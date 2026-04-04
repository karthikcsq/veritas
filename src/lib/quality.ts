import OpenAI from "openai";
import { pool } from "./db";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionMeta {
  id: string;
  order: number;
  type: string;
  prompt: string;
  options: string[] | null;
  config: { scale?: { min: number; max: number; minLabel?: string; maxLabel?: string } } | null;
}

interface ResponseRow {
  questionId: string;
  value: string;
  timeSpentMs: number;
}

export interface ResponseTimeFlag {
  questionId: string;
  prompt: string;
  timeSpentMs: number;
  expectedMinMs: number;
  severity: "warning" | "critical";
  reason: string;
}

export interface ReverseScoreContradiction {
  originalQuestionId: string;
  originalPrompt: string;
  originalValue: string;
  reverseQuestionId: string;
  reversePrompt: string;
  reverseValue: string;
  expectedRelation: string;
  severity: "warning" | "critical";
  explanation: string;
}

export interface StructuredQualityResult {
  enrollmentId: string;
  responseTimeScore: number; // 0-1, higher = better
  responseTimeFlags: ResponseTimeFlag[];
  reverseScoreScore: number; // 0-1, higher = more consistent
  reverseScoreContradictions: ReverseScoreContradiction[];
  overallStructuredScore: number; // 0-1 composite
  flagged: boolean;
  flagReasons: string[];
}

export interface GeneratedReverseItem {
  originalQuestionId: string;
  originalPrompt: string;
  reversePrompt: string;
  reverseType: string;
  reverseOptions: string[] | null;
  reverseConfig: { scale?: { min: number; max: number; minLabel?: string; maxLabel?: string } } | null;
  suggestedOrder: number;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Response Time Analysis
// ---------------------------------------------------------------------------

/** Minimum expected reading + answering time per question type (ms) */
function getExpectedMinTimeMs(question: QuestionMeta): number {
  const promptWords = question.prompt.split(/\s+/).length;
  // Average reading speed: ~250 words/min = ~240ms per word
  const readTimeMs = promptWords * 240;

  switch (question.type) {
    case "SCALE": {
      // Read prompt + scan scale + click
      const scaleRange = question.config?.scale
        ? question.config.scale.max - question.config.scale.min + 1
        : 10;
      // More options = more scan time
      return readTimeMs + Math.max(1500, scaleRange * 150);
    }
    case "MULTIPLE_CHOICE": {
      const optionCount = question.options?.length ?? 4;
      // Read prompt + read each option (~400ms per option) + decide + click
      const optionReadTime = (question.options ?? []).reduce(
        (sum, opt) => sum + opt.split(/\s+/).length * 240,
        0
      );
      return readTimeMs + optionReadTime + 800;
    }
    case "CHECKBOX": {
      const optCount = question.options?.length ?? 4;
      const optReadTime = (question.options ?? []).reduce(
        (sum, opt) => sum + opt.split(/\s+/).length * 240,
        0
      );
      // Checkboxes need more deliberation per item
      return readTimeMs + optReadTime + optCount * 300 + 800;
    }
    case "SHORT_TEXT":
      return readTimeMs + 3000;
    case "LONG_TEXT":
      return readTimeMs + 8000;
    default:
      return readTimeMs + 2000;
  }
}

export function analyzeResponseTimes(
  questions: QuestionMeta[],
  responses: ResponseRow[]
): { score: number; flags: ResponseTimeFlag[] } {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const flags: ResponseTimeFlag[] = [];
  let totalRatio = 0;
  let counted = 0;

  for (const resp of responses) {
    const q = questionMap.get(resp.questionId);
    if (!q) continue;

    const expectedMin = getExpectedMinTimeMs(q);
    const ratio = resp.timeSpentMs / expectedMin;
    totalRatio += Math.min(ratio, 2.0); // cap at 2x so slow readers don't inflate
    counted++;

    if (resp.timeSpentMs < expectedMin * 0.3) {
      flags.push({
        questionId: q.id,
        prompt: q.prompt,
        timeSpentMs: resp.timeSpentMs,
        expectedMinMs: expectedMin,
        severity: "critical",
        reason: `Answered in ${Math.round(resp.timeSpentMs / 1000)}s — expected at least ${Math.round(expectedMin / 1000)}s to read and respond. Likely not reading the question.`,
      });
    } else if (resp.timeSpentMs < expectedMin * 0.6) {
      flags.push({
        questionId: q.id,
        prompt: q.prompt,
        timeSpentMs: resp.timeSpentMs,
        expectedMinMs: expectedMin,
        severity: "warning",
        reason: `Answered in ${Math.round(resp.timeSpentMs / 1000)}s — faster than typical reading speed for this question (${Math.round(expectedMin / 1000)}s minimum).`,
      });
    }
  }

  // Score: what fraction of expected time did they actually spend on average?
  const avgRatio = counted > 0 ? totalRatio / counted : 1;
  // Normalize: 1.0+ ratio = 1.0 score, 0.3 ratio = 0.0 score
  const score = Math.max(0, Math.min(1, (avgRatio - 0.3) / 0.7));

  return { score, flags };
}

// ---------------------------------------------------------------------------
// Reverse-Scored Item Contradiction Detection
// ---------------------------------------------------------------------------

/**
 * Detect pairs of questions where one is semantically the reverse of another,
 * then check if the participant's answers are contradictory.
 *
 * This works by:
 * 1. Finding questions with reverse-implying scale labels (e.g. "Not at all" / "Very much"
 *    vs. questions where high = positive)
 * 2. Using GPT-4o-mini to identify reverse-scored pairs in the study
 * 3. Checking if numeric values are contradictory
 */
export async function detectReverseScoredContradictions(
  questions: QuestionMeta[],
  responses: ResponseRow[]
): Promise<{ score: number; contradictions: ReverseScoreContradiction[] }> {
  const scaleQuestions = questions.filter(
    (q) => q.type === "SCALE" && q.config?.scale
  );

  if (scaleQuestions.length < 2) {
    return { score: 1.0, contradictions: [] };
  }

  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  // Ask GPT-4o-mini to identify reverse-scored pairs
  const questionDescriptions = scaleQuestions
    .map(
      (q) =>
        `[${q.id}] "${q.prompt}" (${q.config!.scale!.min}-${q.config!.scale!.max}, low="${q.config!.scale!.minLabel ?? "low"}", high="${q.config!.scale!.maxLabel ?? "high"}")`
    )
    .join("\n");

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "user",
        content: `You are a psychometrics expert. Given these scale questions from a clinical survey, identify pairs where one question is conceptually the REVERSE of another — meaning a high score on one should correspond to a low score on the other.

QUESTIONS:
${questionDescriptions}

Look for:
- Direct semantic opposites (e.g. "I feel energetic" vs "I feel tired")
- Positive/negative framing of the same construct (e.g. "I enjoy life" vs "I feel that life is meaningless")
- Questions measuring the same dimension but with reversed polarity in their scale labels

ONLY return pairs where the reversal is clear and unambiguous. Do NOT pair questions that are merely related.

Respond ONLY with valid JSON:
{
  "pairs": [
    {
      "questionA": "id of first question",
      "questionB": "id of second question",
      "construct": "what both questions measure",
      "relationship": "brief explanation of the reversal"
    }
  ]
}

If no clear reverse-scored pairs exist, return an empty array.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  const pairs: Array<{
    questionA: string;
    questionB: string;
    construct: string;
    relationship: string;
  }> = result.pairs ?? [];

  if (pairs.length === 0) {
    return { score: 1.0, contradictions: [] };
  }

  const contradictions: ReverseScoreContradiction[] = [];

  for (const pair of pairs) {
    const qA = scaleQuestions.find((q) => q.id === pair.questionA);
    const qB = scaleQuestions.find((q) => q.id === pair.questionB);
    const rA = responseMap.get(pair.questionA);
    const rB = responseMap.get(pair.questionB);

    if (!qA || !qB || !rA || !rB) continue;

    const scaleA = qA.config!.scale!;
    const scaleB = qB.config!.scale!;

    // Normalize both values to 0-1 range
    const normA =
      (Number(rA.value) - scaleA.min) / (scaleA.max - scaleA.min);
    const normB =
      (Number(rB.value) - scaleB.min) / (scaleB.max - scaleB.min);

    // For reverse-scored pairs, normA + normB should be ~1.0
    // If both are high (>0.7) or both are low (<0.3), that's contradictory
    const sum = normA + normB;
    const bothHigh = normA > 0.7 && normB > 0.7;
    const bothLow = normA < 0.3 && normB < 0.3;

    if (bothHigh || bothLow) {
      const severity = Math.abs(sum - 1.0) > 0.8 ? "critical" : "warning";
      contradictions.push({
        originalQuestionId: qA.id,
        originalPrompt: qA.prompt,
        originalValue: rA.value,
        reverseQuestionId: qB.id,
        reversePrompt: qB.prompt,
        reverseValue: rB.value,
        expectedRelation: pair.relationship,
        severity,
        explanation: bothHigh
          ? `Both scored high (${rA.value} and ${rB.value}) on reverse-scored items measuring "${pair.construct}". Expected one high and one low.`
          : `Both scored low (${rA.value} and ${rB.value}) on reverse-scored items measuring "${pair.construct}". Expected one high and one low.`,
      });
    }
  }

  // Score: 1.0 = no contradictions, deduct per contradiction found
  const maxDeduction = pairs.length;
  const deduction = contradictions.reduce(
    (sum, c) => sum + (c.severity === "critical" ? 1.0 : 0.5),
    0
  );
  const score = Math.max(0, 1.0 - deduction / maxDeduction);

  return { score, contradictions };
}

// ---------------------------------------------------------------------------
// Full Structured Quality Analysis
// ---------------------------------------------------------------------------

export async function analyzeStructuredQuality(
  enrollmentId: string
): Promise<StructuredQualityResult> {
  // Fetch questions and responses for this enrollment
  const questionsResult = await pool.query(
    `SELECT q."id", q."order", q."type", q."prompt", q."options", q."config"
     FROM "Question" q
     JOIN "Study" s ON s."id" = q."studyId"
     JOIN "Enrollment" e ON e."studyId" = s."id"
     WHERE e."id" = $1
     ORDER BY q."order"`,
    [enrollmentId]
  );

  const responsesResult = await pool.query(
    `SELECT r."questionId", r."value", r."timeSpentMs"
     FROM "Response" r
     WHERE r."enrollmentId" = $1`,
    [enrollmentId]
  );

  const questions: QuestionMeta[] = questionsResult.rows.map((q) => ({
    id: q.id,
    order: q.order,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    config: q.config,
  }));

  const responses: ResponseRow[] = responsesResult.rows.map((r) => ({
    questionId: r.questionId,
    value: r.value,
    timeSpentMs: r.timeSpentMs,
  }));

  // Run both analyses
  const timeAnalysis = analyzeResponseTimes(questions, responses);
  const reverseAnalysis = await detectReverseScoredContradictions(
    questions,
    responses
  );

  // Composite score: 60% response time, 40% reverse-score consistency
  const overallScore =
    timeAnalysis.score * 0.6 + reverseAnalysis.score * 0.4;

  const flagReasons: string[] = [];
  if (timeAnalysis.score < 0.4) {
    const critCount = timeAnalysis.flags.filter(
      (f) => f.severity === "critical"
    ).length;
    flagReasons.push(
      `Suspiciously fast responses: ${critCount} questions answered far below expected reading time`
    );
  }
  if (reverseAnalysis.score < 0.5) {
    flagReasons.push(
      `Contradictory answers on ${reverseAnalysis.contradictions.length} reverse-scored item pair(s)`
    );
  }

  return {
    enrollmentId,
    responseTimeScore: timeAnalysis.score,
    responseTimeFlags: timeAnalysis.flags,
    reverseScoreScore: reverseAnalysis.score,
    reverseScoreContradictions: reverseAnalysis.contradictions,
    overallStructuredScore: overallScore,
    flagged: overallScore < 0.45,
    flagReasons,
  };
}

// ---------------------------------------------------------------------------
// Auto-Generate Reverse-Scored Attention Check Items
// ---------------------------------------------------------------------------

export async function generateReverseItems(
  studyId: string,
  count: number = 2
): Promise<GeneratedReverseItem[]> {
  const questionsResult = await pool.query(
    `SELECT "id", "order", "type", "prompt", "options", "config"
     FROM "Question"
     WHERE "studyId" = $1
     ORDER BY "order"`,
    [studyId]
  );

  const questions: QuestionMeta[] = questionsResult.rows;

  if (questions.length < 3) {
    return [];
  }

  const questionDescriptions = questions
    .map((q) => {
      let desc = `[Order ${q.order}, ID: ${q.id}] Type: ${q.type} | "${q.prompt}"`;
      if (q.options) desc += ` | Options: ${JSON.stringify(q.options)}`;
      if (q.config?.scale)
        desc += ` | Scale: ${q.config.scale.min}-${q.config.scale.max} (${q.config.scale.minLabel ?? "low"} to ${q.config.scale.maxLabel ?? "high"})`;
      return desc;
    })
    .join("\n");

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "user",
        content: `You are a clinical survey design expert. A researcher has created a survey with the following questions. Generate ${count} reverse-scored attention check question(s) that can be inserted into this survey to detect careless responding.

EXISTING QUESTIONS:
${questionDescriptions}

REQUIREMENTS:
1. Each reverse-scored item should measure the SAME construct as an existing question but with REVERSED polarity
2. Keep the same response format (type, scale range) as the original question it's paired with
3. The reversal should be natural — it should read like a real survey question, not an obvious trap
4. Suggest where in the question order to insert it (not immediately adjacent to the original)
5. A participant answering thoughtfully should give roughly opposite values on the original and reverse items

EXAMPLES OF GOOD REVERSALS:
- Original: "I feel tired" (0-4) → Reverse: "I have energy for daily tasks" (0-4)
- Original: "I feel nervous" (0-3) → Reverse: "I have felt calm and at ease" (0-3)
- Original: "Pain interferes with work" (0-10) → Reverse: "I can carry out work activities despite any discomfort" (0-10)

Respond ONLY with valid JSON:
{
  "items": [
    {
      "originalQuestionId": "id of the question this reverses",
      "originalPrompt": "the original question text",
      "reversePrompt": "your reverse-scored question",
      "reverseType": "SCALE or MULTIPLE_CHOICE",
      "reverseOptions": null or ["option1", ...] for MULTIPLE_CHOICE,
      "reverseConfig": null or {"scale": {"min": 0, "max": 4, "minLabel": "...", "maxLabel": "..."}} for SCALE,
      "suggestedOrder": number (where to insert in the question order),
      "explanation": "Why this reversal works and what construct it tests"
    }
  ]
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 1000,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  return (result.items ?? []) as GeneratedReverseItem[];
}

// ---------------------------------------------------------------------------
// Survey Design Recommendations
// ---------------------------------------------------------------------------

export interface SurveyDesignRecommendation {
  type: "attention_check" | "response_time" | "reverse_score" | "structure";
  severity: "info" | "warning" | "critical";
  message: string;
  suggestion: string;
}

export function analyzeSurveyDesign(
  questions: QuestionMeta[]
): SurveyDesignRecommendation[] {
  const recs: SurveyDesignRecommendation[] = [];

  // Check for reverse-scored items already present
  const scaleQuestions = questions.filter(
    (q) => q.type === "SCALE" && q.config?.scale
  );

  if (scaleQuestions.length >= 5) {
    // Check if any scale labels suggest existing reversals
    const positiveHigh = scaleQuestions.filter((q) => {
      const high = (q.config!.scale!.maxLabel ?? "").toLowerCase();
      return (
        high.includes("very much") ||
        high.includes("extremely") ||
        high.includes("severe") ||
        high.includes("always")
      );
    });
    const positiveHighCount = positiveHigh.length;

    if (positiveHighCount === scaleQuestions.length) {
      recs.push({
        type: "reverse_score",
        severity: "warning",
        message: `All ${scaleQuestions.length} scale questions have the same polarity. There are no reverse-scored items to detect careless responding.`,
        suggestion:
          "Add 1-2 reverse-scored attention check questions. Use the generate-reverse-item API to auto-generate them.",
      });
    }
  }

  // Check total question count for attention check recommendations
  const totalQuestions = questions.length;
  if (totalQuestions >= 10 && totalQuestions < 20) {
    const hasReverseCandidate = questions.some(
      (q) =>
        q.prompt.toLowerCase().includes("attention") ||
        q.prompt.toLowerCase().includes("check")
    );
    if (!hasReverseCandidate) {
      recs.push({
        type: "attention_check",
        severity: "info",
        message: `Survey has ${totalQuestions} questions but no attention checks detected.`,
        suggestion:
          "Consider adding 1 reverse-scored attention check for surveys with 10+ items.",
      });
    }
  } else if (totalQuestions >= 20) {
    recs.push({
      type: "attention_check",
      severity: "warning",
      message: `Survey has ${totalQuestions} questions. Longer surveys have higher rates of careless responding.`,
      suggestion:
        "Strongly recommend adding 2-3 reverse-scored attention checks distributed throughout. Use the generate-reverse-item API.",
    });
  }

  // Check if all questions are the same type (monotony increases careless responding)
  const typeCounts = new Map<string, number>();
  for (const q of questions) {
    typeCounts.set(q.type, (typeCounts.get(q.type) ?? 0) + 1);
  }
  const dominantType = [...typeCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (dominantType && dominantType[1] / totalQuestions > 0.85 && totalQuestions > 5) {
    recs.push({
      type: "structure",
      severity: "info",
      message: `${Math.round((dominantType[1] / totalQuestions) * 100)}% of questions are ${dominantType[0]}. Monotonous formats increase careless responding.`,
      suggestion:
        "Consider mixing in a different question type to maintain engagement.",
    });
  }

  // Response time: warn if there are very short prompts that will have unreliable timing
  const veryShortPrompts = questions.filter(
    (q) => q.prompt.split(/\s+/).length < 4
  );
  if (veryShortPrompts.length > 0) {
    recs.push({
      type: "response_time",
      severity: "info",
      message: `${veryShortPrompts.length} question(s) have very short prompts (< 4 words). Response time analysis is less reliable for very short questions.`,
      suggestion:
        "Short prompts are fine for labeled scales (e.g. 'Fatigue') but consider adding context for ambiguous items.",
    });
  }

  return recs;
}

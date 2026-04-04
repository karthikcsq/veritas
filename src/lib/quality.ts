import OpenAI from "openai";
import { pool, generateId } from "./db";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const MAX_REVERSE_PAIRS = 3;

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
  questionAId: string;
  questionAPrompt: string;
  questionAValue: string;
  questionBId: string;
  questionBPrompt: string;
  questionBValue: string;
  construct: string;
  severity: "warning" | "critical";
  explanation: string;
}

export interface StructuredQualityResult {
  enrollmentId: string;
  responseTimeScore: number;
  responseTimeFlags: ResponseTimeFlag[];
  reverseScoreScore: number;
  reverseScoreContradictions: ReverseScoreContradiction[];
  overallStructuredScore: number;
  flagged: boolean;
  flagReasons: string[];
}

export interface StoredReversePair {
  id: string;
  studyId: string;
  questionAId: string;
  questionBId: string;
  construct: string;
  relationship: string;
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

function getExpectedMinTimeMs(question: QuestionMeta): number {
  const promptWords = question.prompt.split(/\s+/).length;
  const readTimeMs = promptWords * 240;

  switch (question.type) {
    case "SCALE": {
      const scaleRange = question.config?.scale
        ? question.config.scale.max - question.config.scale.min + 1
        : 10;
      return readTimeMs + Math.max(1500, scaleRange * 150);
    }
    case "MULTIPLE_CHOICE": {
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
    totalRatio += Math.min(ratio, 2.0);
    counted++;

    if (resp.timeSpentMs < expectedMin * 0.3) {
      flags.push({
        questionId: q.id,
        prompt: q.prompt,
        timeSpentMs: resp.timeSpentMs,
        expectedMinMs: expectedMin,
        severity: "critical",
        reason: `Answered in ${Math.round(resp.timeSpentMs / 1000)}s — expected at least ${Math.round(expectedMin / 1000)}s to read and respond.`,
      });
    } else if (resp.timeSpentMs < expectedMin * 0.6) {
      flags.push({
        questionId: q.id,
        prompt: q.prompt,
        timeSpentMs: resp.timeSpentMs,
        expectedMinMs: expectedMin,
        severity: "warning",
        reason: `Answered in ${Math.round(resp.timeSpentMs / 1000)}s — faster than typical reading speed (${Math.round(expectedMin / 1000)}s minimum).`,
      });
    }
  }

  const avgRatio = counted > 0 ? totalRatio / counted : 1;
  const score = Math.max(0, Math.min(1, (avgRatio - 0.3) / 0.7));
  return { score, flags };
}

// ---------------------------------------------------------------------------
// #1: Auto-detect reverse pairs on publish (DRAFT → ACTIVE)
// Runs ONCE per study, stores results in ReversePair table
// ---------------------------------------------------------------------------

export async function detectAndStoreReversePairs(studyId: string): Promise<StoredReversePair[]> {
  // Clear any existing pairs for this study (idempotent re-publish)
  await pool.query('DELETE FROM "ReversePair" WHERE "studyId" = $1', [studyId]);

  const questionsResult = await pool.query(
    `SELECT "id", "order", "type", "prompt", "options", "config"
     FROM "Question" WHERE "studyId" = $1 ORDER BY "order"`,
    [studyId]
  );
  const questions: QuestionMeta[] = questionsResult.rows;

  // Only scale questions can be reverse-scored
  const scaleQuestions = questions.filter(
    (q) => q.type === "SCALE" && q.config?.scale
  );

  if (scaleQuestions.length < 2) return [];

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
        content: `You are a psychometrics expert. Given these scale questions from a clinical survey, identify pairs where one question is conceptually the REVERSE of another — a high score on one should correspond to a low score on the other.

QUESTIONS:
${questionDescriptions}

Rules:
- ONLY return pairs where the reversal is clear and unambiguous
- Do NOT pair questions that are merely related or correlated
- Maximum ${MAX_REVERSE_PAIRS} pairs — pick the strongest reversals
- A reverse pair means answering high on BOTH would be a contradiction

Examples of valid reversals:
- "I feel tired" ↔ "I have energy for daily tasks"
- "I feel sad" ↔ "I am able to enjoy life"
- "Pain interferes with my work" ↔ "I can carry out work activities"

Respond ONLY with valid JSON:
{
  "pairs": [
    {
      "questionA": "id of first question",
      "questionB": "id of second question",
      "construct": "the underlying thing both measure (e.g. energy level, mood)",
      "relationship": "one-sentence explanation of why these are reversed"
    }
  ]
}

If no clear reverse-scored pairs exist, return an empty array.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  const pairs: Array<{
    questionA: string;
    questionB: string;
    construct: string;
    relationship: string;
  }> = (result.pairs ?? []).slice(0, MAX_REVERSE_PAIRS);

  // Validate that the question IDs actually exist in this study
  const validIds = new Set(scaleQuestions.map((q) => q.id));
  const validPairs = pairs.filter(
    (p) => validIds.has(p.questionA) && validIds.has(p.questionB)
  );

  const stored: StoredReversePair[] = [];
  for (const pair of validPairs) {
    const id = generateId();
    await pool.query(
      `INSERT INTO "ReversePair" ("id", "studyId", "questionAId", "questionBId", "construct", "relationship", "detectedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("questionAId", "questionBId") DO NOTHING`,
      [id, studyId, pair.questionA, pair.questionB, pair.construct, pair.relationship]
    );
    stored.push({
      id,
      studyId,
      questionAId: pair.questionA,
      questionBId: pair.questionB,
      construct: pair.construct,
      relationship: pair.relationship,
    });
  }

  return stored;
}

// ---------------------------------------------------------------------------
// Check reverse pair contradictions using STORED pairs (no GPT call)
// ---------------------------------------------------------------------------

export function checkReversePairContradictions(
  pairs: StoredReversePair[],
  questions: QuestionMeta[],
  responses: ResponseRow[]
): { score: number; contradictions: ReverseScoreContradiction[] } {
  if (pairs.length === 0) {
    return { score: 1.0, contradictions: [] };
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const contradictions: ReverseScoreContradiction[] = [];

  for (const pair of pairs) {
    const qA = questionMap.get(pair.questionAId);
    const qB = questionMap.get(pair.questionBId);
    const rA = responseMap.get(pair.questionAId);
    const rB = responseMap.get(pair.questionBId);

    if (!qA || !qB || !rA || !rB) continue;
    if (!qA.config?.scale || !qB.config?.scale) continue;

    const scaleA = qA.config.scale;
    const scaleB = qB.config.scale;

    // Normalize to 0-1
    const rangeA = scaleA.max - scaleA.min;
    const rangeB = scaleB.max - scaleB.min;
    if (rangeA === 0 || rangeB === 0) continue;

    const normA = (Number(rA.value) - scaleA.min) / rangeA;
    const normB = (Number(rB.value) - scaleB.min) / rangeB;

    // For a reverse pair: normA + normB should be ~1.0
    // Both high (>0.7) or both low (<0.3) = contradiction
    const bothHigh = normA > 0.7 && normB > 0.7;
    const bothLow = normA < 0.3 && normB < 0.3;

    if (bothHigh || bothLow) {
      const sum = normA + normB;
      const severity = Math.abs(sum - 1.0) > 0.8 ? "critical" : "warning";
      contradictions.push({
        questionAId: qA.id,
        questionAPrompt: qA.prompt,
        questionAValue: rA.value,
        questionBId: qB.id,
        questionBPrompt: qB.prompt,
        questionBValue: rB.value,
        construct: pair.construct,
        severity,
        explanation: bothHigh
          ? `Both scored high (${rA.value} and ${rB.value}) on reverse-scored items measuring "${pair.construct}". Expected one high and one low.`
          : `Both scored low (${rA.value} and ${rB.value}) on reverse-scored items measuring "${pair.construct}". Expected one high and one low.`,
      });
    }
  }

  const maxDeduction = pairs.length;
  const deduction = contradictions.reduce(
    (sum, c) => sum + (c.severity === "critical" ? 1.0 : 0.5),
    0
  );
  const score = Math.max(0, 1.0 - deduction / maxDeduction);

  return { score, contradictions };
}

// ---------------------------------------------------------------------------
// Full Structured Quality Analysis (uses stored pairs — no GPT)
// ---------------------------------------------------------------------------

export async function analyzeStructuredQuality(
  enrollmentId: string
): Promise<StructuredQualityResult> {
  // Fetch study ID for this enrollment
  const enrollRow = await pool.query(
    'SELECT "studyId" FROM "Enrollment" WHERE "id" = $1',
    [enrollmentId]
  );
  if (enrollRow.rows.length === 0) {
    throw new Error(`Enrollment ${enrollmentId} not found`);
  }
  const studyId = enrollRow.rows[0].studyId;

  // Fetch questions, responses, and stored reverse pairs in parallel
  const [questionsResult, responsesResult, pairsResult] = await Promise.all([
    pool.query(
      `SELECT "id", "order", "type", "prompt", "options", "config"
       FROM "Question" WHERE "studyId" = $1 ORDER BY "order"`,
      [studyId]
    ),
    pool.query(
      `SELECT "questionId", "value", "timeSpentMs"
       FROM "Response" WHERE "enrollmentId" = $1`,
      [enrollmentId]
    ),
    pool.query(
      `SELECT "id", "studyId", "questionAId", "questionBId", "construct", "relationship"
       FROM "ReversePair" WHERE "studyId" = $1`,
      [studyId]
    ),
  ]);

  const questions: QuestionMeta[] = questionsResult.rows;
  const responses: ResponseRow[] = responsesResult.rows;
  const pairs: StoredReversePair[] = pairsResult.rows;

  // Response time analysis (pure math, no GPT)
  const timeAnalysis = analyzeResponseTimes(questions, responses);

  // Reverse pair contradiction check (pure math using stored pairs, no GPT)
  const reverseAnalysis = checkReversePairContradictions(pairs, questions, responses);

  // Composite: 60% response time, 40% reverse-score consistency
  const overallScore =
    timeAnalysis.score * 0.6 + reverseAnalysis.score * 0.4;

  const flagReasons: string[] = [];
  if (timeAnalysis.score < 0.4) {
    const critCount = timeAnalysis.flags.filter((f) => f.severity === "critical").length;
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
// #2: Recommend reverse questions during study creation
// Returns up to MAX_REVERSE_PAIRS generated reverse items
// ---------------------------------------------------------------------------

export async function recommendReverseQuestions(
  questions: Array<{ prompt: string; type: string; options?: string[] | null; config?: QuestionMeta["config"] }>
): Promise<GeneratedReverseItem[]> {
  // Only suggest for surveys with 5+ questions
  if (questions.length < 5) return [];

  // Count how many existing questions look like they might already be reverse items
  // (heuristic: if prompts contain opposing sentiment words)
  const existingReverseCount = countLikelyExistingReversals(questions);
  const needed = Math.max(0, Math.min(MAX_REVERSE_PAIRS, 2) - existingReverseCount);

  if (needed === 0) return [];

  const questionDescriptions = questions
    .map((q, i) => {
      let desc = `[Q${i + 1}] Type: ${q.type} | "${q.prompt}"`;
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
        content: `You are a clinical survey design expert. A researcher is creating a survey. Suggest ${needed} reverse-scored question(s) to add as attention checks.

A reverse-scored question measures the SAME thing as an existing question but with OPPOSITE meaning. If someone answers both the same way, they're not reading carefully.

CURRENT QUESTIONS:
${questionDescriptions}

RULES:
- Generate exactly ${needed} reverse-scored question(s)
- Each must clearly reverse one existing question's meaning
- Use the same response format (type, scale) as the original
- Place it away from the original (not adjacent)
- It must read naturally as a real survey question
- Pick the best candidates — questions about subjective feelings/states are ideal for reversal

Respond ONLY with valid JSON:
{
  "items": [
    {
      "originalQuestionId": "Q3",
      "originalPrompt": "the original question text",
      "reversePrompt": "your reverse-scored question",
      "reverseType": "SCALE or MULTIPLE_CHOICE",
      "reverseOptions": null,
      "reverseConfig": null or {"scale": {"min": 0, "max": 4, "minLabel": "...", "maxLabel": "..."}},
      "suggestedOrder": 7,
      "explanation": "One sentence: what construct this checks and how the reversal works"
    }
  ]
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  return ((result.items ?? []) as GeneratedReverseItem[]).slice(0, needed);
}

function countLikelyExistingReversals(
  questions: Array<{ prompt: string }>
): number {
  // Simple heuristic: check if any pair of questions has opposing sentiment
  const positiveWords = ["enjoy", "energy", "able", "satisfied", "well", "calm", "happy", "comfortable"];
  const negativeWords = ["tired", "pain", "sad", "anxious", "difficult", "worry", "afraid", "weak", "meaningless"];

  let positiveCount = 0;
  let negativeCount = 0;
  for (const q of questions) {
    const lower = q.prompt.toLowerCase();
    if (positiveWords.some((w) => lower.includes(w))) positiveCount++;
    if (negativeWords.some((w) => lower.includes(w))) negativeCount++;
  }

  // If both positive and negative sentiment questions exist, some may already be reversals
  return Math.min(positiveCount, negativeCount) > 0 ? 1 : 0;
}

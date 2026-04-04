import OpenAI from "openai";
import { pool, generateId } from "./db";
import type { QuestionType } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ScoringInput {
  question: string;
  answer: string;
  timeSpentMs: number;
  allResponsesInEnrollment: Array<{ question: string; answer: string }>;
}

interface ScoreOutput {
  overallScore: number;
  coherenceScore: number;
  effortScore: number;
  consistencyScore: number;
  flagged: boolean;
  flagReason: string | null;
}

function buildFlaggedScore(reason: string): ScoreOutput {
  return {
    overallScore: 0.1,
    coherenceScore: 0.1,
    effortScore: 0.0,
    consistencyScore: 0.5,
    flagged: true,
    flagReason: reason,
  };
}

function buildScoringPrompt(input: ScoringInput): string {
  const otherResponses = input.allResponsesInEnrollment
    .filter((r) => r.answer !== input.answer)
    .map((r) => `Q: ${r.question}\nA: ${r.answer}`)
    .join("\n\n");

  return `
You are a clinical research data quality assessor. Evaluate the following survey response for quality and authenticity.

QUESTION ASKED:
${input.question}

PARTICIPANT'S ANSWER:
${input.answer}

TIME SPENT ON THIS QUESTION: ${Math.round(input.timeSpentMs / 1000)} seconds

OTHER RESPONSES FROM THIS SAME PARTICIPANT IN THIS STUDY:
${otherResponses || "This is the first response."}

Score this response on each dimension from 0.0 to 1.0:

- coherence: Is the answer logically coherent and relevant to the question?
- effort: Does the answer show genuine engagement rather than minimal effort?
- consistency: Is this answer consistent with the participant's other responses?
- specificity: Does the answer contain specific, personal, concrete detail?

If any score is below 0.4, provide a brief flagReason explaining the concern.

Respond ONLY with valid JSON in this exact shape:
{
  "coherence": 0.0,
  "effort": 0.0,
  "consistency": 0.0,
  "specificity": 0.0,
  "flagReason": null
}
`;
}

export async function scoreResponse(
  input: ScoringInput
): Promise<ScoreOutput> {
  const MIN_TIME_MS = 2000;
  if (input.timeSpentMs < MIN_TIME_MS && input.answer.length > 10) {
    return buildFlaggedScore(
      "Response submitted too quickly to have been read carefully"
    );
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: buildScoringPrompt(input) }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const scores = JSON.parse(completion.choices[0].message.content!);

  const overallScore =
    scores.coherence * 0.3 +
    scores.effort * 0.25 +
    scores.consistency * 0.3 +
    scores.specificity * 0.15;

  const flagged = overallScore < 0.45;

  return {
    overallScore,
    coherenceScore: scores.coherence,
    effortScore: scores.effort,
    consistencyScore: scores.consistency,
    flagged,
    flagReason: flagged ? scores.flagReason : null,
  };
}

// --- Real-time validity checking ---

export interface ValidityResult {
  score: number;
  explanation: string;
}

function buildValidityPrompt(
  question: string,
  answer: string,
  questionType: QuestionType
): string {
  const typeGuidance =
    questionType === "SHORT_TEXT"
      ? "This is a short-answer question. The answer should be a brief, on-topic response."
      : "This is a long-form question. The answer should address the topic with some substance.";

  return `You evaluate whether a survey answer actually responds to the question that was asked.

${typeGuidance}

QUESTION:
${question}

ANSWER:
${answer}

Score the answer's VALIDITY from 0 to 100:
- 0–20: Completely irrelevant. The answer has nothing to do with the question (e.g. random words, copy-paste from elsewhere, answering a totally different question).
- 21–40: Marginally related. Mentions a related topic but does not answer what was asked.
- 41–60: Partially valid. Addresses part of the question but misses key aspects or is vague.
- 61–80: Mostly valid. Clearly responds to the question with minor gaps.
- 81–100: Fully valid. Directly and clearly addresses what the question asked.

Focus ONLY on whether the answer is a genuine attempt to respond to this specific question. Do NOT judge grammar, spelling, depth, or effort — only topical relevance and semantic connection to the question.

Respond ONLY with valid JSON:
{
  "score": 0,
  "explanation": "Brief one-sentence reason for the score"
}`;
}

export async function checkResponseValidity(
  question: string,
  answer: string,
  questionType: QuestionType
): Promise<ValidityResult> {
  if (questionType === "SCALE" || questionType === "MULTIPLE_CHOICE") {
    return { score: 100, explanation: "Structured response — inherently valid." };
  }

  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    return { score: 0, explanation: "Empty response." };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: buildValidityPrompt(question, trimmed, questionType),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 150,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  const score = Math.max(0, Math.min(100, Math.round(result.score)));

  return {
    score,
    explanation: result.explanation ?? "No explanation provided.",
  };
}

// --- Contradiction detection across all responses ---

export interface ContradictionResult {
  score: number;
  contradictions: Array<{
    questionA: string;
    answerA: string;
    questionB: string;
    answerB: string;
    explanation: string;
  }>;
  summary: string;
}

function buildContradictionPrompt(
  responses: Array<{ question: string; answer: string }>
): string {
  const formatted = responses
    .map((r, i) => `[${i + 1}] Q: ${r.question}\n    A: ${r.answer}`)
    .join("\n\n");

  return `You are a clinical research data quality assessor. Analyze the following set of survey responses from a single participant and identify any logical contradictions between answers.

PARTICIPANT'S RESPONSES:
${formatted}

Score the overall CONTRADICTION level from 0 to 100:
- 0–10: No contradictions. All answers are consistent with each other.
- 11–30: Minor inconsistencies. Small discrepancies that could be explained by imprecise wording.
- 31–60: Moderate contradictions. Some answers conflict in ways that raise questions about accuracy.
- 61–80: Significant contradictions. Multiple answers directly conflict with each other.
- 81–100: Extreme contradictions. Answers are fundamentally incompatible, suggesting careless or fabricated responses.

Look for:
- Factual contradictions (e.g. "I've never taken medication" vs "I take ibuprofen daily")
- Logical impossibilities (e.g. rating pain 1/10 but describing it as "unbearable" in text)
- Inconsistent timelines or frequencies
- Scale ratings that contradict free-text descriptions

Do NOT flag:
- Nuanced or complex answers that appear contradictory at first glance but are actually reasonable
- Differences in detail level between answers
- Opinions that evolved across questions

Respond ONLY with valid JSON:
{
  "score": 0,
  "contradictions": [
    {
      "questionA": "the first question",
      "answerA": "the first answer",
      "questionB": "the conflicting question",
      "answerB": "the conflicting answer",
      "explanation": "Brief explanation of the contradiction"
    }
  ],
  "summary": "One-sentence overall assessment"
}

If there are no contradictions, return an empty array for "contradictions".`;
}

export async function checkContradictions(
  responses: Array<{ question: string; answer: string }>
): Promise<ContradictionResult> {
  if (responses.length < 2) {
    return {
      score: 0,
      contradictions: [],
      summary: "Not enough responses to check for contradictions.",
    };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: buildContradictionPrompt(responses),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 800,
  });

  const result = JSON.parse(completion.choices[0].message.content!);
  const score = Math.max(0, Math.min(100, Math.round(result.score)));

  return {
    score,
    contradictions: result.contradictions ?? [],
    summary: result.summary ?? "No summary provided.",
  };
}

export async function triggerScoringPipeline(
  enrollmentId: string,
  responseIds: string[]
) {
  // Fetch responses with their question prompts
  const responsesResult = await pool.query(
    `SELECT r."id", r."value", r."timeSpentMs", q."prompt"
    FROM "Response" r
    JOIN "Question" q ON q."id" = r."questionId"
    WHERE r."id" = ANY($1)`,
    [responseIds]
  );

  const responses = responsesResult.rows;

  const allResponses = responses.map((r) => ({
    question: r.prompt,
    answer: r.value,
  }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const response of responses) {
      const score = await scoreResponse({
        question: response.prompt,
        answer: response.value,
        timeSpentMs: response.timeSpentMs,
        allResponsesInEnrollment: allResponses,
      });

      const scoreId = generateId();
      await client.query(
        'INSERT INTO "QualityScore" ("id", "responseId", "overallScore", "coherenceScore", "effortScore", "consistencyScore", "flagged", "flagReason", "scoredAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
        [scoreId, response.id, score.overallScore, score.coherenceScore, score.effortScore, score.consistencyScore, score.flagged, score.flagReason]
      );
    }

    // Check average score to determine enrollment status
    const scoresResult = await client.query(
      `SELECT qs."overallScore"
      FROM "QualityScore" qs
      JOIN "Response" r ON r."id" = qs."responseId"
      WHERE r."enrollmentId" = $1`,
      [enrollmentId]
    );
    const allScores = scoresResult.rows;
    const avgScore =
      allScores.reduce((sum, s) => sum + parseFloat(s.overallScore), 0) / allScores.length;

    if (avgScore < 0.5) {
      await client.query(
        'UPDATE "Enrollment" SET "status" = $1 WHERE "id" = $2',
        ["FLAGGED", enrollmentId]
      );
    } else {
      await client.query(
        'UPDATE "Enrollment" SET "status" = $1, "completedAt" = NOW() WHERE "id" = $2',
        ["COMPLETED", enrollmentId]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

import OpenAI from "openai";
import { pool, generateId } from "./db";
import { analyzeSimilarity } from "./similarity";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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

  const completion = await getOpenAI().chat.completions.create({
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

async function checkQuestionSimilarityThreshold(
  enrollmentId: string,
  client: any
): Promise<boolean> {
  // Get all questions answered by this enrollment with their similarity scores
  const questionsResult = await client.query(
    `SELECT DISTINCT r."questionId", qs."similarityScore"
     FROM "Response" r
     LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
     WHERE r."enrollmentId" = $1`,
    [enrollmentId]
  );

  const questions = questionsResult.rows;
  if (questions.length === 0) return true;

  // Count how many questions have similarity >= 0.9
  const questionsWithHighSimilarity = questions.filter((q: any) => 
    q.similarityScore !== null && q.similarityScore >= 0.9
  ).length;

  const percentageHighSimilarity = questionsWithHighSimilarity / questions.length;

  console.log(
    `[similarity-threshold] ${questionsWithHighSimilarity}/${questions.length} questions (${(percentageHighSimilarity * 100).toFixed(1)}%) have >= 90% similarity`
  );

  // Flag if 70% or more questions have 90%+ similarity
  if (percentageHighSimilarity >= 0.7) {
    console.log(
      `[similarity-threshold] Enrollment ${enrollmentId}: flagged (${(percentageHighSimilarity * 100).toFixed(1)}% >= 70%)`
    );
    return false;
  }

  return true; // Enrollment passed similarity threshold
}

export async function triggerScoringPipeline(
  enrollmentId: string,
  responseIds: string[]
) {
  // Fetch responses with question prompts, questionId, and studyId
  const responsesResult = await pool.query(
    `SELECT r."id", r."value", r."timeSpentMs", r."questionId",
            q."prompt", e."studyId"
     FROM "Response" r
     JOIN "Question" q  ON q."id" = r."questionId"
     JOIN "Enrollment" e ON e."id" = r."enrollmentId"
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
      // ── 1. Quality scoring (existing) ─────────────────────────────
      const score = await scoreResponse({
        question: response.prompt,
        answer: response.value,
        timeSpentMs: response.timeSpentMs,
        allResponsesInEnrollment: allResponses,
      });

      // ── 2. RAG similarity analysis (new) ──────────────────────────
      // Runs outside the DB transaction so a Pinecone failure doesn't
      // roll back the quality scores.
      let simScore: number | null = null;
      let simReason: string | null = null;
      try {
        const sim = await analyzeSimilarity({
          responseId: response.id,
          questionId: response.questionId,
          enrollmentId,
          studyId: response.studyId,
          questionPrompt: response.prompt,
          responseText: response.value,
        });
        if (sim) {
          simScore = sim.similarityScore;
          simReason = sim.similarityReason;
        }
      } catch (err) {
        console.error("[similarity] pipeline error (non-fatal):", err);
      }

      // ── 3. Persist both scores ─────────────────────────────────────
      const scoreId = generateId();
      await client.query(
        `INSERT INTO "QualityScore"
           ("id", "responseId", "overallScore", "coherenceScore", "effortScore",
            "consistencyScore", "similarityScore", "flagged", "flagReason",
            "similarityReason", "scoredAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())`,
        [
          scoreId,
          response.id,
          score.overallScore,
          score.coherenceScore,
          score.effortScore,
          score.consistencyScore,
          simScore,
          score.flagged,
          score.flagReason,
          simReason,
        ]
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

    // Check if question-level similarity threshold is met
    const similarityThresholdPassed = await checkQuestionSimilarityThreshold(
      enrollmentId,
      client
    );

    if (avgScore < 0.5 || !similarityThresholdPassed) {
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

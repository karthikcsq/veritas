import OpenAI from "openai";
import { prisma } from "./prisma";

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

export async function triggerScoringPipeline(
  enrollmentId: string,
  responseIds: string[]
) {
  const responses = await prisma.response.findMany({
    where: { id: { in: responseIds } },
    include: { question: true },
  });

  const allResponses = responses.map((r) => ({
    question: r.question.prompt,
    answer: r.value,
  }));

  for (const response of responses) {
    const score = await scoreResponse({
      question: response.question.prompt,
      answer: response.value,
      timeSpentMs: response.timeSpentMs,
      allResponsesInEnrollment: allResponses,
    });

    await prisma.qualityScore.create({
      data: {
        responseId: response.id,
        overallScore: score.overallScore,
        coherenceScore: score.coherenceScore,
        effortScore: score.effortScore,
        consistencyScore: score.consistencyScore,
        flagged: score.flagged,
        flagReason: score.flagReason,
      },
    });
  }

  // Flag enrollment if average score is below threshold
  const scores = await prisma.qualityScore.findMany({
    where: { response: { enrollmentId } },
  });
  const avgScore =
    scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;

  if (avgScore < 0.5) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "FLAGGED" },
    });
  } else {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
}

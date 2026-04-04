import OpenAI from "openai";
import { embedText } from "./embeddings";
import { upsertResponseVector, queryNeighbors, type Neighbor } from "./pinecone";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimilarityInput {
  responseId: string;
  questionId: string;
  enrollmentId: string;
  studyId: string;
  questionPrompt: string;
  responseText: string;
  /** How many neighbours to retrieve (default: 5) */
  k?: number;
}

export interface SimilarityResult {
  /** 0–1. How typical this response is relative to stored neighbours.
   *  1.0 on the very first response (no baseline yet). */
  similarityScore: number;
  /** GPT's explanation when the score is low; null otherwise. */
  similarityReason: string | null;
  /** Number of neighbours that were found and used as context. */
  neighborCount: number;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  question: string,
  newResponse: string,
  neighbors: Neighbor[]
): string {
  const neighborBlock = neighbors
    .map(
      (n, i) =>
        `[${i + 1}] (cosine similarity ${n.cosineSimilarity.toFixed(3)})\n"${n.text}"`
    )
    .join("\n\n");

  return `\
You are a research data-quality analyst evaluating a survey response.

QUESTION
--------
${question}

SEMANTICALLY SIMILAR RESPONSES FROM OTHER PARTICIPANTS
(retrieved by k-nearest-neighbour vector search — most similar first)
----------------------------------------------------------------------
${neighborBlock}

NEW RESPONSE TO EVALUATE
------------------------
"${newResponse}"

Task
----
Compare the NEW RESPONSE to the retrieved neighbours and score how semantically
similar and topically consistent it is with the established response pattern.

Scoring guide reference (0.0 – 1.0):
  1.0  Highly similar — Exactly identical to at least one neighbor.
  0.75 Very similar - Exact same flow, some very similar wording.  
  0.5  Moderately similar — same topics mentinoed with same flow, wording is different
  0.0  Dissimilar — completely unique topic, wording unlike any of its neighbors.

Rules:
- Focus on *semantic content*, not writing style.
- If the new response is the only one so far (neighbours list is empty),
  return { "similarityScore": 1.0, "reason": null }.
- Only provide a "reason" when the score is below 0.5; otherwise set it to null.
- Respond ONLY with valid JSON matching the schema below — no extra keys.

{
  "similarityScore": 0.0,
  "reason": null
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Full RAG similarity pipeline for a single survey response:
 *   1. Embed the response text.
 *   2. Query Pinecone for the k nearest neighbours for the same question.
 *   3. Upsert this response's vector (after querying to avoid self-match).
 *   4. If neighbours exist, call GPT-4o to score semantic similarity.
 *   5. Return the score + optional explanation.
 *
 * Returns null (and skips silently) when PINECONE_API_KEY is not set,
 * so the rest of the scoring pipeline keeps working without a vector DB.
 */
export async function analyzeSimilarity(
  input: SimilarityInput
): Promise<SimilarityResult | null> {
  // Graceful no-op when Pinecone is not configured
  if (!process.env.PINECONE_API_KEY) {
    console.warn(
      "[similarity] PINECONE_API_KEY not set — skipping similarity analysis"
    );
    return null;
  }

  const {
    responseId,
    questionId,
    enrollmentId,
    studyId,
    questionPrompt,
    responseText,
    k = 5,
  } = input;

  // 1. Embed the new response
  const embedding = await embedText(responseText);

  // 2. Retrieve k nearest neighbours BEFORE upserting so we don't match ourselves
  const neighbors = await queryNeighbors(questionId, embedding, k, responseId);

  // 3. Upsert this vector into Pinecone for future comparisons
  await upsertResponseVector(responseId, embedding, {
    questionId,
    enrollmentId,
    studyId,
    responseText,
    questionPrompt,
  });

  // 4. No neighbours yet — first response for this question, nothing to compare
  if (neighbors.length === 0) {
    return { similarityScore: 1.0, similarityReason: null, neighborCount: 0 };
  }

  // 5. Ask GPT-4o to evaluate similarity in the context of the neighbours
  const prompt = buildPrompt(questionPrompt, responseText, neighbors);
  console.log("\n[similarity] ── Prompt sent to GPT-4o ─────────────────────\n" + prompt + "\n────────────────────────────────────────────────────────────\n");
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const parsed = JSON.parse(completion.choices[0].message.content!);

  const similarityScore: number = Math.max(
    0,
    Math.min(1, parsed.similarityScore ?? 0.5)
  );

  return {
    similarityScore,
    similarityReason:
      similarityScore < 0.5 ? (parsed.reason ?? null) : null,
    neighborCount: neighbors.length,
  };
}

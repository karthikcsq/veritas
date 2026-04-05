import { Pinecone } from "@pinecone-database/pinecone";

// ── Configuration ─────────────────────────────────────────────────────────────
// Set PINECONE_API_KEY in your .env file.
// Set PINECONE_INDEX to the name of your index (default: "veritas-responses").
//
// Index settings to use when creating in the Pinecone dashboard:
//   Dimensions : 1024   (text-embedding-3-small with dimensions: 1024)
//   Metric     : cosine
//   Cloud      : AWS  |  Region: us-east-1  (free tier)
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_NAME = process.env.PINECONE_INDEX ?? "veritas-responses";

function getPinecone(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

// Lazy singleton so the client is only initialised once per process
let _index: ReturnType<Pinecone["index"]> | null = null;
function getIndex() {
  if (!_index) {
    _index = getPinecone().index(INDEX_NAME);
  }
  return _index;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResponseMetadata {
  questionId: string;
  enrollmentId: string;
  studyId: string;
  responseText: string;
  questionPrompt: string;
  [key: string]: string; // satisfies RecordMetadata index signature
}

export interface Neighbor {
  id: string;
  text: string;
  cosineSimilarity: number;
}

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Store (or overwrite) a response vector in Pinecone.
 * Uses the v4 SDK shape: upsert({ records: [...] })
 */
export async function upsertResponseVector(
  responseId: string,
  values: number[],
  metadata: ResponseMetadata
): Promise<void> {
  await getIndex().upsert({
    records: [{ id: responseId, values, metadata }],
  });
}

/**
 * Return the k most similar responses for the same question.
 * Excludes the vector whose id equals excludeId (the response just embedded)
 * so a response is never its own nearest neighbour.
 */
export async function queryNeighbors(
  questionId: string,
  queryVector: number[],
  k: number = 5,
  excludeId?: string
): Promise<Neighbor[]> {
  const result = await getIndex().query({
    vector: queryVector,
    topK: k + (excludeId ? 1 : 0),
    filter: { questionId: { $eq: questionId } },
    includeMetadata: true,
  });

  return result.matches
    .filter((m) => m.id !== excludeId)
    .slice(0, k)
    .map((m) => ({
      id: m.id,
      text: (m.metadata as unknown as ResponseMetadata)?.responseText ?? "",
      cosineSimilarity: m.score ?? 0,
    }));
}

/**
 * Remove a response vector — call this if a response is hard-deleted.
 */
export async function deleteResponseVector(responseId: string): Promise<void> {
  await getIndex().deleteOne({ id: responseId });
}

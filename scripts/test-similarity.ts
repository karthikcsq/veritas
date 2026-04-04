/**
 * Manual test for the RAG similarity pipeline.
 *
 * Usage:
 *   npx tsx scripts/test-similarity.ts
 *
 * What it does:
 *   1. Embeds a few fake survey responses via OpenAI
 *   2. Upserts them into Pinecone
 *   3. Embeds a new "test" response and queries for neighbours
 *   4. Calls GPT-4o to score similarity
 *   5. Prints the result
 */

import "dotenv/config";
import { embedText } from "../src/lib/embeddings";
import { upsertResponseVector, queryNeighbors, deleteResponseVector } from "../src/lib/pinecone";
import { analyzeSimilarity } from "../src/lib/similarity";

// ── Fake data ─────────────────────────────────────────────────────────────────

const QUESTION_ID  = "test-q1";
const QUESTION     = "Describe how your chronic pain affects your daily activities.";

// A few "baseline" responses that already exist in the study
const EXISTING_RESPONSES = [
  {
    id: "test-existing-1",
    text: "My lower back pain makes it very hard to sit at my desk for more than 20 minutes. I have to stand up and stretch constantly, which disrupts my concentration at work.",
  },
  {
    id: "test-existing-2",
    text: "Getting out of bed every morning takes about 10 minutes because of the stiffness. I've had to stop hiking and cycling, which I used to love.",
  },
  {
    id: "test-existing-3",
    text: "The pain is worst at night. I wake up 2-3 times and have to reposition myself. I'm exhausted during the day and have reduced my working hours.",
  },
];

// Two "new" responses — one authentic-looking, one that looks like AI filler
const AUTHENTIC_RESPONSE = {
  id: "test-new-authentic",
  text: "I can no longer carry groceries with my left arm because of the shoulder pain. Even typing this message is uncomfortable after a few minutes.",
};

const SUSPICIOUS_RESPONSE = {
  id: "test-new-suspicious",
  text: "Chronic pain is a multifaceted condition that impacts many aspects of daily life, including physical, psychological, and social dimensions of human well-being.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(msg: string) { console.log("  ✓", msg); }
function fail(msg: string) { console.error("  ✗", msg); }
function section(title: string) { console.log(`\n── ${title} ${"─".repeat(Math.max(2, 60 - title.length))}`); }

// ── Test runner ───────────────────────────────────────────────────────────────

async function run() {
  console.log("Veritas · Similarity pipeline test");
  console.log("====================================\n");

  // ── Step 1: Embed a single text ──────────────────────────────────────────
  section("Step 1: OpenAI embeddings");
  const sampleEmbedding = await embedText("hello world");
  if (sampleEmbedding.length === 1024) {
    pass(`Embedding produced — ${sampleEmbedding.length} dimensions`);
  } else {
    fail(`Unexpected dimensions: ${sampleEmbedding.length} (expected 1024)`);
    process.exit(1);
  }

  // ── Step 2: Upsert baseline vectors ─────────────────────────────────────
  section("Step 2: Upsert existing responses into Pinecone");
  for (const r of EXISTING_RESPONSES) {
    const vec = await embedText(r.text);
    await upsertResponseVector(r.id, vec, {
      questionId:    QUESTION_ID,
      enrollmentId:  "test-enrollment",
      studyId:       "test-study",
      responseText:  r.text,
      questionPrompt: QUESTION,
    });
    pass(`Upserted ${r.id}`);
  }

  // Allow Pinecone a moment to index (serverless is near-instant, but just in case)
  await new Promise((r) => setTimeout(r, 1500));

  // ── Step 3: Query neighbours ─────────────────────────────────────────────
  section("Step 3: Query neighbours for authentic response");
  const authVec = await embedText(AUTHENTIC_RESPONSE.text);
  const neighbors = await queryNeighbors(QUESTION_ID, authVec, 3);
  if (neighbors.length > 0) {
    pass(`Found ${neighbors.length} neighbour(s)`);
    neighbors.forEach((n, i) =>
      console.log(`     [${i + 1}] score=${n.cosineSimilarity.toFixed(3)}  "${n.text.slice(0, 60)}..."`)
    );
  } else {
    fail("No neighbours returned — check your Pinecone index name and filter");
  }

  // ── Step 4: Full pipeline — authentic response ───────────────────────────
  section("Step 4: Full analyzeSimilarity — authentic response");
  const authResult = await analyzeSimilarity({
    responseId:     AUTHENTIC_RESPONSE.id,
    questionId:     QUESTION_ID,
    enrollmentId:   "test-enrollment",
    studyId:        "test-study",
    questionPrompt: QUESTION,
    responseText:   AUTHENTIC_RESPONSE.text,
    k: 3,
  });
  if (authResult) {
    console.log(`  Score       : ${authResult.similarityScore.toFixed(3)}`);
    console.log(`  Reason      : ${authResult.similarityReason ?? "(none — score is fine)"}`);
    console.log(`  Neighbours  : ${authResult.neighborCount}`);
    authResult.similarityScore >= 0.5
      ? pass("Authentic response scored >= 0.5 as expected")
      : fail(`Unexpected low score for authentic response: ${authResult.similarityScore}`);
  } else {
    fail("analyzeSimilarity returned null — is PINECONE_API_KEY set?");
  }

  // ── Step 5: Full pipeline — suspicious (AI-like) response ───────────────
  section("Step 5: Full analyzeSimilarity — suspicious (AI-like) response");
  const suspResult = await analyzeSimilarity({
    responseId:     SUSPICIOUS_RESPONSE.id,
    questionId:     QUESTION_ID,
    enrollmentId:   "test-enrollment",
    studyId:        "test-study",
    questionPrompt: QUESTION,
    responseText:   SUSPICIOUS_RESPONSE.text,
    k: 3,
  });
  if (suspResult) {
    console.log(`  Score       : ${suspResult.similarityScore.toFixed(3)}`);
    console.log(`  Reason      : ${suspResult.similarityReason ?? "(none)"}`);
    console.log(`  Neighbours  : ${suspResult.neighborCount}`);
    suspResult.similarityScore < 0.5
      ? pass("Suspicious response correctly scored < 0.5")
      : console.log("  ℹ  Score >= 0.5 — GPT judged it acceptable (results may vary)");
  } else {
    fail("analyzeSimilarity returned null");
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  section("Cleanup: removing test vectors from Pinecone");
  const allTestIds = [
    ...EXISTING_RESPONSES.map((r) => r.id),
    AUTHENTIC_RESPONSE.id,
    SUSPICIOUS_RESPONSE.id,
  ];
  for (const id of allTestIds) {
    await deleteResponseVector(id);
    pass(`Deleted ${id}`);
  }

  console.log("\n✅  All steps completed.\n");
}

run().catch((err) => {
  console.error("\n❌  Test failed:", err);
  process.exit(1);
});

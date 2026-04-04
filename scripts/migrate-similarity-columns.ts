/**
 * Adds the two similarity columns to QualityScore.
 * Run once:  npx tsx scripts/migrate-similarity-columns.ts
 */

import "dotenv/config";
import { pool } from "../src/lib/db";
console.log(process.env.DATABASE_URL);

async function run() {
  await pool.query(`
    ALTER TABLE "QualityScore"
      ADD COLUMN IF NOT EXISTS "similarityScore"  DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "similarityReason" TEXT;
  `);
  console.log('✓ Columns added (or already existed).');
  await pool.end();
}

run().catch((err) => { console.error(err); process.exit(1); });

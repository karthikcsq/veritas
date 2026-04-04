# Veritas

Clinical research participant verification platform combining World ID proof-of-personhood with ML-powered response quality scoring.

## Tech Stack
- Next.js 14 (App Router), React 19, Tailwind CSS, shadcn/ui
- PostgreSQL via Supabase (raw SQL with `pg` pool — NO Prisma ORM)
- OpenAI GPT-4o for response quality scoring
- World ID (@worldcoin/idkit) for participant verification

## Database
- **NO PRISMA**. All database operations use raw SQL via `pg` Pool in `src/lib/db.ts`.
- `prisma/schema.prisma` exists as a schema reference only — do NOT run `prisma generate` or `prisma migrate`.
- Migrations are applied via Supabase MCP (`mcp__supabase__apply_migration`) with raw SQL.
- Project ID: `lcyaoieafzjccojcyncd`

## Key Patterns
- API routes use raw SQL queries with parameterized values (`$1`, `$2`, etc.)
- Auth via NextAuth.js with credentials + World ID providers
- Quality scoring dimensions: coherence (30%), effort (25%), consistency (30%), specificity (15%)

<p align="center">
  <img src="public/logo.png" alt="Veritas" width="80" height="80" />
</p>

<h1 align="center">Veritas</h1>

<p align="center">
  <strong>Cryptographic proof-of-personhood with AI-powered quality scoring to eliminate fraud from clinical research.</strong>
</p>

<p align="center">
  <a href="https://veritas-kasm.vercel.app">Live Demo</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#getting-started">Getting Started</a>
</p>

---

## The Problem

The global clinical trials market is worth over $80 billion. A single failed Phase III trial costs around $350 million. An estimated 4% of trial volunteers are "professional patients" who fabricate or exaggerate symptoms for compensation, and a Nature investigation found that up to one quarter of clinical trials in some fields may be problematic or entirely fabricated.

A Harvard research team caught ten fake HIV patients in their trial. People were wearing wigs on video calls to avoid being recognized from previous sign-ups. A separate Alzheimer's study lost 40% of its data to participants who didn't have Alzheimer's.

The best fraud prevention tool most researchers have today is an attention check question: "Select Strongly Agree to prove you're reading this."

## The Solution

Veritas combines **World ID proof-of-personhood** with a **multi-dimensional AI quality scoring pipeline** to give researchers clean, trustworthy data.

- Each participant cryptographically proves they are a unique human before answering a single question
- Every response is scored across coherence, effort, consistency, and specificity
- Researchers see per-enrollment quality breakdowns in a live analytics dashboard

---

## Features

### For Researchers

- **Study Builder**: create surveys with 5 question types (scale, multiple choice, checkbox, short text, long text), conditional logic, and dependency chains
- **AI Question Analysis**: automatic specificity scoring compares your questions against validated clinical instruments (PHQ-9, GAD-7, BPI) and suggests improvements
- **Reverse-Scored Pair Detection**: automatically identifies psychometric reverse pairs when a study is published, enabling contradiction detection without manual tagging
- **Live Analytics Dashboard**: 6 specialized tabs:
  - **Overview**: quality distribution, enrollment trends, dimension score gauges
  - **Integrity**: per-enrollment scores with drill-down into individual responses
  - **Linguistic**: text analysis of response content and patterns
  - **Behavior**: response timing analysis and suspicious speed flags
  - **Questions**: per-question metrics, response rates, and quality breakdown
  - **Geographic**: participant distribution
- **Study Lifecycle**: Draft → Active → Closed with one-click transitions

### For Participants

- **World ID Verification**: prove you're a unique human with a single scan, no personal information stored
- **Clean Survey Experience**: one question at a time with progress tracking and automatic time measurement
- **Real-Time Validity Feedback**: nudges when an answer doesn't address the question, with the option to keep your response
- **Compensation Tracking**: clear visibility into study compensation and completion status

---

## How It Works

### Quality Scoring Pipeline

When a participant submits responses, Veritas runs a multi-stage scoring pipeline:

```
Submission → LLM Quality Scoring → Similarity Analysis → Structured Analysis → Final Verdict
```

**Stage 1: LLM Quality Scoring** (per response)
| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Coherence | 30% | Is the answer logically meaningful and on-topic? |
| Effort | 25% | Does it show genuine engagement beyond minimal effort? |
| Consistency | 30% | Does it align with the participant's other responses? |
| Specificity | 15% | Does it contain concrete, personal detail? |

**Stage 2: RAG Similarity Analysis** (optional, for text responses)
- Embeds each response using `text-embedding-3-small`
- Queries nearest neighbors in Pinecone for the same question
- GPT-4o scores semantic similarity to detect copied or templated answers

**Stage 3: Structured Analysis** (pure math, no LLM)
- **Response time scoring**: calculates expected reading + answering time per question type, flags suspiciously fast completions
- **Reverse-pair contradiction detection**: checks if both items in a reverse-scored pair received the same polarity (both high or both low)

**Final Score**: 50% average LLM scores + 50% structured analysis. Enrollments scoring below 0.5 are automatically flagged.

### World ID Integration

```
Participant → World ID Orb Scan → ZK Proof Generated → Backend Verification → Enrollment Created
```

- Each study has a unique action string (`study_enrollment_{id}`)
- The nullifier hash is globally unique per person per action
- A person can enroll in multiple studies but **never the same study twice**
- Enforced cryptographically

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4.2, shadcn/ui, custom glass morphism |
| **Database** | PostgreSQL via Supabase (raw SQL with `pg` Pool) |
| **Auth** | NextAuth.js (Credentials + World ID providers) |
| **Identity** | World ID (@worldcoin/idkit) — zero-knowledge proof-of-personhood |
| **AI Scoring** | OpenAI GPT-4o (quality scoring), GPT-5.4-mini (validation, reverse pairs) |
| **Embeddings** | OpenAI text-embedding-3-small + Pinecone vector DB |
| **Visualization** | Recharts, Three.js + React Three Fiber, custom GLSL shaders |
| **Deployment** | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── studies/           # Study CRUD, analytics, reverse pairs, specificity
│   │   ├── enrollments/       # Response submission + scoring pipeline
│   │   ├── validate-response/ # Real-time validity checking
│   │   ├── verify-proof/      # World ID proof verification
│   │   └── participant/       # Participant auth
│   ├── dashboard/             # Researcher dashboard + study detail
│   ├── study/                 # Participant-facing enrollment + survey
│   └── page.tsx               # Landing page
│
├── components/
│   ├── analytics/             # 6 dashboard tabs (overview, integrity, etc.)
│   ├── ui/                    # shadcn/ui primitives
│   └── *.tsx                  # Visual effects (globe, shaders, aurora)
│
├── lib/
│   ├── db.ts                  # PostgreSQL connection pool
│   ├── auth.ts                # NextAuth configuration
│   ├── scorer.ts              # LLM quality scoring pipeline
│   ├── quality.ts             # Structured analysis (timing, reverse pairs, specificity)
│   ├── similarity.ts          # RAG similarity via Pinecone
│   └── embeddings.ts          # OpenAI embedding wrapper
│
└── types/
    └── index.ts               # Shared type definitions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- World ID developer account
- OpenAI API key

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Auth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# World ID
NEXT_PUBLIC_WORLD_APP_ID="app_..."
WORLD_RP_ID="rp_..."
RP_SIGNING_KEY="0x..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Pinecone (optional — similarity analysis disabled if unset)
PINECONE_API_KEY="..."
PINECONE_INDEX="veritas-responses"
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Accounts

For quick testing without World ID:

| Role | Email | Password |
|------|-------|----------|
| Researcher | `researcher@demo.veritas` | `demo123` |
| Participant | `participant@demo.veritas` | `demo123` |

---

## Database

All database operations use raw SQL via the `pg` driver. The `prisma/schema.prisma` file exists as a **schema reference only**. Prisma ORM is not used. Migrations are applied directly via Supabase.

### Core Tables

| Table | Purpose |
|-------|---------|
| `Researcher` | Researcher accounts (email/password or World ID) |
| `Study` | Survey definitions with status lifecycle |
| `Question` | Questions with type, config, conditional dependencies |
| `Participant` | Unique participants identified by World ID nullifier |
| `Enrollment` | Links participant to study with verification status |
| `Response` | Individual answers with time tracking |
| `QualityScore` | Per-response AI quality scores (coherence, effort, etc.) |
| `ReversePair` | Auto-detected psychometric reverse-scored pairs |

---

<p align="center">
  Built with <a href="https://worldcoin.org/world-id">World ID</a> and <a href="https://openai.com">OpenAI</a>
</p>

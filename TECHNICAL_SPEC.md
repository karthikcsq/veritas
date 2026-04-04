# VeritasResearch — Technical Specification

> Clinical research participant verification platform combining World ID proof-of-personhood with ML-powered response quality scoring.

---

## Team Roles — Pick Your Track

Read the four descriptions below and claim the one that fits your skills and interests. Once all four are claimed, jump to Section 8 for the detailed breakdown of your responsibilities and the build order.

---

**Track A — Backend & ML (Project Lead / Already Assigned)**
You are building the engine of the product. This means the database, the API layer that everyone else builds against, and the ML response quality scorer — the core technical differentiator of the whole project. You will be the most critical dependency for the rest of the team, so your first job in hour one is to publish the API contracts so everyone else can start in parallel. Heavy lifting, highest impact.
*Skills needed: Node.js / TypeScript, database design, LLM API calls, async pipelines.*

---

**Track B — Researcher Dashboard**
You are building the product that the paying customer sees. This is the study builder where researchers create surveys, and the live dashboard where they watch enrollments come in, see quality scores appear in real time, and identify flagged participants. You also own the before/after demo visualization — the single most important slide in the presentation. If the demo moment lands, it's largely because of what you built.
*Skills needed: React / Next.js, data visualization, UI/UX sensibility.*

---

**Track C — Participant Experience**
You are building everything a study participant touches. The enrollment page where they learn about the study, the World ID verification flow, the question-by-question survey interface, and the submission confirmation. This needs to feel clean and trustworthy — participants need to feel comfortable going through World ID verification, which means the UX has to be reassuring, not intimidating.
*Skills needed: React / Next.js, form handling, frontend UX.*

---

**Track D — World ID Integration**
You own the most novel technical piece of the project — the thing that makes this a World ID hackathon entry rather than just a research tool. You are responsible for wiring up the IDKit SDK on the frontend, building the backend endpoint that verifies ZK proofs, and implementing the nullifier hash logic that makes double-enrollment mathematically impossible. The World ID docs are thorough and the integration pattern is well-defined. You will coordinate closely with Track C on the frontend and Track A on the backend endpoint.
*Skills needed: TypeScript, API integration, ability to read SDK documentation carefully.*

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Data Models](#3-data-models)
4. [API Contract](#4-api-contract)
5. [World ID Integration Spec](#5-world-id-integration-spec)
6. [ML Scorer Spec](#6-ml-scorer-spec)
7. [Demo Script](#7-demo-script)
8. [Team Assignments](#8-team-assignments)

---

## 1. Project Overview

VeritasResearch is a clinical research participant platform that solves two distinct and compounding problems in online health research:

**Problem 1 — Fake Identity:** Organized groups of ineligible individuals enroll in paid studies multiple times under different email addresses, often misrepresenting medical conditions they do not have. Existing tools (email deduplication, IP tracking, CAPTCHA) are trivially defeated.

**Problem 2 — Low Quality Responses:** Even legitimate participants rush through surveys to collect payment, contradict themselves across questions, or give socially desirable answers rather than honest ones. Attention checks are easy to game and catch only the most egregious cases.

VeritasResearch solves both in a single platform:

- **World ID** provides cryptographic proof that each enrolled participant is a unique real human. One iris scan, one enrollment per study. Mathematically enforced, not policy enforced.
- **ML Response Quality Scorer** analyzes every submitted response in real time using an LLM-based evaluation pipeline, producing a quality score across dimensions of coherence, consistency, effort, and specificity.

Researchers see both signals together in a live dashboard: verified identity status alongside per-response quality scores. The result is the first platform that gives clinical researchers genuine confidence in the integrity of their data.

---

## 2. Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **World ID:** `@worldcoin/idkit` SDK
- **HTTP Client:** fetch / axios

### Backend
- **Runtime:** Node.js with Express or Next.js API routes
- **Language:** TypeScript throughout

### Database
- **Primary:** PostgreSQL (via Supabase for fast setup)
- **ORM:** Prisma

### ML / AI
- **LLM API:** OpenAI GPT-4o (response quality scoring)
- **Prompt orchestration:** Custom TypeScript service, no heavy framework needed

### World ID
- **SDK:** `@worldcoin/idkit` (frontend)
- **Verification:** World ID Cloud API (backend proof verification)
- **Action:** One unique action string per study (e.g. `study_enrollment_{studyId}`)

### Dev Tooling
- **Monorepo:** Single Next.js app with `/app`, `/api`, `/lib`, `/prisma` folders
- **Environment:** `.env.local` for all secrets
- **Package manager:** npm

---

## 3. Data Models

All models defined in `prisma/schema.prisma`.

---

### 3.1 Researcher

The person who creates and manages studies.

```prisma
model Researcher {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  createdAt    DateTime  @default(now())

  studies      Study[]
}
```

---

### 3.2 Study

A research study created by a researcher. Contains all configuration for participant eligibility, questions, and compensation.

```prisma
model Study {
  id              String    @id @default(cuid())
  researcherId    String
  title           String
  description     String
  status          StudyStatus @default(DRAFT)
  targetCount     Int
  compensationUsd Float
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  researcher      Researcher  @relation(fields: [researcherId], references: [id])
  questions       Question[]
  enrollments     Enrollment[]
}

enum StudyStatus {
  DRAFT
  ACTIVE
  CLOSED
}
```

---

### 3.3 Question

An individual question within a study. Supports multiple question types.

```prisma
model Question {
  id        String       @id @default(cuid())
  studyId   String
  order     Int
  type      QuestionType
  prompt    String
  options   Json?        // For MULTIPLE_CHOICE only — array of strings

  study     Study     @relation(fields: [studyId], references: [id])
  responses Response[]
}

enum QuestionType {
  SHORT_TEXT
  LONG_TEXT
  MULTIPLE_CHOICE
  SCALE
}
```

---

### 3.4 Participant

A person who has verified their World ID and enrolled in at least one study. The `nullifierHash` is the World ID nullifier — globally unique per person per action, used to prevent double enrollment.

```prisma
model Participant {
  id            String    @id @default(cuid())
  nullifierHash String    @unique  // From World ID — unique per human per action
  createdAt     DateTime  @default(now())

  enrollments   Enrollment[]
}
```

> **Note:** We deliberately store no PII. The nullifier hash is the only identifier. It cannot be reverse-engineered to reveal the person's identity or biometrics.

---

### 3.5 Enrollment

The join between a Participant and a Study. Tracks verification status and completion.

```prisma
model Enrollment {
  id              String           @id @default(cuid())
  participantId   String
  studyId         String
  status          EnrollmentStatus @default(VERIFIED)
  worldIdProof    Json             // Full ZK proof stored for audit
  enrolledAt      DateTime         @default(now())
  completedAt     DateTime?

  participant     Participant @relation(fields: [participantId], references: [id])
  study           Study       @relation(fields: [studyId], references: [id])
  responses       Response[]

  @@unique([participantId, studyId])  // One enrollment per participant per study
}

enum EnrollmentStatus {
  VERIFIED      // World ID verified, not yet started
  IN_PROGRESS
  COMPLETED
  FLAGGED       // ML scorer raised concern
}
```

---

### 3.6 Response

A single answer to a single question within an enrollment.

```prisma
model Response {
  id            String    @id @default(cuid())
  enrollmentId  String
  questionId    String
  value         String    // Raw answer text or selected option
  timeSpentMs   Int       // Time in milliseconds spent on this question
  submittedAt   DateTime  @default(now())

  enrollment    Enrollment   @relation(fields: [enrollmentId], references: [id])
  question      Question     @relation(fields: [questionId], references: [id])
  qualityScore  QualityScore?
}
```

---

### 3.7 QualityScore

ML-generated quality assessment for a single response. Generated asynchronously after submission.

```prisma
model QualityScore {
  id               String   @id @default(cuid())
  responseId       String   @unique
  overallScore     Float    // 0.0 - 1.0
  coherenceScore   Float    // Is the answer logically coherent?
  effortScore      Float    // Did the participant engage meaningfully?
  consistencyScore Float    // Does it contradict other responses in this enrollment?
  flagged          Boolean  @default(false)
  flagReason       String?  // Human-readable reason if flagged
  scoredAt         DateTime @default(now())

  response         Response @relation(fields: [responseId], references: [id])
}
```

---

## 4. API Contract

Base URL: `/api`

All protected routes require a `Authorization: Bearer <token>` header where token is a researcher session JWT. Participant routes are authenticated via World ID proof in the request body.

---

### 4.1 Auth

#### `POST /api/auth/register`
Register a new researcher account.

**Request:**
```json
{
  "email": "researcher@university.edu",
  "name": "Dr. Jane Smith",
  "password": "securepassword"
}
```

**Response `201`:**
```json
{
  "token": "<jwt>",
  "researcher": {
    "id": "clx...",
    "email": "researcher@university.edu",
    "name": "Dr. Jane Smith"
  }
}
```

---

#### `POST /api/auth/login`
Login as a researcher.

**Request:**
```json
{
  "email": "researcher@university.edu",
  "password": "securepassword"
}
```

**Response `200`:**
```json
{
  "token": "<jwt>",
  "researcher": {
    "id": "clx...",
    "email": "researcher@university.edu",
    "name": "Dr. Jane Smith"
  }
}
```

---

### 4.2 Studies

#### `POST /api/studies` 🔒
Create a new study.

**Request:**
```json
{
  "title": "Pain Management in Adults Over 50",
  "description": "A survey study examining...",
  "targetCount": 200,
  "compensationUsd": 25.00,
  "questions": [
    {
      "order": 1,
      "type": "SCALE",
      "prompt": "On a scale of 1-10, how would you rate your average daily pain level?"
    },
    {
      "order": 2,
      "type": "LONG_TEXT",
      "prompt": "Describe how your pain affects your daily activities."
    }
  ]
}
```

**Response `201`:**
```json
{
  "study": {
    "id": "clx...",
    "title": "Pain Management in Adults Over 50",
    "status": "DRAFT",
    "worldIdAction": "study_enrollment_clx..."
  }
}
```

---

#### `GET /api/studies` 🔒
Get all studies for the authenticated researcher.

**Response `200`:**
```json
{
  "studies": [
    {
      "id": "clx...",
      "title": "Pain Management in Adults Over 50",
      "status": "ACTIVE",
      "targetCount": 200,
      "enrollmentCount": 47,
      "completedCount": 31,
      "flaggedCount": 3
    }
  ]
}
```

---

#### `GET /api/studies/:studyId` 🔒
Get a single study with full detail.

**Response `200`:**
```json
{
  "study": {
    "id": "clx...",
    "title": "...",
    "status": "ACTIVE",
    "questions": [...],
    "enrollments": [
      {
        "id": "clx...",
        "status": "COMPLETED",
        "enrolledAt": "2024-01-15T10:30:00Z",
        "averageQualityScore": 0.87,
        "flagged": false
      }
    ]
  }
}
```

---

#### `PATCH /api/studies/:studyId/status` 🔒
Activate or close a study.

**Request:**
```json
{
  "status": "ACTIVE"
}
```

**Response `200`:**
```json
{
  "study": { "id": "clx...", "status": "ACTIVE" }
}
```

---

### 4.3 Enrollment (Participant-facing)

#### `GET /api/studies/:studyId/public`
Get public study info for the participant enrollment page. No auth required.

**Response `200`:**
```json
{
  "study": {
    "id": "clx...",
    "title": "Pain Management in Adults Over 50",
    "description": "...",
    "compensationUsd": 25.00,
    "questionCount": 8,
    "worldIdAction": "study_enrollment_clx..."
  }
}
```

---

#### `POST /api/studies/:studyId/enroll`
Enroll a participant using their World ID proof. Creates Participant if first time, creates Enrollment, rejects if nullifier already used for this study.

**Request:**
```json
{
  "proof": {
    "merkle_root": "0x...",
    "nullifier_hash": "0x...",
    "proof": "0x...",
    "verification_level": "orb"
  }
}
```

**Response `201`:**
```json
{
  "enrollmentId": "clx...",
  "message": "Enrollment verified. You may begin the study."
}
```

**Response `409` (already enrolled):**
```json
{
  "error": "You have already enrolled in this study."
}
```

---

### 4.4 Responses (Participant-facing)

#### `POST /api/enrollments/:enrollmentId/responses`
Submit all responses for a completed study in one call.

**Request:**
```json
{
  "responses": [
    {
      "questionId": "clx...",
      "value": "7",
      "timeSpentMs": 4200
    },
    {
      "questionId": "clx...",
      "value": "I find it difficult to walk more than a block without stopping...",
      "timeSpentMs": 47000
    }
  ]
}
```

**Response `201`:**
```json
{
  "message": "Responses submitted. Quality scoring in progress.",
  "enrollmentId": "clx..."
}
```

> ML scoring runs asynchronously after this call returns. Scores appear in the researcher dashboard within seconds.

---

#### `GET /api/enrollments/:enrollmentId/responses`
Get all responses for an enrollment with quality scores. Researcher auth required.

**Response `200`:**
```json
{
  "responses": [
    {
      "questionId": "clx...",
      "questionPrompt": "Describe how your pain affects your daily activities.",
      "value": "I find it difficult to walk more than a block...",
      "timeSpentMs": 47000,
      "qualityScore": {
        "overallScore": 0.91,
        "coherenceScore": 0.95,
        "effortScore": 0.89,
        "consistencyScore": 0.88,
        "flagged": false
      }
    }
  ]
}
```

---

### 4.5 Dashboard

#### `GET /api/studies/:studyId/dashboard`
Aggregated stats for the researcher dashboard. 🔒

**Response `200`:**
```json
{
  "stats": {
    "totalEnrollments": 47,
    "completed": 31,
    "inProgress": 12,
    "flagged": 4,
    "averageQualityScore": 0.79,
    "qualityDistribution": {
      "high": 22,
      "medium": 6,
      "low": 3
    }
  },
  "recentEnrollments": [...]
}
```

---

## 5. World ID Integration Spec

> This section is the primary responsibility of one team member.

### 5.1 Overview

World ID uses zero-knowledge proofs to let a person prove they are a unique human without revealing their identity. The key concept is the **nullifier hash** — a value that is unique per person per action, but reveals nothing about who that person is.

We create one World ID action per study: `study_enrollment_{studyId}`. This means a person can enroll in multiple different studies (different actions, different nullifiers), but cannot enroll in the same study twice.

---

### 5.2 Environment Variables Required

```bash
# .env.local
NEXT_PUBLIC_WLD_APP_ID=app_...         # From World ID developer portal
NEXT_PUBLIC_WLD_ACTION=study_enrollment # Base action string — studyId appended dynamically
WLD_API_KEY=...                         # For backend verification
```

---

### 5.3 Frontend Integration

Install the SDK:

```bash
npm install @worldcoin/idkit
```

The verification widget lives on the participant enrollment page. It is triggered when a participant clicks "Verify & Enroll."

```tsx
// app/study/[studyId]/enroll/page.tsx
'use client'
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit'

export default function EnrollPage({ params }: { params: { studyId: string } }) {
  const handleVerify = async (proof: ISuccessResult) => {
    const res = await fetch(`/api/studies/${params.studyId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error) // IDKit surfaces this to the user
    }
  }

  const onSuccess = () => {
    // Redirect to survey after successful enrollment
    window.location.href = `/study/${params.studyId}/survey`
  }

  return (
    <IDKitWidget
      app_id={process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`}
      action={`study_enrollment_${params.studyId}`}
      verification_level={VerificationLevel.Orb}
      handleVerify={handleVerify}
      onSuccess={onSuccess}
    >
      {({ open }) => (
        <button onClick={open}>
          Verify with World ID to Enroll
        </button>
      )}
    </IDKitWidget>
  )
}
```

---

### 5.4 Backend Proof Verification

```typescript
// lib/worldid.ts
import { verifyCloudProof, IVerifyResponse } from '@worldcoin/idkit'

export async function verifyWorldIdProof(
  proof: ISuccessResult,
  studyId: string
): Promise<IVerifyResponse> {
  const result = await verifyCloudProof(
    proof,
    process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`,
    `study_enrollment_${studyId}`
  )
  return result
}
```

---

### 5.5 Enrollment Endpoint Logic

```typescript
// app/api/studies/[studyId]/enroll/route.ts
import { verifyWorldIdProof } from '@/lib/worldid'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { studyId: string } }) {
  const { proof } = await req.json()

  // 1. Verify the ZK proof with World ID cloud
  const verifyResult = await verifyWorldIdProof(proof, params.studyId)
  if (!verifyResult.success) {
    return Response.json({ error: 'World ID verification failed' }, { status: 400 })
  }

  const nullifierHash = proof.nullifier_hash

  // 2. Check if this nullifier has already enrolled in this study
  const existingParticipant = await prisma.participant.findUnique({
    where: { nullifierHash }
  })

  if (existingParticipant) {
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        participantId_studyId: {
          participantId: existingParticipant.id,
          studyId: params.studyId
        }
      }
    })
    if (existingEnrollment) {
      return Response.json(
        { error: 'You have already enrolled in this study.' },
        { status: 409 }
      )
    }
  }

  // 3. Create participant if first time, then create enrollment
  const participant = await prisma.participant.upsert({
    where: { nullifierHash },
    create: { nullifierHash },
    update: {}
  })

  const enrollment = await prisma.enrollment.create({
    data: {
      participantId: participant.id,
      studyId: params.studyId,
      worldIdProof: proof as object,
      status: 'VERIFIED'
    }
  })

  return Response.json({ enrollmentId: enrollment.id }, { status: 201 })
}
```

---

## 6. ML Scorer Spec

> This is the core technical differentiator of the product and the primary build responsibility of the project lead.

### 6.1 Overview

The ML scorer runs asynchronously after a participant submits their responses. It evaluates each response across four dimensions and produces a score between 0.0 and 1.0. Responses that fall below a threshold are flagged for researcher review.

The scorer is implemented as a TypeScript service that calls the OpenAI API with carefully structured prompts. No ML framework setup required — pure API calls.

---

### 6.2 Scoring Dimensions

| Dimension | What It Measures | Example of Low Score |
|---|---|---|
| **Coherence** | Is the answer logically meaningful and on-topic? | "Yes no maybe the sky is blue" in response to a pain question |
| **Effort** | Did the participant engage meaningfully with the question? | One-word answer to an open-ended question; answer submitted in under 3 seconds |
| **Consistency** | Does this answer contradict other responses in the same enrollment? | Rating pain as 2/10 but describing inability to leave bed in a later question |
| **Specificity** | Does the answer contain concrete, personal detail? | "It hurts sometimes" vs "Sharp pain in my lower back every morning when I stand up" |

---

### 6.3 Scoring Pipeline

```typescript
// lib/scorer.ts

interface ScoringInput {
  question: string
  answer: string
  timeSpentMs: number
  allResponsesInEnrollment: Array<{ question: string; answer: string }>
}

interface ScoreOutput {
  overallScore: number
  coherenceScore: number
  effortScore: number
  consistencyScore: number
  specificityScore: number
  flagged: boolean
  flagReason: string | null
}

export async function scoreResponse(input: ScoringInput): Promise<ScoreOutput> {
  // Step 1: Time-based effort pre-check
  // Under 2 seconds on a text question is a hard flag regardless of content
  const MIN_TIME_MS = 2000
  if (input.timeSpentMs < MIN_TIME_MS && input.answer.length > 10) {
    return buildFlaggedScore('Response submitted too quickly to have been read carefully')
  }

  // Step 2: LLM scoring
  const prompt = buildScoringPrompt(input)
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1 // Low temperature for consistent scoring
  })

  const scores = JSON.parse(completion.choices[0].message.content!)

  // Step 3: Calculate overall score (weighted average)
  const overallScore =
    scores.coherence * 0.30 +
    scores.effort * 0.25 +
    scores.consistency * 0.30 +
    scores.specificity * 0.15

  const flagged = overallScore < 0.45

  return {
    overallScore,
    coherenceScore: scores.coherence,
    effortScore: scores.effort,
    consistencyScore: scores.consistency,
    specificityScore: scores.specificity,
    flagged,
    flagReason: flagged ? scores.flagReason : null
  }
}
```

---

### 6.4 LLM Prompt Design

```typescript
function buildScoringPrompt(input: ScoringInput): string {
  const otherResponses = input.allResponsesInEnrollment
    .filter(r => r.answer !== input.answer)
    .map(r => `Q: ${r.question}\nA: ${r.answer}`)
    .join('\n\n')

  return `
You are a clinical research data quality assessor. Evaluate the following survey response for quality and authenticity.

QUESTION ASKED:
${input.question}

PARTICIPANT'S ANSWER:
${input.answer}

TIME SPENT ON THIS QUESTION: ${Math.round(input.timeSpentMs / 1000)} seconds

OTHER RESPONSES FROM THIS SAME PARTICIPANT IN THIS STUDY:
${otherResponses || 'This is the first response.'}

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
`
}
```

---

### 6.5 Async Scoring Trigger

Scoring is triggered after the response submission endpoint returns, so participants are not waiting on the LLM call.

```typescript
// app/api/enrollments/[enrollmentId]/responses/route.ts

export async function POST(req: Request, { params }) {
  const { responses } = await req.json()

  // Save all responses to DB first
  const savedResponses = await prisma.$transaction(
    responses.map((r: any) =>
      prisma.response.create({
        data: {
          enrollmentId: params.enrollmentId,
          questionId: r.questionId,
          value: r.value,
          timeSpentMs: r.timeSpentMs
        }
      })
    )
  )

  // Return immediately — scoring happens in background
  triggerScoringPipeline(params.enrollmentId, savedResponses)

  return Response.json({ message: 'Responses submitted. Quality scoring in progress.' }, { status: 201 })
}

// Fire and forget — no await
async function triggerScoringPipeline(enrollmentId: string, responses: Response[]) {
  for (const response of responses) {
    const score = await scoreResponse({ ... })
    await prisma.qualityScore.create({ data: { responseId: response.id, ...score } })
  }

  // Flag enrollment if average score is below threshold
  const avgScore = responses.reduce((sum, r) => sum + r.qualityScore.overallScore, 0) / responses.length
  if (avgScore < 0.5) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'FLAGGED' }
    })
  }
}
```

---

## 7. Demo Script

The demo is the most important 5 minutes of the hackathon. Treat it as a first-class engineering deliverable.

### 7.1 Demo Dataset

Seed the database with two studies before the presentation:

**Study A — "Unprotected" (simulated standard platform)**
- 50 enrollments with no World ID requirement
- 12 fraudulent enrollments: same person enrolled multiple times with slightly varied names/emails
- 8 low-quality response sets: one-word answers, sub-2-second submissions, contradictory responses
- Resulting corrupted conclusion: "68% of participants report manageable pain levels"

**Study B — "VeritasResearch Protected"**
- Same study, same questions
- All enrollments World ID verified (nullifier hash uniqueness enforced)
- All responses ML scored — flagged responses excluded from analysis
- Clean conclusion: "41% of participants report manageable pain levels"

The delta between 68% and 41% is the demo moment.

---

### 7.2 Presentation Flow

**Minute 1 — The problem**
Open Study A's dashboard. Show the 12 duplicate enrollments side by side. Show the 8 flagged low-quality response sets. Point to the corrupted conclusion. Say: "This is what every online clinical trial is dealing with right now. This trial would have told the drug company the wrong thing."

**Minute 2 — World ID enrollment**
Switch to Study B. Have a team member open the participant enrollment page live. Walk through the World ID verification flow in real time — open the World App, scan, see the confirmation. Show the enrollment appear in the researcher dashboard instantly with a verified badge.

**Minute 3 — The ML scorer**
Have the team member submit a deliberately low-quality response set — short answers, fast submissions. Show the quality scores appear in the dashboard in real time. Show the flagged status. Show the flag reason generated by the LLM.

**Minute 4 — The clean conclusion**
Pull up Study B's final results. Show the 41% figure. Put Study A and Study B side by side. Let the difference speak for itself.

**Minute 5 — The pitch**
"One corrupted trial costs a pharma company tens of millions of dollars and years of development time. The CRO industry is worth $85 billion. Nobody has solved this cleanly. We did it in 48 hours."

---

## 8. Team Assignments

### Project Lead (You)
- Core backend infrastructure: database setup, Prisma schema, API layer
- ML response quality scorer end to end
- Async scoring pipeline
- Demo dataset seeding and fraud simulation
- Final integration and deployment

### Person 1
- Researcher-facing frontend
- Study builder UI (create study, add questions, set parameters)
- Researcher dashboard (enrollment list, quality scores, flagged alerts, stats)
- Before/after comparison visualization for the demo

### Person 2
- Participant-facing frontend
- Study discovery and enrollment page
- World ID verification widget placement and UX flow
- Survey-taking interface (question by question, time tracking on each question)
- Submission confirmation screen

### Person 3
- World ID integration end to end
- IDKit SDK configuration on the frontend
- Backend proof verification endpoint (`/api/studies/:studyId/enroll`)
- Nullifier hash storage and double-enrollment prevention logic
- Coordinate with Person 2 on where the verification widget sits in the participant UI
- Coordinate with Project Lead on the enrollment API contract

---

### Build Order (Critical Path)

```
Hour 0-1:   Project Lead defines API contracts → shares with team
            Everyone sets up local dev environment

Hour 1-6:   All four build in parallel against mock API responses
            Project Lead: Database schema + core API routes
            Person 1: Researcher dashboard with mock data
            Person 2: Participant flow with mock enrollment
            Person 3: World ID SDK integration against mock endpoint

Hour 6-18:  Project Lead: ML scorer + async pipeline
            Person 1: Connect dashboard to real API
            Person 2: Connect participant flow to real API
            Person 3: Wire real World ID verification into enrollment endpoint

Hour 18-36: Integration sprint — everything connects to live backend
            Fix blockers together
            Person 1: Demo visualization (before/after comparison)

Hour 36-44: Seed demo dataset
            Full end-to-end run-through
            Fix anything broken

Hour 44-48: Practice demo presentation
            Polish UI rough edges
            Prepare pitch talking points
```

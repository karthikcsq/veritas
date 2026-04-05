## Inspiration

The global clinical trials market is worth over $80 billion. A single failed Phase III trial costs around $350 million. And an estimated 4% of trial volunteers are "professional patients" who fabricate or exaggerate symptoms for compensation. In some fields, a Nature investigation found that up to one quarter of clinical trials may be problematic or entirely fabricated.

This isn't abstract. A Harvard research team caught ten fake HIV patients in their trial. People were wearing wigs on video calls to avoid being recognized from previous sign-ups. A separate Alzheimer's study lost 40% of its data to participants who didn't have Alzheimer's. Years of drug development, gone.

We spoke with the department chair of nursing at UCSF. The best fraud prevention tool available to researchers today is an attention check question: "Select Strongly Agree to prove you're reading this." That's what stands between a clinical trial and garbage data. It's trivially bottable.

We built something better.

## What it does

Veritas is a clinical research platform that combines **cryptographic proof-of-personhood** with **ML-powered response quality scoring** to give researchers clean, trustworthy data.

It works in three layers:

**Identity.** Before answering a single question, participants verify through World ID, which uses iris biometrics to cryptographically prove you're a unique human. Different email, different device, VPN, none of it matters. You cannot enroll twice.

**Intelligence.** Every response is scored across multiple quality dimensions by our ML pipeline. Researchers see per-participant integrity scores, flagged contradictions, timing anomalies, and cross-response similarity analysis, all from a six-tab analytics dashboard.

**Experience.** The platform also helps prevent bad data before it's collected. AI analyzes researcher questions before the study launches, suggesting specificity improvements and recommending reverse-scored questions. During the survey, participants get real-time nudges if a text response is vague or off-topic, with the option to revise.

## How we built it

**Stack:** Next.js 14 (App Router), React 19, Tailwind CSS, shadcn/ui, PostgreSQL via Supabase (raw SQL), NextAuth.js, World ID IDKit, OpenAI GPT-4o, Pinecone vector database.

### Scoring Pipeline

When a participant submits responses, our pipeline calculates a **Combined Quality Score**:

$$\text{Combined} = 0.5 \times \text{LLM Score} + 0.5 \times \text{Structured Score}$$

**LLM Score:** GPT-4o-mini evaluates every text response across four dimensions:

$$\text{LLM} = 0.30 \times \text{Coherence} + 0.25 \times \text{Effort} + 0.30 \times \text{Consistency} + 0.15 \times \text{Specificity}$$

Each dimension is scored from 0.0 to 1.0. *Coherence* measures whether the response logically addresses the question. *Effort* captures depth and thoughtfulness. *Consistency* checks for contradictions across answers. *Specificity* rewards concrete, personal detail over vague generalities.

**Structured Score:** Calculated from behavioral signals alone:

$$\text{Structured} = 0.60 \times \text{Response Time} + 0.40 \times \text{Reverse Consistency}$$

*Response Time* compares how long a participant spent on each question against a calculated expected minimum based on word count, question type, and number of options. Someone who answers a 50-word free-text question in under 3 seconds gets flagged.

*Reverse Consistency* uses question pairs that measure the same construct from opposite directions (e.g., "I feel energized" vs. "I feel exhausted"). If a participant rates both as "Strongly Agree," that's a contradiction, and it's weighted into their score.

### Similarity Detection (RAG Pipeline)

For free-text responses, we embed each answer using `text-embedding-3-small`, store vectors in Pinecone, and retrieve the 5 nearest neighbors from other participants answering the same question. GPT-4o then scores semantic similarity from 0.0 to 1.0. If **70% or more** of a participant's answers have **90%+ similarity** to existing responses, the enrollment is flagged as potentially copied.

**An enrollment is flagged if:** Combined Score < 0.5 **or** the similarity threshold is triggered.

## Challenges we ran into

The hardest design problem was making AI feel collaborative to the participant. Real-time validity nudges say things like "your answer seems vague, want to add more?" We iterated heavily on this tone so that honest participants feel guided, not interrogated.

Integrating World ID's proof-of-personhood into a clinical research context also meant thinking carefully about what we store. We keep only cryptographic nullifier hashes. No biometric data ever touches our servers.

## Accomplishments that we're proud of

Clinical research fraud is a problem that is *perfectly suited* for proof-of-personhood technology. One person, one enrollment, enforced cryptographically. Pairing that with an ML quality pipeline means researchers get identity guarantees and data quality guarantees in one platform.

## What we learned

Building for researchers taught us that good fraud detection should be invisible to participants. The scoring pipeline runs entirely post-submission. Participants experience a clean survey with occasional helpful nudges, and researchers get the full analytics breakdown on their end.

## What's next

Longitudinal study support, multi-site trial coordination, and integration with existing research platforms like REDCap. We're also exploring on-chain verification receipts so participants can prove enrollment without revealing which study they're in.

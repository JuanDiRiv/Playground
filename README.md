# TechPractice

A web app for practicing tech interviews — open-ended Q&A graded by AI, in-browser
coding exercises (sandbox + unit-tested) and timed challenges with progressive
hints.

- **Stack:** Next.js 16 (App Router · RSC · Server Actions) · React 19 · Tailwind 4
  · Firebase Auth + Firestore (Admin SDK) · OpenAI · Monaco · Web Workers · Sucrase
- **Models:** `gpt-5.4-mini` (default) for evaluation, `gpt-5.4-nano` for hints.
- **UI:** dark mode only.

## Features

- **Q&A** — answer questions in your own words; AI returns score + strengths/gaps.
- **Exercises** — Monaco multi-file editor with a live HTML/CSS sandbox iframe and
  a Web-Worker test runner (TypeScript compiled in-browser via Sucrase). Conceptual
  exercises get an AI rubric review.
- **Challenges** — same workbench plus a timer, target-time tracking and personal
  best times.
- **Progressive hints** (3 levels: nudge → approach → walkthrough) cached per file
  state and rate-limited per user.
- **Daily AI quota** per user, enforced by a Firestore transaction.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   You need a Firebase project with Authentication (Google provider) and Firestore
   enabled, plus an OpenAI API key. For the Admin SDK on Vercel, paste your
   service-account JSON as base64 into `FIREBASE_ADMIN_SERVICE_ACCOUNT_B64`.

3. Seed the content catalog:

   ```bash
   npx tsx scripts/seed.ts
   ```

4. Deploy Firestore rules (optional but recommended):

   ```bash
   npx firebase deploy --only firestore:rules
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Deploy on Vercel

1. Import the repo in Vercel.
2. Add every variable from `.env.example` as a Project Environment Variable.
   The private key needs `\n` for newlines (or use the base64 service-account
   variant, which is simpler).
3. Build command: `npm run build` · Output: `.next` (default).
4. After the first deploy, run `npx tsx scripts/seed.ts` once against your prod
   Firebase project to populate topics.

## Project structure

```
src/
  app/                 Next.js App Router (RSC + Server Actions)
    (app)/             Authenticated shell (layout enforces session)
      dashboard/
      profile/
      topics/[slug]/
        qa/[id]/
        exercises/[id]/
        challenges/[id]/
    login/
  components/
    workbench/         Shared editor + tests + sandbox + hints UI
    app-header.tsx
  lib/
    ai/                OpenAI client, cache, rate-limit, Q&A/exercise/hint
    content/           Firestore queries + progress writes (transactions)
    firebase/          Admin + client SDK + auth-server/auth-actions
    schemas/           Zod schemas for content + progress
public/
  exercise-runner.worker.js   Web Worker test runner
scripts/
  seed.ts             Idempotent content seeder
firestore.rules
```

## Security model

- All persistence goes through Server Actions using the Admin SDK.
- Firestore rules deny direct client writes everywhere; clients can only read
  their own `users/{uid}/**` subtree (defensive — the app never reads it
  directly).
- Web Worker test runner uses a 5s timeout and posts results back as plain JSON.
- Sandbox iframes use `sandbox="allow-scripts"` only.

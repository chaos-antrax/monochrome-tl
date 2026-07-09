# Chinese Web Novel Translator — Implementation Plan

## 1. Overview

A Next.js + MongoDB web app that lets users manage Chinese web novels, paste in raw chapters, and generate AI-assisted translations that stay consistent via a per-novel glossary and user-defined style guides. Users bring their own API keys (DeepSeek or OpenRouter) and translation runs as background jobs via a queue.

---

## 2. Core Feature List

### Auth & Account

- Secure login/signup, 7-day session expiry
- Per-user provider configuration: choose DeepSeek or OpenRouter, store encrypted API key, select model
- No model fallback — if a call fails, the error/reason is surfaced directly to the user (no silent retry with a different model)

### Novels

- Create / edit / delete novels
- Each novel has: title, description, cover metadata (optional), glossary, assigned style guide, chapters, volumes/arcs grouping
- **Description can be entered in raw Chinese** and translated via the same AI pipeline used for chapters; the novel detail view offers the same raw/translated toggle used for chapters, including the "not yet translated" empty state if no translation has been generated yet
- Description translation is a lightweight, on-demand action (not part of the background job queue by default, since it's a single short text) but still goes through the same request/response validation contract as chapter translations (Section 6)

### Style Guides (revised: per-novel, multi-style library)

- Users maintain a **library of style guides** at the account level (not a single global one)
- Each style guide: name, content (max 1000 characters), created/updated timestamps
- Users create/edit/delete style guides in this library
- **Per novel**, the user selects one style guide from their library to apply to that novel's translations (default: none / plain style)
- Changing a novel's assigned style guide does not retroactively re-translate existing chapters — only affects future translation jobs (with manual "retranslate" available)

### Chapters

- Add/edit/delete raw Chinese chapters via paste (with a dedicated "Paste from clipboard" button using the Clipboard API), with a live character counter in the paste UI so users can see how close they are to the max-length threshold before it triggers chunking, similar to the style-guide character counter
- Chapter ordering within a novel (drag-and-drop reordering), grouping into volumes/arcs
- Toggle seamlessly between raw Chinese and translated text per chapter
  - If untranslated: translation view shows a clear "This chapter hasn't been translated yet" state with a call-to-action to translate
- **Chapter list view shows an indicator tag/badge per chapter** reflecting its current state: `Untranslated`, `Queued`, `Translating`, `Translated`, or `Failed` (mirroring `chapters.status` / the active `translationJobs` status) — gives users an at-a-glance view of translation progress across a novel without opening each chapter
- Translation versioning: each chapter stores a history of translation attempts (model used, timestamp, token usage); users can view previous versions and revert
- Regenerate/retry translation for a chapter (creates a new version)
- Diff / side-by-side raw-vs-translated view as an alternate reading mode
- Translation memory: hash raw chapter text; skip re-charging API if unchanged and already translated (still allow explicit "regenerate")

### Glossary (per novel)

- Add / edit / delete glossary terms manually
- Fields per term: source term (Chinese), translation, category (character / place / organization / skill-technique / item / honorific / other), pinyin (optional), notes
- AI automatically proposes new proper-noun terms discovered during translation
- **Newly AI-discovered terms go into a "pending" state**, not directly into the live glossary — user reviews and approves/edits/rejects before they're used in future translation calls
- Conflict flagging: if the AI's chosen translation for a term diverges from an approved glossary entry, the term/instance is flagged for user review rather than silently overwritten
- Glossary used as context on every future translation request for that novel

### Translation Pipeline

- AI translates raw chapter using: novel's glossary (approved terms) + novel's assigned style guide + raw chapter text
- Background job queue (BullMQ + Redis) — translation requests are enqueued, not blocking
- Job status: queued → processing → completed → failed, visible to user with live progress (polling or SSE-driven status updates)
- Chunking strategy for chapters exceeding a safe token threshold, with glossary/style context preserved across chunks and results stitched back together
- Max pasted-chapter character limit (before chunking kicks in) is a **config constant**, not hardcoded — different models/providers have different output token caps, so this should be tunable per-provider rather than fixed in code. Resolved default: **10,000 Chinese characters** (see Section 10)
- Strict request/response schema validation (see Section 6)
- Cost/usage dashboard: token counts and estimated cost per chapter, per novel, and per month
- Concurrency and per-user rate limiting on the queue, tuned to provider rate limits

### Export & Reading

- Export translated chapters (EPUB / PDF / plain text)
- Adjustable reading settings (font size, line height) within the Lora/Inter typography system

### Validation (applies throughout — detailed in Section 6)

- All AI requests and responses validated against strict schemas (Zod) before being persisted or displayed
- All form inputs (novel creation, chapter paste, glossary edits, style guide text, API key entry) validated both client- and server-side

---

## 3. Tech Stack

| Layer        | Choice                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| Framework    | Next.js (App Router)                                                                       |
| Database     | MongoDB (Mongoose or native driver)                                                        |
| Auth         | Auth.js (NextAuth), JWT strategy, 7-day `maxAge`, optional DB session store for revocation |
| Queue        | BullMQ + Redis                                                                             |
| Worker       | Standalone persistent Node process (see hosting note below)                                |
| Validation   | Zod (shared schemas between client, API routes, and worker)                                |
| Styling      | Tailwind CSS, Lora (serif, headings/reading) + Inter (sans, UI) via `next/font`            |
| AI Providers | DeepSeek (OpenAI-compatible SDK), OpenRouter (official SDK or OpenAI-compatible endpoint)  |
| Encryption   | Node `crypto` (AES-256-GCM) for API key storage                                            |

**Hosting note**: BullMQ workers need a persistent process — they won't run on typical serverless functions (e.g., Vercel functions). The worker lives in its own top-level `/worker` directory as a self-contained Node project, runnable independently of the Next.js app both locally and in production. Locally it's started as a separate process alongside the Next.js dev server; in production it's deployed to Render as a **Background Worker** service. **Resolved for this 2-user scale**: the Next.js app runs on **Vercel's free tier**, and Redis is an **Upstash free-tier instance** (256MB storage, 500K commands/month) — both comfortably cover a 2-user workload with room to spare. See Section 10 for the reasoning. Full worker setup in Section 5.1.

---

## 4. Data Models (MongoDB)

```
users {
  _id,
  email,
  passwordHash,
  createdAt,
  provider: 'deepseek' | 'openrouter',
  encryptedApiKey: { iv, authTag, ciphertext },
  selectedModel: string,
  updatedAt
}

styleGuides {
  _id,
  userId,
  name: string,
  content: string,        // max 1000 chars, enforced in schema + UI counter
  createdAt,
  updatedAt
}

novels {
  _id,
  userId,
  title: string,
  description?: string,           // raw Chinese description
  descriptionTranslated?: string, // AI-translated description, absent until first translated
  styleGuideId?: ObjectId,   // reference into styleGuides, optional
  createdAt,
  updatedAt
}

volumes {                  // optional grouping layer
  _id,
  novelId,
  title,
  order: number
}

chapters {
  _id,
  novelId,
  volumeId?: ObjectId,
  order: number,
  title?: string,
  rawText: string,
  rawTextHash: string,       // for translation-memory checks
  status: 'untranslated' | 'queued' | 'translated' | 'failed',
  translations: [
    {
      version: number,
      text: string,
      model: string,
      provider: string,
      tokensUsed: { input: number, output: number },
      estimatedCost: number,
      createdAt: Date
    }
  ],
  currentVersion: number,
  createdAt,
  updatedAt
}

glossaryTerms {
  _id,
  novelId,
  sourceTerm: string,
  translation: string,
  category: 'character' | 'place' | 'organization' | 'skill' | 'item' | 'honorific' | 'other',
  pinyin?: string,
  notes?: string,
  status: 'approved' | 'pending' | 'rejected',
  discoveredInChapterId?: ObjectId,   // if AI-discovered
  createdAt,
  updatedAt
}
// unique compound index: novelId + sourceTerm

translationJobs {
  _id,
  userId,
  novelId,
  chapterId,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  provider: string,
  model: string,
  attempts: number,
  error?: string,
  tokensUsed?: { input: number, output: number },
  estimatedCost?: number,
  createdAt,
  startedAt?,
  completedAt?
}
```

**Indexes**: `chapters` on `{novelId: 1, order: 1}`; `glossaryTerms` on `{novelId: 1, sourceTerm: 1}` (unique); `translationJobs` on `{userId: 1, status: 1}`; `styleGuides` on `{userId: 1}`.

---

## 5. Application Architecture

```
/ (repo root)
 ├─ package.json            (Next.js app — root project)
 ├─ docker-compose.yml       (local Redis + Mongo for dev, see 5.1)
 ├─ /app (pages, server components)
 ├─ /app/api (route handlers: auth, novels, chapters, glossary, style-guides, jobs)
 ├─ /lib
 │   ├─ auth.ts             (Auth.js config)
 │   ├─ db.ts               (Mongo connection)
 │   ├─ crypto.ts           (API key encrypt/decrypt)
 │   ├─ schemas/            (Zod schemas — imported by both the app and the worker)
 │   ├─ queue.ts            (BullMQ queue producer, used by API routes to enqueue jobs)
 │   └─ providers/
 │       ├─ deepseek.ts
 │       └─ openrouter.ts
 └─ /worker                 (standalone project, independent of the Next.js app)
     ├─ package.json         (own dependencies: bullmq, mongodb, zod, provider SDKs)
     ├─ tsconfig.json
     ├─ Dockerfile
     ├─ .env.example
     └─ /src
         ├─ index.ts         (worker process entrypoint — connects to Redis, starts BullMQ worker)
         └─ translate-job.ts (job processing logic: fetch data, call provider, validate, persist)
```

The `/worker` directory is a separate Node project (its own `package.json`, lockfile, and build step) so it can be deployed and scaled independently of the Next.js app. It imports shared logic — Zod schemas, provider clients, the encryption helper — directly from `/lib` via relative paths (e.g. `../../lib/schemas/translation`), so there's a single source of truth for the AI request/response contract instead of two copies drifting apart. Full local-dev and Render deployment details are in Section 5.1.

**Flow for translating a chapter**:

1. User clicks "Translate" → API route validates request → enqueues job in BullMQ → creates `translationJobs` doc (status `queued`) → returns job ID.
2. Frontend polls `/api/jobs/:id` or subscribes via SSE for status updates.
3. Worker picks up job → fetches chapter, novel's approved glossary, novel's assigned style guide, user's decrypted API key/model/provider.
4. Worker builds request payload per the schema in Section 6, calls the provider SDK.
5. Worker validates response against schema.
   - Valid: writes new translation version to `chapters.translations`, writes `newTerms` to `glossaryTerms` as `pending`, updates job to `completed` with token/cost data.
   - Invalid schema: one corrective retry with an explicit instruction to conform to the schema.
   - Still invalid, or provider/network error: job marked `failed` with `error` reason surfaced verbatim to the user — no automatic model fallback.

---

## 5.1 Worker Project: Local Development & Render Deployment

### Directory contents

```
/worker
 ├─ package.json
 ├─ tsconfig.json
 ├─ Dockerfile
 ├─ .env.example
 └─ /src
     ├─ index.ts
     └─ translate-job.ts
```

**`/worker/package.json`** (illustrative)

```json
{
  "name": "novel-translator-worker",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "mongodb": "^6.x",
    "zod": "^3.x",
    "openai": "^4.x",
    "@openrouter/sdk": "^1.x"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "typescript": "^5.x",
    "@types/node": "^20.x"
  }
}
```

**`/worker/.env.example`**

```
MONGODB_URI=
REDIS_URL=
ENCRYPTION_SECRET=        # must match the Next.js app's secret, used to decrypt stored API keys
NODE_ENV=development
```

### Running locally, independently of the Next.js app

1. Start Redis and MongoDB locally — the provided root `docker-compose.yml` spins up both:
   ```yaml
   services:
     redis:
       image: redis:7
       ports: ["6379:6379"]
     mongo:
       image: mongo:7
       ports: ["27017:27017"]
   ```
   Run with `docker compose up -d`.
2. From `/worker`, install dependencies and run in watch mode:
   ```
   cd worker
   npm install
   cp .env.example .env   # fill in MONGODB_URI, REDIS_URL, ENCRYPTION_SECRET
   npm run dev
   ```
3. In a separate terminal, run the Next.js app as usual (`npm run dev` from the repo root). The app enqueues jobs into the same Redis instance; the worker (running independently) picks them up and processes them. This means the worker can be started, stopped, and iterated on without touching the Next.js dev server at all — useful for testing translation logic, provider integrations, and schema validation in isolation.
4. Since the worker imports shared schemas/providers from `/lib`, its `tsconfig.json` should include a path mapping (or simply use relative imports) pointing back to the root `/lib` directory so both projects stay in sync on the AI request/response contract.

### Deploying to Render

1. **Service type**: create a Render **Background Worker** (not a Web Service — it doesn't need to expose a port).
2. **Root directory**: set to `worker/` so Render only builds/runs that subdirectory.
3. **Build command**: `npm install && npm run build`
4. **Start command**: `npm start` (runs the compiled `dist/index.js`)
5. **Environment variables** (set in the Render dashboard, matching `.env.example`):
   - `MONGODB_URI` — same database the Next.js app uses
   - `REDIS_URL` — Render Redis instance (or an external Redis provider), same one the Next.js app's API routes use to enqueue jobs
   - `ENCRYPTION_SECRET` — must exactly match the value used by the Next.js app, since the worker decrypts user API keys encrypted by the app
6. **Scaling**: Render lets you adjust instance size/count for the worker independently of the web app — useful if translation volume grows without needing to scale the Next.js deployment itself.
7. **Health/monitoring**: since Background Workers don't serve HTTP, rely on Render's log stream plus the `translationJobs` collection (Section 4) as the source of truth for whether jobs are being processed — a stuck `processing` status with no recent `updatedAt` is a good signal the worker is down.

This setup keeps the worker fully decoupled: it can be built, tested, restarted, and deployed on its own schedule, and a failure or redeploy of the worker never takes down the Next.js app (jobs simply queue up in Redis until the worker is back).

---

## 6. AI Request/Response Contract & Validation

### Outbound request (constructed by worker)

```ts
const TranslationRequestSchema = z.object({
  systemPrompt: z.string(),
  styleGuide: z.string().max(1000).nullable(),
  glossary: z.array(
    z.object({
      sourceTerm: z.string(),
      translation: z.string(),
      category: z.string(),
    }),
  ),
  rawChapterText: z.string().min(1),
});
```

- Only **approved** glossary terms are sent.
- To control token usage on large glossaries, only terms whose `sourceTerm` substring-matches the raw chapter text are included.
- `styleGuide` is the novel's currently assigned style guide content (or `null` if none assigned).

### Inbound response (expected from AI, enforced before persistence)

```ts
const TranslationResponseSchema = z.object({
  translatedText: z.string().min(1),
  newTerms: z
    .array(
      z.object({
        sourceTerm: z.string(),
        translation: z.string(),
        category: z.enum([
          "character",
          "place",
          "organization",
          "skill",
          "item",
          "honorific",
          "other",
        ]),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});
```

- System prompt instructs the model to respond **only** with JSON matching this exact shape — no prose, no markdown fences.
- Worker strips code fences defensively, then `JSON.parse`, then validates with the schema.
- On validation failure: one retry with a message stating the response didn't match the required schema and to resend in the correct format.
- On repeated failure: job fails, raw error/mismatch reason stored and shown to the user — never silently coerced into a "best guess" result.

### Other validation across the app

- **Style guide content**: max 1000 characters, enforced in Zod schema, DB schema, and live character counter in the UI.
- **API key input**: format/length sanity checks before encryption + a test call option ("Verify key") before saving.
- **Chapter paste**: non-empty, max length enforced against the config-constant threshold described in Section 2 (default 10,000 Chinese characters, tunable per-provider), stripped of any executable content before storage/render, with a live character counter in the UI so the limit is visible before submission
- **Glossary term edits**: required `sourceTerm`/`translation`, category must be one of the enum values, duplicate `sourceTerm` per novel rejected (unique index + pre-check).
- **Novel/chapter CRUD**: ownership checks on every request (a user can only mutate their own data) enforced server-side, not just hidden in the UI.

---

## 7. Security

- API keys encrypted at rest with AES-256-GCM using a server-only secret (never exposed to the client after initial save; UI shows masked value only).
- Passwords hashed with bcrypt/argon2.
- CSRF protection on state-changing routes (Auth.js handles much of this for its own routes; apply consistent protection to custom API routes).
- Server-side authorization checks on every novel/chapter/glossary/style-guide/job route — verify the resource belongs to the requesting user.
- Rate limiting on login attempts and on job-enqueue endpoints (independent from provider-side rate limits) to prevent abuse.
- Sanitize all pasted/raw text before rendering to prevent script injection if rendered as HTML.

---

## 8. UI/UX Notes

- Typography: Lora for headings and the reading view (raw/translated chapter text), Inter for all UI chrome (buttons, forms, nav).
- Theme: minimal black-and-white — rely on typography weight, whitespace, and thin borders/dividers rather than color for hierarchy; sparing use of a single accent (e.g., pure black on white, or the inverse in dark mode) for primary actions.
- Chapter view: toggle control (raw / translated) with a clear empty state for untranslated chapters, plus a "Translate this chapter" call-to-action that enqueues a job directly from that view.
- Novel detail view: same raw/translated toggle pattern reused for the novel description, with its own "not yet translated" empty state — consistent interaction model across the app rather than a one-off.
- Chapter list view: status indicator tags/badges (`Untranslated`, `Queued`, `Translating`, `Translated`, `Failed`) rendered next to each chapter row, using typography/border weight rather than color to stay within the black-and-white theme (e.g., outlined vs. filled pill, or a small dot + label).
- Style guide selection surfaced on the novel's settings page, with a "manage style guides" link to the shared library.
- Job status: small persistent indicator (e.g., a translating chapters count) so users can navigate away without losing track of in-flight jobs.
- Glossary view: separate "Approved" and "Pending review" tabs so AI-discovered terms don't get lost.
- **Styling implementation**: Tailwind CSS utility classes throughout — no separate CSS-in-JS or global stylesheet beyond Tailwind's base layer and the `next/font` setup for Lora/Inter. Keeps the black-and-white theme consistent via a small shared design-token set (spacing, border, and type-scale conventions) rather than ad hoc styles per component.

### Responsiveness

The app must be fully usable across mobile, tablet/iPad, and desktop viewports — not just "not broken," but laid out intentionally for each:

- **Mobile (< 640px)**: single-column layouts throughout; chapter list, glossary, and style-guide library render as stacked lists rather than tables; the raw/translated toggle becomes a prominent tap target (e.g., a segmented control) rather than a small button; navigation collapses into a hamburger/drawer pattern.
- **Tablet/iPad (~640–1024px)**: two-column layouts where useful (e.g., glossary term list with an edit panel beside it, or side-by-side raw/translated diff view becomes viable at this width rather than only on desktop); touch-friendly tap targets maintained since iPads are frequently used in portrait as well as landscape.
- **Desktop (> 1024px)**: full multi-column layouts, side-by-side raw/translated view as a first-class option (not just a toggle), persistent sidebar navigation instead of a drawer.
- Implementation approach: Tailwind's responsive breakpoint prefixes (`sm:`, `md:`, `lg:`) applied consistently rather than separate mobile/desktop component variants, so there's a single component tree per view that reflows across breakpoints.
- Test explicitly on real mobile width, iPad portrait/landscape, and desktop during each phase of the roadmap — not just at the end — since layouts like the glossary table or the side-by-side diff view are the most likely to break on narrow viewports if not designed with them in mind from the start.

---

## 9. Phased Roadmap

**Phase 1 — Foundations**

- Auth (login, 7-day sessions), base layout/theme/fonts
- Tailwind CSS setup with the shared design-token conventions (Section 8), responsive breakpoints established from the start (mobile, tablet/iPad, desktop) rather than retrofitted later
- Novel CRUD (including raw Chinese description field), chapter CRUD with paste button
- Raw/translated toggle UI for both chapters and novel descriptions (with "not yet translated" state, no AI wired up yet)

**Phase 2 — Glossary & Style Guides**

- Glossary CRUD (manual), categories
- Style guide library CRUD, per-novel assignment

**Phase 3 — AI Pipeline**

- Provider config UI (DeepSeek/OpenRouter key + model selection, encrypted storage, key verification)
- Request/response schemas, DeepSeek + OpenRouter integration modules
- Synchronous "happy path" translation (no queue yet) to validate the contract end-to-end
- Novel description translation wired up via the same pipeline (on-demand, not queued)

**Phase 4 — Queue & Background Processing**

- Scaffold the standalone `/worker` project (Section 5.1): package.json, tsconfig, Dockerfile, shared-schema imports from `/lib`
- Redis + BullMQ setup; verify the worker runs independently locally via `docker-compose` + `npm run dev` in `/worker`
- Migrate translation calls to enqueue/process via the queue
- Job status UI (polling or SSE), translation versioning, retranslate action
- Chapter list status indicator tags (`Untranslated` / `Queued` / `Translating` / `Translated` / `Failed`), driven by `chapters.status` and live `translationJobs` state
- Deploy `/worker` to Render as a Background Worker service; confirm it processes jobs enqueued by the (separately hosted) Next.js app

**Phase 5 — Glossary Intelligence**

- AI-discovered term pending/approval flow
- Conflict flagging against approved terms

**Phase 6 — Polish & Extras**

- Cost/usage dashboard
- Export (EPUB/PDF/plain text)
- Translation memory (hash-based skip)
- Chunking for long chapters
- Diff/side-by-side reading mode (chapters and, where useful, novel descriptions)
- Responsiveness pass/QA across mobile, tablet/iPad, and desktop for any views added after Phase 1 (glossary, style guide library, dashboards) to confirm they hold up at all breakpoints

---

## 10. Decisions (Resolved)

- **Next.js app hosting**: Vercel free tier. At 2-user scale this comfortably covers the traffic and build/invocation limits involved; revisit only if usage grows well beyond that.
- **Redis hosting**: Upstash free tier (256MB storage, 500K commands/month). BullMQ's per-job command overhead is small (roughly 10–20 commands per job), so even generous 2-user usage stays a small fraction of the monthly quota; storage is a non-issue since queue payloads are just IDs/metadata, not chapter text. Use the TCP connection string (not the REST-only URL) for the worker's BullMQ connection, since BullMQ needs standard Redis commands, not just the HTTP REST API.
- **Max character limit for pasted chapters**: implemented as a config constant (not hardcoded), tunable per-provider since output token caps vary by model. Default value: **10,000 Chinese characters** before chunking kicks in — chosen because typical chapters run 2,000–8,000 characters, and Chinese-to-English translation expansion (~1.5–2x in tokens) means this stays safely under most providers' output token limits after expansion.
- **Chapter export**: confirmed for **Phase 6**, alongside the cost/usage dashboard and translation memory — not required for the initial build.

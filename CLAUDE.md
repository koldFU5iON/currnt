# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

All commands run from the **project root** (not a subdirectory). The build spec and reference modules are in `docs/`.

---

## Dev commands

```bash
npm run dev          # start dev server at localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint

npm run db:push      # push schema to Postgres (no migration file)
npm run db:migrate   # create + apply a named migration
npm run db:seed      # seed default CV template + test user (test@example.com/password) + dummy jobs
npm run db:reset     # force-reset DB then re-seed
npm run db:studio    # open Prisma Studio in browser

docker compose up -d   # start Postgres (port 5435)
docker compose down    # stop Postgres
```

---

## Stack

- **Next.js 16 App Router** — `src/` directory, `@/*` import alias resolves to `src/`
- **Prisma 7 + PostgreSQL** — Docker Compose for local dev (port 5435); `prisma.config.ts` handles CLI config
- **Tailwind CSS v4 + shadcn/ui** — neutral palette, `class` dark mode strategy
- **TypeScript strict** throughout
- **Provider-agnostic LLM layer** — Anthropic, OpenAI, Ollama; users bring their own API key

---

## Prisma 7 notes

Prisma 7 moved database connection config out of `schema.prisma` into `prisma.config.ts`.

- `prisma.config.ts` — configures CLI commands (db push, migrate); loads `.env.local` manually since Prisma doesn't load it by default. Pins `schema` to `prisma/schema/` (folder) and `migrations.path` to `prisma/migrations`.
- `prisma/schema/*.prisma` — multi-file schema split by domain (`main`, `auth`, `profile`, `cv`, `cover-letter`, `jobs`, `settings`). Prisma 7 auto-merges every `*.prisma` file in this folder at validate/generate time.
- `src/lib/db.ts` — standard PrismaClient singleton; reads `DATABASE_URL` from environment at runtime (Next.js loads `.env.local` automatically)
- Do **not** put `url` back into the schema files — it's no longer valid in Prisma 7

---

## Module architecture

```
src/
  types/index.ts            ← canonical type definitions (copy from docs/taiilrd/src/types/)
  modules/
    llm/adapter.ts          ← LLMAdapter interface + per-provider implementations
    vault/parser.ts         ← markdown vault parser (gray-matter + prose body)
    builder/cv.ts           ← CV assembly engine; calls llmComplete(), returns CVGeneratedContent
    cover-letter/index.ts   ← draftCoverLetter() (writer mode), generateCoachBriefs() (coach mode)
  app/
    api/                    ← thin route handlers only: validate → call module → return JSON
    (pages)/                ← Next.js App Router pages
  lib/
    db.ts                   ← Prisma singleton
    utils.ts                ← cn(), formatDate(), parseJsonField(), slugify()
    encryption.ts           ← AES-GCM encryption for API keys stored in the DB
  components/
    ui/                     ← shadcn/ui components
```

**Rule**: business logic stays in `src/modules/`. API routes are thin wrappers — no domain logic there.

---

## Key conventions

### JSON-as-string fields

Postgres columns for arrays/JSON are stored as plain strings (for portability with the schema design). Always parse on read, stringify on write:

```ts
// read
const tags = parseJsonField<string[]>(row.tags, [])

// write
await prisma.skill.create({ data: { ...data, tags: JSON.stringify(data.tags) } })
```

### API key security

Keys are encrypted (AES-GCM via `src/lib/encryption.ts`) before DB storage. Never log or return raw keys. Return `hasApiKey: Boolean(llmApiKey)` from API routes instead.

---

## Authentication

Better Auth (`src/lib/auth.ts`) owns the user identity. Each user has exactly one `Profile` row via `Profile.userId` (1:1), auto-created by a `databaseHooks.user.create.after` hook in `auth.ts` on sign-up.

- **Email/password** sign-up is enabled; email verification is **off** for now (flip `requireEmailVerification: true` to enable once a mail provider is wired up)
- **Social providers** (Google, LinkedIn, X via the `twitter` provider key) are scaffolded but each only activates when its `*_CLIENT_ID` + `*_CLIENT_SECRET` env vars are present — see `getEnabledSocialProviders()` in `src/lib/auth.ts`
- **Proxy** (`src/proxy.ts`, formerly `middleware.ts` — renamed for the Next.js 16 convention) gates `/dashboard/:path*` — unauthenticated requests redirect to `/sign-in?callbackUrl=<original>`
- **Server-side session access**: import `requireProfile()` from `src/lib/session.ts` — throws if not signed in, returns `{ session, profile }`. All mutations and queries that touch user-owned data **must** filter by `profile.id`
- **Client-side session access**: `useSession()` from `src/lib/auth-client.ts`
- **Auth API route**: `src/app/api/auth/[...all]/route.ts` (Better Auth catch-all)
- **Auth pages**: `src/app/(auth)/sign-in` and `/sign-up` (route group so they skip dashboard chrome)

Dev login: `test@example.com` / `password` (created by `npm run db:reset`).

---

## Environment variables

```env
DATABASE_URL="postgresql://taiilrd:taiilrd@localhost:5435/taiilrd"

# Better Auth
BETTER_AUTH_SECRET=""              # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"

# Social providers (each only enables if both ID + SECRET are set)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
TWITTER_CLIENT_ID=""               # X uses the "twitter" provider key in Better Auth
TWITTER_CLIENT_SECRET=""

ENCRYPTION_KEY="dev-encryption-key-32-bytes-long!!"
ANTHROPIC_API_KEY=""               # optional server-side fallback

# LLM layer — uses Vercel AI Gateway by default (one key works for any provider)
AI_GATEWAY_API_KEY=""              # required server-side; create at Vercel → AI Gateway → API Keys
LLM_MODEL="anthropic/claude-sonnet-4.6"  # optional override
```

Copy `.env.example` → `.env.local`. Never commit `.env.local`.

---

## External APIs

- `POST /api/jobs/capture` — bearer-token-authed endpoint for agents/scripts/bookmarklets to submit a job URL. Tokens minted at `/dashboard/settings/api-tokens`. See `docs/api-jobs-capture.md` for the full spec + curl examples.
- `GET /api/llm/ping` — session-authed sanity check for the LLM layer. Returns the configured model's reply + latency + usage. Useful when wiring `AI_GATEWAY_API_KEY` for the first time.

## LLM layer

Server-side abstraction over the Vercel AI Gateway in `src/modules/llm/`.

- `complete(prompt, opts?)` — plain text generation
- `completeStructured(prompt, zodSchema, opts?)` — typed JSON output via `Output.object`
- All errors are normalized to `LLMError` with a `kind` field — product code branches on `kind` instead of provider-specific SDK errors

See `docs/llm-layer.md` for usage examples + how to add new providers.

## Reference docs

Full build specification and pre-written module source is in `docs/`:

- `docs/Project Guidance.md` — 11-phase build plan
- `docs/api-jobs-capture.md` — POST /api/jobs/capture spec
- `docs/taiilrd/src/` — reference implementations for types, modules
- `docs/taiilrd/prisma/schema.prisma` — original schema reference
- `docs/taiilrd/vault-examples/` — example markdown vault files

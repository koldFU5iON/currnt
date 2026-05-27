<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file is the source of truth for project conventions, shared by every coding agent that touches this repo (Claude Code, CODEX, Cursor, Aider, Continue, etc.). `CLAUDE.md` imports this file via `@AGENTS.md` so Claude Code reads the same content without duplication.

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
- **Provider-agnostic LLM layer** — Anthropic, OpenAI, Google; users bring their own API key

---

## Prisma 7 notes

Prisma 7 moved database connection config out of `schema.prisma` into `prisma.config.ts`.

- `prisma.config.ts` — configures CLI commands (db push, migrate); loads `.env.local` manually since Prisma doesn't load it by default. Pins `schema` to `prisma/schema/` (folder) and `migrations.path` to `prisma/migrations`.
- `prisma/schema/*.prisma` — multi-file schema split by domain (`main`, `auth`, `profile`, `cv`, `cover-letter`, `jobs`, `settings`). Prisma 7 auto-merges every `*.prisma` file in this folder at validate/generate time.
- `src/lib/db.ts` — PrismaClient singleton wired through the `PrismaPg` driver adapter with a `pg` connection pool; reads `DATABASE_URL` from environment at runtime (Next.js loads `.env.local` automatically)
- Do **not** put `url` back into the schema files — it's no longer valid in Prisma 7

---

## Module architecture

```
src/
  modules/                  ← all domain/business logic lives here
    api-tokens/             ← bearer-token issuance + verification for /api/jobs/capture
    jobs/                   ← job URL extraction, application records, AI job-fit scoring
    llm/                    ← provider-agnostic LLM layer (client.ts, actions.ts, errors.ts)
    onboarding/             ← lightweight job-search context captured in UserSettings
    profile/                ← career profile queries/mutations (read via parseJsonField for legacy tags)
  app/
    api/                    ← thin route handlers only: validate → call module → return JSON
    (auth)/                 ← sign-in / sign-up route group (skips dashboard chrome)
    dashboard/              ← authenticated app pages, gated by src/proxy.ts
  lib/
    db.ts                   ← PrismaClient singleton (PrismaPg adapter + pg Pool)
    auth.ts                 ← Better Auth server config; databaseHooks auto-create Profile rows
    auth-client.ts          ← client-side useSession() hook
    session.ts              ← requireProfile() — throws if not signed in
    utils.ts                ← cn(), formatDate(), parseJsonField(), slugify()
    encryption.ts           ← AES-GCM encryption for API keys stored in the DB
  components/
    ui/                     ← shadcn/ui components
```

**Rule**: business logic stays in `src/modules/`. API routes and Server Actions are thin wrappers — no domain logic there.

New domain features get their own `src/modules/<name>/` directory. The conventional file split is `queries.ts` (reads), `actions.ts` (Server Actions / mutations), `schema.ts` (Zod schemas + types) — see `src/modules/onboarding/` for the canonical small-module shape.

---

## Key conventions

### Storing structured data in Postgres

Two patterns coexist in the schema. **Prefer the native pattern for new fields**; the legacy pattern stays for existing profile columns.

**Native Postgres types (preferred for new schema fields)** — use `Json?` for arbitrary JSON objects and `String[]` for string arrays. Validate the shape at the boundary with Zod (see `src/modules/onboarding/schema.ts` for the canonical example) and use `Prisma.JsonNull` when clearing a `Json?` column:

```ts
// schema: onboardingContext Json?
import { Prisma } from "@prisma/client"
import { normalizeOnboardingContext } from "@/modules/onboarding/schema"

const context = normalizeOnboardingContext(row.onboardingContext) // Zod parse on read
await prisma.userSettings.update({
  where: { profileId },
  data: { onboardingContext: context },            // write the object directly
})
// to clear:
await prisma.userSettings.update({
  where: { profileId },
  data: { onboardingContext: Prisma.JsonNull },
})
```

**Stringified JSON (legacy — existing profile columns only)** — `Profile.experience.tags`, `Skill.tags`, etc. are typed as `String @default("[]")`. Read with `parseJsonField`, write with `JSON.stringify`. Do not introduce new fields in this pattern; migrate existing ones opportunistically only if you have a reason to touch them:

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

ENCRYPTION_KEY="dev-encryption-key-32-bytes-long!!"  # AES-256-GCM key for at-rest secrets (LLM keys, etc.)
```

The LLM layer is bring-your-own-key — each user enters their own provider API key at `/dashboard/settings/llm`. No app-level LLM env vars; costs land on the user, not the app owner.

Copy `.env.example` → `.env.local`. Never commit `.env.local`.

### Production database SSL

The production `DATABASE_URL` on Vercel must include an **explicit `sslmode`** to suppress the upcoming `pg-connection-string` v3.0 / `pg` v9.0 deprecation warning (which currently emits `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'` in runtime logs). When those libraries upgrade, the implicit aliasing drops and SSL semantics change unexpectedly unless we're explicit now.

Append one of these to the prod connection string:

- **`?sslmode=verify-full`** (preferred) — preserves current behavior with full cert chain + hostname validation. Works on Neon, Supabase, and most managed Postgres. Try this first.
- **`?uselibpqcompat=true&sslmode=require`** (fallback) — only if `verify-full` fails to connect because the provider's cert chain doesn't validate cleanly. Adopts standard libpq semantics, which are weaker; treat as a last resort.

Update the Vercel `DATABASE_URL` env var (Production scope) via dashboard or `vercel env`. Local Docker Postgres at `localhost:5435` does not enable SSL and is unaffected — the `.env.local` value stays as-is.

---

## External APIs

- `POST /api/jobs/capture` — bearer-token-authed endpoint for agents/scripts/bookmarklets to submit a job URL. Tokens minted at `/dashboard/settings/api-tokens`. See `docs/api-jobs-capture.md` for the full spec + curl examples.
- `GET /api/llm/ping` — session-authed sanity check that runs a tiny `pong` round-trip using the signed-in user's saved LLM key. Useful right after wiring up their key in `/dashboard/settings/llm`.

## LLM layer

Bring-your-own-key — each user supplies their own provider API key. Server-side
abstraction in `src/modules/llm/`:

- `complete(profileId, prompt, opts?)` — plain text generation
- `completeStructured(profileId, prompt, zodSchema, opts?)` — typed JSON output via `Output.object`
- All errors normalize to `LLMError` with a `kind` field; product code branches on `kind` instead of provider-specific SDK errors
- `getLLMConfigStatus(profileId)` — cheap read-only check for "is this user set up?"

Providers wired in: Anthropic, OpenAI, Google. Adding more is a single entry in
the `PROVIDERS` map in `client.ts`. See `docs/llm-layer.md` for usage examples.

## Reference docs

Full build specification and pre-written module source is in `docs/`:

- `docs/Project Guidance.md` — 11-phase build plan
- `docs/api-jobs-capture.md` — POST /api/jobs/capture spec
- `docs/taiilrd/src/` — reference implementations for types, modules
- `docs/taiilrd/prisma/schema.prisma` — original schema reference
- `docs/taiilrd/vault-examples/` — example markdown vault files

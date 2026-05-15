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
npm run db:seed      # seed default CV template and blank profile
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

- `prisma.config.ts` — configures CLI commands (db push, migrate); loads `.env.local` manually since Prisma doesn't load it by default
- `src/lib/db.ts` — standard PrismaClient singleton; reads `DATABASE_URL` from environment at runtime (Next.js loads `.env.local` automatically)
- Do **not** put `url` back into `schema.prisma` — it's no longer valid in Prisma 7

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

### Single-user mode

No authentication. All data belongs to the one `Profile` row created by the seed. Routes use `prisma.profile.findFirst()`.

---

## Environment variables

```env
DATABASE_URL="postgresql://taiilrd:taiilrd@localhost:5435/taiilrd"
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="dev-encryption-key-32-bytes-long!!"
ANTHROPIC_API_KEY=""        # optional server-side fallback
```

Copy `.env.example` → `.env.local`. Never commit `.env.local`.

---

## Reference docs

Full build specification and pre-written module source is in `docs/`:

- `docs/Project Guidance.md` — 11-phase build plan
- `docs/taiilrd/src/` — reference implementations for types, modules
- `docs/taiilrd/prisma/schema.prisma` — original schema reference
- `docs/taiilrd/vault-examples/` — example markdown vault files

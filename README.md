# Job Search Operations

A structured system for tracking job applications, assessing fit, and presenting yourself clearly. Open source, bring your own AI key.

→ **Hosted version:** [your-deployment-url]  
→ **GitHub:** https://github.com/koldFU5iON/resume

---

## Local development

### Prerequisites

- Node.js 20+
- Docker (for Postgres)

### 1. Clone and install

```bash
git clone https://github.com/koldFU5iON/resume.git
cd resume
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```env
DATABASE_URL="postgresql://taiilrd:taiilrd@localhost:5435/taiilrd"

BETTER_AUTH_SECRET=""        # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"

ENCRYPTION_KEY="dev-encryption-key-32-bytes-long!!"
```

Social login (Google, LinkedIn, X) is optional — each provider only activates when both its `_CLIENT_ID` and `_CLIENT_SECRET` are set.

### 3. Start Postgres

```bash
docker compose up -d
```

### 4. Set up the database

```bash
npm run db:reset    # creates schema, runs migrations, seeds test data
```

This creates a test account: **test@example.com** / **password**

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Other useful commands

```bash
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint

npm run db:studio        # Open Prisma Studio in browser
npm run db:migrate       # Create + apply a named migration
npm run db:push          # Push schema changes without a migration file
npm run db:seed          # Re-seed without resetting the schema

docker compose down      # Stop Postgres
```

---

## Stack

- **Next.js 16** App Router, `src/` directory, TypeScript strict
- **Prisma 7 + PostgreSQL** — multi-file schema in `prisma/schema/`
- **Tailwind CSS v4 + shadcn/ui** — neutral palette, dark mode via `class` strategy
- **Provider-agnostic LLM layer** — users bring their own Anthropic / OpenAI / Google API key; no app-level AI costs

## Bring your own AI key

This app has no built-in AI billing. Each user adds their own API key at `/dashboard/settings/llm`. Keys are encrypted at rest (AES-GCM). The AI never runs on a shared account.

## Contributing

Issues and PRs welcome. See open issues for what's being worked on.

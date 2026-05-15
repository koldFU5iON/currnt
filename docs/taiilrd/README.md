# Taiilrd

**Open source CV builder and job tracker with AI-powered tailoring.**

Taiilrd treats your work history as a rich, unfiltered dataset — then uses AI to assemble tailored CVs and cover letters for each role you chase, like a jigsaw puzzle that always follows the same formula but selects the right pieces for the job.

---

## Why this exists

Most CV tools ask you to give an LLM a job description and say "build me a CV." The output is generic because the input is sparse.

Taiilrd works differently. You maintain a **Profile Vault** — atomic markdown files for each skill, experience, project, and achievement, written in full prose with no summarisation. When you target a role, the LLM reads your full profile and *selects* the right pieces, *shapes* the language, and *assembles* a CV tailored to that specific job. The richer your vault, the better the output.

---

## Core modules

### Profile Vault
Your career in atomic pieces. Markdown files with YAML frontmatter for structure and freeform prose for richness. Human-readable, LLM-parseable.

```
vault/
  skills/
    marketing-strategy.md
    n8n-workflow-automation.md
  experience/
    acme-corp-head-of-marketing.md
    previous-role.md
  projects/
    echo-playtesting-program.md
    kyros-portfolio-intelligence.md
  education/
    bsc-communications.md
  certifications/
    google-analytics.md
```

### CV Builder
- Paste a job description
- Select a template (global standard + regional variants)
- AI reads your full vault, selects and shapes the right content
- Review the tailoring notes — see what was picked and why
- Export to PDF or DOCX

### Cover Letter — Two Modes
**Writer mode**: AI drafts the full letter from your profile and the JD. Edit, approve, export.

**Coach mode**: AI analyses the role and briefs you section by section — what your intro should accomplish, which proof point to use, how to frame your fit. You write it. The AI evaluates your draft, scores it, and gives concrete feedback. Your words, your voice, AI-quality thinking behind it.

### Job Tracker
Pipeline view of all applications. Status tracking, contacts, interview notes, timeline events. Each application links to its CV and cover letter.

---

## Tech stack

- **Next.js 14** (App Router)
- **Prisma** with SQLite (self-hosted) or PostgreSQL (cloud)
- **Tailwind CSS** + shadcn/ui
- **LLM abstraction layer** — bring your own API key (Anthropic, OpenAI, Ollama)

---

## Getting started

```bash
# Clone the repo
git clone https://github.com/your-org/taiilrd
cd taiilrd

# Install dependencies
npm install

# Set up your database
cp .env.example .env
npm run db:push

# Seed default templates
npm run db:seed

# Start the dev server
npm run dev
```

### Environment variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Optional: native hosted LLM (for paid tier)
ANTHROPIC_API_KEY=""

# App
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
```

### Bring your own API key

In Settings, add your API key from any supported provider:
- **Anthropic** — Claude models
- **OpenAI** — GPT models
- **Ollama** — local models, no key required

---

## Architecture

```
src/
  types/           # Core TypeScript types — the source of truth
  modules/
    llm/           # Provider-agnostic LLM adapter
    vault/         # Markdown parser and profile extractor
    builder/       # CV assembly engine + template system
    cover-letter/  # Writer mode + coach mode
    tracker/       # Job application pipeline
    export/        # PDF and DOCX generation
    templates/     # Template registry (built-in + community)
  app/             # Next.js App Router pages and API routes
  components/      # React components
  lib/             # DB client, utils
prisma/
  schema.prisma    # Database schema
```

### Adding a new LLM provider

1. Implement the `LLMAdapter` interface in `src/modules/llm/adapter.ts`
2. Register it in the `adapters` map
3. Add a default model to `DEFAULT_MODELS`

### Adding a new CV template

Templates are stored in the database and can be contributed via the community. To add a built-in template, add it to `prisma/seed.ts`.

---

## Contributing

This is a community tool. Everyone is welcome to contribute templates, LLM adapters, translations, or features. See `CONTRIBUTING.md`.

---

## Roadmap

- [ ] Vault UI — create and edit profile files in-app
- [ ] Template library — community-contributed regional templates
- [ ] ATS score — estimate how well a CV will parse through applicant tracking systems
- [ ] Browser extension — capture job listings directly from job boards
- [ ] Mobile — review and manage applications on the go
- [ ] Local vault sync — read/write markdown files from disk (Obsidian-compatible)
- [ ] Ollama support — fully offline mode for privacy-conscious users

---

## Licence

MIT — free to use, fork, and build on.

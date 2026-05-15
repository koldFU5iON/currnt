# Taiilrd — Claude Code Build Plan
# Foundation Phase

You are building the foundational scaffold for **Taiilrd**, an open source CV builder and job tracker with AI-powered tailoring. This document is your complete build specification. Work through each phase in order. Do not skip phases. Verify each phase compiles and runs before proceeding.

---

## Project Overview

Taiilrd lets users maintain a rich markdown-based profile vault (skills, experiences, projects) and use AI to assemble tailored CVs and cover letters for specific job applications. The architecture is:

- **Next.js 14 App Router** — frontend + API in one project
- **Prisma + SQLite** — database (SQLite for local dev, swappable to Postgres)
- **Tailwind CSS + shadcn/ui** — styling
- **TypeScript** — strict throughout
- **Provider-agnostic LLM layer** — users bring their own API key

---

## Reference Files

The following files have already been designed and should be used as the source of truth. Copy their contents exactly when creating these files:

- `src/types/index.ts` — all core TypeScript types
- `prisma/schema.prisma` — database schema
- `src/modules/llm/adapter.ts` — LLM abstraction layer
- `src/modules/vault/parser.ts` — markdown vault parser
- `src/modules/builder/cv.ts` — CV assembly engine
- `src/modules/cover-letter/index.ts` — cover letter module
- `vault-examples/` — example markdown vault files

These files exist in the project already. Do not rewrite them unless a phase explicitly asks you to.

---

## Phase 1 — Project Initialisation

### 1.1 Bootstrap Next.js

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

Accept all defaults. Do not use Turbopack (stability).

### 1.2 Install dependencies

```bash
npm install \
  @prisma/client \
  prisma \
  nanoid \
  js-yaml \
  @types/js-yaml \
  gray-matter \
  zod \
  @tanstack/react-query \
  axios

npm install -D \
  tsx \
  @types/node
```

### 1.3 Install shadcn/ui

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

Then install the components we need:

```bash
npx shadcn@latest add button card input label textarea badge tabs dialog sheet select toast progress separator skeleton
```

### 1.4 Environment setup

Create `.env.local`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

Create `.env.example` with the same keys but empty values. Commit `.env.example`, not `.env.local`.

### 1.5 Create `.gitignore` additions

Append to the generated `.gitignore`:

```
.env.local
.env
dev.db
dev.db-journal
*.db
*.db-journal
vault/
```

### Verification

```bash
npm run dev
```

App should load at `http://localhost:3000` with the default Next.js page.

---

## Phase 2 — Database Setup

### 2.1 Prisma schema

The schema is already defined in `prisma/schema.prisma`. Verify it exists and is complete. It should contain models for: Profile, Skill, Experience, Achievement, Project, Education, Certification, CVTemplate, CVDocument, CoverLetterDocument, JobApplication, ApplicationContact, ApplicationEvent, UserSettings, and all junction tables.

### 2.2 Push schema to database

```bash
npx prisma db push
```

### 2.3 Create Prisma client singleton

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 2.4 Create database seed

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { DEFAULT_GLOBAL_TEMPLATE } from '../src/modules/builder/cv'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default CV template
  const existing = await prisma.cVTemplate.findFirst({
    where: { isDefault: true },
  })

  if (!existing) {
    await prisma.cVTemplate.create({
      data: {
        name: DEFAULT_GLOBAL_TEMPLATE.name,
        region: DEFAULT_GLOBAL_TEMPLATE.region,
        description: DEFAULT_GLOBAL_TEMPLATE.description,
        sections: JSON.stringify(DEFAULT_GLOBAL_TEMPLATE.sections),
        isDefault: DEFAULT_GLOBAL_TEMPLATE.isDefault,
        isBuiltIn: DEFAULT_GLOBAL_TEMPLATE.isBuiltIn,
      },
    })
    console.log('Created default CV template')
  }

  // Create a default profile for single-user mode
  const profile = await prisma.profile.findFirst()
  if (!profile) {
    await prisma.profile.create({
      data: {
        name: 'Your Name',
        headline: 'Your professional headline',
      },
    })
    console.log('Created default profile')
  }

  console.log('Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Add to `package.json` scripts:

```json
"db:seed": "tsx prisma/seed.ts",
"db:push": "prisma db push",
"db:studio": "prisma studio",
"db:reset": "prisma db push --force-reset && tsx prisma/seed.ts"
```

Add to `package.json` at root level:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run the seed:

```bash
npm run db:seed
```

### Verification

```bash
npx prisma studio
```

Should show all tables with the seeded template and profile.

---

## Phase 3 — Core Module Integration

### 3.1 Replace the vault parser

The existing `src/modules/vault/parser.ts` uses a hand-rolled YAML parser. Replace it to use `gray-matter` for robustness:

```typescript
// src/modules/vault/parser.ts
// Replace the splitFrontmatter and parseYAML functions with:

import matter from 'gray-matter'

export function parseVaultFile(content: string, filePath: string): VaultFile {
  const { data: frontmatter, content: body } = matter(content)
  const type = frontmatter.type as VaultFileType

  if (!type || !VAULT_FRONTMATTER_TEMPLATES[type]) {
    throw new VaultParseError(
      `Invalid or missing "type" in frontmatter. Expected one of: ${Object.keys(VAULT_FRONTMATTER_TEMPLATES).join(', ')}`,
      filePath
    )
  }

  return {
    type,
    slug: filePathToSlug(filePath),
    frontmatter,
    body: body.trim(),
    filePath,
  }
}

export function serialiseVaultFile(file: VaultFile): string {
  return matter.stringify(file.body, file.frontmatter)
}
```

Keep everything else in the file as-is.

### 3.2 Create utility helpers

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
```

Install missing utility:

```bash
npm install clsx tailwind-merge
```

### 3.3 Create API key encryption utility

Create `src/lib/encryption.ts`:

```typescript
// Simple encryption for API keys stored in the database.
// Uses AES-GCM via the Web Crypto API (available in Node 18+).
// The ENCRYPTION_KEY env var should be a 32-byte hex string.

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

function getKeyMaterial(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    // In development, use a deterministic fallback (not for production)
    return 'dev-encryption-key-32-bytes-long!!'
  }
  return key
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(getKeyMaterial().slice(0, 32))
  return crypto.subtle.importKey('raw', keyData, ALGORITHM, false, ['encrypt', 'decrypt'])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  )

  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return Buffer.from(combined).toString('base64')
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey()
  const combined = Buffer.from(ciphertext, 'base64')
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  )

  return new TextDecoder().decode(plaintext)
}
```

Add to `.env.local`:

```env
ENCRYPTION_KEY="dev-encryption-key-32-bytes-long!!"
```

---

## Phase 4 — API Routes

Create all API routes under `src/app/api/`. Each route file exports HTTP method handlers. Use Zod for request validation throughout.

### 4.1 Profile API

Create `src/app/api/profile/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  linkedIn: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
})

// GET /api/profile — get the primary profile
export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: {
          include: {
            achievements: true,
            skills: { include: { skill: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        projects: {
          include: { skills: { include: { skill: true } } },
          orderBy: { startDate: 'desc' },
        },
        educations: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
        settings: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/profile — update profile fields
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const validated = UpdateProfileSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }

    const profile = await prisma.profile.findFirst()
    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 })
    }

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: validated.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4.2 Skills API

Create `src/app/api/vault/skills/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const SkillSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['technical', 'soft', 'domain', 'tool', 'language']),
  level: z.enum(['familiar', 'proficient', 'expert']),
  yearsOfExperience: z.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst()
    if (!profile) return NextResponse.json([], { status: 200 })

    const skills = await prisma.skill.findMany({
      where: { profileId: profile.id },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(
      skills.map((s) => ({ ...s, tags: JSON.parse(s.tags || '[]') }))
    )
  } catch (error) {
    console.error('GET /api/vault/skills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = SkillSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }

    const profile = await prisma.profile.findFirst()
    if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

    const skill = await prisma.skill.create({
      data: {
        ...validated.data,
        tags: JSON.stringify(validated.data.tags),
        profileId: profile.id,
      },
    })

    return NextResponse.json({ ...skill, tags: validated.data.tags }, { status: 201 })
  } catch (error) {
    console.error('POST /api/vault/skills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Create `src/app/api/vault/skills/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const UpdateSkillSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['technical', 'soft', 'domain', 'tool', 'language']).optional(),
  level: z.enum(['familiar', 'proficient', 'expert']).optional(),
  yearsOfExperience: z.number().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const skill = await prisma.skill.findUnique({ where: { id: params.id } })
    if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...skill, tags: JSON.parse(skill.tags || '[]') })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const validated = UpdateSkillSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }

    const data: Record<string, unknown> = { ...validated.data }
    if (validated.data.tags) {
      data.tags = JSON.stringify(validated.data.tags)
    }

    const skill = await prisma.skill.update({ where: { id: params.id }, data })
    return NextResponse.json({ ...skill, tags: JSON.parse(skill.tags || '[]') })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.skill.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4.3 Experiences API

Create `src/app/api/vault/experiences/route.ts` and `src/app/api/vault/experiences/[id]/route.ts` following the exact same pattern as skills, with this schema:

```typescript
const ExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string(), // ISO date string
  endDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  remote: z.boolean().default(false),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
})
```

Include achievements as nested creates on POST. On GET, include achievements and skills.

### 4.4 Projects API

Create `src/app/api/vault/projects/route.ts` and `src/app/api/vault/projects/[id]/route.ts` following the same pattern with this schema:

```typescript
const ProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url().optional().nullable(),
  repoUrl: z.string().url().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  highlights: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
})
```

### 4.5 LLM API route

Create `src/app/api/llm/cv/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildCV } from '@/modules/builder/cv'
import { decrypt } from '@/lib/encryption'
import { z } from 'zod'

const BuildCVSchema = z.object({
  jobDescription: z.string().min(50, 'Job description must be at least 50 characters'),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  templateId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = BuildCVSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }

    // Load profile with all vault data
    const profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: { include: { achievements: true } },
        projects: true,
        educations: true,
        certifications: true,
        settings: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 })
    }

    if (!profile.settings?.llmApiKey && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'No LLM API key configured. Add your API key in Settings.' },
        { status: 400 }
      )
    }

    // Decrypt stored API key or fall back to env
    const apiKey = profile.settings?.llmApiKey
      ? await decrypt(profile.settings.llmApiKey)
      : process.env.ANTHROPIC_API_KEY

    // Load template
    const templateId = validated.data.templateId || profile.settings?.defaultTemplateId
    const template = templateId
      ? await prisma.cVTemplate.findUnique({ where: { id: templateId } })
      : await prisma.cVTemplate.findFirst({ where: { isDefault: true } })

    if (!template) {
      return NextResponse.json({ error: 'No CV template found' }, { status: 404 })
    }

    // Map Prisma profile to domain type
    const domainProfile = mapPrismaProfileToDomain(profile)

    // Build the CV
    const result = await buildCV({
      profile: domainProfile,
      jobDescription: validated.data.jobDescription,
      jobTitle: validated.data.jobTitle,
      company: validated.data.company,
      template: {
        ...template,
        sections: JSON.parse(template.sections),
      },
      llmConfig: {
        provider: (profile.settings?.llmProvider as any) || 'anthropic',
        apiKey: apiKey || undefined,
        model: profile.settings?.llmModel || 'claude-sonnet-4-20250514',
        baseUrl: profile.settings?.llmBaseUrl || undefined,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/llm/cv error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Maps Prisma DB result to domain UserProfile type
function mapPrismaProfileToDomain(prismaProfile: any): any {
  return {
    ...prismaProfile,
    skills: prismaProfile.skills.map((s: any) => ({
      ...s,
      tags: JSON.parse(s.tags || '[]'),
    })),
    experiences: prismaProfile.experiences.map((e: any) => ({
      ...e,
      tags: JSON.parse(e.tags || '[]'),
      achievements: e.achievements.map((a: any) => ({
        ...a,
        tags: JSON.parse(a.tags || '[]'),
        skillIds: [],
      })),
      skillIds: [],
    })),
    projects: prismaProfile.projects.map((p: any) => ({
      ...p,
      tags: JSON.parse(p.tags || '[]'),
      highlights: JSON.parse(p.highlights || '[]'),
      skillIds: [],
    })),
    education: prismaProfile.educations.map((e: any) => ({
      ...e,
      tags: JSON.parse(e.tags || '[]'),
    })),
    certifications: prismaProfile.certifications.map((c: any) => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      skillIds: [],
    })),
  }
}
```

Create `src/app/api/llm/cover-letter/route.ts` following the same pattern, calling `draftCoverLetter` or `generateCoachBriefs` based on a `mode` field in the request body.

### 4.6 Settings API

Create `src/app/api/settings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { z } from 'zod'

const SettingsSchema = z.object({
  llmProvider: z.enum(['anthropic', 'openai', 'ollama', 'google', 'custom']).optional(),
  llmModel: z.string().optional(),
  llmApiKey: z.string().optional(), // will be encrypted before storage
  llmBaseUrl: z.string().url().optional().nullable(),
  defaultTemplateId: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  exportFormat: z.enum(['pdf', 'docx']).optional(),
})

export async function GET() {
  const profile = await prisma.profile.findFirst({ include: { settings: true } })
  if (!profile?.settings) return NextResponse.json(null)

  // Never return the raw API key
  const { llmApiKey, ...safeSettings } = profile.settings
  return NextResponse.json({
    ...safeSettings,
    hasApiKey: Boolean(llmApiKey),
  })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const validated = SettingsSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }

    const profile = await prisma.profile.findFirst()
    if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

    const data: Record<string, unknown> = { ...validated.data }

    // Encrypt API key before storing
    if (validated.data.llmApiKey) {
      data.llmApiKey = await encrypt(validated.data.llmApiKey)
    }

    const settings = await prisma.userSettings.upsert({
      where: { profileId: profile.id },
      update: data,
      create: { profileId: profile.id, ...data },
    })

    const { llmApiKey, ...safeSettings } = settings
    return NextResponse.json({ ...safeSettings, hasApiKey: Boolean(llmApiKey) })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4.7 Job tracker API

Create `src/app/api/tracker/route.ts` and `src/app/api/tracker/[id]/route.ts` with full CRUD following the same pattern with this schema:

```typescript
const JobApplicationSchema = z.object({
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  jobDescription: z.string().optional().nullable(),
  jobUrl: z.string().url().optional().nullable(),
  location: z.string().optional().nullable(),
  remote: z.boolean().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  currency: z.string().default('EUR'),
  status: z.enum(['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived']).default('saved'),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
})
```

---

## Phase 5 — Application Layout

### 5.1 Root layout

Replace `src/app/layout.tsx` with a layout that includes:
- A persistent left sidebar for navigation (desktop)
- A bottom navigation bar (mobile)
- Proper HTML metadata
- Tailwind dark mode support via `class` strategy

The sidebar navigation items:
1. **Dashboard** — `/dashboard` — icon: LayoutDashboard
2. **Vault** — `/vault` — icon: Database
3. **CV Builder** — `/builder` — icon: FileText
4. **Cover Letter** — `/cover-letter` — icon: PenLine
5. **Job Tracker** — `/tracker` — icon: Briefcase
6. **Settings** — `/settings` — icon: Settings

Install lucide-react:

```bash
npm install lucide-react
```

The layout should be clean and functional — not decorative. Use the shadcn/ui neutral palette. Sidebar width: 240px on desktop, hidden on mobile. Content area: full remaining width with appropriate padding.

### 5.2 Root redirect

Create `src/app/page.tsx` that redirects to `/dashboard`.

### 5.3 Dashboard page

Create `src/app/dashboard/page.tsx` as a server component that:
- Fetches the profile summary (counts of skills, experiences, projects)
- Fetches recent job applications (last 5)
- Renders stat cards: total skills, total experiences, total projects, active applications
- Renders a recent applications list with status badges
- Renders a "Quick Actions" section with links to: Add Skill, Add Experience, Build CV, Track Application

Keep it simple and functional. No charts yet.

---

## Phase 6 — Vault UI

The vault is the heart of the app. Build it as a tabbed interface.

### 6.1 Vault page shell

Create `src/app/vault/page.tsx`:
- Tabs: Skills | Experience | Projects | Education | Certifications
- Each tab loads its content lazily
- "Add new" button in the top right, context-aware to the active tab

### 6.2 Skills tab

Create `src/app/vault/_components/SkillsTab.tsx` as a client component:
- Fetches skills from `GET /api/vault/skills`
- Displays skills as cards grouped by category
- Each card shows: name, level badge, years of experience, tags
- Click a card to open an edit sheet (shadcn Sheet component)
- "Add Skill" button opens the same sheet in create mode
- Delete button on each card with confirmation

The skill form fields:
- Name (text input)
- Category (select: technical, soft, domain, tool, language)
- Level (select: familiar, proficient, expert)
- Years of experience (number input, optional)
- Tags (text input, comma-separated, displayed as badges)
- Notes (textarea, markdown — no preview needed yet)

### 6.3 Experience tab

Create `src/app/vault/_components/ExperienceTab.tsx`:
- Lists experiences chronologically (most recent first)
- Each experience shows as a card: role, company, dates, summary excerpt, skill tags
- Click to expand or open a full edit view
- Achievements are listed within the experience editor as a dynamic list (add/remove rows)

### 6.4 Projects tab

Create `src/app/vault/_components/ProjectsTab.tsx`:
- Grid of project cards
- Each card: name, status badge, description excerpt, skill tags, links if present
- Same sheet-based edit pattern

---

## Phase 7 — CV Builder UI

### 7.1 Builder page

Create `src/app/builder/page.tsx`:

**Step 1 — Job input**
- Large textarea for job description (paste the full JD)
- Fields for job title and company name (optional but recommended)
- Template selector (dropdown, populated from `GET /api/templates`)
- "Build CV" button

**Step 2 — Loading state**
- Show a progress indicator while the LLM is working
- Display encouraging copy: "Reading your profile...", "Selecting relevant experience...", "Assembling your CV..."
- Use a simple animated state machine, not a real progress bar (we don't have progress events yet)

**Step 3 — Review**
- Show the tailoring notes in a highlighted panel: "Here's what was selected and why"
- Show the generated CV sections, editable
- Action buttons: "Export PDF", "Save Draft", "Start Over"

### 7.2 Templates API

Create `src/app/api/templates/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const templates = await prisma.cVTemplate.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(
    templates.map((t) => ({ ...t, sections: JSON.parse(t.sections) }))
  )
}
```

---

## Phase 8 — Job Tracker UI

### 8.1 Tracker page

Create `src/app/tracker/page.tsx`:
- Kanban-style column view of applications by status
- Columns: Saved → Applied → Screening → Interviewing → Offer
- Each card shows: job title, company, date added, any linked CV
- Drag between columns to update status (use `@dnd-kit/core`)
- "Add Application" button opens a sheet

Install drag and drop:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 8.2 Application detail

Create `src/app/tracker/[id]/page.tsx`:
- Full application detail view
- Status timeline (events log)
- Linked CV and cover letter (with links to view/edit)
- Contacts list
- Notes textarea (auto-saves on blur)

---

## Phase 9 — Settings UI

Create `src/app/settings/page.tsx`:

**LLM Configuration section:**
- Provider selector: Anthropic | OpenAI | Ollama | Custom
- API Key field (masked input, shows "Key saved" when one exists, "Clear" button)
- Model field (text input with placeholder showing the default for selected provider)
- Base URL field (only shown for Ollama/Custom)
- Test Connection button — calls `POST /api/settings/test` which makes a minimal LLM call

**Preferences section:**
- Default template selector
- Theme selector: Light | Dark | System
- Export format: PDF | DOCX

**Profile section:**
- Name, email, phone, location, website, LinkedIn, GitHub, headline
- All editable inline

---

## Phase 10 — Cover Letter UI

Create `src/app/cover-letter/page.tsx`:

**Mode selector** — prominent choice at the top:
- "Write it for me" (writer mode) — AI drafts the full letter
- "Help me write it" (coach mode) — AI guides you section by section

**Writer mode flow:**
1. Job description input (same as CV builder — consider a shared component)
2. Generate button
3. Review: four editable section cards, assembled letter preview below
4. Export button

**Coach mode flow:**
1. Job description input
2. "Get my briefs" button — calls `POST /api/llm/cover-letter` with `mode: 'coach'`
3. Section cards appear, each with:
   - The coaching brief (what this section should accomplish)
   - A textarea for the user to write their draft
   - "Evaluate" button per section
   - Feedback panel: score (1–10), strengths, suggestions
4. Assembled preview updates as sections are approved
5. Export button

---

## Phase 11 — Final Checks

### 11.1 TypeScript

```bash
npm run typecheck
```

Fix all type errors. Do not use `any` except in the Prisma mapping function in the LLM route (which is explicitly noted).

### 11.2 Lint

```bash
npm run lint
```

Fix all lint errors.

### 11.3 Build

```bash
npm run build
```

Must complete without errors.

### 11.4 Smoke test

Start the app and verify:
- [ ] App loads at localhost:3000 and redirects to /dashboard
- [ ] Dashboard shows profile stats
- [ ] Can add a skill in the Vault
- [ ] Can add an experience in the Vault
- [ ] Settings page loads and accepts an API key
- [ ] CV Builder page loads and shows the job description input
- [ ] Job Tracker shows the kanban board
- [ ] Cover Letter page shows the mode selector
- [ ] No console errors on any page

---

## File Structure (final)

```
taiilrd/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    → redirects to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── vault/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   │       ├── SkillsTab.tsx
│   │   │       ├── ExperienceTab.tsx
│   │   │       └── ProjectsTab.tsx
│   │   ├── builder/
│   │   │   └── page.tsx
│   │   ├── cover-letter/
│   │   │   └── page.tsx
│   │   ├── tracker/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── profile/
│   │       │   └── route.ts
│   │       ├── vault/
│   │       │   ├── skills/
│   │       │   │   ├── route.ts
│   │       │   │   └── [id]/route.ts
│   │       │   ├── experiences/
│   │       │   │   ├── route.ts
│   │       │   │   └── [id]/route.ts
│   │       │   └── projects/
│   │       │       ├── route.ts
│   │       │       └── [id]/route.ts
│   │       ├── llm/
│   │       │   ├── cv/route.ts
│   │       │   └── cover-letter/route.ts
│   │       ├── templates/
│   │       │   └── route.ts
│   │       ├── tracker/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       └── settings/
│   │           └── route.ts
│   ├── modules/
│   │   ├── llm/adapter.ts              ← existing
│   │   ├── vault/parser.ts             ← existing (update to use gray-matter)
│   │   ├── builder/cv.ts               ← existing
│   │   └── cover-letter/index.ts       ← existing
│   ├── lib/
│   │   ├── db.ts
│   │   ├── utils.ts
│   │   └── encryption.ts
│   └── types/
│       └── index.ts                    ← existing
├── vault-examples/                     ← existing
├── .env.local
├── .env.example
├── .gitignore
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Notes for Claude Code

- Work phase by phase. Complete and verify each phase before moving to the next.
- When implementing the Experience and Project APIs (Phase 4.3 and 4.4), follow the exact same pattern as the Skills API — do not invent a different pattern.
- The modules in `src/modules/` are the business logic. The API routes in `src/app/api/` are thin wrappers that load data, call the module, and return the result. Keep them separate.
- All JSON array fields in Prisma (tags, highlights, sections) are stored as strings and must be parsed on read and stringified on write. Use `parseJsonField` from `src/lib/utils.ts`.
- Never log API keys. Never return API keys from API routes. Always check `hasApiKey` instead.
- If a phase produces TypeScript errors, fix them before proceeding.
- If you are uncertain about a decision not covered in this document, prefer simplicity and consistency with existing patterns over cleverness.

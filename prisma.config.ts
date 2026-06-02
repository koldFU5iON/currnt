import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma CLI doesn't load .env.local (Next.js convention) — bridge the gap.
// Skip if DATABASE_URL is already set (Vercel build env, shell export, etc.)
if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(path.join(process.cwd(), '.env.local')) } catch {}
}

export default defineConfig({
  // Multi-file schema directory — Prisma 7 auto-merges every *.prisma file.
  schema: path.join('prisma', 'schema'),
  // Pin migrations to prisma/migrations (Prisma's default with a folder schema
  // would resolve to prisma/schema/migrations, which isn't where they live).
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})

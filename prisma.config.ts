import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma CLI doesn't load .env.local (Next.js convention) — bridge the gap
try { process.loadEnvFile(path.join(process.cwd(), '.env.local')) } catch {}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})

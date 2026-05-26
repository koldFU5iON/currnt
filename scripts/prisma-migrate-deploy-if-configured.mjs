import { spawnSync } from "node:child_process"
import path from "node:path"

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"))
} catch {
  // Vercel and CI provide environment variables directly. Local checkouts may not
  // have a .env.local file, which is fine for builds that do not need migrations.
}

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not set; skipping prisma migrate deploy for this build.")
  process.exit(0)
}

const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)

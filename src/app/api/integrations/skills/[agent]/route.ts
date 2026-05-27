import { readFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"

// Whitelist of agents whose SKILL.md sources live in src/lib/integrations/skills/.
// Add a new entry here when you add a new <agent>.md alongside it.
const SUPPORTED_AGENTS = ["claude-code", "hermes"] as const
type SupportedAgent = (typeof SUPPORTED_AGENTS)[number]

function isSupported(agent: string): agent is SupportedAgent {
  return (SUPPORTED_AGENTS as readonly string[]).includes(agent)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
) {
  const { agent } = await params

  if (!isSupported(agent)) {
    return new Response(
      `Unknown agent "${agent}". Supported: ${SUPPORTED_AGENTS.join(", ")}.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )
  }

  const filePath = path.join(
    process.cwd(),
    "src/lib/integrations/skills",
    `${agent}.md`,
  )

  let template: string
  try {
    template = await readFile(filePath, "utf-8")
  } catch {
    return new Response(`Skill source missing: ${agent}.md`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // BETTER_AUTH_URL is the canonical deploy URL; fall back to the request
  // origin so preview deployments and local dev still produce useful output.
  const resumeUrl =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? request.nextUrl.origin

  const filled = template.replaceAll("{{RESUME_URL}}", resumeUrl)

  return new Response(filled, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="SKILL.md"`,
      // Five minutes is enough to absorb a click-then-share burst without
      // outlasting a deploy that changes the canonical URL or the skill body.
      "Cache-Control": "public, max-age=300",
    },
  })
}

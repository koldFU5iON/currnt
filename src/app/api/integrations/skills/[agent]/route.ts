import { readFile } from "node:fs/promises"
import path from "node:path"

// Whitelist of agents whose SKILL.md sources live in src/lib/integrations/skills/.
// Add a new entry here when you add a new <agent>.md alongside it.
const SUPPORTED_AGENTS = ["claude-code", "hermes"] as const
type SupportedAgent = (typeof SUPPORTED_AGENTS)[number]

function isSupported(agent: string): agent is SupportedAgent {
  return (SUPPORTED_AGENTS as readonly string[]).includes(agent)
}

export async function GET(
  _request: Request,
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

  // Fail closed on missing config. The downloaded SKILL.md tells the user's
  // agent where to POST a bearer token — falling back to a Host-header-derived
  // origin would let a forged request return a SKILL.md pointed at an attacker.
  const resumeUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "")
  if (!resumeUrl) {
    return new Response("Server misconfigured: BETTER_AUTH_URL is not set.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  let template: string
  try {
    template = await readFile(filePath, "utf-8")
  } catch {
    return new Response(`Skill source missing: ${agent}.md`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const filled = template.replaceAll("{{RESUME_URL}}", resumeUrl)

  return new Response(filled, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="SKILL.md"`,
      // `private` keeps the browser cache but bars shared proxies — the body
      // is host-derived, and we don't want a poisoned response cross-served.
      "Cache-Control": "private, max-age=300",
    },
  })
}

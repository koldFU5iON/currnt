import Link from "next/link"
import { Download, ExternalLink, Sparkles, Terminal } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

type Integration = {
  id: string
  label: string
  description: string
  installPath: string
  icon: typeof Sparkles
  docsHref: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    description:
      "Skill for the Claude Code CLI. Triggers on 'save this job' + a URL during any session.",
    installPath: "~/.claude/skills/capture-job/SKILL.md",
    icon: Sparkles,
    docsHref:
      "https://github.com/koldFU5iON/currnt/blob/main/docs/api-integrations.md#claude-code-skill",
  },
  {
    id: "hermes",
    label: "Hermes",
    description:
      "Skill for Nous Research's Hermes agent. Prompts for your bearer token interactively on first use.",
    installPath: "~/.hermes/skills/job-search/capture-job/SKILL.md",
    icon: Terminal,
    docsHref:
      "https://github.com/koldFU5iON/currnt/blob/main/docs/api-integrations.md#hermes-agent-skill",
  },
]

export function IntegrationsList() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Agent integrations</h2>
        <p className="text-sm text-muted-foreground max-w-prose">
          Pre-built skills for popular agents. Download the SKILL.md, drop it at
          the install path, and the agent can capture jobs by URL. You&apos;ll
          still need an API token (mint above) — the skill reads it from a
          per-agent secret store, not from this download.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </ul>
    </div>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const { id, label, description, installPath, icon: Icon, docsHref } = integration

  return (
    <li className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-md border bg-muted/40 grid place-items-center">
          <Icon size={16} className="text-foreground/70" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-tight">{label}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Install path
        </p>
        <code className="font-mono text-xs break-all block bg-muted/40 rounded px-2 py-1.5 border">
          {installPath}
        </code>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <a
          href={`/api/integrations/skills/${id}`}
          download="SKILL.md"
          className={buttonVariants({ size: "sm", variant: "default" }) + " gap-1.5"}
        >
          <Download size={14} />
          Download SKILL.md
        </a>
        <Link
          href={docsHref}
          target="_blank"
          rel="noreferrer noopener"
          className={buttonVariants({ size: "sm", variant: "ghost" }) + " gap-1.5"}
        >
          <ExternalLink size={14} />
          Docs
        </Link>
      </div>
    </li>
  )
}

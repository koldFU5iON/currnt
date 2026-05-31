// Static, illustrative product fragments for the landing feature section.
// Fixed example content (not live data); styled via semantic tokens so they
// theme in both light and dark.

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] font-medium text-primary">
      {children}
    </span>
  )
}

const SKILLS = [
  { name: "Risk Management", level: "Expert" },
  { name: "Roadmapping", level: "Expert" },
  { name: "Confluence", level: "Advanced" },
  { name: "Smartsheet", level: "Advanced" },
] as const

export function SkillsFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      {SKILLS.map((s, i) => (
        <div
          key={s.name}
          className={`flex items-center justify-between py-1.5 ${i < SKILLS.length - 1 ? "border-b border-border" : ""}`}
        >
          <span className="text-xs text-foreground">{s.name}</span>
          <Pill>{s.level}</Pill>
        </div>
      ))}
    </div>
  )
}

export function FitScoreFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full border-2 border-primary text-base font-bold text-foreground">
          8
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">Strong fit</div>
          <div className="text-[11px] text-muted-foreground">Senior PM · Remote</div>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Deep overlap on program leadership and stakeholder scope; light on the fintech domain.
      </p>
    </div>
  )
}

export function JobRowFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-foreground">Senior Product Manager</div>
          <div className="text-[11px] text-muted-foreground">Anthropic · Remote</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] text-secondary-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> Applied
        </span>
      </div>
      <div className="mt-2.5 flex gap-1">
        {[true, true, true, false, false].map((on, i) => (
          <span key={i} className={`h-1.5 w-3.5 rounded-full ${on ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    </div>
  )
}

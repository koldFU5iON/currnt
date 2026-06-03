import { brand } from "@/lib/brand"

type Belief = (typeof brand.about.beliefs)[number]

export function BeliefSection({ belief }: { belief: Belief }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
        — {belief.label}
      </p>
      <p className="text-base leading-relaxed text-muted-foreground">
        {belief.body}
      </p>
    </div>
  )
}

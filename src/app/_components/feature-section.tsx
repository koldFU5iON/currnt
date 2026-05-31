import { brand } from "@/lib/brand"
import {
  SkillsFragment,
  FitScoreFragment,
  JobRowFragment,
} from "./feature-fragments"

// Pillar → fragment. Keyed by the pillar union so a missing/extra pillar is a
// compile-time error.
const PILLAR_FRAGMENT: Record<
  (typeof brand.features)[number]["pillar"],
  React.ComponentType
> = {
  Structured: SkillsFragment,
  Adaptive: FitScoreFragment,
  Current: JobRowFragment,
}

export function FeatureSection() {
  return (
    <div className="border-t border-border">
      <div className="mx-auto max-w-4xl px-8 py-16">
        {brand.features.map(({ pillar, title, description }, i) => {
          const Fragment = PILLAR_FRAGMENT[pillar]
          return (
            <div
              key={pillar}
              className={`flex flex-col gap-6 border-t border-border/60 py-10 first:border-t-0 md:items-center md:gap-12 ${
                i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
              }`}
            >
              <div className="flex-1">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                  {pillar}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
              <div className="w-full md:w-72 md:shrink-0">
                <Fragment />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

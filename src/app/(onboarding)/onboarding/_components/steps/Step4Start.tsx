"use client"

import { useTransition } from "react"
import { Briefcase, Search, LayoutDashboard, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeOnboarding } from "@/modules/onboarding/actions"

const OPTIONS = [
  {
    destination: "/dashboard/job-applications",
    icon: Briefcase,
    label: "Track a job",
    description: "Add a role you're interested in and track your application progress.",
    primary: true,
  },
  {
    destination: "/dashboard/job-hunt",
    icon: Search,
    label: "Find roles",
    description: "Browse and score job listings against your profile.",
    primary: false,
  },
  {
    destination: "/dashboard",
    icon: LayoutDashboard,
    label: "Go to dashboard",
    description: "Explore the dashboard and decide what to do next.",
    primary: false,
  },
] as const

export function Step4Start() {
  const [pending, startTransition] = useTransition()

  function handleChoose(destination: string) {
    startTransition(async () => {
      await completeOnboarding(destination)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Get started
        </p>
        <h2 className="text-xl font-bold tracking-tight">You&apos;re set — where do you want to start?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a starting point. You can always switch from the dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(({ destination, icon: Icon, label, description, primary }) => (
          <button
            key={destination}
            type="button"
            onClick={() => handleChoose(destination)}
            disabled={pending}
            className={cn(
              "w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-colors disabled:opacity-60",
              primary
                ? "border-primary bg-primary/5 hover:bg-primary/10"
                : "border-border hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <Icon size={20} className={cn("mt-0.5 shrink-0", primary ? "text-primary" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold", primary ? "text-primary" : "text-foreground")}>
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            {pending && <Loader2 size={14} className="mt-1 animate-spin shrink-0 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </div>
  )
}

import Link from "next/link"
import { ArrowRight, RotateCcw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  clearOnboardingContext,
  saveOnboardingContext,
  skipOnboarding,
} from "@/modules/onboarding/actions"
import { getOnboardingSettings } from "@/modules/onboarding/queries"
import { onboardingContextHasContent } from "@/modules/onboarding/schema"
import { brand } from "@/lib/brand"

export default async function Page() {
  const { context, completedAt, skippedAt } = await getOnboardingSettings()
  const hasContext = onboardingContextHasContent(context)

  return (
    <div className="max-w-3xl p-4 md:p-8">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Optional setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">Tell {brand.name} what kind of search you are running</h1>
        <p className="text-muted-foreground">
          Keep this light. This is not your CV or career profile; it is gentle context that helps future assistance understand your direction, preferences, and constraints.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job-search context</CardTitle>
          <CardDescription>
            Everything here is optional. Save what is useful, skip it for now, or come back later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboardingContext} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferredName">Preferred or current name</Label>
                <Input id="preferredName" name="preferredName" defaultValue={context.preferredName} placeholder="What should the app call you?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentRole">Current role or career area</Label>
                <Input id="currentRole" name="currentRole" defaultValue={context.currentRole} placeholder="e.g. Communications operations" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target role or direction</Label>
                <Input id="targetRole" name="targetRole" defaultValue={context.targetRole} placeholder="e.g. Director-level ops roles" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industries">Industries or work types</Label>
                <Input id="industries" name="industries" defaultValue={context.industries} placeholder="e.g. SaaS, games, developer ecosystems" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workPreferences">Location and work preferences</Label>
              <Textarea id="workPreferences" name="workPreferences" defaultValue={context.workPreferences} placeholder="Remote, hybrid, relocation, contract vs permanent, travel limits..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extraContext">Anything useful to know?</Label>
              <Textarea id="extraContext" name="extraContext" defaultValue={context.extraContext} placeholder="Constraints, goals, positioning notes, roles to avoid, or anything you often repeat when tailoring applications." rows={5} />
            </div>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {completedAt
                  ? "Saved. You can update this whenever your search changes."
                  : skippedAt
                    ? "Skipped for now. Add context whenever it becomes useful."
                    : "No pressure. A few rough notes are enough."}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  Save context
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={skipOnboarding}>
              <Button type="submit" variant="outline">Skip for now</Button>
            </form>
            {hasContext && (
              <form action={clearOnboardingContext}>
                <Button type="submit" variant="ghost">
                  <RotateCcw className="size-4" />
                  Clear saved context
                </Button>
              </form>
            )}
            <Link className={buttonVariants({ variant: "ghost" })} href="/dashboard">Back to dashboard</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

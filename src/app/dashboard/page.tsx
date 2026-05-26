import Link from "next/link"
import { redirect } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOnboardingSettings } from "@/modules/onboarding/queries"

export default async function Page() {
  const { profile, hasSignal, context } = await getOnboardingSettings()

  if (!hasSignal) redirect("/dashboard/onboarding")

  const displayName = context.preferredName || profile.name || "there"

  return (
    <div className="p-4 md:p-8">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome, {displayName}</CardTitle>
          <CardDescription>
            Track applications, keep your profile organised, and keep the search moving without turning it into spreadsheet archaeology.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} href="/dashboard/job-applications">View applications</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/onboarding">Edit search context</Link>
        </CardContent>
      </Card>
    </div>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { ResetPasswordForm } from "../_components/reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const session = await getSession()
  if (session) redirect("/dashboard")

  const { token } = await searchParams

  if (!token) {
    return (
      <>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            This reset link is missing or has expired.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="text-foreground font-medium hover:underline">
            Request a new link
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
      </div>

      <ResetPasswordForm token={token} />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="text-foreground font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}

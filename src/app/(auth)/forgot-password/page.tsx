import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { ForgotPasswordForm } from "../_components/forgot-password-form"

export default async function ForgotPasswordPage() {
  const session = await getSession()
  if (session) redirect("/dashboard")

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Forgot password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="text-foreground font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

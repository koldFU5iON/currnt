'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { FormField } from "@/app/dashboard/job-applications/create/_components/form-field"
import { Button } from "@/components/ui/button"

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
})

type FormValues = z.infer<typeof schema>

type Props = { token: string }

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const { error } = await authClient.resetPassword({
        newPassword: values.password,
        token,
      })
      if (error) throw new Error(error.message || "Reset failed")
      toast.success("Password updated — please sign in")
      router.push("/sign-in")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="password"
          label="New password"
          type="password"
          required
        />
        <FormField
          name="confirm"
          label="Confirm password"
          type="password"
          required
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Updating…" : "Set new password"}
        </Button>
      </form>
    </FormProvider>
  )
}

'use client'

import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { FormField } from "@/app/dashboard/job-applications/create/_components/form-field"
import { Button } from "@/components/ui/button"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const { error } = await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      })
      if (error) throw new Error(error.message || "Request failed")
      setSent(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-4 py-5 text-sm text-center space-y-1">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground">
          If an account exists for that address, we&apos;ve sent a reset link.
          It expires in 1 hour.
        </p>
      </div>
    )
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          required
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </FormProvider>
  )
}

'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { FormField } from "@/app/dashboard/job-applications/create/_components/form-field"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

const signUpRefinedSchema = formSchema.extend({
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type FormValues = z.infer<typeof formSchema>
type Mode = "signin" | "signup"

type Props = {
  mode: Mode
  callbackUrl: string
}

export function EmailPasswordForm({ mode, callbackUrl }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const schema = mode === "signin" ? formSchema : signUpRefinedSchema

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", password: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      if (mode === "signin") {
        const { error } = await authClient.signIn.email({
          email: values.email,
          password: values.password,
          callbackURL: callbackUrl,
        })
        if (error) throw new Error(error.message || "Sign in failed")
      } else {
        const { error } = await authClient.signUp.email({
          name: values.name ?? "",
          email: values.email,
          password: values.password,
          callbackURL: callbackUrl,
        })
        if (error) throw new Error(error.message || "Sign up failed")
      }
      router.push(callbackUrl)
      router.refresh()
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
        {mode === "signup" && (
          <FormField name="name" label="Name" placeholder="Jane Doe" required />
        )}
        <FormField name="email" label="Email" type="email" placeholder="you@example.com" required />
        <FormField name="password" label="Password" type="password" required />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </FormProvider>
  )
}

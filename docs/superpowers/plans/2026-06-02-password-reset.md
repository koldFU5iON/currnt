# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete forgot-password / reset-password flow using Resend for email delivery, wired into the existing Better Auth setup.

**Architecture:** Better Auth's `sendResetPassword` callback is the single integration point — all Resend code lives there. Two new pages follow the existing `(auth)` route group pattern exactly. The reset token travels in the email URL query string; Better Auth validates it server-side when `resetPassword` is called.

**Tech Stack:** Better Auth (email/password), Resend SDK, Next.js 16 App Router, React Hook Form + Zod, shadcn/ui, TypeScript strict.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/auth.ts` | Add `sendResetPassword` callback using Resend |
| `src/app/(auth)/_components/forgot-password-form.tsx` | **New** — email input form, calls `authClient.forgetPassword` |
| `src/app/(auth)/_components/reset-password-form.tsx` | **New** — new-password form, calls `authClient.resetPassword` |
| `src/app/(auth)/forgot-password/page.tsx` | **New** — server shell, redirects if already signed in |
| `src/app/(auth)/reset-password/page.tsx` | **New** — server shell, reads `?token=` from searchParams |
| `src/app/(auth)/sign-in/page.tsx` | Add "Forgot password?" link below the form |
| `.env.example` | Document `RESEND_API_KEY` and `SENDER_EMAIL` |

---

## Task 1: Install Resend and wire `sendResetPassword` in `auth.ts`

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install the Resend SDK**

```bash
npm install resend
```

Expected: resend appears in `package.json` dependencies.

- [ ] **Step 2: Update `src/lib/auth.ts`**

Replace the entire file with this (only `emailAndPassword` and the top-level import change; everything else is identical):

```ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { Resend } from "resend"
import { prisma } from "@/lib/db"

const resend = new Resend(process.env.RESEND_API_KEY)
const senderEmail = process.env.SENDER_EMAIL ?? "no-reply@example.com"

type SocialProviderConfig = { clientId: string; clientSecret: string }

function normalizeOrigin(value?: string) {
  if (!value) return undefined
  const withProtocol = value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`
  return withProtocol.replace(/\/$/, "")
}

const vercelUrl = normalizeOrigin(process.env.VERCEL_URL)
const vercelProductionUrl = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
const authBaseUrl = normalizeOrigin(process.env.BETTER_AUTH_URL) ?? vercelUrl
const envTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ?.split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter((origin): origin is string => Boolean(origin)) ?? []

const trustedOrigins = [authBaseUrl, vercelUrl, vercelProductionUrl, ...envTrustedOrigins]
  .filter((origin): origin is string => Boolean(origin))

const socialProviders: Record<string, SocialProviderConfig> = {}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}

if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  socialProviders.linkedin = {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  }
}

if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  socialProviders.twitter = {
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  }
}

export type EnabledSocialProvider = "google" | "linkedin" | "twitter"

export function getEnabledSocialProviders(): EnabledSocialProvider[] {
  return Object.keys(socialProviders) as EnabledSocialProvider[]
}

export const auth = betterAuth({
  baseURL: authBaseUrl,
  trustedOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: senderEmail,
        to: user.email,
        subject: "Reset your password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="font-size:20px;font-weight:600;margin:0 0 8px">Reset your password</h2>
            <p style="color:#6b7280;margin:0 0 24px">
              We received a request to reset the password for your account.
              Click the button below to choose a new password.
              This link expires in 1 hour.
            </p>
            <a href="${url}"
               style="display:inline-block;background:#09090b;color:#fafafa;text-decoration:none;
                      padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500">
              Reset password
            </a>
            <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
              If you didn't request this, you can safely ignore this email.
              Your password won't change.
            </p>
          </div>
        `,
      })
    },
  },
  socialProviders,
  account: {
    accountLinking: {
      trustedProviders: ["linkedin", "google", "twitter"],
      requireLocalEmailVerified: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.profile.create({
            data: {
              userId: user.id,
              name: user.name || user.email.split("@")[0],
            },
          })
        },
      },
    },
  },
  plugins: [nextCookies()],
})
```

- [ ] **Step 3: Add env vars to `.env.example`**

Open `.env.example` and append (after the existing vars):

```env
# Email (Resend) — required for password reset
RESEND_API_KEY=""
SENDER_EMAIL="no-reply@yourdomain.com"
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts .env.example package.json package-lock.json
git commit -m "feat(auth): wire Resend sendResetPassword callback"
```

---

## Task 2: `ForgotPasswordForm` client component

**Files:**
- Create: `src/app/(auth)/_components/forgot-password-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
      const { error } = await authClient.forgetPassword({
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
```

> **Note on the success message:** We deliberately don't confirm whether the email exists — this prevents user enumeration. The message is the same regardless.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/_components/forgot-password-form.tsx
git commit -m "feat(auth): ForgotPasswordForm client component"
```

---

## Task 3: `ResetPasswordForm` client component

**Files:**
- Create: `src/app/(auth)/_components/reset-password-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
  password: z.string().min(8, "Password must be at least 8 characters"),
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/_components/reset-password-form.tsx
git commit -m "feat(auth): ResetPasswordForm client component"
```

---

## Task 4: `/forgot-password` page

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/forgot-password/page.tsx
git commit -m "feat(auth): /forgot-password page"
```

---

## Task 5: `/reset-password` page

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

The page reads the `token` query param. If it's missing the link is broken — render an error state rather than crashing.

- [ ] **Step 1: Create the page**

```tsx
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
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/reset-password/page.tsx
git commit -m "feat(auth): /reset-password page"
```

---

## Task 6: Add "Forgot password?" link to sign-in page

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Add the link**

In `sign-in/page.tsx`, add a "Forgot password?" link between `<EmailPasswordForm>` and `<SocialButtons>`. The full updated file:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { getEnabledSocialProviders } from "@/lib/auth"
import { getSession } from "@/lib/session"
import { EmailPasswordForm } from "../_components/email-password-form"
import { SocialButtons } from "../_components/social-buttons"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await getSession()
  const { callbackUrl } = await searchParams
  const target = callbackUrl || "/dashboard"

  if (session) {
    redirect(target)
  }

  const providers = getEnabledSocialProviders()

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Sign in to your account.</p>
      </div>

      <EmailPasswordForm mode="signin" callbackUrl={target} />

      <p className="text-right -mt-2">
        <Link
          href="/forgot-password"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Forgot password?
        </Link>
      </p>

      <SocialButtons providers={providers} callbackUrl={target} />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-foreground font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/sign-in/page.tsx
git commit -m "feat(auth): add Forgot password link to sign-in page"
```

---

## Manual smoke test

After all tasks are committed:

- [ ] Start dev server: `npm run dev`
- [ ] Go to `/sign-in` — "Forgot password?" link is visible
- [ ] Click it → `/forgot-password` loads correctly
- [ ] Submit a real email address → success message appears (no email/no-email confirmation)
- [ ] Check inbox → email arrives from `SENDER_EMAIL`, reset link points to `/reset-password?token=...`
- [ ] Click link → `/reset-password` loads with the form
- [ ] Submit a new password → redirected to `/sign-in` with success toast
- [ ] Sign in with new password → works
- [ ] Visit `/reset-password` with no token → error state with "Request a new link"
- [ ] Visit `/reset-password?token=expired` → Better Auth returns an error, toast shows

---

## Self-Review

**Spec coverage:**
| Requirement | Task |
|---|---|
| `sendResetPassword` Resend callback in auth.ts | Task 1 |
| `RESEND_API_KEY` and `SENDER_EMAIL` env vars documented | Task 1 |
| Forgot password form (client) | Task 2 |
| Reset password form with token + confirm field (client) | Task 3 |
| `/forgot-password` page | Task 4 |
| `/reset-password` page with missing-token error state | Task 5 |
| "Forgot password?" link on sign-in | Task 6 |

**Security notes:**
- The forgot-password success message is intentionally ambiguous ("if an account exists…") to prevent user enumeration
- Token handling is entirely server-side in Better Auth — we only pass it as a prop to the client component; it never enters localStorage or cookies
- `SENDER_EMAIL` defaults to a placeholder in auth.ts — the email will fail silently if the env var is not set in production; operators must set it

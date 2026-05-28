import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { prisma } from "@/lib/db"

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

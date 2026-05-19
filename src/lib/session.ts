import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function requireProfile() {
  const session = await requireSession()
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found for user")
  return { session, profile }
}

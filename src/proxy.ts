import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}

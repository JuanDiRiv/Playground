import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/auth-server";

/**
 * Lightweight, optimistic auth gate. Heavy verification happens in the
 * (app) layout via the Admin SDK — Proxy only blocks obvious cases.
 *
 * Next.js 16 renamed Middleware to Proxy. File must live at the project root
 * (next to `app/` or `src/`).
 */
export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/topics/:path*",
    "/exercises/:path*",
    "/challenges/:path*",
    "/profile/:path*",
  ],
};

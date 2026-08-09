import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // "/" is the landing page and handles its own authenticated-user redirect
  // (app/page.tsx checks the refresh_token cookie server-side) — redirecting
  // it here unconditionally made the landing page unreachable for everyone,
  // including anonymous visitors it's meant for.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\.svg|.*\\.png|.*\\.ico).*)"],
};

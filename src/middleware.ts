import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes — don't require auth
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/vapi") ||       // Vapi webhooks must be unauthenticated
    pathname === "/api/reservations" ||        // Legacy API (used by Vapi)
    pathname === "/api/settings" ||            // Legacy API
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  // Protect /r/* routes and /api/r/* routes
  if (!req.auth?.user) {
    // API routes get 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

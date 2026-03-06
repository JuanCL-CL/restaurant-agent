import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes — don't require auth
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/vapi") ||       // Vapi webhooks must be unauthenticated
    pathname.startsWith("/api/debug") ||     // Temporary debug endpoints
    pathname.startsWith("/api/onboarding") ||  // Onboarding API
    pathname.startsWith("/auth/") ||           // Auth error page
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  // Everything else requires auth
  if (!req.auth?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

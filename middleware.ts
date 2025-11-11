// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // allow public things
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".ico") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/api/form-test"; // Allow form test endpoint

  if (isPublic) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // not logged in → go to /login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // if user somehow lands on /login while logged in (handled by matcher below)
  if (pathname === "/login" && token) {
    const to = searchParams.get("callbackUrl") || "/";
    return NextResponse.redirect(new URL(to, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // run on everything except the common public assets; keep /login for the “already signed in” redirect
    "/((?!api/auth|_next|assets|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)|robots.txt|sitemap.xml).*)",
    "/login",
  ],
};

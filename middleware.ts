// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isProtected = pathname.startsWith("/(protected)");
  const isLogin = pathname === "/login";

  // Always allow NextAuth, static assets, and public files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Read the NextAuth JWT (session strategy: 'jwt')
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 1) Protect only /(protected) routes
  if (isProtected && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }

  // 2) If already logged in, keep users out of /login
  if (isLogin && token) {
    const to = searchParams.get("callbackUrl") || "/";
    return NextResponse.redirect(new URL(to, req.url));
  }

  // Otherwise, pass through
  return NextResponse.next();
}

// Only run middleware for the routes we care about
export const config = {
  matcher: [
    "/(protected)(.*)", // everything under /(protected)
    "/login", // handle redirect-away for logged-in users
    "/api/auth/:path*", // (optional) keep here if you ever want to inspect/allow; currently just allowed above
  ],
};

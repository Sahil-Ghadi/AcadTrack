import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("acadtrack_token")?.value;
  const role = req.cookies.get("acadtrack_role")?.value;
  const { pathname } = req.nextUrl;

  const roleRoutes: Record<string, string> = {
    student: "/student",
    faculty: "/faculty",
    dept_admin: "/dept-admin",
    college_admin: "/college-admin",
  };

  // If user is at root "/"
  if (pathname === "/") {
    if (token && role && roleRoutes[role]) {
      return NextResponse.redirect(new URL(roleRoutes[role], req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If user is at "/login"
  if (pathname.startsWith("/login")) {
    if (token && role && roleRoutes[role]) {
      return NextResponse.redirect(new URL(roleRoutes[role], req.url));
    }
    return NextResponse.next();
  }

  // Protected paths check
  const protectedPrefixes = ["/student", "/faculty", "/dept-admin", "/college-admin"];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected) {
    if (!token || !role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Role-specific enforcement
    if (pathname.startsWith("/student") && role !== "student" && role !== "college_admin") {
      return NextResponse.redirect(new URL(roleRoutes[role] || "/login", req.url));
    }
    if (pathname.startsWith("/faculty") && role !== "faculty" && role !== "college_admin") {
      return NextResponse.redirect(new URL(roleRoutes[role] || "/login", req.url));
    }
    if (
      pathname.startsWith("/dept-admin") &&
      role !== "dept_admin" &&
      role !== "college_admin"
    ) {
      return NextResponse.redirect(new URL(roleRoutes[role] || "/login", req.url));
    }
    if (pathname.startsWith("/college-admin") && role !== "college_admin") {
      return NextResponse.redirect(new URL(roleRoutes[role] || "/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/student/:path*",
    "/faculty/:path*",
    "/dept-admin/:path*",
    "/college-admin/:path*",
  ],
};

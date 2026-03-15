import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // Patient routes — only PATIENT role
    if (pathname.startsWith("/patient") && role !== "PATIENT") {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", req.url)
      );
    }

    // Doctor routes — only DOCTOR role
    if (pathname.startsWith("/doctor") && role !== "DOCTOR") {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", req.url)
      );
    }

    // Clinic routes — only CLINIC_ADMIN role
    if (pathname.startsWith("/clinic") && role !== "CLINIC_ADMIN") {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", req.url)
      );
    }

    // Admin routes — only ADMIN or CLINIC_ADMIN role
    if (
      pathname.startsWith("/admin") &&
      role !== "ADMIN" &&
      role !== "CLINIC_ADMIN"
    ) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", req.url)
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Redirect unauthenticated users to /login
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Protect the role-based dashboard router and all role-specific routes.
  // /api/auth/* is intentionally excluded so NextAuth endpoints are public.
  matcher: ["/dashboard", "/patient/:path*", "/doctor/:path*", "/admin/:path*", "/clinic/:path*"],
};

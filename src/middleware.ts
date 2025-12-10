import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("session_token");
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  // Note: /signup removed - Registration is disabled
  const publicRoutes = ["/signin", "/forgot-password", "/reset-password"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!sessionToken && !isPublicRoute) {
    const signInUrl = new URL("/signin", request.url);
    // Only add 'from' param if not already on homepage
    if (pathname !== "/") {
      signInUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (sessionToken && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};

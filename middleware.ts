// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    // Retrieve the secret from environment variables
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        console.error('❌ ERROR: NEXTAUTH_SECRET environment variable is not set.');
        // In production, you might want to deny access or show a generic error
        // For development, logging is often sufficient, but returning an error is safer.
        return new NextResponse('Internal Server Error: Authentication configuration missing.', { status: 500 });
    }

    // Attempt to get the JWT token from the request
    const token = await getToken({ req: request, secret: secret });

    // Extract the pathname from the request URL
    const { pathname } = request.nextUrl;

    // Determine if the user is authenticated based on the token's presence
    const isAuthenticated = !!token;

    // --- Define Route Categories ---

    // Protected routes that require authentication
    const protectedRoutes = [
        '/dashboard', // Matches /dashboard and /dashboard/*
        '/api/dashboard',
        '/api/despesas',
        '/api/documents',
        '/api/drive', // Protecting drive upload/folder creation etc.
        '/api/empreendimentos',
        '/api/notifications',
        '/api/sheets', // Protect sheet creation based on auth
        '/api/upload-s3', // Protect direct S3 uploads
        // Add any other API or page routes that strictly need authentication
    ];

    // Public routes accessible to everyone (authentication not required)
    // Includes login page and potentially specific public API endpoints
    const publicRoutes = [
        '/login',
        '/api/auth', // NextAuth routes MUST be public
        '/api/create-admin', // Allow initial admin creation if needed (consider security)
        '/api/test', // Test routes are likely public during development
        // Add any other truly public routes here
    ];

    // Check if the current path matches any protected route pattern
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    // Check if the current path matches any public route pattern
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // --- Middleware Logic ---

    // 1. Allow access to explicitly public routes unconditionally
    if (isPublicRoute) {
        // Special case: If user is already authenticated and tries to access /login, redirect to dashboard
        if (pathname === '/login' && isAuthenticated) {
            console.log(`[Middleware] Authenticated user accessing /login. Redirecting to /dashboard.`);
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        // Otherwise, allow access to the public route
        // console.log(`[Middleware] Allowing access to public route: ${pathname}`);
        return NextResponse.next();
    }

    // 2. Handle protected routes
    if (isProtectedRoute) {
        if (!isAuthenticated) {
            // User is not authenticated, redirect to login
            console.log(`[Middleware] Unauthenticated access to protected route ${pathname}. Redirecting to /login.`);
            // Construct the login URL, preserving the intended destination (callbackUrl)
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', request.url); // Pass the original URL
            return NextResponse.redirect(loginUrl);
        } else {
            // User is authenticated, allow access to the protected route
            // console.log(`[Middleware] Allowing access to protected route: ${pathname}`);
            return NextResponse.next();
        }
    }

    // 3. Default behavior for routes not explicitly listed as public or protected
    //    Depending on your security model, you might want to:
    //    a) Allow access (current behavior - assumes unlisted routes are public)
    //    b) Deny access / Redirect to login (stricter - assumes unlisted routes are protected by default)

    // Current: Allow access to any other route not matched above.
    // console.log(`[Middleware] Allowing access to unmatched route: ${pathname}`);
    return NextResponse.next();

    /* --- Alternative Strict Behavior (Uncomment to use) ---
    // If the route is not public and not protected (and not handled above),
    // assume it requires authentication.
    if (!isAuthenticated) {
        console.log(`[Middleware] Unauthenticated access to unlisted route ${pathname}. Redirecting to /login (strict mode).`);
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', request.url);
        return NextResponse.redirect(loginUrl);
    }
    // If authenticated, allow access to the unlisted route
    console.log(`[Middleware] Allowing access to unlisted route (authenticated): ${pathname}`);
    return NextResponse.next();
    */
}

// --- Matcher Configuration ---
// Define which paths the middleware should run on.
// This is crucial for performance, avoiding checks on static assets etc.
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - /public folder assets (images, svgs etc. - adjust regex if needed)
         * - api/auth (NextAuth specific API routes - already handled as public)
         *
         * This ensures the middleware runs on pages and relevant API routes.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
        // Include API routes explicitly if the pattern above is too broad or misses some
        // '/api/:path*', // Example: If you want ALL API routes (except /api/auth) checked
    ],
};
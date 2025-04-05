import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        console.error('[Middleware] FATAL: NEXTAUTH_SECRET não configurado!');
        return NextResponse.redirect(new URL('/login?error=config', request.url));
    }

    let token = null;
    try {
        token = await getToken({ req: request, secret });
    } catch (error) {
        console.error('[Middleware] Erro ao chamar getToken:', error);
        token = null;
    }

    const { pathname } = request.nextUrl;
    const isAuthenticated = !!token;

    console.log(`[Middleware DEBUG] Path: ${pathname}, IsAuth Detected: ${isAuthenticated}`); // Log de Debug

    // --- INÍCIO DA MODIFICAÇÃO TEMPORÁRIA ---
    // Se o destino for o dashboard, permite o acesso *independentemente* de isAuthenticated
    if (pathname.startsWith('/dashboard')) {
        console.log(`[Middleware DEBUG] Bypass auth check for ${pathname}. Allowing access.`);
        return NextResponse.next();
    }
    // --- FIM DA MODIFICAÇÃO TEMPORÁRIA ---

    // Mantém a lógica original para outras rotas
    const protectedRoutes = ['/api/dashboard', '/api/despesas', '/api/documents', '/api/drive', '/api/empreendimentos', '/api/notifications', '/api/sheets', '/api/upload-s3']; // Exclui /dashboard daqui
    const publicRoutes = ['/login', '/api/auth/providers', '/api/auth/csrf', '/api/auth/callback', '/api/auth/signout', '/api/auth/error', '/api/create-admin', '/api/test'];

    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isApiAuthRoute = pathname.startsWith('/api/auth');

    if (isApiAuthRoute || (publicRoutes.some(route => pathname.startsWith(route)) && pathname !== '/login') || pathname === '/') {
        console.log(`[Middleware DEBUG] Allowing public/auth API route: ${pathname}`);
        return NextResponse.next();
    }

    if (pathname === '/login' && isAuthenticated) {
        console.log(`[Middleware DEBUG] Redirecting authenticated user FROM /login TO /dashboard`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Protege as outras rotas da API se não autenticado
    if (isProtectedRoute && !isAuthenticated) {
        console.log(`[Middleware DEBUG] Redirecting unauthenticated user FROM ${pathname} TO /login`);
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', request.url);
        return NextResponse.redirect(loginUrl);
    }

    console.log(`[Middleware DEBUG] Allowing request for ${pathname}`);
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
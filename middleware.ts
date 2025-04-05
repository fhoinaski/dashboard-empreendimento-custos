import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[Middleware] NEXTAUTH_SECRET não configurado');
    return new NextResponse('Erro interno de autenticação.', { status: 500 });
  }

  const token = await getToken({ req: request, secret });
  const { pathname } = request.nextUrl;
  const isAuthenticated = !!token;

  console.log(`[Middleware] Path: ${pathname}, Authenticated: ${isAuthenticated}`);

  const protectedRoutes = [
    '/dashboard',
    '/api/dashboard',
    '/api/despesas',
    '/api/documents',
    '/api/drive',
    '/api/empreendimentos',
    '/api/notifications',
    '/api/sheets',
    '/api/upload-s3',
  ];
  const publicRoutes = ['/login', '/api/auth', '/api/create-admin', '/api/test'];

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    if (pathname === '/login' && isAuthenticated) {
      console.log('[Middleware] Usuário autenticado tentando acessar /login, redirecionando para /dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (isProtectedRoute && !isAuthenticated) {
    console.log('[Middleware] Acesso não autenticado a rota protegida, redirecionando para /login');
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
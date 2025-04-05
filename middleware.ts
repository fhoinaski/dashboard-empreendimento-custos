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

  console.log(`[Middleware] Path: ${pathname}, IsAuth: ${isAuthenticated}, Token ID: ${token?.id ?? 'N/A'}, Token Role: ${token?.role ?? 'N/A'}`);

  // Rotas protegidas e públicas
  const protectedRoutes = ['/dashboard', '/api/dashboard', '/api/despesas', '/api/documents', '/api/drive', '/api/empreendimentos', '/api/notifications', '/api/sheets', '/api/upload-s3'];
  const publicRoutes = ['/login', '/api/auth/providers', '/api/auth/csrf', '/api/auth/callback', '/api/auth/signout', '/api/auth/error', '/api/create-admin', '/api/test'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isApiAuthRoute = pathname.startsWith('/api/auth');

  // Permitir rotas públicas e de autenticação
  if (isApiAuthRoute || (publicRoutes.some(route => pathname.startsWith(route)) && pathname !== '/login') || pathname === '/') {
    console.log(`[Middleware] Permitindo rota pública/API de autenticação: ${pathname}`);
    return NextResponse.next();
  }

  // Redirecionar usuários autenticados para o dashboard se tentarem acessar o login
  if (pathname === '/login' && isAuthenticated) {
    console.log(`[Middleware] Redirecionando usuário autenticado DE /login PARA /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirecionar usuários não autenticados para o login se tentarem acessar rotas protegidas
  if (isProtectedRoute && !isAuthenticated) {
    console.log(`[Middleware] Redirecionando usuário não autenticado DE ${pathname} PARA /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  console.log(`[Middleware] Allowing request for ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
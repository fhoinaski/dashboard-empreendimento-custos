import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[Middleware] FATAL: NEXTAUTH_SECRET não configurado!');
    // Em produção, talvez seja melhor retornar um erro 500 genérico
    // return new NextResponse('Erro interno de configuração.', { status: 500 });
    // Ou, por segurança, redirecionar para login assumindo falha na autenticação
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  let token = null;
  try {
      token = await getToken({ req: request, secret });
      // Adicione log para ver o token bruto que getToken está recebendo (ou null)
      // Cuidado ao logar o token inteiro em produção real devido a dados sensíveis
      // console.log('[Middleware] Raw Token from getToken:', token);
  } catch (error) {
      console.error('[Middleware] Erro ao chamar getToken:', error);
      // Se getToken falhar, assume não autenticado
      token = null;
  }

  const { pathname } = request.nextUrl;
  const isAuthenticated = !!token;

  // Log Geral
  console.log(`[Middleware] Path: ${pathname}, IsAuth: ${isAuthenticated}, Token ID: ${token?.id ?? 'N/A'}, Token Role: ${token?.role ?? 'N/A'}`);

  const protectedRoutes = ['/dashboard', '/api/dashboard', '/api/despesas', '/api/documents', '/api/drive', '/api/empreendimentos', '/api/notifications', '/api/sheets', '/api/upload-s3'];
  // Adicione /api/auth/session aqui se quiser protegê-la, mas geralmente não é necessário
  const publicRoutes = ['/login', '/api/auth/providers', '/api/auth/csrf', '/api/auth/callback', '/api/auth/signout', '/api/auth/error', '/api/create-admin', '/api/test'];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  // Ajuste para verificar se NÃO é uma rota pública conhecida (excluindo a raiz '/')
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
  const isApiAuthRoute = pathname.startsWith('/api/auth'); // Trata rotas de auth especificamente


  // 1. Permite acesso a rotas PÚBLICAS ou rotas de API de autenticação SEMPRE
  //    (Exceto /login se já autenticado)
  if (isApiAuthRoute || (isPublicRoute && pathname !== '/login')) {
    console.log(`[Middleware] Allowing public/auth API route: ${pathname}`);
    return NextResponse.next();
  }

  // 2. Se está no /login E JÁ autenticado -> Redireciona para /dashboard
  if (pathname === '/login' && isAuthenticated) {
    console.log(`[Middleware] Redirecting authenticated user FROM /login TO /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Se tenta acessar rota PROTEGIDA e NÃO está autenticado -> Redireciona para /login
  if (isProtectedRoute && !isAuthenticated) {
    console.log(`[Middleware] Redirecting unauthenticated user FROM ${pathname} TO /login`);
    const loginUrl = new URL('/login', request.url);
    // Manter o callbackUrl pode ser útil
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Se nenhuma das condições acima foi atendida (ex: rota protegida e autenticado), permite o acesso
  console.log(`[Middleware] Allowing request for ${pathname}`);
  return NextResponse.next();
}

// Configuração do Matcher (sem alterações)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
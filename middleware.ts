import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[Middleware] FATAL: NEXTAUTH_SECRET não configurado!');
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  console.log('[Middleware] Full URL:', request.url);
  console.log('[Middleware] Pathname:', request.nextUrl.pathname);

  // Obter token da requisição
  let token = null;
  try {
      token = await getToken({ 
        req: request, 
        secret,
        secureCookie: process.env.NODE_ENV === 'production' // Usar cookies seguros em produção
      });
      // Log detalhado para depuração
      console.log('[Middleware] Token completo:', JSON.stringify(token, null, 2));
      console.log(`[Middleware] Token obtido:`, token ? 'Sim' : 'Não', 
                 `JWT Sub: ${token?.sub || 'N/A'}`, 
                 `Exp: ${token?.exp || 'N/A'}`);
  } catch (error) {
      console.error('[Middleware] Erro ao chamar getToken:', error);
      token = null;
  }

  const { pathname } = request.nextUrl;
  // Verificar tanto token.id quanto token.sub
  const isAuthenticated = !!token && (!!token.sub || !!token.id);

  // Log Geral
  console.log(`[Middleware] Path: ${pathname}, IsAuth: ${isAuthenticated}, Token ID: ${token?.id ?? token?.sub ?? 'N/A'}, Token Role: ${token?.role ?? 'N/A'}`);

  // Definir rotas protegidas e públicas - incluindo mais caminhos de dashboard
  const protectedRoutes = ['/dashboard', '/dashboard/', '/dashboard/home', '/api/dashboard', '/api/despesas', '/api/documents', '/api/drive', '/api/empreendimentos', '/api/notifications', '/api/sheets', '/api/upload-s3'];
  const publicRoutes = ['/login', '/api/auth/providers', '/api/auth/csrf', '/api/auth/callback', '/api/auth/signout', '/api/auth/error', '/api/create-admin', '/api/test'];

  // Verificar se é uma rota de API de autenticação ou relacionada à sessão
  const isApiAuthRoute = pathname.startsWith('/api/auth') || pathname === '/api/auth/session';
  
  // Verificar se é uma rota protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // 1. Permitir TODAS as rotas relacionadas à autenticação sem restrições
  if (isApiAuthRoute || pathname === '/api/auth') {
      console.log(`[Middleware] Permitindo rota de autenticação: ${pathname}`);
      return NextResponse.next();
  }

  // 2. Se está em rota pública (exceto /login) OU raiz '/', permite acesso
  if ((publicRoutes.some(route => pathname.startsWith(route)) && pathname !== '/login') || pathname === '/') {
      console.log(`[Middleware] Permitindo rota pública: ${pathname}`);
      return NextResponse.next();
  }

  // 3. Se está no /login E JÁ autenticado -> Redireciona para /dashboard
  if (pathname === '/login' && isAuthenticated) {
      console.log(`[Middleware] Redirecionando usuário autenticado DE /login PARA /dashboard. Token ID: ${token?.id ?? token?.sub ?? 'N/A'}`);
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
  }

  // 4. Se tenta acessar rota PROTEGIDA e NÃO está autenticado -> Redireciona para /login
  if (isProtectedRoute && !isAuthenticated) {
      console.log(`[Middleware] Redirecionando usuário não autenticado DE ${pathname} PARA /login. Token ausente ou inválido.`);
      // Criar URL de login sem parâmetros adicionais para evitar problemas
      const loginUrl = new URL('/login', request.url);
      // Limpar qualquer query string existente
      loginUrl.search = '';
      return NextResponse.redirect(loginUrl);
  }

  // 5. Se chegou até aqui, permite o acesso (ex: rota protegida e autenticado)
  console.log(`[Middleware] Permitindo request para ${pathname}`);
  return NextResponse.next();
}

// Configuração do Matcher (atualizado para permitir arquivos PWA)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-*.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
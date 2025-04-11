// ============================================================
// middleware.ts (CONFIRMADO - CORRETO para seu propósito atual)
// ============================================================
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[Middleware] FATAL: NEXTAUTH_SECRET não configurado!');
    // Em caso de falha crítica de config, redireciona para login com erro
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  // Log básico do path
  console.log('[Middleware] Pathname:', request.nextUrl.pathname);

  // Obter token da requisição
  let token = null;
  try {
      token = await getToken({
        req: request,
        secret,
        secureCookie: process.env.NODE_ENV === 'production', // Usar cookies seguros em produção
        // raw: true // Descomente para ver o JWT bruto se necessário
      });
      // Log mais útil sobre o token
      console.log(`[Middleware] Token obtido: ${token ? 'Sim' : 'Não'}. ID/Sub: ${token?.id ?? token?.sub ?? 'N/A'}, Role: ${token?.role ?? 'N/A'}`);
  } catch (error) {
      console.error('[Middleware] Erro ao obter token:', error);
      // Considera como não autenticado se houver erro ao obter token
  }

  const { pathname } = request.nextUrl;
  const isAuthenticated = !!token && (!!token.id || !!token.sub); // Verifica se temos um ID de usuário no token

  // Definir rotas protegidas e públicas (manter consistência com a estrutura do projeto)
  // As rotas /api/trpc/[trpc] são implicitamente tratadas pelo Next.js, não precisam estar aqui.
  // Rotas de API internas chamadas pelo frontend (se houver) devem ser protegidas.
  const protectedApiPrefixes = ['/api/notifications', '/api/upload', '/api/trpc', '/api/drive', '/api/sheets', '/api/backup']; // Exemplos, ajuste conforme necessário
  const protectedPagePrefixes = ['/dashboard'];
  const publicRoutes = ['/login']; // A raiz '/' redireciona para '/login' na app/page.tsx

  // Permitir acesso a TODAS as rotas /api/auth/* e /api/healthcheck
  if (pathname.startsWith('/api/auth') || pathname === '/api/healthcheck') {
    console.log(`[Middleware] Permitindo rota pública/auth: ${pathname}`);
    return NextResponse.next();
  }

  // Se está na página de login E autenticado -> Redireciona para /dashboard
  if (pathname === '/login' && isAuthenticated) {
    console.log(`[Middleware] Redirecionando usuário autenticado DE /login PARA /dashboard.`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Se tenta acessar rota PROTEGIDA (página ou API) e NÃO está autenticado -> Redireciona para /login
  const isProtectedPage = protectedPagePrefixes.some(prefix => pathname.startsWith(prefix));
  const isProtectedApi = protectedApiPrefixes.some(prefix => pathname.startsWith(prefix));

  if ((isProtectedPage || isProtectedApi) && !isAuthenticated) {
    console.log(`[Middleware] Bloqueado acesso não autenticado a ${pathname}. Redirecionando para /login.`);
    const loginUrl = new URL('/login', request.url);
    // Limpa query params para evitar loops ou erros
    loginUrl.search = '';
    // Adiciona parâmetro opcional para indicar o redirecionamento, se desejado
    // loginUrl.searchParams.set('callbackUrl', request.url); // Cuidado com loops!
    return NextResponse.redirect(loginUrl);
  }

  // Se chegou aqui, permite o acesso (autenticado em rota protegida, ou rota não listada/pública)
  console.log(`[Middleware] Permitindo acesso a ${pathname}`);
  return NextResponse.next();
}

// Configuração do Matcher (mantido, ajustado para PWA)
export const config = {
  matcher: [
    // Exclui rotas da API Next.js, arquivos estáticos, imagens e arquivos PWA
    '/((?!api/_next/static|api/_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Inclui especificamente as rotas de API que precisam de proteção (exceto /api/auth)
    '/api/notifications/:path*',
    '/api/upload-s3/:path*',
    '/api/upload-drive-despesa/:path*',
    '/api/upload-drive-document/:path*',
    '/api/trpc/:path*',
    '/api/drive/:path*',
    '/api/sheets/:path*',
    '/api/backup/:path*',
  ],
};
// ============================================================
// END OF FILE: middleware.ts
// ============================================================
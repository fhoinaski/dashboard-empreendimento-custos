// ============================================================
// lib/auth/options.ts (CONFIRMADO - CORRETO)
// ============================================================
import { NextAuthOptions, DefaultUser, Session, User as NextAuthUser, DefaultSession } from "next-auth"; // <-- DefaultSession está aqui
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import connectToDatabase from '../db/mongodb';
import { User, UserDocument } from '../db/models';
import mongoose, { Types } from 'mongoose';

// --- Module Augmentation ---
declare module "next-auth" {
  interface User extends DefaultUser {
    tenantId?: string | null;
    role?: 'superadmin' | 'admin' | 'manager' | 'user';
    sessionId?: string;
    avatarUrl?: string;
    assignedEmpreendimentos?: string[];
  }
  interface Session {
    user: {
      tenantId?: string | null;
      id?: string;
      sub?: string;
      role?: 'superadmin' | 'admin' | 'manager' | 'user';
      name?: string | null;
      email?: string | null;
      image?: string | null;
      avatarUrl?: string;
      assignedEmpreendimentos?: string[];
    // Correção aqui: Usar Omit<DefaultSession['user'], ...> para pegar outros campos padrão
    } & Omit<DefaultSession['user'], 'id' | 'image' | 'name' | 'email'>; // Omitir os que já definimos para evitar conflito
    expires: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string | null;
    id?: string;
    sub?: string;
    role?: 'superadmin' | 'admin' | 'manager' | 'user';
    sessionId?: string;
    avatarUrl?: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    assignedEmpreendimentos?: string[];
  }
}
// --- End Module Augmentation ---

// Função auxiliar simples para gerar um ID de sessão (pode ser mais robusta)
const generateSessionId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const isProduction = process.env.NODE_ENV === 'production';

export const authOptions: NextAuthOptions = {
  // Provedor de Credenciais
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "seu@email.com" },
        password: { label: "Senha", type: "password" },
      },
      // Lógica de autorização
      async authorize(credentials, req) {
        console.log("[Authorize] Iniciando autorização...");
        if (!credentials?.email || !credentials.password) {
          console.log("[Authorize] Credenciais ausentes.");
          throw new Error("Email e senha são obrigatórios.");
        }

        try {
          await connectToDatabase();
          console.log("[Authorize] DB Conectado. Buscando usuário:", credentials.email);

          const user: UserDocument | null = await User.findOne({ email: credentials.email }).lean();

          if (!user) {
            console.log("[Authorize] Usuário não encontrado:", credentials.email);
            throw new Error("Credenciais inválidas.");
          }

          console.log("[Authorize] Usuário encontrado:", user.email, "Role:", user.role, "Tenant:", user.tenantId ?? 'N/A (Super Admin)');

          if (!user.password) {
            console.warn("[Authorize] Usuário sem senha:", user.email);
            throw new Error("Conta inválida ou não configurada corretamente.");
          }

          // Validação de Tenant ID (ignora para superadmin)
          // *** SUPERADMIN CHECK: role é superadmin E tenantId NÃO existe (null/undefined) ***
          const isSuperAdmin = user.role === 'superadmin' && !user.tenantId;

          if (!isSuperAdmin && !user.tenantId) { // Usuário não-superadmin PRECISA ter tenantId
            console.error(`[Authorize] ERRO FATAL: Usuário ${user.email} (Role: ${user.role}) deveria ter um tenantId!`);
            throw new Error("Configuração de conta inválida.");
          }
          // Validação adicional: TenantId deve ser ObjectId válido se existir
          if (user.tenantId && !mongoose.isValidObjectId(user.tenantId)) {
              console.error(`[Authorize] ERRO FATAL: Tenant ID inválido para usuário ${user.email}: ${user.tenantId}`);
              throw new Error("Configuração de conta inválida.");
          }

          const passwordIsValid = await compare(credentials.password, user.password);
          if (!passwordIsValid) {
            console.log("[Authorize] Senha inválida para:", credentials.email);
            throw new Error("Credenciais inválidas.");
          }

          console.log("[Authorize] Autenticação OK para:", user.email);

          const assignedEmpreendimentosIds: string[] = (user.assignedEmpreendimentos || [])
            .map(id => id instanceof Types.ObjectId ? id.toString() : String(id))
            .filter(id => Types.ObjectId.isValid(id));

          // Retorna o objeto User estendido
          return {
            id: user._id.toString(),
            // *** Garante que tenantId é null para superadmin ***
            tenantId: isSuperAdmin ? null : user.tenantId?.toString() ?? null,
            email: user.email,
            name: user.name,
            role: user.role, // 'superadmin', 'admin', 'manager', 'user'
            sessionId: generateSessionId(),
            avatarUrl: user.avatarUrl,
            image: user.avatarUrl, // Mapeia para o campo 'image' padrão
            assignedEmpreendimentos: assignedEmpreendimentosIds,
          };

        } catch (error) {
          console.error("[Authorize] Erro durante autenticação:", error);
          // Relança o erro para o NextAuth tratar (ex: exibir mensagem na tela de login)
          if (error instanceof Error) throw error; // Relança erros conhecidos
          throw new Error("Erro interno durante a autenticação."); // Erro genérico
        }
      },
    }),
  ],

  // Configuração da Sessão
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 dia
  },

  // Páginas Customizadas
  pages: {
    signIn: "/login",
    error: "/login", // Redireciona para login em caso de erro
  },

  // Callbacks
  callbacks: {
    // --- JWT Callback ---
    // Este callback é executado sempre que um JWT é criado (no login) ou atualizado (acesso à sessão).
    // O objeto `user` só está disponível na primeira vez (durante o login).
    async jwt({ token, user }) {
      // Se user existe (login), copia os dados do user para o token
      if (user) {
        token.id = user.id;
        token.sub = user.id; // 'sub' é o padrão JWT para subject (user ID)
        token.tenantId = user.tenantId; // Copia tenantId (pode ser null para superadmin)
        token.role = user.role; // Copia a role
        token.name = user.name;
        token.email = user.email;
        token.avatarUrl = user.avatarUrl;
        token.picture = user.image; // 'picture' é outro campo padrão JWT
        token.assignedEmpreendimentos = user.assignedEmpreendimentos;
        // console.log("[JWT Callback - Login] Token populado:", token);
      }
      // Nas chamadas subsequentes, o token já existe e é retornado.
      // console.log("[JWT Callback - Update] Token retornado:", token);
      return token;
    },

    // --- Session Callback ---
    // Este callback é executado sempre que uma sessão é acessada.
    // Ele recebe o token JWT e a sessão padrão.
    async session({ session, token }) {
      // Se o token existe e a sessão tem um usuário, copia dados do token para a sessão
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.sub = token.sub as string; // Inclui sub se necessário
        session.user.tenantId = token.tenantId as string | null; // Inclui tenantId (pode ser null)
        session.user.role = token.role as 'superadmin' | 'admin' | 'manager' | 'user'; // Inclui role
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.avatarUrl = token.avatarUrl as string | undefined;
        session.user.image = token.picture as string | undefined || session.user.image; // Usa picture do token ou mantém o padrão
        session.user.assignedEmpreendimentos = token.assignedEmpreendimentos as string[] | undefined;
      } else {
         console.warn("[Session Callback] Token ou session.user ausente.");
      }
      // console.log("[Session Callback] Sessão final retornada:", JSON.stringify(session, null, 2));
      return session;
    },
  },

  // Segredo JWT
  secret: process.env.NEXTAUTH_SECRET,

  // Debug
  debug: !isProduction,

  // Cookies
  cookies: {
    // Configuração para produção (HTTPS) - ajusta nomes para __Secure e __Host
    sessionToken: {
        name: `${isProduction ? '__Secure-' : ''}next-auth.session-token`,
        options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: isProduction,
            // domain: isProduction ? '.yourdomain.com' : undefined, // Adicione seu domínio em produção se necessário
        },
    },
    callbackUrl: {
        name: `${isProduction ? '__Host-' : ''}next-auth.callback-url`,
        options: {
            sameSite: 'lax',
            path: '/',
            secure: isProduction,
        },
    },
    csrfToken: {
        name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
        options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: isProduction,
        },
    },
  },

  // Eventos
  events: {
      async signIn(message) {
          if (message.isNewUser) {
              console.log("[Event: signIn] Novo usuário registrado:", { email: message.user.email });
          } else {
              console.log("[Event: signIn] Usuário logado:", { email: message.user.email, provider: message.account?.provider });
          }
       },
      // async session(message) { /* console.log("[Event: session]", { tokenId: message.token?.id }); */ },
      async signOut(message) {
          console.log("[Event: signOut] Usuário desconectado:", { sessionUserId: message.session.user?.id });
      },
      async createUser(message) {
           console.log("[Event: createUser] Usuário criado via adapter (pode não ser usado com Credentials):", { email: message.user.email });
      }
  },
  // Adicione esta linha para lidar explicitamente com erros no authorize
  // e exibi-los na página de erro do NextAuth ou redirecionar
   // error: '/auth/error', // Opcional: redireciona para uma página de erro customizada
};
// ============================================================
// END OF FILE: lib/auth/options.ts
// ============================================================
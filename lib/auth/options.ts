import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import connectToDatabase from '../db/mongodb';
import { User, UserDocument } from '../db/models';
import { DefaultUser, RequestInternal } from "next-auth";
import { Types } from 'mongoose';

// --- Module Augmentation (sem alterações) ---
declare module "next-auth" {
  interface User extends DefaultUser {
    role?: string;
    sessionId?: string;
    avatarUrl?: string;
    assignedEmpreendimentos?: string[];
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      sessionId?: string;
      avatarUrl?: string;
      assignedEmpreendimentos?: string[];
    }
  }
  interface JWT {
    id?: string;
    role?: string;
    sessionId?: string;
    avatarUrl?: string;
    name?: string;
    email?: string;
    assignedEmpreendimentos?: string[];
  }
}
// --- End Module Augmentation ---

const generateSessionId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const isProduction = process.env.NODE_ENV === 'production';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
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
          console.log("[Authorize] Usuário encontrado:", user.email, "Role:", user.role);
          if (!user.password) {
            console.warn("[Authorize] Usuário sem senha:", user.email);
            throw new Error("Conta inválida.");
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
          console.log("[Authorize] Empreendimentos atribuídos (string[]):", assignedEmpreendimentosIds);
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            sessionId: generateSessionId(),
            avatarUrl: user.avatarUrl,
            assignedEmpreendimentos: assignedEmpreendimentosIds,
          };
        } catch (error) {
          console.error("[Authorize] Erro durante autenticação:", error);
          throw new Error(error instanceof Error ? error.message : "Erro interno na autenticação");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 day
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session, account }) {
      console.log("[JWT Callback] Iniciando...", { trigger, hasUser: !!user, hasAccount: !!account });
      if (user) {
        console.log("[JWT Callback] Populando token com dados do objeto 'user':", {id: user.id, email: user.email, role: user.role});
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
        token.avatarUrl = user.avatarUrl;
        token.assignedEmpreendimentos = user.assignedEmpreendimentos;
      }
      if (trigger === "update" && session) {
        console.log("[JWT Callback] Trigger 'update'. Dados da sessão:", session);
        if (session.name) token.name = session.name;
        if (session.avatarUrl) token.avatarUrl = session.avatarUrl;
      }
      console.log("[JWT Callback] Retornando token:", { id: token.id, email: token.email, role: token.role });
      return token;
    },
    async session({ session, token }) {
      console.log("[Session Callback] Iniciando...");
      console.log("[Session Callback] Token recebido:", { id: token?.id, email: token?.email, role: token?.role });
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string | undefined;
        session.user.email = token.email as string | undefined;
        session.user.avatarUrl = token.avatarUrl as string | undefined;
        session.user.image = token.avatarUrl as string | undefined || session.user.image;
        session.user.assignedEmpreendimentos = token.assignedEmpreendimentos as string[] | undefined;
        console.log("[Session Callback] Objeto session populado com dados do token.");
      } else {
        console.warn("[Session Callback] Token ou session.user ausente. Não foi possível popular.");
      }
      console.log("[Session Callback] Retornando objeto session final:", { userId: session.user?.id, userRole: session.user?.role });
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // Essencial para JWT
  debug: !isProduction,
  cookies: {
    // --- CONFIGURAÇÃO DE COOKIES PADRÃO/RECOMENDADA ---
    sessionToken: {
      name: `${isProduction ? '__Host-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        // domain: undefined, // Deixar o navegador inferir o domínio (__Host- não permite domain)
      },
    },
    callbackUrl: {
      name: `${isProduction ? '__Host-' : ''}next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        // domain: undefined,
      },
    },
    csrfToken: {
      name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        // domain: undefined,
      },
    },
    // --- FIM DA CONFIGURAÇÃO PADRÃO ---
  },
  events: {
      async signIn(message) { console.log("[Event: signIn]", { user: message.user.email, account: message.account?.provider }); },
      async session(message) { console.log("[Event: session]", { tokenUserId: message.token?.id }); },
      // Adicione logs para outros eventos se precisar depurar mais
  },
};
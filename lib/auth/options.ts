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
    assignedEmpreendimentos?: string[]; // Array of string IDs
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
    email?: string; // Adicione email ao JWT se não estiver lá
    assignedEmpreendimentos?: string[];
    // Inclua outros campos se precisar passá-los do authorize para o session
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
      async authorize(credentials, req) { // Assinatura simplificada
        console.log("[Authorize] Iniciando autorização...");
        if (!credentials?.email || !credentials.password) {
          console.log("[Authorize] Credenciais ausentes.");
          throw new Error("Email e senha são obrigatórios."); // Lança erro para NextAuth
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
            throw new Error("Conta inválida."); // Ou outra mensagem apropriada
          }

          const passwordIsValid = await compare(credentials.password, user.password);

          if (!passwordIsValid) {
            console.log("[Authorize] Senha inválida para:", credentials.email);
            throw new Error("Credenciais inválidas.");
          }

          console.log("[Authorize] Autenticação OK para:", user.email);

          const assignedEmpreendimentosIds: string[] = (user.assignedEmpreendimentos || [])
              .map(id => id instanceof Types.ObjectId ? id.toString() : String(id)) // Garante conversão segura
              .filter(id => Types.ObjectId.isValid(id)); // Filtra IDs inválidos

          console.log("[Authorize] Empreendimentos atribuídos (string[]):", assignedEmpreendimentosIds);

          // Retorna o objeto que será passado para o callback JWT
          // Certifique-se de incluir TODOS os campos que você quer na sessão/token
          return {
            id: user._id.toString(),
            email: user.email, // Garanta que o email está aqui
            name: user.name,
            role: user.role,
            sessionId: generateSessionId(), // sessionId pode ser opcional
            avatarUrl: user.avatarUrl,
            assignedEmpreendimentos: assignedEmpreendimentosIds,
          };
        } catch (error) {
          console.error("[Authorize] Erro durante autenticação:", error);
          // Lança o erro para o NextAuth tratar (ele mostrará uma mensagem genérica ou redirecionará para error page)
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
    error: "/login", // Página para onde redirecionar em caso de erro (ex: credenciais inválidas)
  },
  callbacks: {
    async jwt({ token, user, trigger, session, account }) {
      // --- LOG INICIAL ---
      console.log("[JWT Callback] Iniciando...", { trigger, hasUser: !!user, hasAccount: !!account });

      // No login inicial (quando 'user' está presente, vindo do authorize)
      if (user) {
        console.log("[JWT Callback] Populando token com dados do objeto 'user':", user);
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email; // Garanta que o email está no token
        token.avatarUrl = user.avatarUrl;
        token.assignedEmpreendimentos = user.assignedEmpreendimentos;
        // token.sessionId = user.sessionId; // Se estiver usando sessionId
        console.log("[JWT Callback] Token após população inicial:", token);
      }

      // Quando a sessão é atualizada (ex: useSession().update() ou mudança de aba)
      if (trigger === "update" && session) {
        console.log("[JWT Callback] Trigger 'update' detectado. Dados da sessão para update:", session);
        // Atualiza apenas os campos permitidos (ex: nome, avatar)
        if (session.name) token.name = session.name;
        if (session.avatarUrl) token.avatarUrl = session.avatarUrl;
        // Role e assignments normalmente não devem ser atualizados por aqui por segurança
        console.log("[JWT Callback] Token após trigger 'update':", token);
      }

      // --- LOG FINAL ---
      console.log("[JWT Callback] Retornando token:", { id: token.id, email: token.email, role: token.role, name: token.name });
      return token;
    },
    async session({ session, token }) {
      // --- LOG INICIAL ---
      console.log("[Session Callback] Iniciando...");
      console.log("[Session Callback] Token recebido:", token);
      console.log("[Session Callback] Objeto session recebido:", session);

      // Passa os dados do token JWT para o objeto 'session' que será usado no cliente
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string | undefined;
        session.user.email = token.email as string | undefined; // Pega email do token
        session.user.avatarUrl = token.avatarUrl as string | undefined;
        // Garante que a imagem padrão do NextAuth use o avatarUrl se disponível
        session.user.image = token.avatarUrl as string | undefined || session.user.image;
        session.user.assignedEmpreendimentos = token.assignedEmpreendimentos as string[] | undefined;
        // session.user.sessionId = token.sessionId as string | undefined; // Se estiver usando sessionId
        console.log("[Session Callback] Objeto session populado:", session);
      } else {
        console.warn("[Session Callback] Token ou session.user ausente. Não foi possível popular a sessão.");
      }

      // --- LOG FINAL ---
      console.log("[Session Callback] Retornando objeto session final:", session);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: !isProduction, // Habilita logs detalhados do NextAuth em dev
  cookies: {
    sessionToken: {
      name: `${isProduction ? '__Host-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        domain: isProduction ? '.dashboard-fhok.vercel.app' : undefined, // Tente especificar o domínio em produção
      },
    },
     // Adicione cookies de CSRF também, se necessário (NextAuth v4 geralmente lida bem por padrão)
     csrfToken: {
       name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
       options: {
         httpOnly: true,
         sameSite: 'lax',
         path: '/',
         secure: isProduction,
         domain: isProduction ? '.dashboard-fhok.vercel.app' : undefined,
       },
     },
     // Se estiver usando callbackUrl
     callbackUrl: {
       name: `${isProduction ? '__Host-' : ''}next-auth.callback-url`,
       options: {
         sameSite: 'lax',
         path: '/',
         secure: isProduction,
         domain: isProduction ? '.dashboard-fhok.vercel.app' : undefined,
       },
     },
  },
  // Opcional: Adiciona log de eventos
  events: {
      async signIn(message) { console.log("[Event: signIn]", message); },
      async session(message) { console.log("[Event: session]", message); },
      async signOut(message) { console.log("[Event: signOut]", message); },
      async createUser(message) { console.log("[Event: createUser]", message); },
      async updateUser(message) { console.log("[Event: updateUser]", message); },
      async linkAccount(message) { console.log("[Event: linkAccount]", message); },
  },
};
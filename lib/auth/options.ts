import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs"; 
import connectToDatabase from '../db/mongodb';
import { User } from '../db/models';
import { Model } from "mongoose";
import { DefaultUser, RequestInternal } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: string;
    sessionId?: string;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      sessionId?: string;
    }
  }
  interface JWT {
    id?: string;
    role?: string;
    sessionId?: string;
  }
}

interface IUser {
  _id: any;
  name: string;
  email: string;
  password: string;
  role: string;
}

type UserModel = Model<IUser>;

const generateSessionId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Determina o ambiente
const isProduction = process.env.NODE_ENV === 'production';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials: Record<"email" | "password", string> | undefined, req: Pick<RequestInternal, "body" | "query" | "headers" | "method">) {
        console.log("[Authorize] Início do processo de autenticação", { credentials, req: req.method });
        if (!credentials || !credentials.email || !credentials.password) {
          console.log("[Authorize] Credenciais inválidas ou ausentes", { credentials });
          return null;
        }
        
        console.log("[Authorize] Credenciais recebidas:", { email: credentials.email });
        try {
          await connectToDatabase();
          console.log("[Authorize] Conexão com MongoDB estabelecida com sucesso");
          const user = await (User as UserModel).findOne({ email: credentials.email });
          
          if (!user) {
            console.log("[Authorize] Usuário não encontrado:", credentials.email);
            return null;
          }
          
          const passwordIsValid = await compare(credentials.password, user.password);
          if (!passwordIsValid) {
            console.log("[Authorize] Senha inválida para:", credentials.email);
            return null;
          }
          
          const sessionId = generateSessionId();
          console.log("[Authorize] Login bem-sucedido para:", { email: credentials.email, sessionId });
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            sessionId,
          };
        } catch (error) {
          console.error("[Authorize] Erro ao autenticar:", error);
          return null;
        }
      },
    }),
  ],
  
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  
  pages: {
    signIn: "/login",
    error: "/login",
  },
  
  callbacks: {
    async jwt({ token, user }) {
      console.log("[JWT Callback] Antes de atualizar token:", { token, user });
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionId = user.sessionId;
      }
      console.log("[JWT Callback] Após atualizar token:", { token });
      return token;
    },
    
    async session({ session, token }) {
      console.log("[Session Callback] Antes de atualizar sessão:", { session, token });
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.sessionId = token.sessionId as string | undefined;
      }
      console.log("[Session Callback] Após atualizar sessão:", { session });
      return session;
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
  debug: !isProduction, // Desativar debug em produção
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction, // True em produção, false em desenvolvimento
        domain: isProduction ? '.dashboard-custos.vercel.app' : 'localhost', // Ajustar para seu domínio
      },
    },
  },
};
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs"; 
import connectToDatabase from '../db/mongodb'; // Seu arquivo mongoose atual
import { User } from '../db/models';
import { Model } from "mongoose";
import { DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: string;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

// Defina a interface para o usuário se ainda não tiver
interface IUser {
  _id: any;
  name: string;
  email: string;
  password: string;
  role: string;
}

// Tipagem explícita para o modelo User
type UserModel = Model<IUser>;

export const authOptions: NextAuthOptions = {
  // Provedores de autenticação
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        // Verifica se as credenciais foram fornecidas
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        try {
          // Conecta ao banco de dados
          await connectToDatabase();
          
          // Busca o usuário no banco de dados - com cast explícito para UserModel
          const user = await (User as UserModel).findOne({ email: credentials.email });
          
          // Se o usuário não existir, retorna null
          if (!user) {
            console.log(`Usuário não encontrado: ${credentials.email}`);
            return null;
          }
          
          // Verifica se a senha está correta
          const passwordIsValid = await compare(credentials.password, user.password);
          
          // Se a senha estiver incorreta, retorna null
          if (!passwordIsValid) {
            console.log(`Senha inválida para o usuário: ${credentials.email}`);
            return null;
          }
          
          // Retorna o usuário
          console.log(`Login bem-sucedido para: ${credentials.email}`);
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("Erro ao autenticar:", error);
          return null;
        }
      },
    }),
  ],
  
  // Configurações da sessão
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas (você pode ajustar conforme necessário)
  },
  
  // Páginas personalizadas
  pages: {
    signIn: "/login",
    error: "/login",
  },
  
  // Callbacks
  callbacks: {
    // Modifica o token JWT para incluir o id e o papel do usuário
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    
    // Modifica a sessão para incluir o id e o papel do usuário
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  
  // Configurações secretas
  secret: process.env.NEXTAUTH_SECRET,
  
  // Habilitar debug em desenvolvimento
  debug: process.env.NODE_ENV === "development",
};
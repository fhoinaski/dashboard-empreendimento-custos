/* ================================== */
/*         lib/auth/options.ts        */
/* ================================== */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import connectToDatabase from '../db/mongodb';
import { User, UserDocument } from '../db/models';
import { DefaultUser, RequestInternal } from "next-auth";
import { Types } from 'mongoose';

// --- Module Augmentation ---
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
      async authorize(credentials: Record<"email" | "password", string> | undefined) {
        if (!credentials?.email || !credentials?.password) {
          if (!isProduction) console.log("[Authorize] Missing credentials.");
          return null;
        }

        try {
          await connectToDatabase();
          if (!isProduction) console.log("[Authorize] Connected to DB. Finding user:", credentials.email);

          const user: UserDocument | null = await User.findOne({ email: credentials.email }).lean();

          if (!user) {
            if (!isProduction) console.log("[Authorize] User not found:", credentials.email);
            return null;
          }

          if (!user.password) {
            if (!isProduction) console.warn("[Authorize] User has no password:", user.email);
            return null;
          }

          const passwordIsValid = await compare(credentials.password, user.password);
          if (!passwordIsValid) {
            if (!isProduction) console.log("[Authorize] Invalid password for user:", credentials.email);
            return null;
          }

          const assignedEmpreendimentosIds: string[] = (user.assignedEmpreendimentos || [])
            .filter(id => id instanceof Types.ObjectId)
            .map(id => id.toString());

          if (!isProduction) console.log("[Authorize] Authentication successful for:", user.email, "Assigned IDs:", assignedEmpreendimentosIds);

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
          console.error("[Authorize] Error during authentication:", error);
          return null;
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionId = user.sessionId;
        token.avatarUrl = user.avatarUrl;
        token.name = user.name;
        token.assignedEmpreendimentos = user.assignedEmpreendimentos;
        if (!isProduction) console.log("[JWT Callback - Initial] Token created:", {
          id: token.id,
          role: token.role,
          name: token.name,
          assignments: Array.isArray(token.assignedEmpreendimentos) ? token.assignedEmpreendimentos.length : 0,
        });
      }

      if (trigger === "update" && session) {
        if (!isProduction) console.log("[JWT Callback - Update] Updating token from session:", session);
        if (session.name) token.name = session.name;
        if (session.avatarUrl) token.avatarUrl = session.avatarUrl;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string | undefined;
        session.user.role = token.role as string | undefined;
        session.user.sessionId = token.sessionId as string | undefined;;
        session.user.avatarUrl = token.avatarUrl as string | undefined;;
        session.user.name = token.name as string | undefined;;
        session.user.image = token.avatarUrl as string | undefined;; // Map to default image field
        session.user.assignedEmpreendimentos = token.assignedEmpreendimentos as string[] | undefined;

        if (!isProduction) console.log("[Session Callback] Session updated:", {
          id: session.user.id,
          role: session.user.role,
          name: session.user.name,
          assignments: session.user.assignedEmpreendimentos?.length || 0,
        });
      } else {
        console.warn("[Session Callback] Token or session.user missing. Session may be invalid.");
        // Opcional: Invalidar sessão se essencial
        // delete session.user;
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: !isProduction,
  cookies: {
    sessionToken: {
      name: `${isProduction ? '__Host-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
};
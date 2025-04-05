/* ================================== */
/*         lib/auth/options.ts        */
/* ================================== */
// Ensure assignedEmpreendimentos (as string[]) is included in JWT and Session
// (The provided code already seems correct, but verify population works reliably)

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
    assignedEmpreendimentos?: string[]; // Array of string IDs
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null; // next-auth default
      sessionId?: string;
      avatarUrl?: string; // custom
      assignedEmpreendimentos?: string[]; // custom
    }
  }
  interface JWT {
    id?: string;
    role?: string;
    sessionId?: string;
    avatarUrl?: string;
    name?: string;
    assignedEmpreendimentos?: string[]; // Array of string IDs
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
      async authorize(credentials: Record<"email" | "password", string> | undefined, req: Pick<RequestInternal, "body" | "query" | "headers" | "method">) {
        if (!credentials || !credentials.email || !credentials.password) {
          console.log("[Authorize] Missing credentials.");
          return null;
        }
        try {
          await connectToDatabase();
          console.log("[Authorize] Connected to DB. Finding user:", credentials.email);

          // Fetch user WITHOUT population first
          const user: UserDocument | null = await User.findOne({ email: credentials.email }).lean(); // Use lean for plain object

          if (!user) {
            console.log("[Authorize] User not found:", credentials.email);
            return null;
          }
          console.log("[Authorize] User found:", user.email, "Role:", user.role);

          if (!user.password) {
            console.warn("[Authorize] User found but has no password:", user.email);
            return null;
          }

          const passwordIsValid = await compare(credentials.password, user.password);

          if (!passwordIsValid) {
            console.log("[Authorize] Invalid password for user:", credentials.email);
            return null;
          }

          console.log("[Authorize] Authentication successful for:", user.email);

          // Convert ObjectId[] to string[] for assignedEmpreendimentos
          const assignedEmpreendimentosIds: string[] = (user.assignedEmpreendimentos || [])
              .filter(id => id instanceof Types.ObjectId) // Ensure it's an ObjectId before converting
              .map(id => id.toString());

           console.log("[Authorize] Assigned Empreendimento IDs for token:", assignedEmpreendimentosIds);

          // Return object for NextAuth token/session
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role, // Make sure role exists on the user document
            sessionId: generateSessionId(),
            avatarUrl: user.avatarUrl,
            assignedEmpreendimentos: assignedEmpreendimentosIds, // Crucial for RBAC
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
    error: "/login", // Redirect to login on error
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionId = user.sessionId;
        token.avatarUrl = user.avatarUrl;
        token.name = user.name;
        token.assignedEmpreendimentos = user.assignedEmpreendimentos; // Store string[]
        console.log("[JWT Callback - Initial] Token created:", { 
          id: token.id, 
          role: token.role, 
          name: token.name, 
          assignments: Array.isArray(token.assignedEmpreendimentos) ? token.assignedEmpreendimentos.length : 0 
        });
      }

       // Session update (e.g., profile edit)
       if (trigger === "update" && session) {
          console.log("[JWT Callback - Update] Updating token from session:", session);
          if (session.name) token.name = session.name;
          if (session.avatarUrl) token.avatarUrl = session.avatarUrl;
          // Role and assignments generally shouldn't be updated via client-side session update
       }

      return token;
    },
    async session({ session, token }) {
      // Pass data from JWT token to session object (available client-side)
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.sessionId = token.sessionId as string | undefined;
        session.user.avatarUrl = token.avatarUrl as string | undefined;
        session.user.name = token.name as string | undefined;
        session.user.image = token.avatarUrl as string | undefined; // Map avatarUrl to default image field if needed
        session.user.assignedEmpreendimentos = token.assignedEmpreendimentos as string[] | undefined; // Pass string[]
      } else {
          console.warn("[Session Callback] Token or session.user missing during session creation.");
      }
       // console.log("[Session Callback] Final Session Object:", JSON.stringify(session)); // Debugging
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
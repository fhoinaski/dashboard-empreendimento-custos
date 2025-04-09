"use client"; // Add 'use client' for hooks

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useSession, signIn, signOut, SessionContextValue } from "next-auth/react"; // Import hooks and functions from next-auth/react
import { Session } from "next-auth"; // Import Session type from next-auth
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast'; // Import useToast
import { TRPCClientErrorLike } from '@trpc/client'; // Import error type
import { AppRouter } from '@/server/api/root'; // Import AppRouter type
// Import the specific input type for the register mutation
import { CreateUserInput } from '@/server/api/schemas/auth'; // Adjust path if needed

interface AuthContextType {
  // Use Session type from next-auth
  session: Session | null;
  // Use status from useSession for loading/auth state
  status: SessionContextValue["status"];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Use the specific input type here
  register: (userData: CreateUserInput) => Promise<void>;
  isRegistering: boolean; // Add loading state for register
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use useSession for managing session state and status
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  // State for register mutation loading
  const [isRegistering, setIsRegistering] = useState(false);

  // Register Mutation (Keep this as the procedure exists)
  const registerMutation = trpc.auth.register.useMutation({
      onSuccess: (data) => {
          toast({
              title: "Registro bem-sucedido",
              description: data.message,
          });
          // Optionally redirect to login or dashboard after registration
          router.push('/login');
      },
      onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
          toast({
              variant: "destructive",
              title: "Erro no registro",
              description: error.message,
          });
      },
      onSettled: () => {
          setIsRegistering(false); // Reset loading state
      }
  });

  // Login function using signIn
  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        redirect: false, // Handle redirect manually after success
        email,
        password,
      });

      if (!result?.ok) {
        throw new Error(result?.error || "Credenciais inválidas");
      }

      toast({
        title: "Login bem-sucedido",
        description: "Redirecionando...",
      });
      // Successful login triggers useSession update, let component redirect based on status
      // router.push('/dashboard'); // Or use window.location.href='/dashboard'
    } catch (error) {
      console.error("Erro de login:", error);
      toast({
        variant: "destructive",
        title: "Erro de login",
        description: error instanceof Error ? error.message : "Falha na autenticação",
      });
      // Re-throw if needed by the calling component
      // throw error;
    }
  }, [toast]); // Add router and toast as dependencies

  // Logout function using signOut
  const logout = useCallback(async () => {
    try {
      await signOut({ redirect: false }); // Handle redirect manually
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado.",
      });
      router.push('/login'); // Redirect to login after logout
    } catch (error) {
      console.error("Erro no logout:", error);
      toast({
        variant: "destructive",
        title: "Erro no logout",
        description: "Não foi possível desconectar.",
      });
    }
  }, [router, toast]); // Add router and toast as dependencies

  // Register function using the tRPC mutation
  const register = useCallback(async (userData: CreateUserInput) => { // Use correct input type
    setIsRegistering(true); // Set loading state
    // The mutation's onSettled will reset isLoading
    await registerMutation.mutateAsync(userData);
  }, [registerMutation]); // Add registerMutation as dependency

  const value: AuthContextType = {
    session, // Session from useSession
    status, // Status from useSession ('loading', 'authenticated', 'unauthenticated')
    isAuthenticated: status === 'authenticated',
    login,
    logout,
    register,
    isRegistering,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
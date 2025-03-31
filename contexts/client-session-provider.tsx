// components/client-session-provider.tsx
"use client"; // Essencial para o SessionProvider

import { SessionProvider } from "next-auth/react";
import type React from "react"; // Boa prática importar o tipo

export default function ClientSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
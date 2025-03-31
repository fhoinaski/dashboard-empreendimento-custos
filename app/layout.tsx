// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import ClientSessionProvider from "@/contexts/client-session-provider";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scotta Empreendimentos Dashboard",
  description: "Manage your Scotta Empreendimentos and expenses efficiently",
};

// Deve haver apenas UM export default neste arquivo
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {/* Usa o componente importado para envolver os filhos */}
          <ClientSessionProvider>
            {children}
          </ClientSessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
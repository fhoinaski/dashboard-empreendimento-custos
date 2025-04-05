// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Ou styles/globals.css
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster"; // Ou sonner
import ClientSessionProvider from "@/contexts/client-session-provider"; // CORRIJA O CAMINHO SE NECESSÁRIO

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard Imobiliário - Gestão de Empreendimentos",
  description: "Gerencie seus empreendimentos imobiliários e despesas de forma eficiente",
  manifest: "/manifest.json",
  applicationName: "Dashboard Imobiliário",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashboard Imobiliário",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>{/* Meta tags PWA etc */}</head>
      <body className={inter.className}>
        {/* ClientSessionProvider envolve ThemeProvider e children para garantir acesso à sessão */}
        <ClientSessionProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </ClientSessionProvider>
      </body>
    </html>
  );
}
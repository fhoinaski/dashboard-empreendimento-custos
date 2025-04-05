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
  manifest: "/manifest.json",
  applicationName: "Scotta Gestão",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scotta Gestão",
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
      <head>{/* Escrever tudo em uma linha para evitar nós de texto em branco */}<meta name="viewport" content="width=device-width, initial-scale=1.0" /><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#44c3a3" /><link rel="apple-touch-icon" href="/icons/icon-512x512.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="default" /><meta name="apple-mobile-web-app-title" content="Scotta Gestão" /></head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ClientSessionProvider>
            {children}
          </ClientSessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
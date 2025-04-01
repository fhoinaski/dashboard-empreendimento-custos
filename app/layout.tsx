// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Assuming styles/globals.css is aliased or imported correctly
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster"; // Assuming this is sonner or shadcn toaster
import ClientSessionProvider from "@/contexts/client-session-provider";

const inter = Inter({ subsets: ["latin"] });

// Your existing metadata might be more complex
export const metadata: Metadata = {
  title: "Scotta Empreendimentos Dashboard",
  description: "Manage your Scotta Empreendimentos and expenses efficiently",
  // Add PWA related metadata if desired (though manifest is primary)
  applicationName: "Scotta Gestão",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scotta Gestão",
    // startupImage: [...] // Optional: Add startup images
  },
  formatDetection: {
    telephone: false,
  },
  // openGraph, twitter metadata...
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Link to the Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme Color for PWA UI */}
        <meta name="theme-color" content="#44c3a3" /> {/* Match manifest.json */}

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

        {/* Other Apple specific meta tags (Optional but recommended) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Scotta Gestão" />

        {/* Favicon links (ensure these exist in /public) */}
        {/* <link rel="icon" href="/favicon.ico" sizes="any" /> */}
        {/* <link rel="icon" href="/icon.svg" type="image/svg+xml" /> */}
        {/* <link rel="apple-touch-icon" href="/apple-touch-icon.png" /> */}

      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ClientSessionProvider>
            {children}
          </ClientSessionProvider>
          {/* Ensure you have only one Toaster component rendered */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
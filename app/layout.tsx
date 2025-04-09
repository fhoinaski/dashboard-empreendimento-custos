import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import ClientSessionProvider from '@/contexts/client-session-provider';
import ClientProviders from './ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dashboard Imobiliário - Gestão de Empreendimentos',
  description: 'Gerencie seus empreendimentos imobiliários e despesas de forma eficiente',
  manifest: '/manifest.json',
  applicationName: 'Dashboard Imobiliário',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dashboard Imobiliário',
  },
  formatDetection: {
    telephone: false,
  },
};

// Função de utilidade movida para um arquivo separado
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // Navegador usa URL relativa
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ClientProviders>
          <ClientSessionProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              {children}
              <Toaster />
            </ThemeProvider>
          </ClientSessionProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
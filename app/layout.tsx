import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import ClientSessionProvider from '@/contexts/client-session-provider';
import ClientProviders from './ClientProviders';

const inter = Inter({ subsets: ['latin'] });

// --- METADATA OBJECT DEFINITION ---
export const metadata: Metadata = {
  title: 'OrbiGestão - Plataforma de Gestão Multi-Serviços',
  description: 'Centralize a gestão da sua empresa com o OrbiGestão. Controle obras, manutenção, financeiro e muito mais em uma plataforma eficiente e integrada.',
  manifest: '/manifest.json',
  applicationName: 'OrbiGestão',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OrbiGestão',
  },
  themeColor: '#1D3557', // Azul Orbi Profundo da paleta sugerida
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
  icons: {
    icon: '/icons/icon-512x512.png',
    apple: '/icons/apple-icon.png',
  },
  openGraph: {
    title: 'OrbiGestão - Plataforma de Gestão Multi-Serviços',
    description: 'Otimize e simplifique a gestão da sua empresa com o OrbiGestão. Gestão integrada para múltiplos serviços e operações.',
    url: 'https://orbigestao.com.br', // Atualize conforme seu domínio
    siteName: 'OrbiGestão',
    images: [
      {
        url: '/icons/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OrbiGestão - Plataforma de Gestão Multi-Serviços',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrbiGestão - Plataforma de Gestão Multi-Serviços',
    description: 'Gerencie sua operação de maneira eficiente com o OrbiGestão.',
    images: ['/icons/og-image.png'],
  },
  formatDetection: {
    telephone: false,
  }
}; 
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // Navegador usa URL relativa
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

// --- RootLayout COMPONENT DEFINITION ---
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
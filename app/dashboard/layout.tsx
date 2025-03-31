// app/dashboard/layout.tsx
"use client";

import { useState, useEffect } from "react"; // <- Pode precisar remover useEffect se não usar mais
import { SessionProvider, useSession } from "next-auth/react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";
// import { Loading } from "@/components/ui/loading"; // <- REMOVA SE EXISTIR

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // const { status } = useSession(); // <- REMOVA se usava para loading

  // REMOVA ESTE BLOCO IF SE EXISTIR
  // if (status === "loading") {
  //   return <Loading />;
  // }

  return (
    <SessionProvider> {/* SessionProvider deve estar aqui ou no RootLayout */}
        <NotificationProvider>
            <div className="flex min-h-screen bg-background">
                <DashboardSidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex-1 flex flex-col min-w-0">
                    <DashboardHeader isMobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-4 sm:p-6 lg:p-8">
                           {children} {/* O loading.tsx ou Suspense cuidarão daqui */}
                        </div>
                    </main>
                </div>
            </div>
        </NotificationProvider>
    </SessionProvider>
  );
}
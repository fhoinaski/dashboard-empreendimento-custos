// app/dashboard/layout.tsx
"use client";

import { useState } from "react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader isMobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
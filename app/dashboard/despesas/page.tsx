// FILE: app/dashboard/despesas/page.tsx
// STATUS: REFACTORED (Server Component - No Data Fetching)

export const dynamic = 'force-dynamic'; // Keep if you need dynamic rendering based on searchParams elsewhere, but not strictly needed for this component anymore

import type { Metadata } from "next";
import { getServerSession } from "next-auth/next"; // Keep for RBAC check if needed
import { authOptions } from "@/lib/auth/options"; // Keep for RBAC check if needed
import DespesasList from "@/components/despesas/despesas-list";
import { Lock } from "lucide-react"; // Keep for potential RBAC message

// Metadata remains the same
export const metadata: Metadata = {
  title: "Despesas | Scotta Empreendimentos",
  description: "Gerencie as despesas dos empreendimentos",
};

// No need for DespesasPageProps as searchParams are handled client-side now
export default async function DespesasPage() {
  // Optional: You can still perform a basic server-side RBAC check here
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.id) {
  //   // Handle redirect or unauthorized view
  //   return (
  //     <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
  //       <Lock className="h-12 w-12 text-muted-foreground mb-4" />
  //       <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
  //       <p className="text-muted-foreground max-w-sm">
  //         Você precisa estar logado para acessar esta página.
  //       </p>
  //     </div>
  //   );
  // }
  // // Add role-specific checks if necessary
  // if (!['admin', 'manager', 'user'].includes(session.user.role ?? '')) {
  //    return <div>Acesso negado para sua função.</div>
  // }

  // Simply render the Client Component. It will handle its own data fetching.
  return (
    // Container padding
    <div className="p-2 sm:p-4 md:p-6 lg:p-8">
      <DespesasList />
    </div>
  );
}
// ============================================================
// app/dashboard/admin/tenants/page.tsx (CONFIRMADO - CORRETO)
// ============================================================
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import TenantManagementPage from "@/components/admin/tenants/tenant-management-page"; // Componente cliente principal
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Gerenciar Tenants | Super Admin",
  description: "Painel de administração de tenants para Super Administradores.",
};

export default async function AdminTenantsPage() {
  const session = await getServerSession(authOptions); // Obtém a sessão no servidor

  // Redireciona se não estiver logado
  if (!session) {
    redirect("/login");
  }

  // --- RBAC CHECK: Allow ONLY Super Admin ---
  // Verifica a role e se tenantId é null (ou inexistente)
  if (session.user?.role !== 'superadmin' || session.user?.tenantId) {
    console.warn(`[AdminTenantsPage] Acesso negado para usuário ${session.user?.id} (Role: ${session.user?.role}, Tenant: ${session.user?.tenantId})`);
    return (
      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-sm">
          Esta página está disponível apenas para Super Administradores.
        </p>
      </div>
    );
  }
  // --- END RBAC CHECK ---

  console.log(`[AdminTenantsPage] Acesso concedido para Super Admin: ${session.user?.id}`);
  // Renderiza o componente cliente para Super Admins autorizados
  return <TenantManagementPage />;
}
// ============================================================
// END OF PAGE FILE
// ============================================================
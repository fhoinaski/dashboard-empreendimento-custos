// FILE: components/configuracoes/configuracoes-page.tsx (Modificado)
// ============================================================
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { User, Bell, Building, Settings, Users, Laptop, Server, Lock, ShieldCheck, Globe } from "lucide-react"; // Added Globe
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils"; // Import cn

// Import forms/tables
import ProfileSettingsForm from "./profile-settings-form";
import PasswordSettingsForm from "./password-settings-form";
import NotificationSettingsForm from "./notification-settings-form";
import CompanySettingsForm from "./company-settings-form"; // Admin only (Global?)
import UserSettingsTable from "./user-settings-table";     // Tenant Admin only
import ApiKeysSettingsForm from "./api-keys-settings-form"; // Super Admin only (Global?)
import BackupSettings from "./backup-settings";             // Super Admin only (Global?)
import AppearanceSettings from "./appearance-settings";     // All roles
// --- IMPORTAR NOVO FORM ---
import GoogleIntegrationSettingsForm from "./GoogleIntegrationSettingsForm";

export default function ConfiguracoesPage() {
    const { data: session, status } = useSession();
    const userRole = session?.user?.role;
    const isSuperAdmin = userRole === 'superadmin';
    const isTenantAdmin = userRole === 'admin' && !!session?.user?.tenantId; // Check for tenantId explicitly

    const initialTab = "perfil";
    const [activeTab, setActiveTab] = useState(initialTab);

    // Atualizar abas disponíveis
    const availableTabs = useMemo(() => {
        const allTabs = [
            // Common Tabs
            { value: "perfil", label: "Perfil", icon: User, roles: ['superadmin', 'admin', 'manager', 'user'] },
            { value: "notificacoes", label: "Notificações", icon: Bell, roles: ['superadmin', 'admin', 'manager', 'user'] },
            { value: "sistema", label: "Aparência", icon: Laptop, roles: ['superadmin', 'admin', 'manager', 'user'] },

            // Tenant Admin Tabs
            { value: "usuarios", label: "Usuários", icon: Users, roles: ['admin'] }, // Tenant Admin
             // --- ADICIONAR ABA GOOGLE ---
            { value: "google", label: "Integrações", icon: Globe, roles: ['admin'] }, // Tenant Admin

            // Super Admin Tabs (Global Settings)
            { value: "empresa", label: "Empresa (Global)", icon: Building, roles: ['superadmin'] },
            { value: "apiKeys", label: "Chaves API (Global)", icon: ShieldCheck, roles: ['superadmin'] },
            { value: "backup", label: "Backup (Global)", icon: Server, roles: ['superadmin'] },
            // { value: "tenants", label: "Gerenciar Tenants", icon: Building2, roles: ['superadmin'] }, // Futuro
        ];

        // Filtrar baseado na role E na presença de tenantId para admin
        return allTabs.filter(tab => {
            if (!userRole) return false; // Não autenticado
            if (tab.roles.includes('superadmin') && isSuperAdmin) return true;
            if (tab.roles.includes('admin') && isTenantAdmin) return true; // Apenas admin COM tenantId
            if (tab.roles.includes('manager') && userRole === 'manager') return true;
            if (tab.roles.includes('user') && userRole === 'user') return true;
            return false;
        });

    }, [userRole, isSuperAdmin, isTenantAdmin]); // Depender dos estados derivados

    useEffect(() => {
        if (status === 'authenticated' && !availableTabs.some(tab => tab.value === activeTab)) {
            setActiveTab(availableTabs[0]?.value || 'perfil');
        }
    }, [status, availableTabs, activeTab]);


    if (status === 'loading') { return <Skeleton className="h-screen w-full" />; }
    if (status === 'unauthenticated') { return <div className="p-6 text-center text-red-600">Acesso não autorizado. Faça login.</div>; }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Configurações</h2>
                <p className="text-muted-foreground text-sm">Gerencie suas preferências e configurações.</p>
            </div>

            <Tabs defaultValue={initialTab} value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                 <TabsList className={cn( "flex flex-wrap h-auto justify-center", "rounded-md bg-muted p-1 text-muted-foreground", "max-w-[1000px] mx-auto gap-1" )}>
                     {availableTabs.map(tab => (
                         <TabsTrigger key={tab.value} value={tab.value} className={cn( "inline-flex items-center justify-center whitespace-nowrap rounded-sm", "px-2 py-1 sm:px-3 sm:py-1.5 h-9", "text-xs sm:text-sm font-medium", "ring-offset-background transition-all", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", "disabled:pointer-events-none disabled:opacity-50", "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm" )}>
                             <tab.icon className="h-4 w-4 flex-shrink-0 mr-1 sm:mr-1.5" />
                             <span className="truncate">{tab.label}</span>
                         </TabsTrigger>
                     ))}
                 </TabsList>

                 {/* Common Tabs */}
                <TabsContent value="perfil" className="mt-4 space-y-6"> <ProfileSettingsForm /> <PasswordSettingsForm /> </TabsContent>
                <TabsContent value="notificacoes" className="mt-4"> <NotificationSettingsForm /> </TabsContent>
                <TabsContent value="sistema" className="mt-4"> <AppearanceSettings /> </TabsContent>

                {/* Tenant Admin Tabs */}
                {isTenantAdmin && (
                    <>
                        <TabsContent value="usuarios" className="mt-4"> <UserSettingsTable /> </TabsContent>
                         {/* --- RENDERIZAR NOVO FORM --- */}
                        <TabsContent value="google" className="mt-4"> <GoogleIntegrationSettingsForm /> </TabsContent>
                    </>
                )}

                {/* Super Admin Tabs */}
                {isSuperAdmin && (
                    <>
                        <TabsContent value="empresa" className="mt-4"> <CompanySettingsForm /> </TabsContent>
                        <TabsContent value="apiKeys" className="mt-4"> <ApiKeysSettingsForm /> </TabsContent>
                        <TabsContent value="backup" className="mt-4"> <BackupSettings /> </TabsContent>
                        {/* <TabsContent value="tenants"> <TenantManagement /> </TabsContent> */}
                    </>
                )}

            </Tabs>
        </motion.div>
    );
}
// ============================================================
// FIM DO ARQUIVO MODIFICADO: components/configuracoes/configuracoes-page.tsx
// ============================================================
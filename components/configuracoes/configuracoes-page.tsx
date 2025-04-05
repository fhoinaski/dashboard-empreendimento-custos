"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { User, Bell, Building, Settings, Users, Laptop, Server, Lock, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Import forms/tables
import ProfileSettingsForm from "./profile-settings-form";
import PasswordSettingsForm from "./password-settings-form";
import NotificationSettingsForm from "./notification-settings-form";
import CompanySettingsForm from "./company-settings-form"; // Admin only
import UserSettingsTable from "./user-settings-table"; // Admin only
import ApiKeysSettingsForm from "./api-keys-settings-form"; // Admin only
import BackupSettings from "./backup-settings"; // Admin only
import AppearanceSettings from "./appearance-settings"; // All roles

export default function ConfiguracoesPage() {
    const { data: session, status } = useSession();
    const userRole = session?.user?.role;

    // Determine initial active tab
    const initialTab = "perfil"; // Start on profile for everyone
    const [activeTab, setActiveTab] = useState(initialTab);

    // Memoize available tabs based on role
    const availableTabs = useMemo(() => {
        const tabs = [
            { value: "perfil", label: "Perfil", icon: User, roles: ['admin', 'manager', 'user'] },
            { value: "notificacoes", label: "Notificações", icon: Bell, roles: ['admin', 'manager', 'user'] },
            { value: "sistema", label: "Aparência", icon: Laptop, roles: ['admin', 'manager', 'user'] },
            // Admin only tabs
            { value: "empresa", label: "Empresa", icon: Building, roles: ['admin'] },
            { value: "usuarios", label: "Usuários", icon: Users, roles: ['admin'] },
            { value: "apiKeys", label: "Integrações", icon: ShieldCheck, roles: ['admin'] },
            { value: "backup", label: "Backup", icon: Server, roles: ['admin'] },
        ];
        return tabs.filter(tab => userRole && tab.roles.includes(userRole));
    }, [userRole]);

    // Adjust activeTab if the initial one isn't available (shouldn't happen with 'perfil' default)
    useEffect(() => {
        if (status === 'authenticated' && !availableTabs.some(tab => tab.value === activeTab)) {
            setActiveTab(availableTabs[0]?.value || 'perfil');
        }
    }, [status, availableTabs, activeTab]);

    // --- Loading / Unauthenticated State ---
    if (status === 'loading') {
        return (
             <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8">
                 <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
                 <Skeleton className="h-10 w-full max-w-xl" /> {/* Tabs List */}
                 <Skeleton className="h-64 w-full rounded-lg" /> {/* Tab Content Area */}
            </div>
        );
    }
    if (status === 'unauthenticated') {
        return <div className="p-6 text-center text-red-600">Acesso não autorizado. Faça login.</div>;
    }
    // --- End Loading ---

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Configurações</h2>
                <p className="text-muted-foreground text-sm">Gerencie suas preferências e configurações.</p>
            </div>

            <Tabs defaultValue={initialTab} value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                 {/* Render TabsList dynamically */}
                 <TabsList className={`grid w-full h-auto grid-cols-3 sm:grid-cols-${availableTabs.length > 3 ? Math.ceil(availableTabs.length / 2) : availableTabs.length} lg:grid-cols-${availableTabs.length}`}>
                     {availableTabs.map(tab => (
                         <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-10 text-xs sm:text-sm">
                             <tab.icon className="mr-1.5 h-4 w-4 flex-shrink-0" />
                             <span className="hidden sm:inline">{tab.label}</span>
                             <span className="sm:hidden">{tab.label.substring(0, 4)}..</span> {/* Shorten label for mobile */}
                         </TabsTrigger>
                     ))}
                 </TabsList>

                 {/* Common Tabs */}
                <TabsContent value="perfil" className="mt-0 space-y-6">
                    <ProfileSettingsForm />
                    <PasswordSettingsForm />
                </TabsContent>
                <TabsContent value="notificacoes" className="mt-0">
                    <NotificationSettingsForm />
                </TabsContent>
                <TabsContent value="sistema" className="mt-0">
                    <AppearanceSettings />
                </TabsContent>

                {/* Admin-specific Tabs */}
                {userRole === 'admin' && (
                    <>
                        <TabsContent value="empresa" className="mt-0"> <CompanySettingsForm /> </TabsContent>
                        <TabsContent value="usuarios" className="mt-0"> <UserSettingsTable /> </TabsContent>
                         <TabsContent value="apiKeys" className="mt-0"> <ApiKeysSettingsForm /> </TabsContent>
                        <TabsContent value="backup" className="mt-0"> <BackupSettings /> </TabsContent>
                    </>
                )}

            </Tabs>
        </motion.div>
    );
}
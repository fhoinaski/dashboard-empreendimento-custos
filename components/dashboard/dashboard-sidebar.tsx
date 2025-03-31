// components/dashboard/dashboard-sidebar.tsx
"use client";

import { useState, useEffect } from "react"; // useEffect não é mais necessário aqui
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building, Receipt, BarChart3, Calendar, Settings, HelpCircle, FileText, ChevronLeft, ChevronRight, X // Importar X para o botão de fechar mobile
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  // Renomeado para maior clareza, mas funcionalmente igual
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

// Define menu items outside the component
const menuItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Empreendimentos", href: "/dashboard/empreendimentos", icon: Building },
    { title: "Despesas", href: "/dashboard/despesas", icon: Receipt },
    { title: "Documentos", href: "/dashboard/documentos", icon: FileText },
    { title: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3 },
    { title: "Calendário", href: "/dashboard/calendario", icon: Calendar },
    { title: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
    { title: "Ajuda", href: "/dashboard/ajuda", icon: HelpCircle },
];

// --- COMPONENTE SIDEBAR ---
export default function DashboardSidebar({ mobileOpen, setMobileOpen }: DashboardSidebarProps) {
  // Estado apenas para o colapso do desktop
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Variantes de animação para o desktop
  const desktopSidebarVariants = {
    expanded: { width: "16rem" },
    collapsed: { width: "4rem" },
  };
  const desktopTransition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] }; // Ease mais suave

  // Variantes de animação para o mobile (slide)
  const mobileSidebarVariants = {
    hidden: { x: "-100%" },
    visible: { x: 0 },
  };
  const mobileTransition = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

  return (
    <TooltipProvider delayDuration={100}> {/* Pequeno delay para tooltips */}
      {/* --- Sidebar Desktop --- */}
      <motion.aside
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={desktopSidebarVariants}
        transition={desktopTransition}
        className="hidden lg:flex flex-col border-r bg-background h-screen sticky top-0" // h-screen e sticky
      >
        {/* Header Desktop */}
        <div className={cn("h-16 border-b flex items-center shrink-0", isCollapsed ? "justify-center" : "px-4")}>
          <AnimatePresence initial={false} mode="wait"> {/* Mode wait para transição mais suave */}
            {!isCollapsed ? (
              <motion.div key="logo-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
                    <Building className="h-6 w-6 text-primary" />
                    <span>Gestão</span>
                </Link>
              </motion.div>
            ) : (
              <motion.div key="logo-icon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.1 }}>
                <Building className="h-6 w-6 text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navegação Desktop */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors h-9", // Altura fixa
                          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          isCollapsed && "justify-center"
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {/* Animação do texto */}
                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.span
                              key={`text-${item.href}`}
                              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                              animate={{ opacity: 1, width: "auto", marginLeft: '0.75rem', transition: { duration: 0.2, delay: 0.1 } }}
                              exit={{ opacity: 0, width: 0, marginLeft: 0, transition: { duration: 0.1 } }}
                              className="whitespace-nowrap overflow-hidden" // Evita quebra durante animação
                            >
                              {item.title}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (
                        <TooltipContent side="right" align="center">
                            <p>{item.title}</p>
                        </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Botão Colapsar Desktop */}
        <div className="p-2 border-t mt-auto shrink-0"> {/* mt-auto para empurrar para baixo */}
            <Tooltip>
                <TooltipTrigger asChild>
                     <Button
                        variant="ghost" size="icon" className="w-full h-9"
                        onClick={toggleCollapse}
                        aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
                    >
                        {/* Ícone animado */}
                        <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={desktopTransition}>
                            <ChevronLeft className="h-5 w-5" />
                        </motion.div>
                    </Button>
                </TooltipTrigger>
                 <TooltipContent side="right" align="center">
                    <p>{isCollapsed ? "Expandir" : "Recolher"}</p>
                </TooltipContent>
            </Tooltip>
        </div>
      </motion.aside>

      {/* --- Sidebar Mobile (Overlay e Slide) --- */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
               key="mobile-overlay"
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               transition={{ duration: 0.2 }}
               className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" // Adicionado backdrop-blur
               onClick={() => setMobileOpen(false)} // Fecha ao clicar no overlay
             />
             {/* Sidebar Deslizante */}
            <motion.aside
                key="mobile-sidebar"
                variants={mobileSidebarVariants}
                initial="hidden" animate="visible" exit="hidden"
                transition={mobileTransition}
                className="fixed inset-y-0 left-0 top-0 w-64 bg-background border-r z-50 flex flex-col lg:hidden shadow-xl" // Sombra
            >
                {/* Header Mobile */}
                <div className="h-16 border-b flex items-center justify-between px-4 shrink-0">
                     <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg" onClick={() => setMobileOpen(false)}>
                        <Building className="h-6 w-6 text-primary" />
                        <span>Gestão</span>
                    </Link>
                     {/* Botão Fechar Interno */}
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}>
                        <X className="h-5 w-5" />
                        <span className="sr-only">Fechar menu</span>
                     </Button>
                </div>
                {/* Navegação Mobile */}
                <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        return (
                            <li key={`mobile-${item.href}`}>
                                <Link
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors h-10", // Altura fixa
                                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                onClick={() => setMobileOpen(false)} // Fecha ao clicar no link
                                >
                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                <span>{item.title}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
                </nav>
                {/* Footer Mobile (Opcional) */}
                {/* <div className="p-4 border-t mt-auto shrink-0"> <Button variant="outline" className="w-full">Sair</Button> </div> */}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
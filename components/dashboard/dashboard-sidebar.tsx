"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { Building, ChevronLeft, X, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { getVisibleMenuItems, menuItems, MenuItem, isLinkActive } from "@/lib/navigation";

interface DashboardSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function DashboardSidebar({
  
  mobileOpen,
  setMobileOpen,
}: DashboardSidebarProps) {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Filter menu items based on user role AFTER session is loaded
  const visibleMenuItems: MenuItem[] = status === "authenticated"
    ? getVisibleMenuItems(menuItems, userRole)
    : []; // Return empty array if no session or role

  // Animation variants
  const desktopSidebarVariants = {
    expanded: { width: "16rem" },
    collapsed: { width: "4rem" },
  };
  const desktopTransition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] };
  const mobileSidebarVariants = {
    hidden: { x: "-100%" },
    visible: { x: 0 },
  };
  const mobileTransition = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

  // Loading Skeleton
  if (status === "loading") {
    return (
      <aside className="hidden lg:flex flex-col border-r bg-background h-screen sticky top-0 w-16 animate-pulse">
        <div className="h-16 border-b flex items-center justify-center p-2">
          <Building className="h-6 w-6 text-muted" />
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-9 rounded-md" />)}
        </nav>
        <div className="p-2 border-t mt-auto shrink-0"><Skeleton className="h-9 w-9 rounded-md" /></div>
      </aside>
    );
  }

   // Unauthenticated state (optional, middleware should handle redirect)
   if (status === 'unauthenticated') {
       return null; // Or a minimal sidebar if preferred
   }

  return (
    <TooltipProvider delayDuration={100}>
      {/* Sidebar Desktop */}
      <motion.aside
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={desktopSidebarVariants}
        transition={desktopTransition}
        className="hidden lg:flex flex-col border-r bg-background h-screen sticky top-0"
      >
        {/* Header */}
        <div
          className={cn(
            "h-16 border-b flex items-center shrink-0",
            isCollapsed ? "justify-center" : "px-4"
          )}
        >
          <AnimatePresence initial={false} mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
                  <Building className="h-6 w-6 text-primary" />
                  <span>Gestão</span>
                </Link>
              </motion.div>
            ) : (
              <motion.div key="logo-icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <Building className="h-6 w-6 text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          <ul className="space-y-1 px-2">
            {visibleMenuItems.map((item) => {
              const isActive = isLinkActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={item.href} passHref legacyBehavior>
                        <a
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors h-9",
                            isActive
                              ? "bg-muted text-primary"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            isCollapsed && "justify-center"
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.2, delay: 0.1 }}
                                className="whitespace-nowrap overflow-hidden"
                              >
                                {item.title}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </a>
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (<TooltipContent side="right" align="center"><p>{item.title}</p></TooltipContent>)}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Toggle */}
        <div className="p-2 border-t mt-auto shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-9"
                onClick={toggleCollapse}
                aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              >
                <motion.div
                  animate={{ rotate: isCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
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

      {/* Sidebar Mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="mobile-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={mobileTransition} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside key="mobile-sidebar" initial="hidden" animate="visible" exit="hidden" variants={mobileSidebarVariants} transition={mobileTransition} className="fixed inset-y-0 left-0 z-50 flex h-full w-3/4 flex-col border-r bg-background lg:hidden">
                {/* Mobile Header */}
                <div className="h-16 border-b flex items-center justify-between px-4 shrink-0">
                     <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg"><Building className="h-6 w-6 text-primary" /><span>Gestão</span></Link>
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /><span className="sr-only">Fechar menu</span></Button>
                </div>
                {/* Mobile Navigation */}
                <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2">
                    {visibleMenuItems.map((item) => {
                        const isActive = isLinkActive(pathname, item.href);
                        return (
                            <li key={`mobile-${item.href}`}>
                                <Link href={item.href} passHref legacyBehavior>
                                <a className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors h-10",
                                    isActive ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )} onClick={() => setMobileOpen(false)}>
                                    <item.icon className="h-5 w-5 flex-shrink-0" /><span>{item.title}</span>
                                </a>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
                </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}

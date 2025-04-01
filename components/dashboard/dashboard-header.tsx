// components/dashboard/dashboard-header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Menu, X, Search, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserNav } from "@/components/dashboard/user-nav";
import { NotificationsPopover } from "@/components/dashboard/notifications-popover";


// Interface para as props
interface DashboardHeaderProps {
  // Recebe o estado atual e a função para alterá-lo do layout pai
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function DashboardHeader({ isMobileMenuOpen, setMobileMenuOpen }: DashboardHeaderProps) {
  // Estado local apenas para a busca mobile, se necessário
  const [searchOpen, setSearchOpen] = useState(false);

  // Obter dados do contexto de notificação (se necessário aqui, senão pode remover)
  // const { unreadCount, isLoading: isLoadingNotifications } = useNotifications();

  // Função simplificada para o toggle da busca mobile
  const toggleSearch = () => setSearchOpen(prev => !prev);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:px-8 shadow-sm">
      {/* Botão Menu Mobile e Logo */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* Botão que controla o estado no layout pai */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} // Chama diretamente a função do pai
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"} // Melhora acessibilidade
        >
          {/* Renderiza o ícone correto baseado no estado vindo do pai */}
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          {/* Não há mais estado de loading aqui */}
        </Button>

        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline-block text-lg">Scotta Gestão </span>
        </Link>
      </div>

      {/* Busca e Ícones da Direita */}
      <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4">
        {/* Busca Desktop */}
        <div className="hidden sm:flex relative w-full max-w-xs md:max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar empreendimentos..."
            className="pl-8 w-full h-9 text-sm"
          />
        </div>

        {/* Ícones */}
        <div className="flex items-center gap-1 sm:gap-2">
           {/* Botão de Busca Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={toggleSearch} // Usa a função local simplificada
          >
            <Search size={20} />
            <span className="sr-only">Buscar</span>
          </Button>

           {/* Popover de Notificação (já inclui o botão e badge) */}
           <NotificationsPopover />

          {/* Navegação do Usuário */}
          <UserNav />
        </div>
      </div>

      {/* Animação para a Barra de Busca Mobile */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-16 left-0 right-0 p-4 bg-background border-b sm:hidden z-30 shadow-md"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Buscar..." className="pl-8 w-full h-10" autoFocus />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* NÃO HÁ MAIS O LOADING ARTIFICIAL AQUI */}
    </header>
  );
}
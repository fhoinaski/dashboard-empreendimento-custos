import {
  LayoutDashboard,
  Building,
  Receipt,
  BarChart3,
  Calendar,
  Settings,
  HelpCircle,
  FileText, 
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

export const menuItems: MenuItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3, roles: ["admin"] },
  { title: "Documentos", href: "/dashboard/documentos", icon: FileText, roles: ["admin"] },
  { title: "Empreendimentos", href: "/dashboard/empreendimentos", icon: Building, roles: ["admin", "manager"] },
  { title: "Despesas", href: "/dashboard/despesas", icon: Receipt, roles: ["admin", "manager", "user"] },
  { title: "Calendário", href: "/dashboard/calendario", icon: Calendar, roles: ["admin", "manager", "user"] },
  { title: "Configurações", href: "/dashboard/configuracoes", icon: Settings, roles: ["admin", "manager", "user"] },
  { title: "Ajuda", href: "/dashboard/ajuda", icon: HelpCircle, roles: ["admin", "manager", "user"] },
];

export function getVisibleMenuItems(items: MenuItem[], userRole: string | undefined): MenuItem[] {
    if (!userRole) return [];
    return items.filter(item => item.roles.includes(userRole));
}

export function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}


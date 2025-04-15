import { User, Bell, Users, Lock } from "lucide-react";

export interface Tab {
  name: string;
  description: string;
  icon: React.ComponentType;
}

export const tabs: Tab[] = [
  { name: 'Perfil', description: 'Informações pessoais do usuário.', icon: User },
  { name: 'Notificações', description: 'Configurações de notificações.', icon: Bell },
  { name: 'Usuários', description: 'Gerenciamento de usuários.', icon: Users },
  { name: 'Segurança', description: 'Configurações de segurança.', icon: Lock },
];
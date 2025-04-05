"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

export function UserNav() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  

  const handleLogout = async () => {
    try {
     
      await signOut({ redirect: false });
     
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
      router.push("/login");
    } catch (error) {
      console.error("[UserNav] Erro ao fazer logout:", error);
      toast({
        variant: "destructive",
        title: "Erro no logout",
        description: "Não foi possível desconectar. Tente novamente.",
      });
    }
  };

  // Enquanto a sessão carrega, exibir um placeholder
  if (status === "loading") {
    return (
      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
        <Avatar className="h-8 w-8">
          <AvatarFallback>Carregando...</AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  // Se não houver sessão, exibir um avatar genérico (para depuração)
  if (!session?.user) {
    console.warn("[UserNav] Nenhuma sessão encontrada, exibindo fallback");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder-user.jpg" alt="Avatar" />
              <AvatarFallback>??</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel>Sem usuário</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push("/login")}>
            Fazer login
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const userName = session.user.name || "Usuário";
  const userEmail = session.user.email || "email@desconhecido.com";
  const userAvatarUrl = session.user.avatarUrl || "/placeholder-user.jpg";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
          <AvatarImage src={session.user.image ?? ""} alt={session.user.name || "Avatar"} />
          <AvatarFallback>{session.user.name?.[0]}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Perfil</DropdownMenuItem>
          <DropdownMenuItem>Configurações</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { User, Bell, Building, Settings, Upload, Save, Users, Plus, Trash2, Sun, Moon, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

// Sample users data
const users = [
  {
    id: 1,
    name: "Administrador",
    email: "admin@example.com",
    role: "Administrador",
    lastLogin: "Hoje, 10:30",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: 2,
    name: "Carlos Silva",
    email: "carlos.silva@example.com",
    role: "Gerente",
    lastLogin: "Ontem, 15:45",
    avatar: "/placeholder.svg",
  },
  {
    id: 3,
    name: "Ana Oliveira",
    email: "ana.oliveira@example.com",
    role: "Gerente",
    lastLogin: "Hoje, 09:15",
    avatar: "/placeholder.svg",
  },
  {
    id: 4,
    name: "Roberto Mendes",
    email: "roberto.mendes@example.com",
    role: "Usuário",
    lastLogin: "3 dias atrás",
    avatar: "/placeholder.svg",
  },
  {
    id: 5,
    name: "Juliana Costa",
    email: "juliana.costa@example.com",
    role: "Usuário",
    lastLogin: "Hoje, 11:20",
    avatar: "/placeholder.svg",
  },
]

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState("perfil")
  const [theme, setTheme] = useState("system")
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false)
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)
  const { toast } = useToast()

  const handleSaveProfile = () => {
    toast({
      title: "Perfil atualizado",
      description: "Suas informações de perfil foram atualizadas com sucesso",
    })
  }

  const handleSaveNotifications = () => {
    toast({
      title: "Preferências de notificação atualizadas",
      description: "Suas preferências de notificação foram atualizadas com sucesso",
    })
  }

  const handleSaveCompany = () => {
    toast({
      title: "Informações da empresa atualizadas",
      description: "As informações da empresa foram atualizadas com sucesso",
    })
  }

  const handleSaveSystem = () => {
    toast({
      title: "Configurações do sistema atualizadas",
      description: "As configurações do sistema foram atualizadas com sucesso",
    })
  }

  const handleAddUser = () => {
    toast({
      title: "Usuário adicionado",
      description: "O novo usuário foi adicionado com sucesso",
    })
    setNewUserDialogOpen(false)
  }

  const handleDeleteUser = () => {
    toast({
      title: "Usuário excluído",
      description: "O usuário foi excluído com sucesso",
    })
    setDeleteUserDialogOpen(false)
    setUserToDelete(null)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }



  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie suas preferências e configurações do sistema</p>
      </div>

      <Tabs defaultValue="perfil" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger
            value="perfil"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <User className="mr-2 h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger
            value="notificacoes"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Bell className="mr-2 h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger
            value="empresa"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Building className="mr-2 h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Users className="mr-2 h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="sistema"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Settings className="mr-2 h-4 w-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Perfil</CardTitle>
              <CardDescription>Atualize suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-2">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src="/placeholder-user.jpg" alt="Avatar" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Alterar foto
                  </Button>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" defaultValue="Administrador" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue="admin@example.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" defaultValue="(11) 98765-4321" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo</Label>
                      <Input id="role" defaultValue="Administrador" />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Alterar Senha</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha Atual</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSaveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>Configure como você deseja receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Notificações por Email</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-despesas">Despesas a vencer</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba emails sobre despesas próximas do vencimento
                      </p>
                    </div>
                    <Switch id="email-despesas" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-documentos">Novos documentos</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba emails quando novos documentos forem adicionados
                      </p>
                    </div>
                    <Switch id="email-documentos" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-relatorios">Relatórios semanais</Label>
                      <p className="text-sm text-muted-foreground">Receba relatórios semanais por email</p>
                    </div>
                    <Switch id="email-relatorios" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Notificações no Sistema</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="system-despesas">Despesas a vencer</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações no sistema sobre despesas próximas do vencimento
                      </p>
                    </div>
                    <Switch id="system-despesas" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="system-documentos">Novos documentos</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações no sistema quando novos documentos forem adicionados
                      </p>
                    </div>
                    <Switch id="system-documentos" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="system-eventos">Eventos do calendário</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações no sistema sobre eventos do calendário
                      </p>
                    </div>
                    <Switch id="system-eventos" defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configurações Avançadas</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="antecedencia">Antecedência para notificações de vencimento</Label>
                      <p className="text-sm text-muted-foreground">
                        Quantos dias antes do vencimento você deseja ser notificado
                      </p>
                    </div>
                    <Select defaultValue="3">
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 dia</SelectItem>
                        <SelectItem value="3">3 dias</SelectItem>
                        <SelectItem value="5">5 dias</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSaveNotifications}>
                <Save className="mr-2 h-4 w-4" />
                Salvar Preferências
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>Configure as informações da sua empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-2">
                  <div className="h-24 w-24 rounded-md border flex items-center justify-center bg-muted">
                    <Building className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Alterar logo
                  </Button>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nome da Empresa</Label>
                      <Input id="company-name" defaultValue="Scotta Empreendimentos Gestão ." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-cnpj">CNPJ</Label>
                      <Input id="company-cnpj" defaultValue="12.345.678/0001-90" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company-address">Endereço</Label>
                    <Input id="company-address" defaultValue="Av. Paulista, 1000, São Paulo - SP" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Telefone</Label>
                      <Input id="company-phone" defaultValue="(11) 3456-7890" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email</Label>
                      <Input id="company-email" type="email" defaultValue="contato@gestaoimobiliaria.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-website">Website</Label>
                      <Input id="company-website" defaultValue="www.gestaoimobiliaria.com" />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configurações Fiscais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax-regime">Regime Tributário</Label>
                    <Select defaultValue="simples">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples">Simples Nacional</SelectItem>
                        <SelectItem value="lucro-presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro-real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscal-code">Inscrição Estadual</Label>
                    <Input id="fiscal-code" defaultValue="123.456.789" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSaveCompany}>
                <Save className="mr-2 h-4 w-4" />
                Salvar Informações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                <CardDescription>Gerencie os usuários do sistema</CardDescription>
              </div>
              <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Preencha as informações para adicionar um novo usuário ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-user-name">Nome</Label>
                      <Input id="new-user-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-email">Email</Label>
                      <Input id="new-user-email" type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-role">Função</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma função" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="user">Usuário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewUserDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddUser}>Adicionar Usuário</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.lastLogin}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm">
                            Editar
                          </Button>
                          <Dialog
                            open={deleteUserDialogOpen && userToDelete === user.id}
                            onOpenChange={(open) => {
                              setDeleteUserDialogOpen(open)
                              if (!open) setUserToDelete(null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setUserToDelete(user.id)}
                                disabled={user.id === 1} // Prevent deleting the admin
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Excluir Usuário</DialogTitle>
                                <DialogDescription>
                                  Tem certeza que deseja excluir o usuário {user.name}? Esta ação não pode ser desfeita.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>
                                  Cancelar
                                </Button>
                                <Button variant="destructive" onClick={handleDeleteUser}>
                                  Excluir
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>Configure as preferências gerais do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Aparência</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Tema</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className={cn(
                          "flex items-center justify-center rounded-md border-2 p-2 cursor-pointer",
                          theme === "light" ? "border-primary bg-primary/10" : "border-muted",
                        )}
                        onClick={() => setTheme("light")}
                      >
                        <Sun className="h-5 w-5 mr-2" />
                        <span>Claro</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-center rounded-md border-2 p-2 cursor-pointer",
                          theme === "dark" ? "border-primary bg-primary/10" : "border-muted",
                        )}
                        onClick={() => setTheme("dark")}
                      >
                        <Moon className="h-5 w-5 mr-2" />
                        <span>Escuro</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-center rounded-md border-2 p-2 cursor-pointer",
                          theme === "system" ? "border-primary bg-primary/10" : "border-muted",
                        )}
                        onClick={() => setTheme("system")}
                      >
                        <Laptop className="h-5 w-5 mr-2" />
                        <span>Sistema</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Idioma e Região</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="language">Idioma</Label>
                    <Select defaultValue="pt-BR">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Moeda</Label>
                    <Select defaultValue="BRL">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (R$)</SelectItem>
                        <SelectItem value="USD">US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-format">Formato de Data</Label>
                    <Select defaultValue="dd/MM/yyyy">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                        <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Backup e Dados</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-backup">Backup Automático</Label>
                      <p className="text-sm text-muted-foreground">Realizar backup automático dos dados do sistema</p>
                    </div>
                    <Switch id="auto-backup" defaultChecked />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency">Frequência de Backup</Label>
                    <Select defaultValue="daily">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline">Fazer Backup Manual</Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSaveSystem}>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}


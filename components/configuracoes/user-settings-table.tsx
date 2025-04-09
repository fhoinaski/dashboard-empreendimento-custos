// components/configuracoes/user-settings-table.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, KeyRound, Save, Eye, EyeOff, Edit, Search } from 'lucide-react'; // Adicionado Search
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MultiSelect } from '../ui/multi-select'; // Mantido MultiSelect
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos'; // Hook para buscar empreendimentos
import { useDebounce } from '@/utils/debounce'; // Hook debounce
import { trpc } from '@/lib/trpc/client'; // Cliente tRPC
import { PaginationControls } from '@/components/ui/pagination/pagination-controls'; // Controle de Paginação
// Importar tipos do backend
import type { UserResponse, CreateUserInput, UpdateUserInput, AdminUpdatePasswordInput } from '@/server/api/schemas/auth'; // Tipos de usuário e inputs

// --- Schemas Zod dos Formulários (Mantidos) ---
const newUserSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha: mínimo 6 caracteres"),
    role: z.enum(['admin', 'manager', 'user'], { required_error: "Função é obrigatória" }),
    assignedEmpreendimentos: z.array(z.string()).optional(), // Mantém array de strings (IDs)
});
type NewUserFormData = z.infer<typeof newUserSchema>;

const editUserSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    role: z.enum(['admin', 'manager', 'user'], { required_error: "Função é obrigatória" }),
    assignedEmpreendimentos: z.array(z.string()).optional(),
});
type EditUserFormData = z.infer<typeof editUserSchema>;

const adminPasswordChangeSchema = z.object({
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem", path: ["confirmPassword"],
});
type AdminPasswordChangeFormData = z.infer<typeof adminPasswordChangeSchema>;

// Interface para opções do MultiSelect
interface EmpreendimentoOption { value: string; label: string; }
// Usar UserResponse como tipo principal para dados de usuário vindo do tRPC
type UserData = UserResponse;

export default function UserSettingsTable() {
    const { data: session } = useSession();
    const { toast } = useToast();

    // --- Estados Locais ---
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(10); // Limite fixo por página
    const [searchTerm, setSearchTerm] = useState('');
    const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
    const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
    const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [userToModify, setUserToModify] = useState<UserData | null>(null);
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    // Remover estado local `users` e `userPagination`, usar dados do tRPC query
    // Remover estado local `isLoading`, usar o do tRPC query

    const debouncedSearchTerm = useDebounce(searchTerm, 500); // Debounce para busca

    // --- Hooks de Formulário ---
    const newUserForm = useForm<NewUserFormData>({ resolver: zodResolver(newUserSchema), defaultValues: { name: '', email: '', password: '', role: undefined, assignedEmpreendimentos: [] }, });
    const editUserForm = useForm<EditUserFormData>({ resolver: zodResolver(editUserSchema), defaultValues: { name: '', role: undefined, assignedEmpreendimentos: [] }, });
    const passwordChangeForm = useForm<AdminPasswordChangeFormData>({ resolver: zodResolver(adminPasswordChangeSchema), defaultValues: { newPassword: '', confirmPassword: '' }, });

    // --- tRPC Queries ---
    // Busca de Usuários Paginada com tRPC
    const usersQuery = trpc.users.getAll.useQuery(
        { page: currentPage, limit, searchTerm: debouncedSearchTerm || undefined },
        {
            staleTime: 5 * 60 * 1000, // 5 minutos stale time
            placeholderData: (previousData) => previousData, // Mantém dados anteriores enquanto carrega novos
            // onError já é tratado pelo hook useSettings (se ele existir e for usado)
            // ou pode ser tratado aqui se necessário
        }
    );
    // Hook para buscar empreendimentos para o MultiSelect
    const { empreendimentos: backendEmpreendimentos, isLoading: isFetchingEmpreendimentos } = useEmpreendimentos();

    // Mapeia empreendimentos para o formato do MultiSelect
    const empreendimentoOptions = useMemo((): EmpreendimentoOption[] => {
        // Garante que backendEmpreendimentos é um array antes de mapear
        return (backendEmpreendimentos || []).map(emp => ({ value: emp._id, label: emp.name }));
    }, [backendEmpreendimentos]);


    // --- tRPC Mutations ---
    // Usar as mutations diretamente do tRPC client
    const utils = trpc.useContext(); // Contexto para invalidação
    const createUserMutation = trpc.auth.register.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setNewUserDialogOpen(false); newUserForm.reset(); utils.users.getAll.invalidate(); }, // Invalida a query de usuários
        onError: (error) => { toast({ variant: "destructive", title: "Erro ao Criar", description: error.message }); }
    });
    const editUserMutation = trpc.users.update.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setEditUserDialogOpen(false); setUserToModify(null); utils.users.getAll.invalidate(); utils.users.getById.invalidate({ id: data.user._id }); }, // Invalida getAll e getById específico
        onError: (error) => { toast({ variant: "destructive", title: "Erro ao Editar", description: error.message }); }
    });
    const deleteUserMutation = trpc.users.delete.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setDeleteUserDialogOpen(false); setUserToModify(null); utils.users.getAll.invalidate(); },
        onError: (error) => { toast({ variant: "destructive", title: "Erro ao Excluir", description: error.message }); }
    });
    const changePasswordMutation = trpc.users.updatePassword.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setPasswordChangeDialogOpen(false); passwordChangeForm.reset(); setUserToModify(null); },
        onError: (error) => { toast({ variant: "destructive", title: "Erro ao Alterar Senha", description: error.message }); }
    });

    // Estados de Loading das Mutations
    const isCreatingUser = createUserMutation.isPending;
    const isEditingUser = editUserMutation.isPending;
    const isDeletingUser = deleteUserMutation.isPending;
    const isChangingPassword = changePasswordMutation.isPending;
    // Estado geral de submitting para desabilitar botões de ação na tabela
    const isActionSubmitting = isEditingUser || isDeletingUser || isChangingPassword;


    // --- Handlers (agora chamam as mutations tRPC) ---
    const handleNewUserSubmit = useCallback(async (values: NewUserFormData) => {
        // Preparar input conforme esperado pela mutation trpc.auth.register (CreateUserInput)
        const inputData: CreateUserInput = {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role,
            // Garante que assignedEmpreendimentos seja undefined se não for role 'user'
            assignedEmpreendimentos: values.role === 'user' ? values.assignedEmpreendimentos : undefined,
        };
        await createUserMutation.mutateAsync(inputData);
    }, [createUserMutation, newUserForm]); // Adicionado newUserForm à dependência

    const handleEditUserSubmit = useCallback(async (values: EditUserFormData) => {
        if (!userToModify?._id) return;
        // Preparar input conforme esperado pela mutation trpc.users.update ({ id: string, data: UpdateUserInput })
        const inputData: UpdateUserInput = {
            name: values.name,
            role: values.role,
             // Garante que assignedEmpreendimentos seja undefined se não for role 'user'
             assignedEmpreendimentos: values.role === 'user' ? values.assignedEmpreendimentos : [], // Envia array vazio para limpar se role != user
        };
        await editUserMutation.mutateAsync({ id: userToModify._id, data: inputData });
    }, [editUserMutation, userToModify]);

    const handleDeleteUser = useCallback(async () => {
        if (!userToModify?._id) return;
        await deleteUserMutation.mutateAsync({ id: userToModify._id });
    }, [deleteUserMutation, userToModify]);

    const handleAdminPasswordChangeSubmit = useCallback(async (values: AdminPasswordChangeFormData) => {
        if (!userToModify?._id) return;
         // Preparar input conforme esperado pela mutation trpc.users.updatePassword ({ id: string, data: AdminUpdatePasswordInput })
         const inputData: AdminUpdatePasswordInput = {
             password: values.newPassword,
             // confirmPassword não é enviado
         };
        await changePasswordMutation.mutateAsync({ id: userToModify._id, data: inputData });
    }, [changePasswordMutation, userToModify, passwordChangeForm]); // Adicionado passwordChangeForm à dependência


    // --- Funções para abrir Dialogs (sem alterações na lógica, mas ajustam o reset) ---
    const openPasswordDialog = (user: UserData) => {
        setUserToModify(user);
        passwordChangeForm.reset(); // Reseta form ao abrir
        setPasswordChangeDialogOpen(true);
        setShowPasswordFields(false);
    };
    const openEditDialog = (user: UserData) => {
        setUserToModify(user);
        // Popula o form com os dados do usuário selecionado
        editUserForm.reset({
            name: user.name,
            role: user.role,
            // Mapeia de volta para array de IDs (strings)
            assignedEmpreendimentos: user.assignedEmpreendimentos?.map(emp => emp._id) || []
        });
        setEditUserDialogOpen(true);
    };
     const openDeleteDialog = (user: UserData) => {
         setUserToModify(user);
         setDeleteUserDialogOpen(true);
     };

    // --- Watchers de Formulário (sem alterações) ---
    const watchNewUserRole = newUserForm.watch("role");
    const watchEditUserRole = editUserForm.watch("role");

    // --- Variáveis derivadas dos dados tRPC ---
    const users = usersQuery.data?.users || [];
    const pagination = usersQuery.data?.pagination;
    const isLoadingUsers = usersQuery.isLoading || usersQuery.isFetching; // Combina estados de loading da query

    // --- Renderização ---
    return (
        <TooltipProvider>
            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Gerenciamento de Usuários</CardTitle>
                        <CardDescription>Adicione, edite ou remova usuários do sistema.</CardDescription>
                    </div>
                    {/* --- Dialog Novo Usuário --- */}
                    <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                        <DialogTrigger asChild>
                            {/* Desabilitar botão se estiver carregando empreendimentos */}
                            <Button size="sm" className="w-full md:w-auto" disabled={isFetchingEmpreendimentos}>
                                {isFetchingEmpreendimentos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Novo Usuário
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Adicionar Novo Usuário</DialogTitle></DialogHeader>
                            <FormProvider {...newUserForm}>
                                <form onSubmit={newUserForm.handleSubmit(handleNewUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                    {/* Campos do formulário (sem alterações visuais, mas 'disabled' usa isCreatingUser) */}
                                     <FormField control={newUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={newUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={newUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={newUserForm.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isCreatingUser}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                                    {watchNewUserRole === 'user' && (
                                        <FormField control={newUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem> <FormLabel>Empreendimentos Atribuídos</FormLabel> <FormControl> <MultiSelect options={empreendimentoOptions} selected={field.value || []} onChange={field.onChange} isLoading={isFetchingEmpreendimentos} disabled={isCreatingUser} placeholder="Selecione..." /> </FormControl> <FormMessage /> </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-4 -mb-4">
                                        <Button variant="outline" type="button" onClick={() => setNewUserDialogOpen(false)} disabled={isCreatingUser}>Cancelar</Button>
                                        {/* Botão usa isCreatingUser e isFetchingEmpreendimentos */}
                                        <Button type="submit" disabled={isCreatingUser || isFetchingEmpreendimentos}>
                                            {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {/* --- Busca --- */}
                    <div className="mb-4 flex items-center gap-2">
                         <Search className="h-4 w-4 text-muted-foreground" />
                         <Input placeholder="Buscar por nome ou email..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} disabled={isLoadingUsers} className="h-9 text-sm" />
                    </div>
                    {/* --- Tabela --- */}
                    {/* Usa isLoadingUsers */}
                    {isLoadingUsers && users.length === 0 ? ( // Mostra skeleton apenas no load inicial
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Nenhum usuário encontrado {searchTerm && `para "${searchTerm}"`}.</p>
                    ) : (
                        <div className="border rounded-md overflow-x-auto relative">
                             {/* Overlay de Loading para refetch */}
                             {isLoadingUsers && users.length > 0 && ( <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> </div> )}
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Função</TableHead>
                                        <TableHead>Empreendimentos</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Mapeia os dados de `usersQuery.data.users` */}
                                    {users.map((user) => {
                                        // Lógica para exibir empreendimentos (sem alterações)
                                        const empreendimentosText = user.role === 'admin' || user.role === 'manager' ? 'Todos' : user.assignedEmpreendimentos && user.assignedEmpreendimentos.length > 0 ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ') : 'Nenhum';
                                        const empreendimentosTitle = user.assignedEmpreendimentos && user.assignedEmpreendimentos.length > 0 ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ') : undefined;

                                        return (
                                            <TableRow key={user._id} className={isActionSubmitting && userToModify?._id === user._id ? 'opacity-50' : ''}>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell><Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>{user.role}</Badge></TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={empreendimentosTitle}> {empreendimentosText} </TableCell>
                                                <TableCell>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {/* Desabilitar ações se outra ação estiver em progresso para QUALQUER usuário ou se esta linha específica estiver sendo modificada */}
                                                         {session?.user?.id !== user._id && (
                                                             <>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)} disabled={isActionSubmitting}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPasswordDialog(user)} disabled={isActionSubmitting}><KeyRound className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Senha</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(user)} disabled={isActionSubmitting}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Excluir</p></TooltipContent></Tooltip>
                                                             </>
                                                         )}
                                                        {session?.user?.id === user._id && (<span className="text-xs text-muted-foreground italic pr-2">(Você)</span>)}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* --- Dialog Excluir Usuário --- */}
                    <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Excluir Usuário</DialogTitle><DialogDescription>Tem certeza que deseja excluir <strong>{userToModify?.name}</strong>? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
                            <DialogFooter className="pt-4 gap-2">
                                <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)} disabled={isDeletingUser}>Cancelar</Button>
                                <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
                                    {isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* --- Dialog Alterar Senha --- */}
                     <Dialog open={passwordChangeDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setPasswordChangeDialogOpen(open); }}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Alterar Senha de {userToModify?.name}</DialogTitle><DialogDescription>Digite a nova senha para {userToModify?.email}.</DialogDescription></DialogHeader>
                            <FormProvider {...passwordChangeForm}>
                                <form onSubmit={passwordChangeForm.handleSubmit(handleAdminPasswordChangeSubmit)} className="space-y-4 py-4">
                                    <FormField control={passwordChangeForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>Nova Senha</FormLabel><div className="flex items-center gap-2"><FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={isChangingPassword} /></FormControl><Button type="button" variant="ghost" size="icon" onClick={() => setShowPasswordFields(!showPasswordFields)} className="flex-shrink-0 h-8 w-8">{showPasswordFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div><FormMessage /></FormItem>)} />
                                    <FormField control={passwordChangeForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar</FormLabel><FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={isChangingPassword} /></FormControl><FormMessage /></FormItem>)} />
                                    <DialogFooter className="pt-4 gap-2">
                                        <DialogClose asChild><Button variant="outline" type="button" disabled={isChangingPassword}>Cancelar</Button></DialogClose>
                                        <Button type="submit" disabled={isChangingPassword}>
                                            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Senha
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>

                    {/* --- Dialog Editar Usuário --- */}
                     <Dialog open={editUserDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setEditUserDialogOpen(open); }}>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle><DialogDescription>Atualize as informações de {userToModify?.name}.</DialogDescription></DialogHeader>
                            <FormProvider {...editUserForm}>
                                <form onSubmit={editUserForm.handleSubmit(handleEditUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                    {/* Campos usam disabled={isEditingUser} */}
                                     <FormField control={editUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={isEditingUser} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={editUserForm.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditingUser}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                                    {watchEditUserRole === 'user' && (
                                        <FormField control={editUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem> <FormLabel>Empreendimentos Atribuídos</FormLabel> <FormControl> <MultiSelect options={empreendimentoOptions} selected={field.value || []} onChange={field.onChange} isLoading={isFetchingEmpreendimentos} disabled={isEditingUser || isFetchingEmpreendimentos} placeholder="Selecione..." /> </FormControl> <FormMessage /> </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-4 -mb-4">
                                        <DialogClose asChild><Button variant="outline" type="button" disabled={isEditingUser}>Cancelar</Button></DialogClose>
                                        {/* Botão usa isEditingUser */}
                                        <Button type="submit" disabled={isEditingUser || isFetchingEmpreendimentos || !editUserForm.formState.isDirty}>
                                            {isEditingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                </CardContent>
                {/* --- Paginação --- */}
                 {/* Usa dados de paginação do tRPC query */}
                 {!isLoadingUsers && pagination && pagination.pages > 1 && (
                    <PaginationControls
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        onPageChange={setCurrentPage} // Atualiza a página local para refetch
                        isDisabled={isLoadingUsers} // Desabilita durante o carregamento/fetch
                     />
                )}
            </Card>
        </TooltipProvider>
    );
}
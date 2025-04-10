"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, KeyRound, Save, Eye, EyeOff, Edit, Search, RotateCcw } from 'lucide-react';
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
import { MultiSelect } from '../ui/multi-select';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDebounce } from '@/utils/debounce';
import { trpc } from '@/lib/trpc/client';
import { PaginationControls } from '@/components/ui/pagination/pagination-controls';
import type { UserResponse, CreateUserInput, UpdateUserInput, AdminUpdatePasswordInput } from '@/server/api/schemas/auth';

// Zod Schemas (unchanged)
const newUserSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha: mínimo 6 caracteres"),
    role: z.enum(['admin', 'manager', 'user'], { required_error: "Função é obrigatória" }),
    assignedEmpreendimentos: z.array(z.string()).optional(),
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

interface EmpreendimentoOption { value: string; label: string; }
type UserData = UserResponse;

export default function UserSettingsTable() {
    const { data: session } = useSession();
    const { toast } = useToast();

    // Local States
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
    const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
    const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [userToModify, setUserToModify] = useState<UserData | null>(null);
    const [showPasswordFields, setShowPasswordFields] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Form Hooks
    const newUserForm = useForm<NewUserFormData>({ resolver: zodResolver(newUserSchema), defaultValues: { name: '', email: '', password: '', role: undefined, assignedEmpreendimentos: [] } });
    const editUserForm = useForm<EditUserFormData>({ resolver: zodResolver(editUserSchema), defaultValues: { name: '', role: undefined, assignedEmpreendimentos: [] } });
    const passwordChangeForm = useForm<AdminPasswordChangeFormData>({ resolver: zodResolver(adminPasswordChangeSchema), defaultValues: { newPassword: '', confirmPassword: '' } });

    // tRPC Queries
    const usersQuery = trpc.users.getAll.useQuery(
        { page: currentPage, limit, searchTerm: debouncedSearchTerm || undefined },
        { staleTime: 5 * 60 * 1000, placeholderData: (previousData) => previousData }
    );
    const { empreendimentos: backendEmpreendimentos, isLoading: isFetchingEmpreendimentos } = useEmpreendimentos();

    const empreendimentoOptions = useMemo((): EmpreendimentoOption[] => {
        return (backendEmpreendimentos || []).map(emp => ({ value: emp._id, label: emp.name }));
    }, [backendEmpreendimentos]);

    // tRPC Mutations
    const utils = trpc.useContext();
    const createUserMutation = trpc.auth.register.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setNewUserDialogOpen(false); newUserForm.reset(); utils.users.getAll.invalidate(); },
        onError: (error) => { toast({ variant: "destructive", title: "Erro ao Criar", description: error.message }); }
    });
    const editUserMutation = trpc.users.update.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: data.message }); setEditUserDialogOpen(false); setUserToModify(null); utils.users.getAll.invalidate(); utils.users.getById.invalidate({ id: data.user._id }); },
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

    // Loading States
    const isCreatingUser = createUserMutation.isPending;
    const isEditingUser = editUserMutation.isPending;
    const isDeletingUser = deleteUserMutation.isPending;
    const isChangingPassword = changePasswordMutation.isPending;
    const isActionSubmitting = isEditingUser || isDeletingUser || isChangingPassword;

    // Handlers
    const handleNewUserSubmit = useCallback(async (values: NewUserFormData) => {
        const inputData: CreateUserInput = { name: values.name, email: values.email, password: values.password, role: values.role, assignedEmpreendimentos: values.role === 'user' ? values.assignedEmpreendimentos : undefined };
        await createUserMutation.mutateAsync(inputData);
    }, [createUserMutation]);

    const handleEditUserSubmit = useCallback(async (values: EditUserFormData) => {
        if (!userToModify?._id) return;
        const inputData: UpdateUserInput = { name: values.name, role: values.role, assignedEmpreendimentos: values.role === 'user' ? values.assignedEmpreendimentos : [] };
        await editUserMutation.mutateAsync({ id: userToModify._id, data: inputData });
    }, [editUserMutation, userToModify]);

    const handleDeleteUser = useCallback(async () => {
        if (!userToModify?._id) return;
        await deleteUserMutation.mutateAsync({ id: userToModify._id });
    }, [deleteUserMutation, userToModify]);

    const handleAdminPasswordChangeSubmit = useCallback(async (values: AdminPasswordChangeFormData) => {
        if (!userToModify?._id) return;
        const inputData: AdminUpdatePasswordInput = { password: values.newPassword };
        await changePasswordMutation.mutateAsync({ id: userToModify._id, data: inputData });
    }, [changePasswordMutation, userToModify]);

    const openPasswordDialog = (user: UserData) => { setUserToModify(user); passwordChangeForm.reset(); setPasswordChangeDialogOpen(true); setShowPasswordFields(false); };
    const openEditDialog = (user: UserData) => { setUserToModify(user); editUserForm.reset({ name: user.name, role: user.role, assignedEmpreendimentos: user.assignedEmpreendimentos?.map(emp => emp._id) || [] }); setEditUserDialogOpen(true); };
    const openDeleteDialog = (user: UserData) => { setUserToModify(user); setDeleteUserDialogOpen(true); };

    // Watchers
    const watchNewUserRole = newUserForm.watch("role");
    const watchEditUserRole = editUserForm.watch("role");

    // Derived Variables
    const users = usersQuery.data?.users || [];
    const pagination = usersQuery.data?.pagination;
    const isLoadingUsers = usersQuery.isLoading || usersQuery.isFetching;

    // --- Renderização ---
    return (
        <TooltipProvider>
            <Card className="w-full mx-auto">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-6">
                    <div>
                        <CardTitle className="text-lg sm:text-xl">Gerenciamento de Usuários</CardTitle>
                        <CardDescription className="text-sm">Adicione, edite ou remova usuários.</CardDescription>
                    </div>
                    <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="w-full sm:w-auto" disabled={isFetchingEmpreendimentos}>
                                {isFetchingEmpreendimentos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Novo Usuário
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[90vw] max-w-[425px] sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Adicionar Novo Usuário</DialogTitle></DialogHeader>
                            <FormProvider {...newUserForm}>
                                <form onSubmit={newUserForm.handleSubmit(handleNewUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2 sm:px-0">
                                    <FormField control={newUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} disabled={isCreatingUser} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isCreatingUser}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    {watchNewUserRole === 'user' && (
                                        <FormField control={newUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Empreendimentos</FormLabel>
                                                <FormControl>
                                                    <div>
                                                        <MultiSelect
                                                            options={empreendimentoOptions}
                                                            selected={field.value || []}
                                                            onChange={field.onChange}
                                                            isLoading={isFetchingEmpreendimentos}
                                                            disabled={isCreatingUser}
                                                            placeholder="Selecione..."
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 sm:pb-4">
                                        <Button variant="outline" type="button" onClick={() => setNewUserDialogOpen(false)} disabled={isCreatingUser}>Cancelar</Button>
                                        <Button type="submit" disabled={isCreatingUser || isFetchingEmpreendimentos}>
                                            {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    {/* Search Bar */}
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2 w-full">
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <Input
                                placeholder="Buscar por nome ou email..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                disabled={isLoadingUsers}
                                className="h-9 text-sm w-full"
                            />
                        </div>
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                disabled={isLoadingUsers}
                                className="w-full sm:w-auto mt-2 sm:mt-0"
                            >
                                <RotateCcw className="h-4 w-4 mr-1" /> Limpar
                            </Button>
                        )}
                    </div>

                    {/* User List */}
                    {isLoadingUsers && users.length === 0 ? (
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6 text-sm">Nenhum usuário encontrado {searchTerm && `para "${searchTerm}"`}.</p>
                    ) : (
                        <>
                            {/* Mobile Card Layout */}
                            <div className="space-y-4 md:hidden">
                                {users.map((user) => {
                                    const empreendimentosText = user.role === 'admin' || user.role === 'manager' ? 'Todos' : user.assignedEmpreendimentos?.length ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ') : 'Nenhum';
                                    return (
                                        <Card key={user._id} className={isActionSubmitting && userToModify?._id === user._id ? 'opacity-50' : ''}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium">{user.name}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </div>
                                                    <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>{user.role}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2 truncate">Empreend.: {empreendimentosText}</p>
                                                <div className="flex justify-end gap-1 mt-4">
                                                    {session?.user?.id !== user._id ? (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)} disabled={isActionSubmitting}><Edit className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPasswordDialog(user)} disabled={isActionSubmitting}><KeyRound className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(user)} disabled={isActionSubmitting}><Trash2 className="h-4 w-4" /></Button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">(Você)</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden md:block border rounded-md overflow-x-auto relative">
                                {isLoadingUsers && users.length > 0 && (
                                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                )}
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[150px]">Nome</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="w-[100px]">Função</TableHead>
                                            <TableHead className="hidden lg:table-cell">Empreendimentos</TableHead>
                                            <TableHead className="hidden xl:table-cell w-[120px]">Criado em</TableHead>
                                            <TableHead className="text-right w-[120px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => {
                                            const empreendimentosText = user.role === 'admin' || user.role === 'manager' ? 'Todos' : user.assignedEmpreendimentos?.length ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ') : 'Nenhum';
                                            const empreendimentosTitle = user.assignedEmpreendimentos?.length ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ') : undefined;
                                            return (
                                                <TableRow key={user._id} className={isActionSubmitting && userToModify?._id === user._id ? 'opacity-50' : ''}>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell><Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>{user.role}</Badge></TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate hidden lg:table-cell" title={empreendimentosTitle}>{empreendimentosText}</TableCell>
                                                    <TableCell className="hidden xl:table-cell">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {session?.user?.id !== user._id ? (
                                                                <>
                                                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)} disabled={isActionSubmitting}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                                                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPasswordDialog(user)} disabled={isActionSubmitting}><KeyRound className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Senha</p></TooltipContent></Tooltip>
                                                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(user)} disabled={isActionSubmitting}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Excluir</p></TooltipContent></Tooltip>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic pr-2">(Você)</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}

                    {/* Edit Dialog */}
                    <Dialog open={editUserDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setEditUserDialogOpen(open); }}>
                        <DialogContent className="w-[90vw] max-w-[425px] sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle><DialogDescription>Atualize as informações de {userToModify?.name}.</DialogDescription></DialogHeader>
                            <FormProvider {...editUserForm}>
                                <form onSubmit={editUserForm.handleSubmit(handleEditUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2 sm:px-0">
                                    <FormField control={editUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={isEditingUser} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={editUserForm.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditingUser}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    {watchEditUserRole === 'user' && (
                                        <FormField control={editUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Empreendimentos</FormLabel>
                                                <FormControl>
                                                    <div>
                                                        <MultiSelect
                                                            options={empreendimentoOptions}
                                                            selected={field.value || []}
                                                            onChange={field.onChange}
                                                            isLoading={isFetchingEmpreendimentos}
                                                            disabled={isEditingUser || isFetchingEmpreendimentos}
                                                            placeholder="Selecione..."
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 sm:pb-4">
                                        <DialogClose asChild><Button variant="outline" type="button" disabled={isEditingUser}>Cancelar</Button></DialogClose>
                                        <Button type="submit" disabled={isEditingUser || isFetchingEmpreendimentos || !editUserForm.formState.isDirty}>
                                            {isEditingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Dialog */}
                    <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
                        <DialogContent className="w-[90vw] max-w-[425px]">
                            <DialogHeader><DialogTitle>Excluir Usuário</DialogTitle><DialogDescription>Tem certeza que deseja excluir <strong>{userToModify?.name}</strong>? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
                            <DialogFooter className="pt-4 gap-2">
                                <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)} disabled={isDeletingUser}>Cancelar</Button>
                                <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
                                    {isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Password Change Dialog */}
                    <Dialog open={passwordChangeDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setPasswordChangeDialogOpen(open); }}>
                        <DialogContent className="w-[90vw] max-w-[425px]">
                            <DialogHeader><DialogTitle>Alterar Senha de {userToModify?.name}</DialogTitle><DialogDescription>Digite a nova senha para {userToModify?.email}.</DialogDescription></DialogHeader>
                            <FormProvider {...passwordChangeForm}>
                                <form onSubmit={passwordChangeForm.handleSubmit(handleAdminPasswordChangeSubmit)} className="space-y-4 py-4 px-2 sm:px-0">
                                    <FormField control={passwordChangeForm.control} name="newPassword" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nova Senha</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={isChangingPassword} /></FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPasswordFields(!showPasswordFields)} className="flex-shrink-0 h-8 w-8">{showPasswordFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={passwordChangeForm.control} name="confirmPassword" render={({ field }) => (
                                        <FormItem><FormLabel>Confirmar</FormLabel><FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={isChangingPassword} /></FormControl><FormMessage /></FormItem>
                                    )} />
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
                </CardContent>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <CardContent className="px-4 sm:px-6 pt-0">
                        <PaginationControls
                            currentPage={pagination.page}
                            totalPages={pagination.pages}
                            onPageChange={setCurrentPage}
                            isDisabled={isLoadingUsers}
                        />
                    </CardContent>
                )}
            </Card>
        </TooltipProvider>
    );
}
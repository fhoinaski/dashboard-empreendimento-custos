"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, KeyRound, Save, Eye, EyeOff, Edit } from 'lucide-react';
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



const newUserSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha: mínimo 6 caracteres"),
    role: z.string().min(1, "Função é obrigatória"),
    assignedEmpreendimentos: z.array(z.string()).optional(),
});
type NewUserFormData = z.infer<typeof newUserSchema>;

const editUserSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    role: z.string().min(1, "Função é obrigatória"),
    assignedEmpreendimentos: z.array(z.string()).optional(),
});
type EditUserFormData = z.infer<typeof editUserSchema>;

const adminPasswordChangeSchema = z.object({
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem",
    path: ["confirmPassword"],
});
type AdminPasswordChangeFormData = z.infer<typeof adminPasswordChangeSchema>;

interface AssignedEmpreendimento { _id: string; name: string; }
interface UserData {
    _id: string; name: string; email: string; role: string; createdAt: string;
    assignedEmpreendimentos?: AssignedEmpreendimento[];
}
interface UserPagination { total: number; page: number; limit: number; totalPages: number; }
interface EmpreendimentoOption { value: string; label: string; }

export default function UserSettingsTable() {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | false>(false);
    const [users, setUsers] = useState<UserData[]>([]);
    const [userPagination, setUserPagination] = useState<UserPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
    const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
    const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [userToModify, setUserToModify] = useState<UserData | null>(null);
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [allEmpreendimentos, setAllEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
    const [isFetchingEmpreendimentos, setIsFetchingEmpreendimentos] = useState(true);

    const newUserForm = useForm<NewUserFormData>({
        resolver: zodResolver(newUserSchema),
        defaultValues: { name: '', email: '', password: '', role: '', assignedEmpreendimentos: [] },
    });
    const editUserForm = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: { name: '', role: '', assignedEmpreendimentos: [] },
    });
    const passwordChangeForm = useForm<AdminPasswordChangeFormData>({
        resolver: zodResolver(adminPasswordChangeSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    const fetchUsersData = useCallback(async (page = 1, limit = 10, search = '') => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit), q: search });
            const response = await fetch(`/api/users?${params.toString()}`);
            if (!response.ok) throw new Error(`Falha ao buscar usuários (${response.status})`);
            const data = await response.json();
            console.log('[fetchUsersData] Dados recebidos:', data); // Log para depuração
            setUsers(data.users || []);
            setUserPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
        } catch (error) {
            console.error("Erro fetchUsersData:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar usuários." });
            setUsers([]);
            setUserPagination({ total: 0, page: 1, limit: 10, totalPages: 1 });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    const fetchEmpreendimentos = useCallback(async () => {
        setIsFetchingEmpreendimentos(true);
        try {
            const response = await fetch('/api/empreendimentos?limit=999');
            if (!response.ok) throw new Error(`Falha ao buscar empreendimentos (${response.status})`);
            const data = await response.json();
            if (data?.empreendimentos) {
                setAllEmpreendimentos(data.empreendimentos.map((emp: any) => ({ value: emp._id, label: emp.name })));
            }
        } catch (error) {
            console.error("Erro fetchEmpreendimentos:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar empreendimentos." });
        } finally {
            setIsFetchingEmpreendimentos(false);
        }
    }, [toast]);

    useEffect(() => { fetchEmpreendimentos(); }, [fetchEmpreendimentos]);
    useEffect(() => { fetchUsersData(userPagination.page, userPagination.limit, userSearchTerm); }, [fetchUsersData, userPagination.page, userPagination.limit, userSearchTerm]);

    const handleNewUserSubmit = useCallback(async (values: NewUserFormData) => {
        setIsSubmitting('newUser');
        try {
            const payload = values.role === 'user' ? values : { ...values, assignedEmpreendimentos: [] };
            console.log("[handleNewUserSubmit] Payload:", payload);
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao adicionar usuário');
            toast({ title: "Sucesso", description: data.message });
            setNewUserDialogOpen(false);
            newUserForm.reset();
            fetchUsersData();
        } catch (error) {
            console.error("[handleNewUserSubmit] Error:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao adicionar usuário" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, newUserForm, fetchUsersData]);

    const handleEditUserSubmit = useCallback(async (values: EditUserFormData) => {
        if (!userToModify) return;
        setIsSubmitting(`edit-${userToModify._id}`);
        try {
            const payload = values.role === 'user' ? values : { ...values, assignedEmpreendimentos: [] };
            console.log("[handleEditUserSubmit] Payload:", payload);
            const response = await fetch(`/api/users/${userToModify._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao atualizar usuário');
            toast({ title: "Sucesso", description: data.message });
            setEditUserDialogOpen(false);
            setUserToModify(null);
            fetchUsersData();
        } catch (error) {
            console.error("[handleEditUserSubmit] Error:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao atualizar" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, userToModify, fetchUsersData]);

    const handleDeleteUser = useCallback(async () => {
        if (!userToModify) return;
        setIsSubmitting(`delete-${userToModify._id}`);
        try {
            const response = await fetch(`/api/users/${userToModify._id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao excluir');
            toast({ title: "Sucesso", description: data.message });
            setDeleteUserDialogOpen(false);
            setUserToModify(null);
            fetchUsersData();
        } catch (error) {
            console.error("Delete error:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, userToModify, fetchUsersData]);

    const handleAdminPasswordChangeSubmit = useCallback(async (values: AdminPasswordChangeFormData) => {
        if (!userToModify) return;
        setIsSubmitting(`passwordChange-${userToModify._id}`);
        try {
            const response = await fetch(`/api/users/${userToModify._id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: values.newPassword }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao alterar');
            toast({ title: "Sucesso", description: data.message });
            setPasswordChangeDialogOpen(false);
            passwordChangeForm.reset();
            setUserToModify(null);
        } catch (error) {
            console.error("Password change error:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, userToModify, passwordChangeForm]);

    const openPasswordDialog = (user: UserData) => {
        setUserToModify(user);
        passwordChangeForm.reset();
        setPasswordChangeDialogOpen(true);
        setShowPasswordFields(false);
    };
    const openEditDialog = (user: UserData) => {
        setUserToModify(user);
        editUserForm.reset({
            name: user.name,
            role: user.role,
            assignedEmpreendimentos: user.assignedEmpreendimentos?.map(emp => emp._id) || []
        });
        setEditUserDialogOpen(true);
    };

    const watchNewUserRole = newUserForm.watch("role");
    const watchEditUserRole = editUserForm.watch("role");

    return (
        <TooltipProvider>
            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Gerenciamento de Usuários</CardTitle>
                        <CardDescription>Adicione, edite ou remova usuários do sistema.</CardDescription>
                    </div>
                    <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="w-full md:w-auto"> <Plus className="mr-2 h-4 w-4" /> Novo Usuário </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Adicionar Novo Usuário</DialogTitle></DialogHeader>
                            <FormProvider {...newUserForm}>
                                <form onSubmit={newUserForm.handleSubmit(handleNewUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                    <FormField control={newUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={isSubmitting === 'newUser'} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={isSubmitting === 'newUser'} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} disabled={isSubmitting === 'newUser'} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={newUserForm.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting === 'newUser'}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    {watchNewUserRole === 'user' && (
                                        <FormField control={newUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Empreendimentos Atribuídos</FormLabel>
                                                <FormControl>
                                                    <MultiSelect
                                                        options={allEmpreendimentos}
                                                        selected={field.value || []}
                                                        onChange={field.onChange}
                                                        isLoading={isFetchingEmpreendimentos}
                                                        disabled={isSubmitting === 'newUser'}
                                                        placeholder="Selecione..."
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-4 -mb-4">
                                        <Button variant="outline" type="button" onClick={() => setNewUserDialogOpen(false)} disabled={isSubmitting === 'newUser'}>Cancelar</Button>
                                        <Button type="submit" disabled={isSubmitting === 'newUser' || isFetchingEmpreendimentos}>
                                            {isSubmitting === 'newUser' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <Input placeholder="Buscar por nome ou email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} disabled={isLoading} />
                    </div>
                    {isLoading ? (
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Nenhum usuário encontrado.</p>
                    ) : (
                        <div className="border rounded-md overflow-x-auto">
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
                                    {users.map((user) => {
                                        const empreendimentosText = user.role === 'admin' || user.role === 'manager'
                                            ? 'Todos'
                                            : user.assignedEmpreendimentos && user.assignedEmpreendimentos.length > 0
                                                ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ')
                                                : 'Nenhum';
                                        const empreendimentosTitle = user.assignedEmpreendimentos && user.assignedEmpreendimentos.length > 0
                                            ? user.assignedEmpreendimentos.map(emp => emp.name).join(', ')
                                            : undefined;

                                        return (
                                            <TableRow key={user._id}>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell><Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>{user.role}</Badge></TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={empreendimentosTitle}>
                                                    {empreendimentosText}
                                                </TableCell>
                                                <TableCell>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {session?.user?.id !== user._id && (
                                                            <>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)} disabled={!!isSubmitting}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPasswordDialog(user)} disabled={!!isSubmitting}><KeyRound className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Senha</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setUserToModify(user); setDeleteUserDialogOpen(true); }} disabled={!!isSubmitting}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Excluir</p></TooltipContent></Tooltip>
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

                    <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Excluir Usuário</DialogTitle><DialogDescription>Tem certeza que deseja excluir <strong>{userToModify?.name}</strong>? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
                            <DialogFooter className="pt-4 gap-2"><Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)} disabled={isSubmitting === `delete-${userToModify?._id}`}>Cancelar</Button><Button variant="destructive" onClick={handleDeleteUser} disabled={isSubmitting === `delete-${userToModify?._id}`}>{isSubmitting === `delete-${userToModify?._id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={passwordChangeDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setPasswordChangeDialogOpen(open); }}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Alterar Senha de {userToModify?.name}</DialogTitle><DialogDescription>Digite a nova senha para {userToModify?.email}.</DialogDescription></DialogHeader>
                            <FormProvider {...passwordChangeForm}>
                                <form onSubmit={passwordChangeForm.handleSubmit(handleAdminPasswordChangeSubmit)} className="space-y-4 py-4">
                                    <FormField control={passwordChangeForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>Nova Senha</FormLabel><div className="flex items-center gap-2"><FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={!!isSubmitting} /></FormControl><Button type="button" variant="ghost" size="icon" onClick={() => setShowPasswordFields(!showPasswordFields)} className="flex-shrink-0">{showPasswordFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div><FormMessage /></FormItem>)} />
                                    <FormField control={passwordChangeForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar</FormLabel><FormControl><Input type={showPasswordFields ? "text" : "password"} {...field} disabled={!!isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                    <DialogFooter className="pt-4 gap-2"><DialogClose asChild><Button variant="outline" type="button" disabled={!!isSubmitting}>Cancelar</Button></DialogClose><Button type="submit" disabled={!!isSubmitting}>{!!isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Senha</Button></DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={editUserDialogOpen} onOpenChange={(open) => { if (!open) setUserToModify(null); setEditUserDialogOpen(open); }}>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle><DialogDescription>Atualize as informações de {userToModify?.name}.</DialogDescription></DialogHeader>
                            <FormProvider {...editUserForm}>
                                <form onSubmit={editUserForm.handleSubmit(handleEditUserSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                    <FormField control={editUserForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} disabled={!!isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={editUserForm.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Função</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!!isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Gerente</SelectItem><SelectItem value="user">Usuário</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    {watchEditUserRole === 'user' && (
                                        <FormField control={editUserForm.control} name="assignedEmpreendimentos" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Empreendimentos Atribuídos</FormLabel>
                                                <FormControl>
                                                    <MultiSelect
                                                        options={allEmpreendimentos}
                                                        selected={field.value || []}
                                                        onChange={field.onChange}
                                                        isLoading={isFetchingEmpreendimentos}
                                                        disabled={!!isSubmitting}
                                                        placeholder="Selecione..."
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                    <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-4 -mb-4"><DialogClose asChild><Button variant="outline" type="button" disabled={!!isSubmitting}>Cancelar</Button></DialogClose><Button type="submit" disabled={!!isSubmitting || !editUserForm.formState.isDirty}>{!!isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button></DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                </CardContent>
                {!isLoading && userPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-6 pb-4">
                        <span className="text-sm text-muted-foreground">Pág {userPagination.page} de {userPagination.totalPages}</span>
                        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => fetchUsersData(userPagination.page - 1, userPagination.limit, userSearchTerm)} disabled={userPagination.page === 1 || isLoading}>Anterior</Button><Button variant="outline" size="sm" onClick={() => fetchUsersData(userPagination.page + 1, userPagination.limit, userSearchTerm)} disabled={userPagination.page === userPagination.totalPages || isLoading}>Próxima</Button></div>
                    </div>
                )}
            </Card>
        </TooltipProvider>
    );
}
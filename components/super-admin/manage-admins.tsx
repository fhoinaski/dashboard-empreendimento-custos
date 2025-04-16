"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";
import { TRPCClientErrorLike } from "@trpc/client";
import { ColumnDef, } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { AppRouter } from "@/server/api/root";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  email: string;
  plan: "free" | "plus" | "pro";
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "plan",
    header: "Plano",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-2"></div>
      );
    },
  }
];


function DeleteUserButton({ userId, isLoadingButton }: { userId: string, isLoadingButton: boolean }) {
  const { toast } = useToast();
  const utils = trpc.useContext();
  const { mutate: deleteUser } = trpc.users.deleteUser.useMutation( {
    onSuccess: () => {
      utils.users.getUsers.invalidate();
      toast({
        title: "Sucesso!",
        description: "Usuario removido com sucesso.",
      });
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast({
        title: "Erro!",
        description: error.message,

        variant: "destructive",
      });
    },
  });
  return (
    <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" size="sm">
        Deletar
        </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
        <AlertDialogDescription>
          Essa ação não pode ser desfeita.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>


        <AlertDialogAction  disabled={isLoadingButton}>
          

          Confirmar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
      </AlertDialog>
  ); 
}


function EditUserDialog({ user }: { user: User}) {
  const utils = trpc.useContext();
   
  const { toast } = useToast();
  const { mutate: updateUser, isLoading: isLoadingUpdate } = trpc.users.updateUser.useMutation({
    onSuccess: () => {
      utils.users.getUsers.invalidate();
      toast({
        title: "Sucesso!",
        description: "Usuario atualizado com sucesso.",
      });
    },
      onError: (error: TRPCClientErrorLike<AppRouter>) => {
        toast({
          title: "Erro!",
          description: error.message, 
          variant: "destructive",
        });
      },
  }); 
  const [plan, setPlan] = useState<"free" | "plus" | "pro">(user.plan);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Editar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Editar o plano do usuario {user.email}.
          </DialogDescription>
        </DialogHeader>
        <EditUserForm user={user} />

        <DialogFooter>
          <Button
            type="submit"
            onClick={() => updateUser({ id: user.id, plan })}
            disabled={isLoadingUpdate}
          >
            Salvar
          </Button>
        </DialogFooter>

        <DeleteUserButton userId={user.id} isLoadingButton={isLoadingUpdate} />
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({ user }: { user: User }) {
  const [plan, setPlan] = useState<"free" | "plus" | "pro">(user.plan);
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="plan" className="text-right">
          Plano
        </Label>
        <Select
          onValueChange={(value: "free" | "plus" | "pro") => setPlan(value)}
          defaultValue={user.plan}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="plus">Plus</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CreateUserDialog() {
  const { toast } = useToast();
  const utils = trpc.useContext();
  const { mutate: createUser, isLoading: isLoadingCreate } = trpc.users.createUser.useMutation(
    {
      onSuccess: () => {
        utils.users.getUsers.invalidate();
        toast({
          title: "Sucesso!",
          description: "Usuario criado com sucesso.",
        });
      },
      onError: (error: TRPCClientErrorLike<AppRouter>) => {
        toast({
          title: "Erro!",
          description: error.error.data?.zodError?.fieldErrors.email?.[0] ?? error.message,
          
            
          variant: "destructive",
        });
      },
    });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<"free" | "plus" | "pro">("free");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Criar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Usuario</DialogTitle>
          <DialogDescription>
            Crie um novo usuario para a plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="plan" className="text-right">
              Plano
            </Label>
            <Select
              onValueChange={(value: "free" | "plus" | "pro") => setPlan(value)}
              defaultValue={""}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="plus">Plus</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              className="col-span-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              Senha
            </Label>
              <Input
                id="password"
                className="col-span-3"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
          </div>
          
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={() => createUser({ email: email, password: password, plan: plan })}
            disabled={isLoadingCreate}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ManageAdmins() {
  const { data, refetch, isLoading } = trpc.users.getUsers.useQuery()
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gerenciar Administradores</h1>
        <div className="flex gap-2">
          <Button onClick={() => refetch()}  disabled={isLoading} >
            Atualizar
          </Button>
          <CreateUserDialog />
        </div>
      </div>
      <DataTable columns={columns} data={data ?? []} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2 } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const formSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
});

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();

  // Redireciona se já autenticado
  useEffect(() => {
    if (status === "authenticated") {
      console.log("[LoginForm] Usuário já autenticado, redirecionando para /dashboard");
      router.replace("/dashboard");
      // Garante que o estado de carregamento seja resetado quando o status muda para authenticated
      setIsLoading(false);
    }
  }, [status, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setLoginError(false);
    console.log("[LoginForm] Iniciando tentativa de login para:", values.email);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard", // Define a URL de retorno
      });

      console.log("[LoginForm] Resultado do signIn:", result);

      if (result?.ok && !result.error) {
        toast({
          title: "Login bem-sucedido",
          description: "Redirecionando para o dashboard...",
        });
        console.log("[LoginForm] Login OK, redirecionando para /dashboard...");
        // Força a atualização da sessão no cliente
        router.push("/dashboard");
        router.refresh(); // Garante que o estado da sessão seja atualizado
        // Importante: resetar o estado de carregamento após login bem-sucedido
        setIsLoading(false);
        // Importante: resetar o estado de carregamento após login bem-sucedido
        setIsLoading(false);
      } else {
        const errorMessage = result?.error || "Email ou senha incorretos";
        console.error("[LoginForm] Erro na autenticação:", errorMessage);
        setLoginError(true);
        toast({
          variant: "destructive",
          title: "Erro de autenticação",
          description: errorMessage,
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error("[LoginForm] Erro inesperado durante o signIn:", error);
      toast({
        variant: "destructive",
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor. Tente novamente.",
      });
      setIsLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="w-full max-w-md p-8 bg-background rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Verificando sessão...</p>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md p-8 bg-background rounded-xl shadow-lg"
    >
      <div className="flex flex-col items-center mb-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground mb-4"
        >
          <Building2 size={32} />
        </motion.div>
        <h1 className="text-2xl font-bold">Gestão Scotta</h1>
        <p className="text-muted-foreground mt-1">Acesse sua conta</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="seu@email.com" {...field} className={loginError ? "border-destructive" : ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••"
                    {...field}
                    className={loginError ? "border-destructive" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>Use suas credenciais para fazer login.</p>
      </div>
    </motion.div>
  );
}
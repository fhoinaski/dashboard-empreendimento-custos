"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2 } from "lucide-react";
import { signIn, useSession, getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  const { data: session, status } = useSession();

  // Evita loop de redirecionamento e verifica a sessão
  useEffect(() => {
    if (status === "authenticated") {
      console.log("[LoginForm] Usuário autenticado, redirecionando para dashboard");
      window.location.href = "/dashboard"; // Força redirecionamento completo
    }
  }, [status]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!values.email || !values.password) {
      setLoginError(true);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Email e senha são obrigatórios",
      });
      return;
    }

    setIsLoading(true);
    setLoginError(false);

    try {
      // Faz o login sem redirecionamento automático
      const result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      console.log("[LoginForm] Resultado do signIn:", result);

      if (!result?.ok) {
        throw new Error(result?.error || "Credenciais inválidas");
      }

      // Verifica a sessão após o login
      const session = await getSession();
      console.log("[LoginForm] Sessão após login:", session);

      if (session) {
        toast({
          title: "Login bem-sucedido",
          description: "Redirecionando para o dashboard...",
        });
        // Força redirecionamento completo para garantir que a sessão seja reconhecida
        window.location.href = "/dashboard";
      } else {
        throw new Error("Sessão não foi criada após login bem-sucedido");
      }
    } catch (error) {
      console.error("[LoginForm] Erro no login:", error);
      setLoginError(true);
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: error instanceof Error ? error.message : "Falha na autenticação",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Renderização condicional para status de carregamento
  if (status === "loading") {
    return (
      <div className="w-full max-w-md p-8 bg-background rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Verificando sessão...</p>
      </div>
    );
  }

  // Não renderiza nada se já autenticado (o useEffect cuida do redirecionamento)
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
                  <Input
                    placeholder="seu@email.com"
                    {...field}
                    disabled={isLoading}
                    className={loginError ? "border-destructive" : ""}
                  />
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
                    disabled={isLoading}
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
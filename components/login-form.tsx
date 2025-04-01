"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
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
  const { data: session, status } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
  
    if (status === "authenticated" && session?.user) {
      
      toast({
        title: "Login bem-sucedido",
        description: "Redirecionando para o dashboard...",
      });
      router.push("/dashboard");
      router.refresh();
      setIsLoading(false);
    }
  }, [status, session, router, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setLoginError(false);

    

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
      });

      

      if (!result || result.error) {
        console.error("[LoginForm] Erro na autenticação:", result?.error || "Resultado indefinido");
        setLoginError(true);
        toast({
          variant: "destructive",
          title: "Erro de autenticação",
          description: result?.error || "Email ou senha incorretos",
        });
        setIsLoading(false);
        return;
      }

      
      toast({
        title: "Login bem-sucedido",
        description: "Redirecionando para o dashboard...",
      });

      // Aguardar um pequeno delay para garantir que o cookie seja propagado
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("[LoginForm] Erro inesperado:", error);
      toast({
        variant: "destructive",
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
      });
      setIsLoading(false);
    }
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
        <h1 className="text-2xl font-bold">Gestão de Empreendimentos</h1>
        <p className="text-muted-foreground mt-1">Acesse sua conta para continuar</p>
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
              <>
                <span className="mr-2">Entrando</span>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                />
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>Use suas credenciais para fazer login no sistema</p>
      </div>
    </motion.div>
  );
}
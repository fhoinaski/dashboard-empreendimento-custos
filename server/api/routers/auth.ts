import { publicProcedure, router } from '@/server/api/trpc';
import { TRPCError } from "@trpc/server";
import { compare, hash } from 'bcrypt';
import { z } from "zod";
import connectToDatabase from '@/lib/db/mongodb';
import { UserModel } from '@/server/db/schema';
import { createUserSchema } from '@/server/api/schemas/auth';
// Schema de entrada para login
const SignIn = z.object({
  email: z.string().email(),
  password: z.string()
});
type SignIn = z.infer<typeof SignIn>;

/**
 * Roteador para autenticação
 * Gerencia rotas relacionadas à autenticação e registro de usuários
 */
export const authRouter = router({
  signup: publicProcedure
        .input(createUserSchema)
        .mutation(async ({ input }) => {
            try {
                await connectToDatabase();
                // Verificar se o email já existe
                const existingUser = await UserModel.findOne({ email: input.email });
                if (existingUser) {
                    console.warn(`[tRPC auth.register] Email já existe: ${input.email}`);
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Email já cadastrado",
                    });
                }
                console.log(`[tRPC auth.register] Email disponível: ${input.email}`);
                const hashedPassword = await hash(input.password, 12); // Usar 12 rounds
                const createdUser = await UserModel.create({ ...input, password: hashedPassword });

                return {
                    success: true,
                    message: 'Usuário criado com sucesso',
                    user: {
                        id: createdUser._id.toString(),
                        name: createdUser.name,
                    },
                };
            } catch (error) {
                if (error instanceof TRPCError) throw error;
                console.error("[tRPC auth.register] Erro:", error);

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Erro ao criar usuário",
                    cause: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }),

  signin: publicProcedure
        .input(SignIn)
        .mutation(async ({ input }) => {
            try {
                await connectToDatabase();
                // Buscar usuário por email
                const user = await UserModel.findOne({ email: input.email })

                if (!user) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
                }
                
                const passwordValid = await compare(input.password, user.password);
                if (!passwordValid) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
                }

                return { _id: user._id.toString(), id: user._id.toString(), name: user.name, email: user.email, role: user.role };
            } catch (error) {
                console.error("[tRPC auth.signin] Erro:", error);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao fazer login" });
            }
        }),
});

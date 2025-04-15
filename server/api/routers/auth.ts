import { publicProcedure, router } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { compare, hash } from "bcrypt"; // Corrected import
import { z } from "zod";
import connectToDatabase from "@/lib/db/mongodb"; // Corrected import
import { User, UserModel } from "@/server/db/schema"; // Corrected import
// Schema de entrada para login
const SignIn = z.object({
  email: z.string().email(),
  password: z.string()
});
type SignIn = z.infer<typeof SignIn>;
type UserType = z.infer<typeof User>;


/**
 * Roteador para autenticação
 * Gerencia rotas relacionadas à autenticação e registro de usuários
 */
export const authRouter = router({
    // Rota para cadastro (signup)
    signup: publicProcedure
        .input(User)
        .mutation(async ({ input }) => {
            try {
                console.log("[tRPC auth.register] Iniciando registro. Input:", input);
                await connectToDatabase();
                console.log("[tRPC auth.register] DB Conectado.");
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
                // Remove id if it exists
                const { id, ...inputWithoutId } = input;
                console.log("[tRPC auth.register] Hashing password...");
                const hashedPassword = await hash(input.password, 12); // Usar 12 rounds
                const createdUser = await UserModel.create({ ...inputWithoutId, password: hashedPassword });
                // Retornar dados do usuário criado
                const { _id, name, email, role } = createdUser;
                return {
                    success: true,
                    message: 'Usuário criado com sucesso',
                    user: {
                        // Retorna dados seguros
                        id: _id.toString(),
                        name: name,
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

    // Rota para login (signin)
    signin: publicProcedure
        .input(SignIn)
        .mutation(async ({ input }) => {
            try {
                console.log("[tRPC auth.signin] Iniciando login. Input:", input);
                await connectToDatabase();
                // Buscar usuário por email
                const user = await UserModel.findOne({ email: input.email });
                if (!user) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
                }
                // Verificar senha usando bcrypt
                const passwordValid = await compare(input.password, user.password);
                if (!passwordValid) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
                }
                return { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role };
            } catch (error) {
                console.error("[tRPC auth.signin] Erro:", error);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao fazer login" });
            }
        }),
});

// server/api/routers/backup.ts
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento, Despesa, Documento, AppSettings, Notification } from '@/lib/db/models'; // Importar todos os modelos necessários
import { format } from 'date-fns'; // Para formatar datas
import {
    generateCsvResponseSchema,
    saveToDriveResponseSchema,
    type GenerateCsvResponse,
    type SaveToDriveResponse
} from '../schemas/backup'; // Ajuste o path se necessário
import mongoose from 'mongoose'; // Import mongoose

// --- Função Auxiliar para Escapar Valores CSV (sem alterações) ---
function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);
    if (value instanceof Date) {
        try { stringValue = format(value, 'yyyy-MM-dd HH:mm:ss'); } catch { stringValue = "Data Inválida"; }
    } else if (value instanceof mongoose.Types.ObjectId) {
        stringValue = value.toString();
    } else if (Array.isArray(value)) {
        stringValue = value.map(item => item?.toString() ?? '').join(';');
    } else if (typeof value === 'object' && value !== null && '_id' in value) {
        stringValue = value._id?.toString() ?? '';
    }
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }
    return stringValue;
}

// --- Função Auxiliar para Converter Documentos Mongoose em Linhas CSV (sem alterações) ---
function documentsToCsvLines(docs: any[], headers: string[]): string {
    return docs.map(doc => {
        // Usar lean() já retorna objetos planos, mas uma verificação extra não faz mal
        const plainDoc = doc.toObject ? doc.toObject() : doc;
        return headers.map(header => escapeCsvValue(plainDoc[header])).join(',');
    }).join('\n');
}


export const backupRouter = router({
  /**
   * Gera um backup completo de coleções selecionadas como uma string CSV.
   */
  generateCsv: adminProcedure
    .output(generateCsvResponseSchema)
    .mutation(async ({ ctx }): Promise<GenerateCsvResponse> => {
        console.log(`[tRPC backup.generateCsv] Iniciado por: ${ctx.user.email}`);
        try {
            await connectToDatabase();
            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            const fileName = `backup_scotta_${timestamp}.csv`;
            let csvContent = "\ufeff"; // BOM

            const collectionsToBackup = [
                { name: "AppSettings", model: AppSettings, headers: ['_id', 'companyName', 'cnpj', 'companyAddress', 'companyPhone', 'companyEmail', 'logoUrl', 'updatedAt'] },
                { name: "Users", model: User, headers: ['_id', 'name', 'email', 'role', 'avatarUrl', 'createdAt', 'updatedAt', 'assignedEmpreendimentos'] },
                { name: "Empreendimentos", model: Empreendimento, headers: ['_id', 'name', 'address', 'type', 'status', 'totalUnits', 'soldUnits', 'startDate', 'endDate', 'responsiblePerson', 'contactEmail', 'contactPhone', 'folderId', 'sheetId', 'createdBy', 'createdAt', 'updatedAt'] },
                { name: "Despesas", model: Despesa, headers: ['_id', 'description', 'value', 'date', 'dueDate', 'status', 'category', 'paymentMethod', 'approvalStatus', 'reviewedAt', 'notes', 'empreendimento', 'createdBy', 'reviewedBy', 'createdAt', 'updatedAt'] },
                { name: "Documentos", model: Documento, headers: ['_id', 'name', 'type', 'category', 'fileId', 'url', 'empreendimento', 'createdBy', 'createdAt', 'updatedAt'] },
                { name: "Notifications", model: Notification, headers: ['_id', 'titulo', 'mensagem', 'tipo', 'destinatarioId', 'empreendimentoId', 'lida', 'createdAt', 'updatedAt'] },
            ];

            for (const { name, model, headers } of collectionsToBackup) {
                console.log(`[tRPC backup.generateCsv] Buscando ${name}...`);

                // ***** CORREÇÃO APLICADA AQUI *****
                // Fazer um cast do 'model' para um tipo mais genérico que o TS entenda
                const documents = await (model as mongoose.Model<any>) // <-- Cast para Model<any>
                                    .find()
                                    .select('-__v') // Exclui __v
                                    .lean(); // Obter objetos JS planos
                // ***** FIM DA CORREÇÃO *****

                csvContent += `--- ${name.toUpperCase()} ---\n`;
                csvContent += headers.map(escapeCsvValue).join(',') + '\n';
                csvContent += documentsToCsvLines(documents, headers) + '\n\n';
                console.log(`[tRPC backup.generateCsv] ${documents.length} ${name.toLowerCase()} adicionados.`);
            }

            console.log(`[tRPC backup.generateCsv] Geração CSV concluída. Nome: ${fileName}, Tamanho: ~${(csvContent.length / 1024).toFixed(2)} KB`);

            return generateCsvResponseSchema.parse({
                success: true,
                csvContent: csvContent,
                fileName: fileName,
                message: "Backup CSV gerado com sucesso.",
            });

        } catch (error) {
            console.error('[tRPC backup.generateCsv] Erro:', error);
            return generateCsvResponseSchema.parse({
                success: false,
                message: 'Falha ao gerar backup CSV.',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }),

  /**
   * Salva o backup no Google Drive (PLACEHOLDER).
   */
  saveToDrive: adminProcedure
    .output(saveToDriveResponseSchema)
    .mutation(async ({ ctx }): Promise<SaveToDriveResponse> => {
        console.log(`[tRPC backup.saveToDrive] Iniciado por: ${ctx.user.email}`);
        console.warn("[tRPC backup.saveToDrive] LÓGICA DE UPLOAD PARA O DRIVE NÃO IMPLEMENTADA.");
        await new Promise(res => setTimeout(res, 1000));
        return saveToDriveResponseSchema.parse({
             success: false,
             message: "Salvar no Drive ainda não implementado.",
             error: "Funcionalidade pendente.",
        });
    }),

  // Manter comentado ou remover se não for mais necessário
  /*
  create: adminProcedure
    .input(createBackupSchema)
    .output(createBackupResponseSchema)
    .mutation(async ({ ctx }): Promise<CreateBackupResponse> => { ... }),
  */
});

export type BackupRouter = typeof backupRouter;
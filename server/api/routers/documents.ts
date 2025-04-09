import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createDocumentoSchema,
    documentFilterSchema,
    documentListResponseSchema,
    documentResponseSchema
} from '../schemas/documents';
import connectToDatabase from '@/lib/db/mongodb';
import { Documento, Empreendimento, DocumentoDocument } from '@/lib/db/models';
import mongoose, { Types, FilterQuery } from 'mongoose';
import type { Context } from '../context'; // Import Context type
// Import Drive functions if needed for delete/fetch operations
// import { deleteFileFromDrive } from '@/lib/google/drive';

// Interface for Documento populado com lean
interface PopulatedLeanDocumento extends Omit<DocumentoDocument, 'empreendimento' | 'createdBy'>{
  _id: Types.ObjectId;
  empreendimento: { _id: Types.ObjectId; name: string };
  createdBy?: { _id: Types.ObjectId; name: string };
}


// Helper function to build the RBAC filter for documents
const buildDocumentFilter = (inputFilters: z.infer<typeof documentFilterSchema>, ctxUser: Context['user']): FilterQuery<DocumentoDocument> => {
    if (!ctxUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const filter: FilterQuery<DocumentoDocument> = {};
    const { empreendimentoId, category, search } = inputFilters;

    // RBAC Filter
    let allowedEmpreendimentoIds: Types.ObjectId[] | undefined = undefined;
    if (ctxUser.role !== 'admin') {
        allowedEmpreendimentoIds = (ctxUser.assignedEmpreendimentos || [])
            .filter(id => mongoose.isValidObjectId(id))
            .map(id => new Types.ObjectId(id));
        if (allowedEmpreendimentoIds.length === 0) {
            filter._id = new Types.ObjectId(); // Match nothing if no assigned empreendimentos
            return filter; // Early return if user has no access
        }
        filter.empreendimento = { $in: allowedEmpreendimentoIds };
    }

    // Specific Filters
    if (empreendimentoId && mongoose.isValidObjectId(empreendimentoId)) {
        const requestedEmpId = new Types.ObjectId(empreendimentoId);
        // Ensure the requested empreendimento is within the allowed ones for non-admins
        if (ctxUser.role === 'admin' || allowedEmpreendimentoIds?.some(id => id.equals(requestedEmpId))) {
             // Override the $in filter if a specific, allowed ID is requested
             filter.empreendimento = requestedEmpId;
        } else {
            filter._id = new Types.ObjectId(); // Requested specific ID not allowed
        }
    } else if (!empreendimentoId && ctxUser.role === 'admin') {
        // Admin viewing all empreendimentos - remove the empreendimento filter entirely
        delete filter.empreendimento;
    }
     // Note: If no specific empreendimentoId is provided by a non-admin,
     // the $in filter remains, showing docs from all their assigned projects.

    if (category) {
      filter.category = category;
    }
    if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Add fields to search, e.g., name, category
        filter.$or = [
            { name: { $regex: escapedSearch, $options: 'i' } },
            { category: { $regex: escapedSearch, $options: 'i' } },
            // Consider searching related Empreendimento name via $lookup if needed
        ];
    }

     console.log("[buildDocumentFilter] Final Filter:", JSON.stringify(filter));
    return filter;
};


/**
 * Roteador para documentos
 * Gerencia rotas relacionadas aos documentos do sistema
 */
export const documentsRouter = router({
  // Listar documentos (Equivalente a GET /api/documents e GET /api/empreendimentos/[id]/documents)
  getAll: protectedProcedure
    .input(documentFilterSchema) // Use the defined filter schema
    .output(documentListResponseSchema) // Use the defined list response schema
    .query(async ({ input, ctx }) => {
      console.log("[tRPC documents.getAll] Input:", input);
      try {
        await connectToDatabase();

        const { page, limit } = input;
        const skip = (page - 1) * limit;

        // Build filter using the helper and context
        const filter = buildDocumentFilter(input, ctx.user);

        // Check if the filter is impossible (e.g., non-admin user with no assigned projects)
        if (filter._id instanceof Types.ObjectId) {
             console.log("[tRPC documents.getAll] Filtro impossível, retornando vazio.");
             return { documents: [], pagination: { total: 0, limit, page, pages: 0, hasMore: false } };
        }

        console.log("[tRPC documents.getAll] Executando busca com filtro:", JSON.stringify(filter));
        const [documentsDocs, total] = await Promise.all([
             Documento.find(filter)
               .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>('empreendimento', 'name _id')
               .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>('createdBy', 'name _id')
               .sort({ createdAt: -1 })
               .skip(skip)
               .limit(limit)
               .lean<PopulatedLeanDocumento[]>(),
             Documento.countDocuments(filter)
        ]);
         console.log(`[tRPC documents.getAll] Documentos encontrados: ${documentsDocs.length}, Total: ${total}`);

        const clientDocuments = documentsDocs.map(doc => ({
          _id: doc._id.toString(),
          name: doc.name,
          type: doc.type,
          empreendimento: {
            _id: doc.empreendimento._id.toString(),
            name: doc.empreendimento.name ?? 'N/A', // Handle potential missing name
          },
          category: doc.category,
          fileId: doc.fileId,
          url: doc.url ?? null, // Use null if undefined
          createdBy: doc.createdBy ? {
            _id: doc.createdBy._id.toString(),
            name: doc.createdBy.name ?? 'N/A', // Handle potential missing name
          } : undefined, // Use undefined if missing
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        }));

        // Validate the final structure before returning
        return documentListResponseSchema.parse({
             documents: clientDocuments,
             pagination: {
                 total,
                 limit,
                 page,
                 pages: Math.ceil(total / limit),
                 hasMore: page * limit < total,
             },
         });

      } catch (error) {
        console.error('Erro ao listar documentos via tRPC:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao listar documentos',
        });
      }
    }),

  // Criar documento (Equivalente a POST /api/empreendimentos/[id]/documents)
  // Assumes file upload happened separately and fileId/url are provided
  create: protectedProcedure
    .input(createDocumentoSchema)
    .mutation(async ({ input, ctx }) => {
       console.log("[tRPC documents.create] Input:", input);
      try {
        await connectToDatabase();

        const empreendimento = await Empreendimento.findById(input.empreendimento);
        if (!empreendimento) {
           console.error(`[tRPC documents.create] Empreendimento não encontrado: ${input.empreendimento}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' });
        }

        // Verificar permissão
        const canCreate = ctx.user.role === 'admin' ||
                          (ctx.user.assignedEmpreendimentos || []).includes(empreendimento._id.toString());

        if (!canCreate) {
           console.warn(`[tRPC documents.create] Usuário ${ctx.user.id} sem permissão para empreendimento ${empreendimento._id}`);
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para criar documento neste empreendimento' });
        }

        const newDocumentoData = {
          ...input,
          createdBy: new Types.ObjectId(ctx.user.id),
        };
         console.log("[tRPC documents.create] Dados para criação:", newDocumentoData);

        // Corrigindo o tipo do documento criado
        const newDocumento = await Documento.create(newDocumentoData) as DocumentoDocument;
        console.log(`[tRPC documents.create] Documento criado com ID: ${newDocumento._id}`);

        return {
          success: true,
          message: 'Documento criado com sucesso',
          document: { // Return minimal info
            id: String(newDocumento._id),
            name: newDocumento.name,
            fileId: newDocumento.fileId,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof mongoose.Error.ValidationError) {
            console.error("[tRPC documents.create] Erro de Validação Mongoose:", error.errors);
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
        }
        console.error('Erro ao criar documento via tRPC:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar documento' });
      }
    }),

   // Excluir documento (Requires Admin or specific permissions)
   delete: protectedProcedure // Or adminProcedure depending on rules
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
    .mutation(async ({ input, ctx }) => {
        console.log(`[tRPC documents.delete] ID: ${input.id}`);
        await connectToDatabase();

        const docToDelete = await Documento.findById(input.id);
        if (!docToDelete) {
            console.error(`[tRPC documents.delete] Documento não encontrado: ${input.id}`);
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado.' });
        }

        // --- RBAC CHECK ---
        const canDelete = ctx.user.role === 'admin' || // Admin can delete
                          (docToDelete.createdBy && docToDelete.createdBy.toString() === ctx.user.id); // Creator can delete?

        if (!canDelete) {
            console.warn(`[tRPC documents.delete] Usuário ${ctx.user.id} (${ctx.user.role}) sem permissão para excluir doc ${input.id}`);
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para excluir este documento.' });
        }
         console.log(`[tRPC documents.delete] Permissão de exclusão concedida para ${ctx.user.role}.`);

         try {
          // 1. Delete from Database
          await Documento.findByIdAndDelete(input.id);
          console.log(`[tRPC documents.delete] Documento ${input.id} excluído do DB.`);

          // 2. TODO: Delete from Storage (Drive/S3) - Requires fileId
          if (docToDelete.fileId) {
              console.log(`[tRPC documents.delete] Tentando excluir arquivo do storage (File ID: ${docToDelete.fileId})...`);
              // try {
              //    await deleteFileFromDrive(docToDelete.fileId); // OR deleteFromS3(docToDelete.fileId)
              //    console.log(`[tRPC documents.delete] Arquivo ${docToDelete.fileId} excluído do storage.`);
              // } catch (storageError) {
              //    console.error(`[tRPC documents.delete] ERRO ao excluir arquivo ${docToDelete.fileId} do storage:`, storageError);
              //    // Decide how to handle: log, notify, proceed?
              // }
          } else {
               console.warn(`[tRPC documents.delete] Documento ${input.id} não possui fileId, não é possível excluir do storage.`);
          }


          return { success: true, message: 'Documento excluído com sucesso.' };

      } catch (error) {
           console.error(`[tRPC documents.delete] Erro geral ao excluir documento ${input.id}:`, error);
           if (error instanceof TRPCError) throw error;
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir documento.' });
      }
  }),

  // Obter um documento específico por ID
  getById: protectedProcedure
      .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
      .output(documentResponseSchema)
      .query(async ({ input, ctx }) => {
          console.log(`[tRPC documents.getById] ID: ${input.id}`);
          try {
              await connectToDatabase();
              
              const documento = await Documento.findById(input.id)
                  .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>('empreendimento', 'name _id')
                  .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>('createdBy', 'name _id')
                  .lean<PopulatedLeanDocumento>();
              
              if (!documento) {
                  console.error(`[tRPC documents.getById] Documento não encontrado: ${input.id}`);
                  throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado' });
              }
              
              // Verificar permissão
              const canView = ctx.user.role === 'admin' || 
                              (ctx.user.assignedEmpreendimentos || []).includes(documento.empreendimento._id.toString());
              
              if (!canView) {
                  console.warn(`[tRPC documents.getById] Usuário ${ctx.user.id} sem permissão para visualizar documento ${input.id}`);
                  throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para visualizar este documento' });
              }
              
              return {
                  _id: documento._id.toString(),
                  name: documento.name,
                  type: documento.type,
                  empreendimento: {
                      _id: documento.empreendimento._id.toString(),
                      name: documento.empreendimento.name
                  },
                  category: documento.category,
                  fileId: documento.fileId,
                  url: documento.url ?? null,
                  createdBy: documento.createdBy ? {
                      _id: documento.createdBy._id.toString(),
                      name: documento.createdBy.name
                  } : undefined,
                  createdAt: documento.createdAt.toISOString(),
                  updatedAt: documento.updatedAt.toISOString()
              };
          } catch (error) {
              if (error instanceof TRPCError) throw error;
              console.error(`[tRPC documents.getById] Erro ao buscar documento ${input.id}:`, error);
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar documento' });
          }
      })
});

export type DocumentsRouter = typeof documentsRouter;
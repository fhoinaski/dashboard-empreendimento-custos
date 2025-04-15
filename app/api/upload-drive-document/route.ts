// ============================================================
// START OF REFACTORED FILE: app/api/upload-drive-document/route.ts
// (Added tenant config check)
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Documento, AppSettings } from "@/lib/db/models"; // Import AppSettings
import { uploadFileToDrive } from "@/lib/google/drive";
import mongoose, { Types, Document as MongooseDocument } from "mongoose";
// Importar o serviço para buscar config do tenant
import { TenantService } from "@/server/services/TenantService";

// Define a basic interface for the Documento document (adjust based on your schema)
interface IDocumento extends MongooseDocument {
  _id: Types.ObjectId;
  name: string;
  type: string;
  tenantId: Types.ObjectId; // Incluir tenantId na interface
  empreendimento: Types.ObjectId;
  category: string;
  fileId: string;
  url: string;
  createdBy: Types.ObjectId;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  console.log("[API /upload-drive-document] Recebido request POST.");
  try {
    // 1. Verificar Autenticação, Permissão e Tenant
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) { // Verificar tenantId
      console.warn("[API UploadDoc] Acesso não autorizado (sem sessão ou tenantId).");
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }
    if (!["admin", "manager"].includes(session.user.role ?? "")) {
      console.warn(`[API UploadDoc] Usuário ${session.user.id} (Role: ${session.user.role}) sem permissão.`);
      return NextResponse.json({ success: false, error: "Sem permissão para upload de documentos." }, { status: 403 });
    }
    const userId = new Types.ObjectId(session.user.id);
    const tenantId = session.user.tenantId; // Obter tenantId
    const tenantObjectId = new Types.ObjectId(tenantId);
    console.log(`[API UploadDoc] Usuário autorizado: ${userId} (${session.user.role}) Tenant: ${tenantId}`);

    // --- VERIFICAÇÃO DE CONFIGURAÇÃO DO TENANT ---
    console.log(`[API UploadDoc] Verificando configuração do tenant ${tenantId}...`);
    const tenantService = new TenantService();
    const tenantConfig = await tenantService.getTenantConfig(tenantId);

    if (!tenantConfig?.googleDriveEnabled) {
      console.warn(`[API UploadDoc] Integração Google Drive DESABILITADA para tenant ${tenantId}.`);
      return NextResponse.json({
        success: false,
        error: 'A integração com Google Drive não está habilitada para sua organização.'
      }, { status: 403 }); // 403 Forbidden
    }
    console.log(`[API UploadDoc] Integração Google Drive HABILITADA para tenant ${tenantId}.`);
    // --- FIM DA VERIFICAÇÃO ---

    // 2. Processar FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empreendimentoId = formData.get("empreendimentoId") as string | null;
    const category = formData.get("category") as string | null;

    // 3. Validações Essenciais
    if (!file) return NextResponse.json({ success: false, error: "Nenhum arquivo recebido." }, { status: 400 });
    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) return NextResponse.json({ success: false, error: "ID do empreendimento inválido ou ausente." }, { status: 400 });
    const finalCategory = category || "Outros";

    // 4. Conectar ao DB e Buscar Empreendimento (VALIDANDO TENANT)
    await connectToDatabase();
    console.log("[API UploadDoc] Buscando empreendimento...");
    const empreendimento = await Empreendimento.findOne({ _id: new Types.ObjectId(empreendimentoId), tenantId: tenantObjectId }) // Validar tenantId
      .select("folderId name")
      .lean();

    if (!empreendimento) {
      console.error(`[API UploadDoc] Empreendimento ${empreendimentoId} não encontrado ou não pertence ao tenant ${tenantId}.`);
      return NextResponse.json({ success: false, error: "Empreendimento não encontrado." }, { status: 404 });
    }
    if (!empreendimento.folderId) {
      console.error(`[API UploadDoc] Empreendimento ${empreendimento.name} (Tenant: ${tenantId}) sem folderId.`);
      return NextResponse.json({ success: false, error: `Google Drive não configurado para ${empreendimento.name}. Crie as pastas na página do empreendimento.` }, { status: 400 });
    }
    const targetFolderId = empreendimento.folderId;
    console.log(`[API UploadDoc] Empreendimento encontrado: ${empreendimento.name} (Folder: ${targetFolderId})`);

    // 5. Validação de Arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]; // Adicionado DOCX, XLSX
    const maxSize = 15 * 1024 * 1024; // Aumentado para 15MB
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ success: false, error: `Tipo de arquivo inválido: ${file.type}` }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ success: false, error: `Arquivo excede o limite de ${(maxSize / 1024 / 1024).toFixed(0)}MB` }, { status: 413 });
    console.log(`[API UploadDoc] Validação arquivo OK: ${file.name}`);

    // 6. Preparar dados para upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileData = { buffer: fileBuffer, originalname: file.name, mimetype: file.type };
    console.log(`[API UploadDoc] Chamando uploadFileToDrive. Tenant: ${tenantId}, Folder: ${targetFolderId}, Category: ${finalCategory}, File: ${file.name}`);

    // 7. Upload para o Drive (Passando tenantId)
    const uploadResult = await uploadFileToDrive(tenantId, fileData, targetFolderId, finalCategory);
    console.log("[API UploadDoc] Resultado uploadFileToDrive:", uploadResult);

    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      return NextResponse.json({ success: false, error: uploadResult.error || "Falha no upload para o Google Drive." }, { status: 500 });
    }

    // 8. Salvar Referência no MongoDB
    try {
      console.log(`[API UploadDoc] Salvando referência no DB. Tenant: ${tenantId}, Empr: ${empreendimentoId}, FileId: ${uploadResult.fileId}`);
      const newDocument = await Documento.create({
        tenantId: tenantObjectId, // Adicionar tenantId ao criar
        name: uploadResult.fileName,
        type: file.type,
        empreendimento: new Types.ObjectId(empreendimentoId),
        category: finalCategory,
        fileId: uploadResult.fileId,
        url: uploadResult.webViewLink, // Usar webViewLink
        createdBy: userId,
      }) as IDocumento; // Explicitly type the result

      console.log(`[API UploadDoc] Referência DB criada: ${newDocument._id} para Tenant ${tenantId}`);

      // 9. Retornar Sucesso
      return NextResponse.json({
        success: true,
        message: "Arquivo enviado e referência salva com sucesso!",
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        url: uploadResult.webViewLink,
        documentId: newDocument._id.toString(),
      }, { status: 201 });

    } catch (dbError: any) {
      console.error("[API UploadDoc] Erro ao salvar referência no DB:", dbError);
      // TODO: Considerar deletar o arquivo do Drive se o DB falhar (compensação)
      return NextResponse.json({ success: false, error: "Upload para Drive OK, mas falha ao salvar referência no banco: " + dbError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[API UploadDoc] Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: `Erro interno do servidor: ${errorMessage}` }, { status });
  }
}
// ============================================================
// END OF REFACTORED FILE: app/api/upload-drive-document/route.ts
// ============================================================
// ============================================================
// START OF REFACTORED FILE: app/api/upload-drive-despesa/route.ts
// (Added tenant config check)
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Despesa, AppSettings } from "@/lib/db/models"; // Import AppSettings
import { uploadFileToDrive } from "@/lib/google/drive";
import mongoose, { Types } from "mongoose";
import type { Attachment } from "@/server/api/schemas/despesas";
// Importar o serviço para buscar config do tenant
import { TenantService } from "@/server/services/tenant.service";

export const config = { api: { bodyParser: false } };

export async function POST(request: Request) {
  console.log("[API /upload-drive-despesa] Recebido request POST.");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) { // Verificar tenantId aqui também
      console.warn("[API /upload-drive-despesa] Acesso não autorizado (sem sessão ou tenantId).");
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 }); // Alterado para 401
    }
    const userId = new Types.ObjectId(session.user.id);
    const tenantId = session.user.tenantId; // Obter tenantId
    console.log(`[API /upload-drive-despesa] Usuário autorizado: ${userId} (${session.user.role}) Tenant: ${tenantId}`);

    // --- VERIFICAÇÃO DE CONFIGURAÇÃO DO TENANT ---
    console.log(`[API /upload-drive-despesa] Verificando configuração do tenant ${tenantId}...`);
    const tenantService = new TenantService();
    const tenantConfig = await tenantService.getTenantConfig(tenantId);

    if (!tenantConfig?.googleDriveEnabled) {
      console.warn(`[API /upload-drive-despesa] Integração Google Drive DESABILITADA para tenant ${tenantId}.`);
      return NextResponse.json({
        success: false,
        error: 'A integração com Google Drive não está habilitada para sua organização.'
      }, { status: 403 }); // 403 Forbidden
    }
    console.log(`[API /upload-drive-despesa] Integração Google Drive HABILITADA para tenant ${tenantId}.`);
    // --- FIM DA VERIFICAÇÃO ---

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empreendimentoId = formData.get("empreendimentoId") as string | null;
    const despesaId = formData.get("despesaId") as string | null;
    const finalCategory = "Despesas"; // Categoria fixa para despesas

    console.log(`[API /upload-drive-despesa] Dados recebidos: file=${file?.name}, empId=${empreendimentoId}, despesaId=${despesaId}`);

    if (!file) return NextResponse.json({ success: false, error: "Arquivo não recebido." }, { status: 400 });
    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) return NextResponse.json({ success: false, error: "ID empreendimento inválido." }, { status: 400 });
    if (!despesaId || !mongoose.isValidObjectId(despesaId)) return NextResponse.json({ success: false, error: "ID da despesa inválido." }, { status: 400 });

    console.log("[API /upload-drive-despesa] Conectando ao DB...");
    await connectToDatabase();

    // Buscar empreendimento e despesa, validando o tenantId
    const [empreendimento, despesa] = await Promise.all([
      Empreendimento.findOne({ _id: new Types.ObjectId(empreendimentoId), tenantId: new Types.ObjectId(tenantId) }) // Validar tenantId
        .select("folderId name")
        .lean(),
      Despesa.findOne({ _id: new Types.ObjectId(despesaId), tenantId: new Types.ObjectId(tenantId) }) // Validar tenantId
    ]);

    if (!empreendimento) return NextResponse.json({ success: false, error: "Empreendimento não encontrado ou não pertence a este tenant." }, { status: 404 });
    if (!despesa) return NextResponse.json({ success: false, error: "Despesa não encontrada ou não pertence a este tenant." }, { status: 404 });
    if (!empreendimento.folderId) return NextResponse.json({ success: false, error: `Google Drive não configurado para ${empreendimento.name}.` }, { status: 400 });
    const targetFolderId = empreendimento.folderId;
    console.log(`[API /upload-drive-despesa] Empreendimento: ${empreendimento.name}, Despesa: ${despesa._id}`);

    // Validação de Permissão (Admin ou criador da despesa)
    const isCreator = despesa.createdBy.equals(userId);
    const isAdmin = session.user.role === "admin";
    if (!isAdmin && !isCreator) {
      console.warn(`[API /upload-drive-despesa] Usuário ${userId} sem permissão para despesa ${despesaId}.`);
      return NextResponse.json({ success: false, error: "Sem permissão para anexar a esta despesa." }, { status: 403 });
    }
    console.log("[API /upload-drive-despesa] Permissão OK.");

    // Validação do Arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ success: false, error: `Tipo inválido: ${file.type}` }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ success: false, error: `Arquivo > ${maxSize / 1024 / 1024}MB` }, { status: 413 });
    console.log("[API /upload-drive-despesa] Validação arquivo OK.");

    // Preparar e Enviar Arquivo
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileData = { buffer: fileBuffer, originalname: file.name, mimetype: file.type };
    console.log(`[API /upload-drive-despesa] Chamando uploadFileToDrive com tenantId: ${tenantId}...`);

    // Passar tenantId para uploadFileToDrive
    const uploadResult = await uploadFileToDrive(tenantId, fileData, targetFolderId, finalCategory);
    console.log("[API /upload-drive-despesa] Resultado uploadFileToDrive:", uploadResult);

    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      return NextResponse.json({ success: false, error: uploadResult.error || "Falha upload Drive." }, { status: 500 });
    }

    // Atualizar Despesa no DB
    try {
      console.log(`[API /upload-drive-despesa] Atualizando Despesa ${despesaId} no DB...`);
      const newAttachment: Omit<Attachment, "_id"> = {
        fileId: uploadResult.fileId,
        name: uploadResult.fileName,
        url: uploadResult.webViewLink, // Usar webViewLink do Drive
      };

      // Append ou substitui (a lógica atual substitui, pode mudar para push se necessário)
      despesa.attachments = [newAttachment];
      // despesa.attachments = [...(despesa.attachments || []), newAttachment]; // Para append
      despesa.updatedAt = new Date();
      await despesa.save();
      console.log(`[API /upload-drive-despesa] Despesa ${despesaId} atualizada com anexo.`);

      return NextResponse.json({
        success: true,
        message: "Anexo enviado e vinculado à despesa!",
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        url: uploadResult.webViewLink,
        despesaId: despesaId,
      }, { status: 200 });

    } catch (dbError: any) {
      console.error("[API /upload-drive-despesa] Erro atualizar Despesa DB:", dbError);
      // TODO: Considerar deletar o arquivo do Drive se o DB falhar (compensação)
      return NextResponse.json({ success: false, error: "Upload Drive OK, falha atualizar Despesa DB: " + dbError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[API /upload-drive-despesa] Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: `Erro interno servidor: ${errorMessage}` }, { status });
  }
}
// ============================================================
// END OF REFACTORED FILE: app/api/upload-drive-despesa/route.ts
// ============================================================
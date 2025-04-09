// app/api/upload-drive-despesa/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Despesa } from "@/lib/db/models";
import { uploadFileToDrive } from "@/lib/google/drive";
import mongoose, { Types } from "mongoose";
import type { Attachment } from "@/server/api/schemas/despesas";

export const config = { api: { bodyParser: false } };

export async function POST(request: Request) {
  console.log("[API /upload-drive-despesa] Recebido request POST.");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn("[API /upload-drive-despesa] Acesso não autorizado.");
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 403 });
    }
    const userId = new Types.ObjectId(session.user.id);
    console.log(`[API /upload-drive-despesa] Usuário autorizado: ${userId} (${session.user.role})`);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empreendimentoId = formData.get("empreendimentoId") as string | null;
    const despesaId = formData.get("despesaId") as string | null;
    const finalCategory = "Despesas";

    console.log(`[API /upload-drive-despesa] Dados recebidos: file=${file?.name}, empId=${empreendimentoId}, despesaId=${despesaId}`);

    if (!file) return NextResponse.json({ success: false, error: "Arquivo não recebido." }, { status: 400 });
    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) return NextResponse.json({ success: false, error: "ID empreendimento inválido." }, { status: 400 });
    if (!despesaId || !mongoose.isValidObjectId(despesaId)) return NextResponse.json({ success: false, error: "ID da despesa inválido." }, { status: 400 });

    console.log("[API /upload-drive-despesa] Conectando ao DB...");
    await connectToDatabase();
    const [empreendimento, despesa] = await Promise.all([
      Empreendimento.findById(empreendimentoId).select("folderId name").lean(),
      Despesa.findById(despesaId),
    ]);

    if (!empreendimento) return NextResponse.json({ success: false, error: "Empreendimento não encontrado." }, { status: 404 });
    if (!despesa) return NextResponse.json({ success: false, error: "Despesa não encontrada." }, { status: 404 });
    if (!empreendimento.folderId) return NextResponse.json({ success: false, error: `Drive não configurado para ${empreendimento.name}.` }, { status: 400 });
    const targetFolderId = empreendimento.folderId;
    console.log(`[API /upload-drive-despesa] Empreendimento: ${empreendimento.name}, Despesa: ${despesa._id}`);

    const isCreator = despesa.createdBy.equals(userId);
    const isAdmin = session.user.role === "admin";
    if (!isAdmin && !isCreator) {
      console.warn(`[API /upload-drive-despesa] Usuário ${userId} sem permissão para despesa ${despesaId}.`);
      return NextResponse.json({ success: false, error: "Sem permissão para anexar a esta despesa." }, { status: 403 });
    }
    console.log("[API /upload-drive-despesa] Permissão OK.");

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ success: false, error: `Tipo inválido: ${file.type}` }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ success: false, error: `Arquivo > ${maxSize / 1024 / 1024}MB` }, { status: 413 });
    console.log("[API /upload-drive-despesa] Validação arquivo OK.");

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileData = { buffer: fileBuffer, originalname: file.name, mimetype: file.type };
    console.log(`[API /upload-drive-despesa] Chamando uploadFileToDrive...`);

    const uploadResult = await uploadFileToDrive(fileData, targetFolderId, finalCategory);
    console.log("[API /upload-drive-despesa] Resultado uploadFileToDrive:", uploadResult);

    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      return NextResponse.json({ success: false, error: uploadResult.error || "Falha upload Drive." }, { status: 500 });
    }

    // Update the Despesa in the DB
    try {
      console.log(`[API /upload-drive-despesa] Atualizando Despesa ${despesaId} no DB...`);
      const newAttachment: Omit<Attachment, "_id"> = {
        fileId: uploadResult.fileId,
        name: uploadResult.fileName,
        url: uploadResult.webViewLink,
      };

      // Append new attachment instead of replacing (if that’s the intent)
      despesa.attachments = [...(despesa.attachments || []), newAttachment];
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
      return NextResponse.json({ success: false, error: "Upload Drive OK, falha atualizar Despesa DB: " + dbError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[API /upload-drive-despesa] Erro geral:", error);
    return NextResponse.json({ success: false, error: "Erro interno servidor." }, { status: 500 });
  }
}
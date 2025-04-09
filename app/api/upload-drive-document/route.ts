// app/api/upload-drive-document/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Documento } from "@/lib/db/models";
import { uploadFileToDrive } from "@/lib/google/drive";
import mongoose, { Types, Document } from "mongoose";

// Define a basic interface for the Documento document (adjust based on your schema)
interface IDocumento extends Document {
  _id: Types.ObjectId;
  name: string;
  type: string;
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
  try {
    // 1. Verificar Autenticação e Permissão
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["admin", "manager"].includes(session.user.role ?? "")) {
      console.warn("[API UploadDoc] Acesso não autorizado ou sem permissão.");
      return NextResponse.json({ success: false, error: "Não autorizado ou sem permissão." }, { status: 403 });
    }
    const userId = new Types.ObjectId(session.user.id);

    // 2. Processar FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empreendimentoId = formData.get("empreendimentoId") as string | null;
    const category = formData.get("category") as string | null;

    // 3. Validações Essenciais
    if (!file) {
      return NextResponse.json({ success: false, error: "Nenhum arquivo recebido." }, { status: 400 });
    }
    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) {
      return NextResponse.json({ success: false, error: "ID do empreendimento inválido ou ausente." }, { status: 400 });
    }
    const finalCategory = category || "Outros";

    // 4. Conectar ao DB e Buscar Empreendimento
    await connectToDatabase();
    const empreendimento = await Empreendimento.findById(empreendimentoId).select("folderId name").lean();
    if (!empreendimento) {
      console.error(`[API UploadDoc] Empreendimento não encontrado: ${empreendimentoId}`);
      return NextResponse.json({ success: false, error: "Empreendimento não encontrado." }, { status: 404 });
    }
    if (!empreendimento.folderId) {
      console.error(`[API UploadDoc] Empreendimento ${empreendimento.name} sem folderId.`);
      return NextResponse.json({ success: false, error: `Google Drive não configurado para ${empreendimento.name}. Crie as pastas na página do empreendimento.` }, { status: 400 });
    }
    const targetFolderId = empreendimento.folderId;

    // 5. Validação de Arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: `Tipo de arquivo inválido: ${file.type}` }, { status: 400 });
    }
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: `Arquivo excede o limite de ${(maxSize / 1024 / 1024).toFixed(0)}MB` }, { status: 413 });
    }

    // 6. Preparar dados para upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileData = {
      buffer: fileBuffer,
      originalname: file.name,
      mimetype: file.type,
    };
    console.log(`[API UploadDoc] Chamando uploadFileToDrive. Folder: ${targetFolderId}, Category: ${finalCategory}, File: ${file.name}`);

    // 7. Upload para o Drive
    const uploadResult = await uploadFileToDrive(fileData, targetFolderId, finalCategory);
    console.log("[API UploadDoc] Resultado uploadFileToDrive:", uploadResult);

    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      return NextResponse.json({ success: false, error: uploadResult.error || "Falha no upload para o Google Drive." }, { status: 500 });
    }

    // 8. Salvar Referência no MongoDB
    try {
      console.log(`[API UploadDoc] Salvando referência no DB. Empr: ${empreendimentoId}, FileId: ${uploadResult.fileId}`);
      const newDocument = await Documento.create({
        name: uploadResult.fileName,
        type: file.type,
        empreendimento: new Types.ObjectId(empreendimentoId),
        category: finalCategory,
        fileId: uploadResult.fileId,
        url: uploadResult.webViewLink,
        createdBy: userId,
      }) as IDocumento; // Explicitly type the result

      console.log(`[API UploadDoc] Referência DB criada: ${newDocument._id}`);

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
      return NextResponse.json({ success: false, error: "Upload para Drive OK, mas falha ao salvar referência no banco: " + dbError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[API UploadDoc] Erro geral:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor ao processar upload." }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { AppSettings } from '@/lib/db/models'; // Certifique-se que AppSettings está corretamente definido em models.ts
import { authOptions } from '@/lib/auth/options';
import { encrypt, decrypt } from '@/lib/crypto'; // Importar funções de criptografia


// --- Interface para o resultado esperado da query .lean() ---
// Inclua APENAS os campos que você seleciona na query E o _id
interface IAppSettingsLean {
    _id: string; // Ou o tipo correto do seu _id, que é string aqui
    googleApiKeyEncrypted?: string | null; // Tornar opcional ou nullável se pode não existir
    awsApiKeyEncrypted?: string | null;    // Tornar opcional ou nullável
    // Adicione outros campos selecionados aqui se houver
}

// --- GET (Buscar chaves - retorna apenas placeholders ou status) ---
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }

        await connectToDatabase();

        // Usar findOne em vez de findById para _id string e adicionar type hint com <IAppSettingsLean | null>
        const settings = await AppSettings.findOne({ _id: 'global_settings' })
            .select('googleApiKeyEncrypted awsApiKeyEncrypted') // Seleciona os campos necessários
            .lean<IAppSettingsLean | null>(); // <-- Adiciona o tipo esperado para o lean()

        // 'settings' agora é corretamente tipado como IAppSettingsLean ou null

        // Retorna apenas se as chaves existem (estão configuradas), sem revelar o valor
        return NextResponse.json({
            googleConfigured: !!settings?.googleApiKeyEncrypted, // Acesso seguro com optional chaining
            awsConfigured: !!settings?.awsApiKeyEncrypted,     // Acesso seguro com optional chaining
            // Adicione outras chaves aqui
        });

    } catch (error) {
        console.error('Erro ao verificar chaves de API:', error);
        return NextResponse.json({ error: 'Erro interno ao verificar chaves' }, { status: 500 });
    }
}

// --- PUT (Atualizar chaves de API) ---
export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Apenas administradores podem alterar as chaves de API' }, { status: 403 });
        }

        const body = await request.json();
        const { googleApiKey, awsApiKey /*, outrasChaves */ } = body;

        // Validar se as chaves fornecidas são strings (ou null/undefined para limpar)
        if ((googleApiKey !== undefined && googleApiKey !== null && typeof googleApiKey !== 'string') ||
            (awsApiKey !== undefined && awsApiKey !== null && typeof awsApiKey !== 'string')) {
             return NextResponse.json({ error: 'Valores de chave de API inválidos (devem ser string, null ou undefined).' }, { status: 400 });
        }


        const updateData: { [key: string]: any } = { updatedAt: new Date() }; // Use um tipo mais específico se preferir

        // Criptografar as chaves antes de salvar
        if (googleApiKey !== undefined) { // Verifica se a chave foi enviada (incluindo null ou '')
            if (googleApiKey) {
                 console.log("Criptografando chave Google...");
                 updateData.googleApiKeyEncrypted = await encrypt(googleApiKey);
                 console.log("Chave Google criptografada.");
            } else {
                 // Se chegou como null ou '', remove a chave
                 updateData.googleApiKeyEncrypted = null;
                 console.log("Chave Google removida.");
            }
        }


        if (awsApiKey !== undefined) { // Verifica se a chave foi enviada
             if (awsApiKey) {
                console.log("Criptografando chave AWS...");
                updateData.awsApiKeyEncrypted = await encrypt(awsApiKey);
                console.log("Chave AWS criptografada.");
             } else {
                 updateData.awsApiKeyEncrypted = null;
                 console.log("Chave AWS removida.");
             }
        }

        // Adicione lógica para outras chaves aqui...

        // Verifica se há algo para atualizar além da data
        const keysToUpdate = Object.keys(updateData).filter(key => key !== 'updatedAt');
        if (keysToUpdate.length === 0) {
             return NextResponse.json({ message: 'Nenhuma chave de API fornecida para atualização.' }, { status: 200 });
        }

        await connectToDatabase();

        // Atualiza ou cria o documento de configurações
        await AppSettings.findByIdAndUpdate(
            'global_settings',
            { $set: updateData }, // Usar $set para atualizar apenas os campos fornecidos
            { upsert: true, runValidators: true } // Cria se não existir
        );

        console.log("Chaves de API atualizadas no banco.");
        return NextResponse.json({ message: 'Chaves de API atualizadas com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar chaves de API:', error);
        const message = error instanceof Error ? error.message : 'Erro interno.';
         console.error("Detalhes do erro ao atualizar chaves:", JSON.stringify(error, null, 2));
        return NextResponse.json({ error: `Erro ao atualizar chaves: ${message}` }, { status: 500 });
    }
}
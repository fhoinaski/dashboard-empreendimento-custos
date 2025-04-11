// ============================================================
// scripts/create-super-admin.ts (CommonJS Version)
// ============================================================
// Use require para importar módulos
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Use require para seus módulos internos (ajuste o caminho relativo)
const connectToDatabase = require('../lib/db/mongodb').default; // Acessa o export default
const { User } = require('../lib/db/models'); // Acessa o export nomeado

// --- Configuração (igual) ---
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const SUPER_ADMIN_NAME = 'Super Admin';
const SALT_ROUNDS = 12;

async function createSuperAdmin() {
    console.log('\n--- Executando Script de Criação do Super Admin (CommonJS) ---');

    // Validação das variáveis de ambiente (igual)
    if (!process.env.MONGODB_URI) { console.error('\n❌ ERRO: MONGODB_URI não definida. Saindo.'); process.exit(1); }
    if (!SUPER_ADMIN_EMAIL) { console.error('\n❌ ERRO: SUPER_ADMIN_EMAIL não definida. Saindo.'); process.exit(1); }
    if (!SUPER_ADMIN_PASSWORD || SUPER_ADMIN_PASSWORD.length < 8) { console.error('\n❌ ERRO: SUPER_ADMIN_PASSWORD não definida ou curta. Saindo.'); process.exit(1); }

    let connection;
    try {
        console.log('\n🔌 Conectando ao banco de dados...');
        connection = await connectToDatabase();
        console.log('✅ Conectado com sucesso.');

        console.log(`\n🔍 Verificando se Super Admin já existe...`);
        const existingSuperAdmin = await User.findOne({ role: 'superadmin' });

        if (existingSuperAdmin) {
            console.log(`\n⚠️ AVISO: Super Admin já existe (Email: ${existingSuperAdmin.email}, ID: ${existingSuperAdmin._id}). Nenhuma ação necessária.`);
            console.log('--- Script Concluído ---');
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log('   -> Nenhum Super Admin encontrado. Prosseguindo com a criação.');
        console.log('\n🔒 Gerando hash da senha...');
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
        console.log('   -> Hash gerado com sucesso.');

        console.log(`\n➕ Criando usuário Super Admin com email: ${SUPER_ADMIN_EMAIL}...`);
        const superAdminUser = await User.create({
            tenantId: null,
            name: SUPER_ADMIN_NAME,
            email: SUPER_ADMIN_EMAIL,
            password: hashedPassword,
            role: 'superadmin',
            notificationPreferences: { /* ... */ },
            preferences: { /* ... */ },
            assignedEmpreendimentos: [],
        });

        console.log('\n✨ --- SUCESSO --- ✨');
        console.log(`   Super Admin criado com ID: ${superAdminUser._id}`);
        console.log(`   Email: ${superAdminUser.email}`);
        console.log(`   Role: ${superAdminUser.role}`);
        console.log('--------------------');

    } catch (error: any) { // Tipar error como any para acesso seguro
        console.error('\n❌ --- ERRO DURANTE A CRIAÇÃO DO SUPER ADMIN --- ❌');
        if (error instanceof mongoose.Error.ValidationError) {
             console.error('   Erro de Validação Mongoose:');
             for (const field in error.errors) {
                 console.error(`     - ${field}: ${error.errors[field].message}`);
             }
        } else if (error instanceof Error) {
            console.error(`   Mensagem: ${error.message}`);
             console.error(`   Stack: ${error.stack}`);
        } else {
             console.error('   Erro desconhecido:', error);
        }
        process.exit(1);
    } finally {
        if (connection) {
            console.log('\n🔌 Desconectando do banco de dados...');
            await mongoose.disconnect();
            console.log('🔌 Desconectado.');
        }
        console.log('--- Script Finalizado ---');
    }
}

// Executa a função principal
createSuperAdmin();
// ============================================================
// END OF SCRIPT: scripts/create-super-admin.ts (CommonJS Version)
// ============================================================
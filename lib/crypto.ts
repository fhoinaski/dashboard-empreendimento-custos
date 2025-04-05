import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm'; // Algoritmo robusto
const IV_LENGTH = 16; // Tamanho padrão do IV para GCM
const SALT_LENGTH = 16; // Tamanho do Salt
const KEY_LENGTH = 32; // 256 bits para aes-256
const AUTH_TAG_LENGTH = 16; // Tamanho padrão da Auth Tag para GCM
const PBKDF2_ITERATIONS = 600000; // Número de iterações (alto é mais seguro)
const PBKDF2_DIGEST = 'sha512'; // Digest seguro

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    console.warn(`
    ############################################################################
    # AVISO: ENCRYPTION_KEY não definida ou muito curta no .env.local!         #
    # Gere uma chave segura de 32 caracteres (256 bits) para produção.         #
    # Exemplo: node -e "console.log(crypto.randomBytes(32).toString('hex'))"  #
    # Chaves de API NÃO serão criptografadas corretamente sem uma chave segura. #
    ############################################################################
    `);
    // Poderia lançar um erro em produção: throw new Error('ENCRYPTION_KEY inválida ou ausente.');
}

// Gera uma chave derivada segura da chave de ambiente usando PBKDF2
const getDerivedKey = (salt: Buffer): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        if (!ENCRYPTION_KEY) return reject(new Error("Chave de criptografia não definida"));
        crypto.pbkdf2(
            ENCRYPTION_KEY,
            salt,
            PBKDF2_ITERATIONS,
            KEY_LENGTH,
            PBKDF2_DIGEST,
            (err, derivedKey) => {
                if (err) return reject(err);
                resolve(derivedKey);
            }
        );
    });
};

export async function encrypt(text: string): Promise<string> {
    if (!ENCRYPTION_KEY) {
        console.error("Tentativa de criptografar sem ENCRYPTION_KEY. Retornando texto original.");
        return text; // Ou lançar erro? Retornar original é inseguro.
    }
    if (!text) return ''; // Lida com strings vazias

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        const derivedKey = await getDerivedKey(salt);

        const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        // Retorna salt:iv:authTag:encryptedData
        return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error("Erro ao criptografar:", error);
        throw new Error("Falha na criptografia");
    }
}

export async function decrypt(encryptedText: string): Promise<string> {
    if (!ENCRYPTION_KEY) {
        console.error("Tentativa de descriptografar sem ENCRYPTION_KEY. Retornando texto criptografado.");
        return encryptedText; // Ou lançar erro? Retornar original é inseguro.
    }
     if (!encryptedText || typeof encryptedText !== 'string' || encryptedText.split(':').length !== 4) {
        console.warn("Texto criptografado inválido ou vazio recebido para decrypt.");
        // Decidir como tratar: retornar vazio, string original, ou lançar erro?
        // Retornar vazio pode ser mais seguro que retornar o texto criptografado.
        return ''; // Ou: throw new Error("Texto criptografado inválido");
    }

    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 4) throw new Error('Formato do texto criptografado inválido');

        const [saltHex, ivHex, authTagHex, encryptedDataHex] = parts;
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedData = Buffer.from(encryptedDataHex, 'hex');

        if (iv.length !== IV_LENGTH || salt.length !== SALT_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
             throw new Error('Componentes do texto criptografado têm tamanhos inválidos');
        }

        const derivedKey = await getDerivedKey(salt);

        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(authTag); // Essencial para GCM

        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error("Erro ao descriptografar:", error);
        // Não lançar o erro diretamente para o cliente pode ser mais seguro
        // Poderia retornar uma string vazia ou um erro genérico
        // throw new Error("Falha na descriptografia");
        return ''; // Retorna vazio em caso de falha
    }
}
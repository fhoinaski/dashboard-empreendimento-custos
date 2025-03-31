import mongoose, { ConnectOptions } from "mongoose";

// 1. Defina a interface para o cache global de forma mais segura
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// 2. Declare a extensão do globalThis com TypeScript
//    (Usar globalThis é ligeiramente mais moderno que 'global')
declare global {
  var mongooseCache: MongooseCache | undefined; // Use um nome diferente para evitar conflito com o import
}

// 3. Obtenha a URI com verificação
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Por favor, defina a variável de ambiente MONGODB_URI no .env.local");
}

// 4. Inicialize o cache global de forma tipada
//    Use 'globalThis.mongooseCache' para acessar a variável global tipada
let cached: MongooseCache = globalThis.mongooseCache || { conn: null, promise: null };

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

async function connectToDatabase(): Promise<typeof mongoose> {
  // Se já temos uma conexão no cache, retorne-a
  if (cached.conn) {
    console.log("Usando conexão MongoDB do cache.");
    return cached.conn;
  }

  // Se não há uma promessa de conexão ativa, crie uma
  if (!cached.promise) {
    // 5. Use ConnectOptions para tipar as opções e remova opções obsoletas
    const opts: ConnectOptions = {
      bufferCommands: false, // Recomendado para melhor performance e detecção de erros
      serverSelectionTimeoutMS: 30000,
      // ssl: true, // 'ssl: true' pode ser configurado na URI diretamente se necessário (?tls=true)
      // useNewUrlParser e useUnifiedTopology são obsoletos no Mongoose 6+
    };

    console.log("Tentando nova conexão com MongoDB...");
    // 6. Use type assertion pois já verificamos MONGODB_URI no início
    cached.promise = mongoose.connect(MONGODB_URI as string, opts)
      .then((mongooseInstance) => {
        console.log("Conectado ao MongoDB com sucesso!");
        return mongooseInstance;
      })
      .catch((err) => {
        console.error("Erro ao conectar ao MongoDB:", err);
        // Limpa a promessa em caso de erro para permitir nova tentativa
        cached.promise = null;
        throw err; // Re-lança o erro
      });
  }

  try {
    console.log("Aguardando a promessa de conexão...");
    // Aguarda a promessa ser resolvida e armazena a conexão
    cached.conn = await cached.promise;
  } catch (e) {
    // Se a promessa falhou (catch dentro dela), limpe a promessa aqui também
    cached.promise = null;
    throw e; // Re-lança o erro da conexão
  }

  // Retorna a conexão estabelecida
  return cached.conn;
}

export default connectToDatabase;
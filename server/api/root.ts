import { router, publicProcedure } from './trpc';

// Importações dos roteadores
import { authRouter } from './routers/auth';
import { usersRouter } from './routers/users';
import { empreendimentosRouter } from './routers/empreendimentos';
import { documentsRouter } from './routers/documents';
import { notificationsRouter } from './routers/notifications';
import { settingsRouter } from './routers/settings';
import { despesasRouter } from './routers/despesas';
import { backupRouter } from './routers/backup';
import { dashboardRouter } from './routers/dashboard';
import { driveRouter } from './routers/drive';
import { sheetsRouter } from './routers/sheets';
import { uploadRouter } from './routers/upload';
import { relatoriosRouter } from './routers/relatorios';


/**
 * Roteador principal da API tRPC
 * Combina todos os sub-roteadores em um único roteador
 */
export const appRouter = router({
  // Roteadores da API
  auth: authRouter,
  users: usersRouter,
  empreendimentos: empreendimentosRouter,
  documents: documentsRouter,
  notifications: notificationsRouter,
  settings: settingsRouter,
  despesas: despesasRouter,
  backup: backupRouter,
  dashboard: dashboardRouter,
  drive: driveRouter,
  sheets: sheetsRouter,
  upload: uploadRouter, 
  relatorios: relatoriosRouter,


  // Endpoints de teste/diagnóstico
  healthcheck: publicProcedure.query(() => 'yay!'),

  // Endpoint de teste que retorna a data e hora atual
  currentDateTime: publicProcedure.query(() => {
    return {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };
  }),
});

// Tipo do roteador principal para uso no cliente
export type AppRouter = typeof appRouter;
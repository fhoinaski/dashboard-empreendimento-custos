'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import superjson from 'superjson';

// Importar a função de um arquivo separado
import { getBaseUrl } from '@/lib/utils';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 1000, // Dados ficam "frescos" por 5 segundos
        },
      },
    })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink(), // Opcional: mantém logs no console
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          fetch: (input: RequestInfo | URL, options?: RequestInit) =>
            fetch(input, {
              ...options,
              credentials: 'include', // Envia cookies de autenticação
            }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
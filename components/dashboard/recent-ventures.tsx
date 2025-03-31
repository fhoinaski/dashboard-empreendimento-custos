"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building, ArrowUpRight, Clock, CheckCircle, AlertTriangle, ThumbsUp } from "lucide-react"; // Adicionado ThumbsUp
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // Importar Skeleton para fallback interno
// --- CORREÇÃO AQUI ---
// Importação NOMEADA do componente Loading
import { Loading } from "@/components/ui/loading";
// --- FIM DA CORREÇÃO ---
import { cn } from "@/lib/utils"; // Importar cn
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip

// Interface para os dados de empreendimento esperados
interface VentureData {
    id: string;
    name: string;
    status: string;
    pendingExpenses?: number; // Tornar opcional para segurança
    // lastUpdate?: string; // Remover ou buscar data real
    updatedAt: string; // Usar a data real de atualização
    image?: string; // Adicionar imagem
}

export function RecentVentures() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null); // Usar ID (string)
  const [ventures, setVentures] = useState<VentureData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Inicia como true

  useEffect(() => {
    let isMounted = true;
    async function fetchVentures() {
        setIsLoading(true); // Garante loading=true antes do fetch
        try {
            // Busca os últimos 4 criados ou atualizados (ajustar API se necessário)
            const response = await fetch("/api/empreendimentos?limit=4&sort=updatedAt:desc"); // Ordenar por updatedAt descendente
            if (!response.ok) throw new Error("Erro ao buscar empreendimentos recentes");
            const data = await response.json();

            if (isMounted && data && Array.isArray(data.empreendimentos)) {
                // Mapeia para a interface VentureData
                const fetchedVentures = data.empreendimentos.map((emp: any): VentureData => ({
                    id: emp._id,
                    name: emp.name,
                    status: emp.status,
                    pendingExpenses: emp.pendingExpenses, // Vem da API
                    updatedAt: emp.updatedAt, // Usar data real
                    image: emp.image, // Usar imagem real
                }));
                setVentures(fetchedVentures);
            } else if (isMounted) {
                setVentures([]); // Define como vazio se a resposta não for válida
            }
        } catch (error) {
            console.error("Erro ao buscar empreendimentos recentes:", error);
             if (isMounted) setVentures([]); // Limpa em caso de erro
             // Poderia adicionar um toast aqui
        } finally {
             if (isMounted) setIsLoading(false);
        }
    }
    fetchVentures();
    return () => { isMounted = false }; // Cleanup
  }, []); // Executa apenas na montagem

  // Renderiza o componente Loading se ainda estiver carregando
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        {/* Pode usar o Loading genérico ou skeletons específicos */}
        {/* <Loading /> */}
        <div className="w-full space-y-3">
            <div className="flex gap-3 items-center"><Skeleton className="h-10 w-10 rounded-full"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4"/><Skeleton className="h-3 w-1/2"/></div><Skeleton className="h-4 w-16"/></div>
            <div className="flex gap-3 items-center"><Skeleton className="h-10 w-10 rounded-full"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-4/5"/><Skeleton className="h-3 w-1/3"/></div><Skeleton className="h-4 w-14"/></div>
            <div className="flex gap-3 items-center"><Skeleton className="h-10 w-10 rounded-full"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-1/2"/></div><Skeleton className="h-4 w-12"/></div>
        </div>
      </div>
    );
  }

  // Renderiza mensagem se não houver empreendimentos
  if (ventures.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground text-sm p-4 border rounded-md bg-muted/30">
              <Building className="h-8 w-8 mb-2 opacity-50"/>
              Nenhum empreendimento recente encontrado.
          </div>
      )
  }

  // Renderiza a lista de empreendimentos
  return (
    <TooltipProvider>
        <div className="space-y-3">
        {ventures.map((venture) => (
            <motion.div
            key={venture.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 sm:p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            onHoverStart={() => setHoveredItem(venture.id)}
            onHoverEnd={() => setHoveredItem(null)}
            >
            {/* Imagem e Infos */}
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                 {/* Imagem pequena */}
                 <Link href={`/dashboard/empreendimentos/${venture.id}`} className="flex-shrink-0">
                     <img
                         src={venture.image || "/placeholder-logo.svg"} // Fallback logo
                         alt={`Logo ${venture.name}`}
                         className="h-10 w-10 rounded-md object-cover border"
                         onError={(e) => { e.currentTarget.src = "/placeholder-logo.svg"; }}
                     />
                 </Link>
                 {/* Nome e Atualização */}
                 <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/empreendimentos/${venture.id}`}>
                        <div className="font-medium text-sm sm:text-base truncate hover:text-primary" title={venture.name}>{venture.name}</div>
                    </Link>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center text-xs text-muted-foreground cursor-default">
                                <Clock className="mr-1 h-3 w-3" />
                                {/* Usar data real se disponível */}
                                Atualizado {new Date(venture.updatedAt).toLocaleDateString('pt-BR')}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                             <p>Última atualização: {new Date(venture.updatedAt).toLocaleString('pt-BR')}</p>
                        </TooltipContent>
                    </Tooltip>
                 </div>
            </div>
            {/* Status e Ações */}
            <div className="flex items-center justify-end sm:justify-start gap-2 w-full sm:w-auto flex-shrink-0 pl-10 sm:pl-0">
                 {/* Status do Empreendimento */}
                 <Badge
                     variant={venture.status === "Concluído" ? "outline" : venture.status === "Planejamento" ? "secondary" : "default"}
                     className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap", // Pequeno e sem quebra
                         venture.status === "Concluído" && "border-green-500 text-green-700 bg-green-50",
                         venture.status === "Em andamento" && "border-blue-500 text-blue-700 bg-blue-50",
                         venture.status === "Planejamento" && "border-gray-400 text-gray-700 bg-gray-100"
                     )}
                 >
                     {venture.status}
                 </Badge>
                 {/* Status das Despesas */}
                <Tooltip>
                    <TooltipTrigger>
                         <div className={cn("flex items-center text-xs gap-1 whitespace-nowrap", venture.pendingExpenses && venture.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>
                             {venture.pendingExpenses && venture.pendingExpenses > 0 ? (
                                 <> <AlertTriangle className="h-3 w-3" /> {venture.pendingExpenses} pend. </>
                             ) : (
                                 <> <ThumbsUp className="h-3 w-3" /> Em dia </>
                             )}
                         </div>
                    </TooltipTrigger>
                    <TooltipContent>
                         {venture.pendingExpenses && venture.pendingExpenses > 0
                           ? <p>{venture.pendingExpenses} despesa(s) pendente(s) ou a vencer.</p>
                           : <p>Nenhuma despesa pendente.</p>
                         }
                    </TooltipContent>
                </Tooltip>
                {/* Botão Ver Detalhes */}
                 <motion.div
                     animate={{ opacity: hoveredItem === venture.id ? 1 : 0, scale: hoveredItem === venture.id ? 1 : 0.8 }}
                     transition={{ duration: 0.15 }}
                     className={cn(hoveredItem !== venture.id && "hidden sm:block")} // Esconde em mobile se não hover
                 >
                     <Button variant="ghost" size="icon" asChild className="h-7 w-7 ml-1">
                     <Link href={`/dashboard/empreendimentos/${venture.id}`}>
                         <ArrowUpRight className="h-4 w-4" />
                         <span className="sr-only">Ver detalhes</span>
                     </Link>
                     </Button>
                 </motion.div>
             </div>
            </motion.div>
        ))}
        </div>
    </TooltipProvider>
  );
}
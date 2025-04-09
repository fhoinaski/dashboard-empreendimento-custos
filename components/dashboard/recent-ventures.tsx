// components/dashboard/recent-ventures.tsx (REVISED TO ACCEPT PROPS)
"use client";

import React from "react"; // Removed useState, useEffect
import Link from "next/link";
import { motion } from "framer-motion";
import { Building, ArrowUpRight, Clock, ThumbsUp, AlertTriangle } from "lucide-react"; // Removed CheckCircle
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loading } from "@/components/ui/loading"; // Keep if used for overall loading
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns"; // Use for relative time
import { ptBR } from "date-fns/locale";

// Interface for the expected data prop (same as RecentVentureItem)
interface RecentVentureItem {
    id: string;
    name: string;
    status: string;
    pendingExpenses?: number;
    updatedAt: string; // Expect ISO string
    image?: string;
}

// Interface for the component's props
interface RecentVenturesProps {
    data: RecentVentureItem[];
    isLoading: boolean;
}

// Animation variants (can be kept)
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// Get Badge Styles helper (can be kept)
const getBadgeStyles = (status: string) => {
    return {
        "Concluído": "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
        "Em andamento": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
        Planejamento: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600"
    }[status] || "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600";
};

// *** Component now accepts props ***
export function RecentVentures({ data, isLoading }: RecentVenturesProps) {
    const [hoveredItem, setHoveredItem] = React.useState<string | null>(null); // Keep hover state local

    // Render Skeleton based on isLoading prop
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={`skel-recent-${i}`} className="flex items-center gap-4 animate-pulse">
                        <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                ))}
            </div>
        );
    }

    // Render message if no data
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground text-sm p-4 border rounded-md bg-muted/30">
                <Building className="h-8 w-8 mb-2 opacity-50" />
                Nenhum empreendimento recente encontrado.
            </div>
        )
    }

    // Render the list using the passed 'data' prop
    return (
        <TooltipProvider>
            <div className="space-y-3">
                {data.map((venture) => {
                    // Calculate relative time safely
                    let relativeUpdateTime = "data inválida";
                    try {
                        const parsedDate = new Date(venture.updatedAt);
                        if (!isNaN(parsedDate.getTime())) {
                           relativeUpdateTime = formatDistanceToNow(parsedDate, { locale: ptBR, addSuffix: true });
                        }
                    } catch (e) {
                         console.error("Error parsing venture updatedAt:", venture.updatedAt, e);
                    }

                    return (
                        <motion.div
                            key={venture.id}
                            variants={itemVariants} // Apply animation variants
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 sm:p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            onHoverStart={() => setHoveredItem(venture.id)}
                            onHoverEnd={() => setHoveredItem(null)}
                        >
                            {/* Image and Infos */}
                            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                <Link href={`/dashboard/empreendimentos/${venture.id}`} className="flex-shrink-0">
                                    <img
                                        src={venture.image || "/placeholder-logo.svg"} // Fallback logo
                                        alt={`Logo ${venture.name}`}
                                        className="h-10 w-10 rounded-md object-cover border"
                                        onError={(e) => { e.currentTarget.src = "/placeholder-logo.svg"; }}
                                        loading="lazy"
                                    />
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <Link href={`/dashboard/empreendimentos/${venture.id}`}>
                                        <div className="font-medium text-sm sm:text-base truncate hover:text-primary" title={venture.name}>{venture.name}</div>
                                    </Link>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center text-xs text-muted-foreground cursor-default">
                                                <Clock className="mr-1 h-3 w-3" />
                                                Atualizado {relativeUpdateTime}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Última atualização: {new Date(venture.updatedAt).toLocaleString('pt-BR')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            {/* Status and Actions */}
                             <div className="flex items-center justify-end sm:justify-start gap-2 w-full sm:w-auto flex-shrink-0 pl-10 sm:pl-0">
                                 <Badge variant={"outline"} className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap", getBadgeStyles(venture.status))}>
                                     {venture.status}
                                 </Badge>
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
                                 <motion.div
                                     initial={{ opacity: 0, scale: 0.8 }}
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
                    )
                })}
            </div>
        </TooltipProvider>
    );
}
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Building, Plus, Search, LayoutGrid, List } from "lucide-react";

// Define o número de skeletons a serem exibidos por padrão
const ITEMS_PER_PAGE_SKELETON = 9;

export default function LoadingEmpreendimentos() {
  return (
    <div className="space-y-6 animate-pulse px-4 sm:px-0">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full sm:w-[210px] rounded-md" />
      </div>

      {/* Filters and View Mode Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Skeleton className="h-9 w-full sm:w-36 rounded-md" />
            <Skeleton className="h-9 w-full sm:w-36 rounded-md" />
          </div>
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Grid View Skeleton (Default) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: ITEMS_PER_PAGE_SKELETON }).map((_, index) => (
          <Card key={`skel-grid-${index}`} className="overflow-hidden flex flex-col">
            <Skeleton className="h-48 w-full" />
            <CardHeader className="pb-2 pt-3">
                <div className="flex justify-between items-start gap-2">
                    <Skeleton className="h-5 w-3/4 mb-1" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                </div>
                <Skeleton className="h-3 w-full" />
            </CardHeader>
            <CardContent className="pb-3 flex-grow space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><Skeleton className="h-3 w-10 mb-1"/><Skeleton className="h-3 w-16"/></div>
                    <div><Skeleton className="h-3 w-12 mb-1"/><Skeleton className="h-3 w-10"/></div>
                    <div><Skeleton className="h-3 w-14 mb-1"/><Skeleton className="h-3 w-12"/></div>
                    <div><Skeleton className="h-3 w-10 mb-1"/><Skeleton className="h-3 w-14"/></div>
                </div>
            </CardContent>
            <CardFooter className="p-3">
                <Skeleton className="h-8 w-full rounded-md" />
            </CardFooter>
          </Card>
        ))}
      </div>

       {/* Pagination Skeleton (Opcional, mas bom se houver muitos itens) */}
       <div className="flex items-center justify-between pt-4 border-t">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
            </div>
        </div>
    </div>
  );
}
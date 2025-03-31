// components/despesas/despesa-form-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card"; // Import Card if needed for file upload skeleton

export function DespesaFormSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
        <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
        <div className="space-y-1.5 flex-grow">
          <Skeleton className="h-6 w-40 sm:w-48" />
          <Skeleton className="h-4 w-3/4 sm:w-2/3" />
        </div>
      </div>

      {/* Form Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
        {/* Left Column Skeleton */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Popover Button */}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Popover Button */}
            </div>
          </div>
           <div className="space-y-2">
            <Skeleton className="h-4 w-16" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
           <div className="space-y-2">
            <Skeleton className="h-4 w-20" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
             <Skeleton className="h-3 w-40 mt-1" /> {/* Description */}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" /> {/* Label */}
            <Skeleton className="h-24 w-full" /> {/* Textarea */}
          </div>
           <div className="space-y-2">
             <Skeleton className="h-4 w-28" /> {/* Label */}
             {/* Skeleton for the File Upload Card */}
             <Card className="mt-2 border-dashed border-2">
               <CardContent className="p-4">
                 <div className="flex flex-col items-center justify-center p-6 text-center">
                   <Skeleton className="h-8 w-8 rounded-md mb-2"/>
                   <Skeleton className="h-4 w-3/4 mb-1"/>
                   <Skeleton className="h-3 w-1/2 mb-4"/>
                   <Skeleton className="h-8 w-32"/>
                 </div>
               </CardContent>
             </Card>
           </div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
        <Skeleton className="h-10 w-full sm:w-24 order-last sm:order-first" />
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>
    </div>
  );
}
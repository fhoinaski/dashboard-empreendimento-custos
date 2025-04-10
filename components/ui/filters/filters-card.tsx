import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FiltersCardProps {
  title?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  onReset?: () => void;
  className?: string;
}

export function FiltersCard({
  title = 'Filtros',
  children,
  isLoading = false,
  onReset,
  className,
}: FiltersCardProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg sm:text-xl font-semibold">{title}</CardTitle>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className={cn("transition-opacity duration-200", isLoading && "opacity-70 pointer-events-none")}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
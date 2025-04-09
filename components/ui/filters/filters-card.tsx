// components/ui/filters/filters-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';

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
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isLoading}
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
      <CardContent>
        <div className={isLoading ? "opacity-70 pointer-events-none" : ""}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

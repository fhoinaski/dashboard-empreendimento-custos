// components/ui/pagination/pagination-controls.tsx
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isDisabled?: boolean;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  isDisabled = false,
  className,
}: PaginationControlsProps) {
  return (
    <div className={`flex items-center justify-between mt-4 ${className}`}>
      <Button 
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isDisabled || currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Anterior
      </Button>
      
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {Math.max(1, totalPages)}
      </span>
      
      <Button 
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isDisabled || currentPage >= totalPages}
      >
        Próxima
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

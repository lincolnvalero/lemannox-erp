import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StockIndicatorProps {
  stock: number;
  maxStock: number;
}

export function StockIndicator({ stock, maxStock }: StockIndicatorProps) {
  const percentage = maxStock > 0 ? (stock / maxStock) * 100 : 0;

  let colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
  let level = 'Alto';

  if (percentage < 50) {
    colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    level = 'Médio';
  }
  if (percentage < 20) {
    colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
    level = 'Baixo';
  }

  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', colorClass)}>
      {level}
    </Badge>
  );
}

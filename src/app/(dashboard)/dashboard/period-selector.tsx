'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PERIODS = [
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'trimestre', label: 'Este trimestre' },
  { value: 'total', label: 'Todos os períodos' },
] as const;

export function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  return (
    <Select value={current} onValueChange={(v) => router.push(`?period=${v}`)}>
      <SelectTrigger className="h-7 text-xs w-[148px] border-border/60">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map(p => (
          <SelectItem key={p.value} value={p.value} className="text-xs">
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

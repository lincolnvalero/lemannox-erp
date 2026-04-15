'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const fmt = (d: Date) => d.toISOString().split('T')[0];

const today = () => fmt(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;

type Preset =
  | { label: string; from: () => string; to: () => string }
  | { label: string; clear: true };

const PRESETS: Preset[] = [
  { label: '7d',  from: () => daysAgo(7),  to: today },
  { label: '30d', from: () => daysAgo(30), to: today },
  { label: '3m',  from: () => daysAgo(90), to: today },
  { label: 'Mês', from: monthStart, to: today },
  { label: 'Ano', from: yearStart,  to: today },
  { label: 'Tudo', clear: true },
];

export function DateRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();

  const update = (newFrom: string, newTo: string) => {
    const p = new URLSearchParams();
    if (newFrom) p.set('from', newFrom);
    if (newTo)   p.set('to',   newTo);
    router.push(`?${p.toString()}`);
  };

  const isActive = (preset: Preset) => {
    if ('clear' in preset) return !from && !to;
    return from === preset.from() && to === preset.to();
  };

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      {/* Atalhos */}
      <div className="flex gap-1 flex-wrap justify-end">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              if ('clear' in p) { router.push('?'); return; }
              update(p.from(), p.to());
            }}
            className={cn(
              'px-2 py-0.5 text-[11px] font-semibold rounded transition-colors',
              isActive(p)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Inputs de data */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => update(e.target.value, to)}
          className="h-6 px-1.5 text-[11px] rounded border border-border bg-background text-foreground w-[118px]"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => update(from, e.target.value)}
          className="h-6 px-1.5 text-[11px] rounded border border-border bg-background text-foreground w-[118px]"
        />
      </div>
    </div>
  );
}

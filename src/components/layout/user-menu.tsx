'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logout } from '@/app/(auth)/actions';

export function UserMenu({
  name,
  email,
  initials,
}: {
  name: string;
  email: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Conta"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/80 backdrop-blur-sm shadow-sm hover:bg-muted transition-colors"
      >
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute left-0 bottom-[calc(100%+6px)] min-w-[200px] rounded-lg border border-border bg-popover shadow-xl p-3 z-50">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate mb-3">{email}</p>
          <button
            onClick={async () => { await logout(); }}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

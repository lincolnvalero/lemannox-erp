'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';

export function SidebarToggle() {
  const { open } = useSidebar();

  // Só mostra o botão flutuante quando o sidebar está fechado
  if (open) return null;

  return (
    <div className="fixed top-3 left-3 z-50">
      <SidebarTrigger className="bg-background border border-border shadow-md rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" />
    </div>
  );
}

'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <div className="fixed top-3 right-4 z-50">
      <button
        onClick={toggle}
        title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/80 backdrop-blur-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        {theme === 'dark'
          ? <Sun className="h-4 w-4" />
          : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, DollarSign,
  Factory, Truck, Settings, Receipt, BarChart3, Archive,
  Menu, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AppRole } from '@/lib/role-context';

type NavItem = { title: string; href: string };
type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  items?: NavItem[];
};

const navGroups: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    label: 'Comercial',
    icon: FileText,
    items: [
      { title: 'Lista de Orçamentos', href: '/quotes' },
      { title: 'Novo Orçamento', href: '/quotes/editor' },
      { title: 'Análise por IA', href: '/quotes/analysis' },
      { title: 'Clientes', href: '/customers' },
    ],
  },
  { label: 'Produtos', icon: Package, href: '/products' },
  {
    label: 'Produção',
    icon: Factory,
    items: [
      { title: 'Programação', href: '/production' },
      { title: 'Produtos Fabricados', href: '/production/fabricados' },
      { title: 'Ordens de Serviço', href: '/os' },
    ],
  },
  {
    label: 'Financeiro',
    icon: DollarSign,
    items: [
      { title: 'Visão Geral', href: '/financeiro' },
      { title: 'Controle do Caixa', href: '/financeiro/caixa' },
      { title: 'Contas a Pagar', href: '/financeiro/pagar' },
      { title: 'Contas a Receber', href: '/financeiro/receber' },
      { title: 'Plano de Contas', href: '/financeiro/contas' },
    ],
  },
  {
    label: 'Compras',
    icon: Truck,
    items: [
      { title: 'Fornecedores', href: '/suppliers' },
      { title: 'Dashboard', href: '/suppliers/dashboard' },
    ],
  },
  { label: 'Estoque', icon: Archive, href: '/materials' },
  {
    label: 'Relatórios',
    icon: BarChart3,
    items: [
      { title: 'Relatórios', href: '/relatorios' },
      { title: 'Calculadora', href: '/calculator' },
    ],
  },
  { label: 'Fatura', icon: Receipt, href: '/invoicing' },
  {
    label: 'Config',
    icon: Settings,
    items: [
      { title: 'Usuários', href: '/admin/users' },
      { title: 'Empresa / NF-e', href: '/admin/empresa' },
    ],
  },
];

export const RAIL_W = 84;

// Labels dos grupos visíveis para cada role
const PRODUCAO_VISIBLE = new Set(['Produção', 'Relatórios', 'Estoque']);

/* ── Leamnox Logo Mark ── */
function LeamnoxLogo({ small }: { small?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-0.5 text-sidebar-foreground', small && 'scale-90')}>
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Leamnox"
      >
        <rect width="40" height="40" rx="9" fill="currentColor" fillOpacity={0.1} />
        <path
          d="M11 9 L11 31 L29 31 L29 25 L17 25 L17 9 Z"
          fill="currentColor"
        />
      </svg>
      <span className="text-[7px] font-bold tracking-[0.15em] uppercase opacity-60 leading-none">
        Leamnox
      </span>
    </div>
  );
}

/* ── Mobile page title derived from pathname ── */
function usePageTitle(pathname: string) {
  for (const g of navGroups) {
    if (g.href && (pathname === g.href || pathname.startsWith(g.href + '/'))) return g.label;
    for (const item of g.items ?? []) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.title;
    }
  }
  return 'Leamnox ERP';
}

export function SidebarNav({ footer, role = 'admin' }: { footer?: React.ReactNode; role?: AppRole }) {
  const pathname = usePathname();

  // Filtrar grupos de acordo com o perfil do usuário
  const visibleGroups = role === 'admin'
    ? navGroups
    : navGroups.filter(g => PRODUCAO_VISIBLE.has(g.label));
  /* ── Desktop flyout state ── */
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* ── Mobile sheet state ── */
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  /* Close mobile sheet on navigation */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* Auto-expand active group when sheet opens */
  useEffect(() => {
    if (!mobileOpen) return;
    const activeGroup = visibleGroups.find(g =>
      g.items?.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    );
    if (activeGroup) {
      setExpandedGroups(prev =>
        prev.includes(activeGroup.label) ? prev : [...prev, activeGroup.label]
      );
    }
  }, [mobileOpen, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname]
  );

  const isGroupActive = useCallback(
    (g: NavGroup) => g.href ? isActive(g.href) : (g.items?.some(i => isActive(i.href)) ?? false),
    [isActive]
  );

  const clearLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const scheduleClose = () => {
    leaveTimer.current = setTimeout(() => setActiveLabel(null), 130);
  };

  const openFlyout = (label: string, el: HTMLElement) => {
    clearLeave();
    const rect = el.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setActiveLabel(label);
  };

  const toggleExpanded = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const activeFlyout = visibleGroups.find(g => g.label === activeLabel && g.items);
  const pageTitle = usePageTitle(pathname);

  return (
    <>
      {/* ════════════════════════════════════════
          MOBILE TOP BAR (< md)
      ════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 flex md:hidden h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3">
        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Title */}
        <span className="text-sm font-semibold text-sidebar-foreground truncate max-w-[180px]">
          {pageTitle}
        </span>

        {/* Right slot (footer items) */}
        <div className="flex items-center gap-1">
          {footer}
        </div>
      </header>

      {/* ════════════════════════════════════════
          MOBILE SHEET DRAWER
      ════════════════════════════════════════ */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 flex flex-col bg-sidebar border-r border-sidebar-border"
        >
          <SheetHeader className="flex h-14 flex-row items-center px-4 border-b border-sidebar-border shrink-0">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <LeamnoxLogo />
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {visibleGroups.map((group) => {
              const active = isGroupActive(group);
              const expanded = expandedGroups.includes(group.label);
              const hasSubmenu = !!(group.items?.length);

              if (!hasSubmenu && group.href) {
                return (
                  <div key={group.label} className="px-2 my-0.5">
                    <Link
                      href={group.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <group.icon className="h-4 w-4 shrink-0" />
                      {group.label}
                    </Link>
                  </div>
                );
              }

              return (
                <div key={group.label} className="px-2 my-0.5">
                  <button
                    onClick={() => toggleExpanded(group.label)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <group.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 opacity-60 transition-transform duration-200',
                        expanded && 'rotate-180'
                      )}
                    />
                  </button>

                  {expanded && (
                    <div className="ml-[28px] mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
                      {group.items?.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'block px-3 py-2 rounded-lg text-sm transition-colors',
                            isActive(item.href)
                              ? 'text-primary font-semibold bg-primary/10'
                              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                          )}
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* ════════════════════════════════════════
          DESKTOP RAIL (≥ md)
      ════════════════════════════════════════ */}
      <aside
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col bg-sidebar border-r border-border"
        style={{ width: RAIL_W }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-center shrink-0 border-b border-border">
          <LeamnoxLogo />
        </div>

        {/* Nav items */}
        <nav
          className="flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {visibleGroups.map((group) => {
            const active = isGroupActive(group);
            const hovered = activeLabel === group.label;
            const hasSubmenu = !!(group.items?.length);

            const cls = cn(
              'flex flex-col items-center justify-center gap-0.5 w-full py-2.5 rounded-lg transition-colors duration-150 select-none',
              active
                ? 'bg-primary/15 text-primary'
                : hovered
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground'
            );

            const inner = (
              <>
                <group.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-[8.5px] font-semibold tracking-wide uppercase leading-tight text-center mt-0.5 px-0.5 w-full">
                  {group.label}
                </span>
              </>
            );

            if (!hasSubmenu && group.href) {
              return (
                <div key={group.label} className="px-1.5 my-0.5">
                  <Link
                    href={group.href}
                    className={cls}
                    onMouseEnter={() => { clearLeave(); setActiveLabel(null); }}
                  >
                    {inner}
                  </Link>
                </div>
              );
            }

            return (
              <div key={group.label} className="px-1.5 my-0.5">
                <div
                  className={cn(cls, 'cursor-pointer')}
                  onMouseEnter={(e) => openFlyout(group.label, e.currentTarget)}
                  onMouseLeave={scheduleClose}
                >
                  {inner}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer: user + theme toggle */}
        {footer && (
          <div className="shrink-0 border-t border-border p-2 flex items-center justify-center gap-1.5">
            {footer}
          </div>
        )}
      </aside>

      {/* ── Desktop Submenu flyout ── */}
      {activeFlyout && (
        <div
          className="hidden md:block fixed z-50 bg-sidebar border border-border rounded-r-lg shadow-2xl py-1.5 min-w-[210px]"
          style={{ left: RAIL_W, top: flyoutTop }}
          onMouseEnter={clearLeave}
          onMouseLeave={scheduleClose}
        >
          <div className="px-3 pt-1 pb-1.5 mb-1 border-b border-border">
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">
              {activeFlyout.label}
            </span>
          </div>
          {activeFlyout.items?.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setActiveLabel(null)}
              className={cn(
                'block px-4 py-2 text-sm transition-colors',
                isActive(item.href)
                  ? 'text-primary font-medium bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

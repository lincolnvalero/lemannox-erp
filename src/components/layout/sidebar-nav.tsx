'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, DollarSign,
  Factory, Truck, Settings, Receipt, BarChart3, Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback } from 'react';

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

export function SidebarNav() {
  const pathname = usePathname();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const activeFlyout = navGroups.find(g => g.label === activeLabel && g.items);

  return (
    <>
      {/* ── Rail ── */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-border"
        style={{ width: RAIL_W }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-center shrink-0 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <span className="text-sm font-bold text-primary">L</span>
          </div>
        </div>

        {/* Nav items */}
        <nav
          className="flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {navGroups.map((group) => {
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
      </aside>

      {/* ── Submenu flyout ── */}
      {activeFlyout && (
        <div
          className="fixed z-50 bg-sidebar border border-border rounded-r-lg shadow-2xl py-1.5 min-w-[210px]"
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

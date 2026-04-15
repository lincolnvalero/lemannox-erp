'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, FileText, DollarSign,
  Factory, Truck, Calculator, LogOut, ChevronDown,
  ShoppingCart, Settings, Receipt, BarChart3, Archive,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarSeparator, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logout } from '@/app/(auth)/actions';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type NavGroup = {
  label?: string;
  items: NavItem[];
};

type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  indent?: boolean;
};

const navGroups: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      { title: 'Orçamentos', href: '/quotes', icon: FileText },
      { title: 'Lista de Orçamentos', href: '/quotes', indent: true },
      { title: 'Novo Orçamento', href: '/quotes/editor', indent: true },
      { title: 'Análise por IA', href: '/quotes/analysis', indent: true },
      { title: 'Clientes', href: '/customers', icon: Users },
    ],
  },
  {
    label: 'PRODUTOS',
    items: [
      { title: 'Produtos', href: '/products', icon: Package },
    ],
  },
  {
    label: 'PRODUÇÃO',
    items: [
      { title: 'Programação', href: '/production', icon: Factory },
      { title: 'Ordens de Serviço', href: '/os', icon: ShoppingCart },
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      { title: 'Visão Geral', href: '/financeiro', icon: DollarSign },
      { title: 'Controle do Caixa', href: '/financeiro/caixa', indent: true },
      { title: 'Contas a Pagar', href: '/financeiro/pagar', indent: true },
      { title: 'Contas a Receber', href: '/financeiro/receber', indent: true },
      { title: 'Plano de Contas', href: '/financeiro/contas', indent: true },
    ],
  },
  {
    label: 'COMPRAS',
    items: [
      { title: 'Fornecedores', href: '/suppliers', icon: Truck },
      { title: 'Dashboard', href: '/suppliers/dashboard', indent: true },
    ],
  },
  {
    label: 'ESTOQUE',
    items: [
      { title: 'Materiais', href: '/materials', icon: Archive },
    ],
  },
  {
    label: 'RELATÓRIOS',
    items: [
      { title: 'Relatórios', href: '/relatorios', icon: BarChart3 },
      { title: 'Calculadora', href: '/calculator', icon: Calculator },
    ],
  },
  {
    label: 'FATURAMENTO',
    items: [
      { title: 'Faturamento', href: '/invoicing', icon: Receipt },
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    items: [
      { title: 'Usuários', href: '/admin/users', icon: Settings },
      { title: 'Empresa / NF-e', href: '/admin/empresa', indent: true },
    ],
  },
];

// Grupos colapsáveis (que têm label e mais de 1 item ou sub-itens)
const COLLAPSIBLE_LABELS = new Set(['COMERCIAL', 'FINANCEIRO', 'COMPRAS', 'CONFIGURAÇÕES']);

export function SidebarNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = (user.user_metadata?.name as string || user.email || 'U')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  // Descobre qual grupo está ativo pela rota atual
  const activeGroupLabel = navGroups.find(g =>
    g.label && COLLAPSIBLE_LABELS.has(g.label) &&
    g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  )?.label ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <span className="text-sm font-bold text-primary">L</span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-semibold text-sm leading-tight">Lemannox</span>
            <span className="text-xs text-muted-foreground leading-tight">ERP Industrial</span>
          </div>
          <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="overflow-y-auto">
        {navGroups.map((group, gi) => {
          const isCollapsible = !!(group.label && COLLAPSIBLE_LABELS.has(group.label));
          const isOpen = !isCollapsible || openGroup === group.label;
          const groupActive = group.items.some(i => isActive(i.href));

          return (
            <SidebarGroup key={gi} className="py-1">
              {group.label && (
                <button
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase',
                    groupActive ? 'text-primary' : 'text-muted-foreground/60',
                    isCollapsible && 'hover:text-muted-foreground cursor-pointer transition-colors'
                  )}
                  onClick={() => {
                    if (!isCollapsible) return;
                    setOpenGroup(prev => prev === group.label ? null : group.label!);
                  }}
                >
                  <span>{group.label}</span>
                  {isCollapsible && (
                    <ChevronDown className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )} />
                  )}
                </button>
              )}

              {isOpen && (
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    // Itens com indent são sub-itens sem ícone
                    if (item.indent) {
                      return (
                        <SidebarMenuItem key={item.href + item.title}>
                          <SidebarMenuButton asChild isActive={active} className="pl-7 text-xs h-7">
                            <Link href={item.href}>
                              <span className={cn('truncate', active ? 'text-primary font-medium' : 'text-muted-foreground')}>
                                {item.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    return (
                      <SidebarMenuItem key={item.href + item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link href={item.href}>
                            {item.icon && <item.icon className="h-4 w-4" />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{user.user_metadata?.name || 'Usuário'}</span>
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  );
}

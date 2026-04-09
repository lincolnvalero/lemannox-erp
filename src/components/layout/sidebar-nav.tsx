'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, FileText, DollarSign,
  Factory, Truck, Wrench, Calculator, LogOut, ChevronRight,
  ShoppingCart, Settings, Receipt, BarChart3, Archive,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarRail, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logout } from '@/app/(auth)/actions';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';

type NavItem = {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { title: string; href: string }[];
};

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Orçamentos', icon: FileText, children: [
    { title: 'Lista de Orçamentos', href: '/quotes' },
    { title: 'Novo Orçamento', href: '/quotes/editor' },
    { title: 'Análise por IA', href: '/quotes/analysis' },
  ]},
  { title: 'Clientes', href: '/customers', icon: Users },
  { title: 'Produtos', href: '/products', icon: Package },
  { title: 'Produção', href: '/production', icon: Factory },
  { title: 'Financeiro', icon: DollarSign, children: [
    { title: 'Visão Geral', href: '/financeiro' },
    { title: 'Nova Transação', href: '/financeiro/editor' },
    { title: 'Contas a Pagar', href: '/financeiro/pagar' },
    { title: 'Contas a Receber', href: '/financeiro/receber' },
    { title: 'Histórico', href: '/financeiro/historico' },
    { title: 'Plano de Contas', href: '/financeiro/contas' },
  ]},
  { title: 'Fornecedores', icon: Truck, children: [
    { title: 'Lista', href: '/suppliers' },
    { title: 'Dashboard', href: '/suppliers/dashboard' },
  ]},
  { title: 'Materiais', href: '/materials', icon: Archive },
  { title: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { title: 'Calculadora', href: '/calculator', icon: Calculator },
  { title: 'Faturamento', href: '/invoicing', icon: Receipt },
  { title: 'Admin', icon: Settings, children: [
    { title: 'Usuários', href: '/admin/users' },
    { title: 'Empresa / NF-e', href: '/admin/empresa' },
  ]},
];

export function SidebarNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = (user.user_metadata?.name as string || user.email || 'U')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <span className="text-sm font-bold text-primary">L</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">Lemannox</span>
            <span className="text-xs text-muted-foreground leading-tight">ERP Industrial</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              if (item.children) {
                const isActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'));
                return (
                  <Collapsible key={item.title} defaultOpen={isActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className={cn(isActive && 'text-primary')}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map(child => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                                <Link href={child.href}>{child.title}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              }

              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href!}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
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

      <SidebarRail />
    </Sidebar>
  );
}

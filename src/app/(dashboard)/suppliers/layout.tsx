'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = pathname.endsWith('dashboard') ? 'dashboard' : pathname.endsWith('historico') ? 'historico' : 'list';

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
        <Tabs value={activeTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="list" asChild>
                    <Link href="/suppliers">Lista</Link>
                </TabsTrigger>
                <TabsTrigger value="dashboard" asChild>
                    <Link href="/suppliers/dashboard">Dashboard</Link>
                </TabsTrigger>
                <TabsTrigger value="historico" asChild>
                    <Link href="/suppliers/historico">Histórico de Compras</Link>
                </TabsTrigger>
            </TabsList>
            {children}
        </Tabs>
    </div>
  );
}


'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function QuotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // The editor page is a full-page experience and should not have the tabs.
  if (pathname.includes('/editor')) {
    return <>{children}</>;
  }

  let activeTab = 'list';
  if (pathname.endsWith('analysis')) {
      activeTab = 'analysis';
  } else if (pathname.endsWith('production-schedule')) {
      activeTab = 'production-schedule';
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Gestão de Orçamentos</h1>
        <Tabs value={activeTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="list" asChild>
                    <Link href="/quotes">Lista</Link>
                </TabsTrigger>
                <TabsTrigger value="analysis" asChild>
                    <Link href="/quotes/analysis">Análise</Link>
                </TabsTrigger>
            </TabsList>
            {children}
        </Tabs>
    </div>
  );
}

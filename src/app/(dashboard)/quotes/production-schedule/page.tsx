'use client';

import { useEffect, useState } from 'react';
import { getProductionScheduleItems } from '../../production/actions';
import type { ScheduleItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Factory } from 'lucide-react';

export default function ProductionSchedulePage() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await getProductionScheduleItems();
      if (result.success) {
        setSchedule(result.items || []);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
      setLoading(false);
    })();
  }, [toast]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
        <Factory className="mr-2 h-5 w-5" />
        <h1 className="text-lg font-semibold">Programação de Produção</h1>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Cronograma</CardTitle>
            <CardDescription>Itens aprovados ordenados por previsão de entrega</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({length: 8}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : schedule.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum item na programação.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Concluído</TableHead>
                    <TableHead>Entregue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">#{item.pedido}</TableCell>
                      <TableCell className="text-sm">{new Date(item.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-sm">{item.cliente}</TableCell>
                      <TableCell className="text-sm">{item.obra}</TableCell>
                      <TableCell className="text-sm">{item.produto}</TableCell>
                      <TableCell className="text-sm">{item.previsao}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.concluidoEm || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.entregueEm || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, AlertTriangle, Clock, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPendingTransactions, markAsPaid } from '../actions';
import type { FinancialTransaction } from '@/lib/types';
import Link from 'next/link';

function getAlertInfo(dueDate?: string): { label: string; className: string; icon: React.ReactNode } {
  if (!dueDate) return { label: 'Sem vencimento', className: 'text-muted-foreground', icon: <Clock className="h-4 w-4" /> };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: `Vencido há ${Math.abs(diffDays)}d`, className: 'text-red-400', icon: <AlertTriangle className="h-4 w-4 text-red-400" /> };
  if (diffDays === 0) return { label: 'Vence hoje', className: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4 text-orange-400" /> };
  if (diffDays <= 7) return { label: `Vence em ${diffDays}d`, className: 'text-yellow-400', icon: <Clock className="h-4 w-4 text-yellow-400" /> };
  return { label: `Vence em ${diffDays}d`, className: 'text-muted-foreground', icon: <Clock className="h-4 w-4" /> };
}

export default function ContasAPagarPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await getPendingTransactions('saida');
    if (result.success) setTransactions(result.transactions ?? []);
    else toast({ variant: 'destructive', title: 'Erro', description: result.error });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handlePay = async (t: FinancialTransaction) => {
    setPaying(t.id);
    const result = await markAsPaid(t.id);
    if (result.success) {
      setTransactions(prev => prev.filter(x => x.id !== t.id));
      toast({ title: 'Pago!', description: `"${t.description}" marcado como pago.` });
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setPaying(null);
  };

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const overdue = transactions.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < new Date());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Pendente</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Contas Pendentes</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{transactions.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Vencidas</CardDescription></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-400' : ''}`}>{overdue.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contas a Pagar</CardTitle>
              <CardDescription>Despesas pendentes ordenadas por vencimento</CardDescription>
            </div>
            <Link href="/financeiro/editor?type=saida">
              <Button size="sm" variant="outline">+ Nova Despesa</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhuma conta pendente.</TableCell>
                </TableRow>
              ) : transactions.map(t => {
                const alert = getAlertInfo(t.dueDate);
                return (
                  <TableRow key={t.id} className={t.dueDate && new Date(t.dueDate + 'T00:00:00') < new Date() ? 'bg-red-500/5' : ''}>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1.5 text-sm ${alert.className}`}>
                        {alert.icon}
                        <span>{t.dueDate ? new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                        <span className="text-xs">({alert.label})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={paying === t.id} onClick={() => handlePay(t)}>
                        <CheckCircle className="mr-1 h-4 w-4 text-green-400" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

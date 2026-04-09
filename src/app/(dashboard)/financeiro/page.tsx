
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';
import { getTransactions, getAccounts, deleteTransaction } from './actions';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  DollarSign,
  FileDown,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  isWithinInterval,
  startOfMonth,
  startOfYear,
  subMonths,
  format,
} from 'date-fns';
import { FinancialReportDialog } from '@/components/dashboard/financial-report-dialog';

const chartConfig = {
  entrada: { label: 'Entradas', color: 'hsl(var(--chart-2))' },
  saida: { label: 'Saídas', color: 'hsl(var(--chart-6))' },
};

type QuickFilter = 'month' | '3m' | '6m' | 'year' | 'custom';

type DateRange = {
  from?: Date;
  to?: Date;
};

const quickFilters: { label: string; value: QuickFilter }[] = [
  { label: 'Este mês', value: 'month' },
  { label: '3 meses', value: '3m' },
  { label: '6 meses', value: '6m' },
  { label: 'Este ano', value: 'year' },
];

function getDateRangeForFilter(filter: QuickFilter): DateRange {
  const now = new Date();
  if (filter === 'month') return { from: startOfMonth(now), to: now };
  if (filter === '3m') return { from: startOfMonth(subMonths(now, 2)), to: now };
  if (filter === '6m') return { from: startOfMonth(subMonths(now, 5)), to: now };
  if (filter === 'year') return { from: startOfYear(now), to: now };
  return { from: undefined, to: undefined };
}

export default function FinancialDashboardPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('6m');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForFilter('6m'));

  const formatDateForInput = (date?: Date) =>
    date ? format(date, 'yyyy-MM-dd') : '';

  const applyQuickFilter = (f: QuickFilter) => {
    setActiveFilter(f);
    setDateRange(getDateRangeForFilter(f));
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      const [transactionsResult, accountsResult] = await Promise.all([
        getTransactions(),
        getAccounts(),
      ]);
      if (transactionsResult.success) setTransactions(transactionsResult.transactions || []);
      else toast({ variant: 'destructive', title: 'Erro ao carregar dados', description: transactionsResult.error });
      if (accountsResult.success) setAccounts(accountsResult.accounts || []);
      else toast({ variant: 'destructive', title: 'Erro ao carregar plano de contas', description: accountsResult.error });
      setLoading(false);
    };
    fetchFinancialData();
  }, [toast]);

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    const result = await deleteTransaction(deletingTransaction.id);
    if (result.success) {
      toast({ title: 'Transação excluída', description: `"${deletingTransaction.description}" foi removida.` });
      setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
    } else {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: result.error });
    }
    setDeletingTransaction(null);
  };

  const analysis = useMemo(() => {
    const filtered = transactions.filter((t) => {
      if (!dateRange?.from) return true;
      const transactionDate = new Date(t.transactionDate + 'T00:00:00');
      return isWithinInterval(transactionDate, {
        start: dateRange.from,
        end: dateRange.to || new Date(),
      });
    });

    const totalEntradas = filtered
      .filter((t) => t.type === 'entrada' && t.status === 'pago')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSaidas = filtered
      .filter((t) => t.type === 'saida' && t.status === 'pago')
      .reduce((sum, t) => sum + t.amount, 0);

    const resultadoLiquido = totalEntradas - totalSaidas;

    const monthlyData = filtered
      .filter(t => t.status === 'pago')
      .reduce((acc, t) => {
        const date = new Date(t.transactionDate + 'T00:00:00');
        const sortKey = date.getFullYear() * 100 + date.getMonth() + 1;
        const month = date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        if (!acc[sortKey]) acc[sortKey] = { name: month, entrada: 0, saida: 0, sortKey };
        acc[sortKey][t.type] += t.amount;
        return acc;
      }, {} as Record<number, { name: string; entrada: number; saida: number; sortKey: number }>);

    const chartData = Object.values(monthlyData)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey: _sk, ...rest }) => rest);

    const recentTransactions = filtered
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 10);

    return { totalEntradas, totalSaidas, resultadoLiquido, chartData, recentTransactions };
  }, [transactions, dateRange]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const isPositive = analysis.resultadoLiquido >= 0;

  return (
    <>
      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir permanentemente a transação &quot;{deletingTransaction?.description}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FinancialReportDialog
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
        transactions={transactions}
        accounts={accounts}
      />

      <div className="space-y-6 p-4 md:p-8">

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Visão Geral Financeira</h1>
              <p className="text-sm text-muted-foreground">Fluxo de caixa e resultados do período selecionado</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsReportDialogOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              Relatório PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/financeiro/editor?type=saida">
                <ArrowDownCircle className="mr-2 h-4 w-4 text-red-400" />
                Nova Despesa
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/financeiro/editor?type=entrada">
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Nova Receita
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium mr-1">Período:</span>
          {quickFilters.map(f => (
            <button
              key={f.value}
              onClick={() => applyQuickFilter(f.value)}
              className={cn(
                'h-7 px-3 text-xs rounded-full border transition-colors',
                activeFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-border mx-1">|</span>
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={formatDateForInput(dateRange?.from)}
            onChange={(e) => {
              const v = e.target.value;
              setActiveFilter('custom');
              setDateRange(prev => ({ ...prev, from: v ? new Date(v + 'T00:00:00') : undefined }));
            }}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={formatDateForInput(dateRange?.to)}
            onChange={(e) => {
              const v = e.target.value;
              setActiveFilter('custom');
              setDateRange(prev => ({ ...prev, to: v ? new Date(v + 'T23:59:59') : undefined }));
            }}
          />
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-t-2 border-t-green-500">
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                Total de Entradas
              </p>
              <p className="text-2xl font-bold font-mono text-green-400">{formatCurrency(analysis.totalEntradas)}</p>
              <p className="text-xs text-muted-foreground mt-1">Receitas pagas no período</p>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-red-500">
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                Total de Saídas
              </p>
              <p className="text-2xl font-bold font-mono text-red-400">{formatCurrency(analysis.totalSaidas)}</p>
              <p className="text-xs text-muted-foreground mt-1">Despesas pagas no período</p>
            </CardContent>
          </Card>
          <Card className={cn('border-t-2', isPositive ? 'border-t-primary' : 'border-t-destructive')}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Resultado Líquido
              </p>
              <p className={cn('text-2xl font-bold font-mono', isPositive ? 'text-primary' : 'text-destructive')}>
                {formatCurrency(analysis.resultadoLiquido)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Entradas − Saídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart + Recent transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Fluxo de Caixa Mensal
              </p>
              <CardDescription className="text-xs">Comparativo de entradas e saídas (valores pagos) por mês.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {analysis.chartData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado no período selecionado.
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={analysis.chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(value) => formatCurrency(value as number).replace('R$\u00a0', '').replace('R$', '')} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="entrada" fill="var(--color-entrada)" radius={4} />
                    <Bar dataKey="saida" fill="var(--color-saida)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <ArrowUpCircle className="h-3.5 w-3.5" />
                Transações Recentes
              </p>
              <CardDescription className="text-xs">Últimas movimentações no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.recentTransactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          {t.type === 'entrada'
                            ? <ArrowUpCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : <ArrowDownCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <div>
                            <div className="font-medium text-sm leading-tight">{t.description}</div>
                            <div className="text-xs text-muted-foreground">{t.category}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.transactionDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.status === 'pago' ? 'default' : 'outline'}
                          className={cn('text-xs', t.status === 'pago' ? 'bg-green-500/20 text-green-400 border-green-500/30' : '')}
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn('text-right font-mono font-semibold text-sm pr-6', t.type === 'entrada' ? 'text-green-400' : 'text-red-400')}>
                        {t.type === 'entrada' ? '+' : '−'} {formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {analysis.recentTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma transação no período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </>
  );
}

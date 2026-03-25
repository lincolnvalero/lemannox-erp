
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  DollarSign,
  FileDown,
  FilePenLine,
  MoreHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { isWithinInterval, startOfMonth, subMonths, format } from 'date-fns';
import { FinancialReportDialog } from '@/components/dashboard/financial-report-dialog';

const chartConfig = {
  entrada: { label: 'Entradas', color: 'hsl(var(--chart-2))' },
  saida: { label: 'Saídas', color: 'hsl(var(--chart-6))' },
};

type DateRange = {
  from?: Date;
  to?: Date;
};

export default function FinancialDashboardPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: new Date(),
  });
  
  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      const [transactionsResult, accountsResult] = await Promise.all([
        getTransactions(),
        getAccounts(),
      ]);

      if (transactionsResult.success) {
        setTransactions(transactionsResult.transactions || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: transactionsResult.error,
        });
      }
      
      if (accountsResult.success) {
        setAccounts(accountsResult.accounts || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar plano de contas',
          description: accountsResult.error,
        });
      }

      setLoading(false);
    };

    fetchFinancialData();
  }, [toast]);

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    const result = await deleteTransaction(deletingTransaction.id);
    if (result.success) {
        toast({ title: 'Transação Excluída', description: `A transação "${deletingTransaction.description}" foi removida.`});
        setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
    } else {
        toast({ variant: 'destructive', title: 'Erro ao Excluir', description: result.error });
    }
    setDeletingTransaction(null);
  };

  const analysis = useMemo(() => {
    const filtered = transactions.filter((t) => {
      if (!dateRange?.from) return true;
      const transactionDate = new Date(t.transactionDate);
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
            const month = new Date(t.transactionDate).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            if (!acc[month]) {
                acc[month] = { name: month, entrada: 0, saida: 0 };
            }
            acc[month][t.type] += t.amount;
            return acc;
        }, {} as Record<string, { name: string; entrada: number; saida: number }>);
    
    const chartData = Object.values(monthlyData).sort((a,b) => {
        const [mA, yA] = a.name.split('/');
        const [mB, yB] = b.name.split('/');
        const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const dateA = new Date(parseInt(`20${yA}`, 10), months.indexOf(mA.toLowerCase()));
        const dateB = new Date(parseInt(`20${yB}`, 10), months.indexOf(mB.toLowerCase()));
        return dateA.getTime() - dateB.getTime();
    });

    const recentTransactionsForDisplay = filtered.slice(0, 10);

    return {
      totalEntradas,
      totalSaidas,
      resultadoLiquido,
      chartData,
      recentTransactions: recentTransactionsForDisplay,
    };
  }, [transactions, dateRange]);

  if (loading) {
    return <Skeleton className="h-[80vh] w-full" />;
  }

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

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <CardTitle>Filtros do Dashboard</CardTitle>
                    <CardDescription>
                        Selecione um período para analisar o fluxo de caixa.
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                     <Button variant="secondary" onClick={() => setIsReportDialogOpen(true)}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Gerar Relatório em PDF
                    </Button>
                     <Button variant="outline" asChild>
                        <Link href="/financeiro/editor?type=saida">
                          <ArrowDownCircle className="mr-2 h-4 w-4" />
                          Nova Despesa
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/financeiro/editor?type=entrada">
                          <ArrowUpCircle className="mr-2 h-4 w-4" />
                          Nova Receita
                        </Link>
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date-from">De</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={formatDateForInput(dateRange?.from)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDateRange((prev) => ({
                      ...prev,
                      from: value ? new Date(value + "T00:00:00") : undefined,
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-to">Até</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={formatDateForInput(dateRange?.to)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDateRange((prev) => ({
                      ...prev,
                      to: value ? new Date(value + "T23:59:59") : undefined,
                    }));
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500 font-code">
                {formatCurrency(analysis.totalEntradas)}
              </div>
              <p className="text-xs text-muted-foreground">Receitas pagas no período</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500 font-code">
                {formatCurrency(analysis.totalSaidas)}
              </div>
              <p className="text-xs text-muted-foreground">Despesas pagas no período</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resultado Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold font-code',
                  analysis.resultadoLiquido >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatCurrency(analysis.resultadoLiquido)}
              </div>
              <p className="text-xs text-muted-foreground">Entradas - Saídas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader>
                <CardTitle>Fluxo de Caixa Mensal</CardTitle>
                <CardDescription>
                    Comparativo de entradas e saídas (valores pagos) por mês.
                </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart data={analysis.chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(value as number).replace('R$', '')} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="entrada" fill="var(--color-entrada)" radius={4} />
                    <Bar dataKey="saida" fill="var(--color-saida)" radius={4} />
                    </BarChart>
                </ChartContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                <CardTitle>Transações Recentes</CardTitle>
                <CardDescription>
                    As últimas movimentações financeiras no período selecionado.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead><span className="sr-only">Ações</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {analysis.recentTransactions.map(t => (
                            <TableRow key={t.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {t.type === 'entrada' ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
                                        <div className="font-medium">{t.description}</div>
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-6">{t.category}</div>
                                </TableCell>
                                <TableCell>{new Date(t.transactionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                <TableCell>
                                    <Badge variant={t.status === 'pago' ? 'default' : 'outline'} className={cn(t.status === 'pago' && 'bg-green-500/80')}>{t.status}</Badge>
                                </TableCell>
                                <TableCell className={cn("text-right font-code font-semibold", t.type === 'entrada' ? 'text-green-500' : 'text-red-500')}>
                                    {t.type === 'entrada' ? '+ ' : '- '} {formatCurrency(t.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/financeiro/editor/${t.id}`}>
                                                  <FilePenLine className="mr-2 h-4 w-4" />
                                                  <span>Editar</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingTransaction(t)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Excluir</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {analysis.recentTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
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

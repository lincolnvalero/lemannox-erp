
'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getQuotes } from './actions';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign,
  CheckCircle,
  TrendingUp,
  Send,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Quote } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';


const quoteStatuses: Quote['status'][] = [
  'rascunho',
  'enviado',
  'aprovado',
  'rejeitado',
  'faturado',
  'produzindo',
  'entregue',
];

function AnalysisSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    <Skeleton className="h-10 w-[200px]" />
                </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <Skeleton className="h-4 w-2/3" />
                           <Skeleton className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-7 w-1/2" />
                            <Skeleton className="h-3 w-3/4 mt-2" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="pl-2">
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

export default function QuoteAnalysisPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  
  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  useEffect(() => {
    async function fetchQuotes() {
      setLoading(true);
      const result = await getQuotes();
      if (result.success) {
        setQuotes(result.quotes || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar orçamentos',
          description: result.error,
        });
      }
      setLoading(false);
    }
    fetchQuotes();
  }, [toast]);

  const analysis = useMemo(() => {
    // 1. First, filter by the chosen date period. This is the base for KPIs.
    const periodFilteredQuotes = quotes.filter(quote => {
      if (!dateRange?.from) {
        return true; // No date filter, include all
      }
      
      const quoteDate = new Date(quote.date);
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);

      if (quoteDate < fromDate) {
        return false;
      }

      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (quoteDate > toDate) {
          return false;
        }
      }
      
      return true;
    });

    // 2. From the period-filtered list, calculate sent quotes for KPIs.
    const sentQuotes = periodFilteredQuotes.filter(q => q.status !== 'rascunho');
    const sentValue = sentQuotes.reduce((sum, q) => sum + q.total, 0);
    
    // 3. From the SAME period-filtered list, calculate approved quotes for KPIs.
    const approvedQuotes = periodFilteredQuotes.filter((q) =>
      ['aprovado', 'faturado', 'produzindo', 'entregue'].includes(q.status)
    );
    const approvedValue = approvedQuotes.reduce((sum, q) => sum + q.total, 0);

    // 4. Calculate other KPI metrics.
    const valueConversionRate = sentValue > 0 ? (approvedValue / sentValue) * 100 : 0;
    const averageTicket =
      approvedQuotes.length > 0 ? approvedValue / approvedQuotes.length : 0;
    
    // 5. Now, apply the status filter for the chart data.
    const chartSourceData =
      statusFilter && statusFilter !== 'all'
        ? periodFilteredQuotes.filter((q) => q.status === statusFilter)
        : periodFilteredQuotes;

    const monthlyData = chartSourceData.reduce((acc, quote) => {
      const month = new Date(quote.date).toLocaleString('pt-BR', {
        month: 'short',
      });
      const key =
        month.charAt(0).toUpperCase() + month.slice(1).replace('.', '');

      if (!acc[key]) {
        acc[key] = { name: key, total: 0, aprovado: 0 };
      }
      
      if (quote.status !== 'rascunho') {
        acc[key].total += quote.total;
      }
      if (['aprovado', 'faturado', 'produzindo', 'entregue'].includes(quote.status)) {
        acc[key].aprovado += quote.total;
      }

      return acc;
    }, {} as Record<string, { name: string; total: number; aprovado: number }>);
    
    const allMonths = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    
    const chartData = allMonths.map((monthName) => {
      return monthlyData[monthName] || { name: monthName, total: 0, aprovado: 0 };
    });

    return {
      sentQuotesCount: sentQuotes.length,
      approvedQuotesCount: approvedQuotes.length,
      sentValue,
      approvedValue,
      valueConversionRate,
      averageTicket,
      chartData,
    };
  }, [quotes, dateRange, statusFilter]);


  const chartConfig = {
    total: {
      label: 'Total Enviado',
      color: 'hsl(var(--muted-foreground))',
    },
    aprovado: {
      label: 'Aprovado',
      color: 'hsl(var(--primary))',
    },
  };
  
  if (loading) {
      return <AnalysisSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros da Análise</CardTitle>
          <CardDescription>
            Filtre os dados para analisar períodos ou status específicos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
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
                      from: value ? new Date(value + "T00:00:00") : undefined,
                      to: prev?.to,
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
                      from: prev?.from,
                      to: value ? new Date(value + "T23:59:59") : undefined,
                    }));
                  }}
                />
              </div>
            </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {quoteStatuses.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Enviado</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-code">
              {formatCurrency(analysis.sentValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              em {analysis.sentQuotesCount} orçamentos enviados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor Total Aprovado
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-code">
              {formatCurrency(analysis.approvedValue)}
            </div>
            <p className="text-xs text-muted-foreground">
             em {analysis.approvedQuotesCount} orçamentos aprovados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Conversão (Valor)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-code">
              {analysis.valueConversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              R$ Aprovado / R$ Enviado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ticket Médio (Aprovado)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-code">
              {formatCurrency(analysis.averageTicket)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor médio por projeto ganho
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Desempenho Mensal</CardTitle>
          <CardDescription>
            Total enviado vs. total aprovado por mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={analysis.chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  formatCurrency(value as number).replace('R$', '')
                }
                tickMargin={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {
                            chartConfig[name as keyof typeof chartConfig]
                              .label
                          }
                        </span>
                        <span className="font-bold">
                          {formatCurrency(value as number)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="aprovado"
                fill="var(--color-aprovado)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

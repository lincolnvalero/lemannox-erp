'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import type { DateRange } from 'react-day-picker';
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
import { getSuppliers } from '../actions';
import type { Supplier } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  DollarSign,
  Star,
  Building2,
  Package,
  FileDown
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { ExportSuppliersPdfDialog } from '@/components/dashboard/export-suppliers-pdf-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function DashboardSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <Skeleton className="h-10 w-[260px]" />
                    <Skeleton className="h-10 w-[260px]" />
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
            <div className="grid gap-4 md:grid-cols-2">
                <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
            </div>
            <Card><CardContent className="p-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
        </div>
    )
}


export default function SupplierDashboardPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const { toast } = useToast();

  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };
  
  useEffect(() => {
    async function fetchSuppliers() {
      setLoading(true);
      const result = await getSuppliers();
      if (result.success) {
        setSuppliers(result.suppliers || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Carregar Fornecedores',
          description: result.error,
        });
      }
      setLoading(false);
    }
    fetchSuppliers();
  }, [toast]);

  const supplierOptions: ComboboxOption[] = useMemo(() => ([
    { value: 'all', label: 'Todos os Fornecedores' },
    ...suppliers.map(s => ({ value: s.id, label: s.name }))
  ]), [suppliers]);

  const filteredData = useMemo(() => {
    let data = [...suppliers];
    
    if (dateRange?.from) {
        data = data.filter(s => {
            const joinDate = new Date(s.joinDate ?? '');
            const from = new Date(dateRange.from!);
            from.setHours(0,0,0,0);
            
            if(dateRange.to) {
                const to = new Date(dateRange.to);
                to.setHours(23,59,59,999);
                return joinDate >= from && joinDate <= to;
            }
            return joinDate >= from;
        });
    }

    if(selectedSupplier && selectedSupplier !== 'all') {
        data = data.filter(s => s.id === selectedSupplier);
    }
    
    return data;
  }, [suppliers, dateRange, selectedSupplier]);

  const analysis = useMemo(() => {
    const data = filteredData;
    const totalSuppliers = data.length;
    const totalSpent = data.reduce((sum, s) => sum + (s.totalSpent ?? 0), 0);
    const bestSupplier = data.length > 0 ? data.reduce(
      (best, current) => ((current.rating ?? 0) > (best.rating ?? 0) ? current : best),
      data[0]
    ) : null;
    const newSuppliersCount = data.filter(
      (s) => new Date(s.joinDate ?? '') > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    const suppliersByCategory = data.reduce((acc, supplier) => {
      acc[supplier.category] = (acc[supplier.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryChartData = Object.entries(suppliersByCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const spendingByCategory = data.reduce((acc, supplier) => {
      acc[supplier.category] = (acc[supplier.category] || 0) + (supplier.totalSpent ?? 0);
      return acc;
    }, {} as Record<string, number>);

    const spendingChartData = Object.entries(spendingByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topSuppliers = [...data]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    const performanceChartData = topSuppliers.map((supplier) => ({
      subject: supplier.name,
      price: supplier.performance?.price ?? 0,
      quality: supplier.performance?.quality ?? 0,
      delivery: supplier.performance?.delivery ?? 0,
      fullMark: 5,
    }));

    return {
      totalSuppliers,
      totalSpent,
      bestSupplier,
      newSuppliersCount,
      categoryChartData,
      spendingChartData,
      performanceChartData,
      topSuppliers,
    };
  }, [filteredData]);

  const chartConfig = {
    count: { label: 'Fornecedores' },
    value: { label: 'Gasto' },
    price: { label: 'Preço', color: 'hsl(var(--chart-1))' },
    quality: { label: 'Qualidade', color: 'hsl(var(--chart-2))' },
    delivery: { label: 'Entrega', color: 'hsl(var(--chart-3))' },
  };

  if (loading) {
      return <DashboardSkeleton />
  }

  return (
    <>
    <ExportSuppliersPdfDialog 
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        suppliers={filteredData}
    />
    <div className="space-y-4">
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>Filtros do Dashboard</CardTitle>
                        <CardDescription>
                            Filtre os dados para analisar períodos ou fornecedores específicos.
                        </CardDescription>
                    </div>
                     <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exportar PDF
                    </Button>
                </div>
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
                <Combobox 
                    options={supplierOptions}
                    value={selectedSupplier}
                    onChange={setSelectedSupplier}
                    placeholder="Selecione um fornecedor"
                    searchPlaceholder="Buscar fornecedor..."
                    emptyPlaceholder="Nenhum fornecedor encontrado."
                    className="w-[260px]"
                />
            </CardContent>
        </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fornecedores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              +{analysis.newSuppliersCount} nos últimos 30 dias
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-code">
              {formatCurrency(analysis.totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              Soma de todos os pedidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias Únicas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.categoryChartData.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Diversidade de fornecimento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Avaliado</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{analysis.bestSupplier?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              Nota: {analysis.bestSupplier?.rating.toFixed(1) || '0.0'} de 5
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fornecedores por Categoria</CardTitle>
            <CardDescription>
              Distribuição dos fornecedores nas principais categorias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={analysis.categoryChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={<ChartTooltipContent />}
                />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gasto por Categoria</CardTitle>
            <CardDescription>
              Percentual do gasto total para cada categoria de fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <PieChart>
                <Tooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <Pie data={analysis.spendingChartData} dataKey="value" nameKey="name" innerRadius={60} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {analysis.spendingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Análise de Desempenho (Top 5 Fornecedores)</CardTitle>
            <CardDescription>Comparativo de preço, qualidade e prazo de entrega dos principais fornecedores em gasto.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <RadarChart data={analysis.performanceChartData}>
                  <CartesianGrid />
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Radar name="Preço" dataKey="price" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.6} />
                  <Radar name="Qualidade" dataKey="quality" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.6} />
                  <Radar name="Entrega" dataKey="delivery" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ChartContainer>
            </div>
             <div className="flex flex-col justify-center space-y-4">
                <h4 className="font-semibold text-center lg:text-left">Legenda do Desempenho</h4>
                <p className="text-sm text-muted-foreground">
                    Cada eixo do gráfico de radar representa um critério de 1 a 5. Valores mais altos são melhores (ex: 5 em "Preço" significa custo baixo).
                </p>
                <Separator />
                {analysis.topSuppliers.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                        {analysis.topSuppliers.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                <span>{s.name}</span>
                                <span className="ml-auto font-mono text-xs text-muted-foreground">{formatCurrency(s.totalSpent)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-center text-muted-foreground lg:text-left">Nenhum fornecedor para exibir.</p>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}

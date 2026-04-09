'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getReportData, type ReportData } from './actions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  rejeitado: 'Rejeitado', faturado: 'Faturado', produzindo: 'Produzindo', entregue: 'Entregue',
};
const statusColor: Record<string, string> = {
  aprovado: 'bg-green-500/20 text-green-400', produzindo: 'bg-orange-500/20 text-orange-400',
  entregue: 'bg-cyan-500/20 text-cyan-400', faturado: 'bg-primary/20 text-primary',
  enviado: 'bg-blue-500/20 text-blue-400', rascunho: 'bg-gray-500/20 text-gray-400',
  rejeitado: 'bg-red-500/20 text-red-400',
};

export default function RelatoriosPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState('6');

  const load = async (m = months) => {
    setLoading(true);
    const result = await getReportData(Number(m));
    if (result.success && result.data) setData(result.data);
    else toast({ variant: 'destructive', title: 'Erro', description: result.error });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const SkCard = () => <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={months} onValueChange={(v) => { setMonths(v); load(v); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Resumo Financeiro */}
      {loading ? <div className="grid gap-4 grid-cols-2 md:grid-cols-5"><SkCard /><SkCard /><SkCard /><SkCard /><SkCard /></div> : data && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Entradas (pagas)</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-bold text-green-400">{fmt(data.resumoFinanceiro.totalEntradas)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Saídas (pagas)</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-bold text-red-400">{fmt(data.resumoFinanceiro.totalSaidas)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Resultado Líquido</CardDescription></CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5">
                {data.resumoFinanceiro.resultado >= 0
                  ? <TrendingUp className="h-4 w-4 text-green-400" />
                  : <TrendingDown className="h-4 w-4 text-red-400" />}
                <p className={`text-xl font-bold ${data.resumoFinanceiro.resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(data.resumoFinanceiro.resultado)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>A Receber (pendente)</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-bold text-blue-400">{fmt(data.resumoFinanceiro.aReceber)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>A Pagar (pendente)</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-bold text-orange-400">{fmt(data.resumoFinanceiro.aPagar)}</p></CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Faturamento Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento Mensal</CardTitle>
            <CardDescription>Valor dos orçamentos aprovados por mês</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : data && data.faturamentoMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.faturamentoMensal}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" fill="#4F8CFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12 text-sm">Nenhum orçamento aprovado no período.</p>}
          </CardContent>
        </Card>

        {/* Status dos Orçamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos por Status</CardTitle>
            <CardDescription>Distribuição dos orçamentos no período</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.statusOrcamentos.map(s => (
                    <TableRow key={s.status}>
                      <TableCell><Badge className={statusColor[s.status] ?? ''}>{statusLabel[s.status] ?? s.status}</Badge></TableCell>
                      <TableCell className="text-center font-mono">{s.count}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(s.total)}</TableCell>
                    </TableRow>
                  ))}
                  {data.statusOrcamentos.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes</CardTitle>
            <CardDescription>Clientes com maior volume de orçamentos aprovados</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topClientes.map((c, i) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">
                        <span className="text-muted-foreground mr-2 font-mono text-xs">#{i + 1}</span>
                        {c.name}
                      </TableCell>
                      <TableCell className="text-center font-mono">{c.count}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(c.total)}</TableCell>
                    </TableRow>
                  ))}
                  {data.topClientes.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produtos</CardTitle>
            <CardDescription>Produtos mais vendidos por receita gerada</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProdutos.map((p, i) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">
                        <span className="text-muted-foreground mr-2 font-mono text-xs">#{i + 1}</span>
                        {p.name}
                      </TableCell>
                      <TableCell className="text-center font-mono">{fmtN(p.quantidade)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  {data.topProdutos.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Estoque */}
      {data && data.materiaisAbaixoMinimo.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              <CardTitle className="text-orange-400">Materiais Abaixo do Estoque Mínimo</CardTitle>
            </div>
            <CardDescription>Ação necessária para não interromper a produção</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-center">Estoque Atual</TableHead>
                  <TableHead className="text-center">Mínimo</TableHead>
                  <TableHead className="text-center">Deficit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.materiaisAbaixoMinimo.map(m => (
                  <TableRow key={m.name} className="bg-orange-500/5">
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-center text-red-400 font-mono">{fmtN(m.quantity)} {m.unit}</TableCell>
                    <TableCell className="text-center font-mono">{fmtN(m.minQuantity)} {m.unit}</TableCell>
                    <TableCell className="text-center text-orange-400 font-mono">-{fmtN(m.minQuantity - m.quantity)} {m.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

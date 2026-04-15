import { createClient } from '@/lib/supabase-server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown,
  FileText, Factory, BarChart3, AlertTriangle, Clock,
} from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function rangeLabel(from: string, to: string) {
  if (!from && !to) return 'Todos os períodos';
  if (from && to) return `${fmtDate(from)} — ${fmtDate(to)}`;
  if (from) return `A partir de ${fmtDate(from)}`;
  return `Até ${fmtDate(to)}`;
}

async function getDashboardData(from: string, to: string) {
  const supabase = await createClient();

  let recentQ = supabase
    .from('quotes')
    .select('id, quote_number, customer_name, total, status, date')
    .order('quote_number', { ascending: false })
    .limit(8);
  if (from) recentQ = recentQ.gte('date', from);
  if (to)   recentQ = recentQ.lte('date', to);

  const [
    recentQuotesRes,
    allQuotesRes,
    allTxRes,
    customersRes,
    productsRes,
    osRes,
    upcomingPayRes,
  ] = await Promise.all([
    recentQ,
    supabase.from('quotes').select('total, status, date'),
    supabase.from('financial_transactions').select('amount, type, status'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('ordens_servico')
      .select('*', { count: 'exact', head: true })
      .in('status', ['aberta', 'em_producao', 'em_andamento']),
    supabase
      .from('financial_transactions')
      .select('id, description, amount, due_date')
      .eq('type', 'saida')
      .eq('status', 'pendente')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(6),
  ]);

  // ── Quote stats for selected range ────────────────────────────────────────
  const allQ = allQuotesRes.data ?? [];
  const periodQ = allQ.filter(q => {
    if (from && q.date < from) return false;
    if (to   && q.date > to)   return false;
    return true;
  });

  const quoteStats = {
    total:      periodQ.length,
    aprovados:  periodQ.filter(q => q.status === 'aprovado').length,
    emProducao: periodQ.filter(q => q.status === 'produzindo').length,
    faturados:  periodQ.filter(q => q.status === 'faturado').length,
    valorTotal: periodQ.reduce((s, q) => s + (Number(q.total) || 0), 0),
  };

  // ── Ticket médio (all-time, status produtivo) ─────────────────────────────
  const activeQ = allQ.filter(q =>
    ['aprovado', 'faturado', 'produzindo', 'entregue'].includes(q.status)
  );
  const ticketMedio = activeQ.length > 0
    ? activeQ.reduce((s, q) => s + (Number(q.total) || 0), 0) / activeQ.length
    : 0;

  // ── Taxa de conversão do range ────────────────────────────────────────────
  const sentOrApproved = periodQ.filter(q =>
    ['enviado', 'aprovado', 'produzindo', 'faturado', 'entregue', 'rejeitado'].includes(q.status)
  );
  const taxaConversao = sentOrApproved.length > 0
    ? Math.round(
        periodQ.filter(q =>
          ['aprovado', 'produzindo', 'faturado', 'entregue'].includes(q.status)
        ).length / sentOrApproved.length * 100
      )
    : null;

  // ── Financeiro ─────────────────────────────────────────────────────────────
  const allTx   = allTxRes.data ?? [];
  const txPagas = allTx.filter(t => t.status === 'pago');
  const entradas = txPagas.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const saidas   = txPagas.filter(t => t.type === 'saida').reduce((s,   t) => s + Number(t.amount), 0);
  const aReceber = allTx.filter(t => t.status === 'pendente' && t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const aPagar   = allTx.filter(t => t.status === 'pendente' && t.type === 'saida').reduce((s,   t) => s + Number(t.amount), 0);

  return {
    recentQuotes:     recentQuotesRes.data ?? [],
    upcomingPayments: upcomingPayRes.data  ?? [],
    customerCount:    customersRes.count   ?? 0,
    productCount:     productsRes.count    ?? 0,
    osCount:          osRes.count          ?? 0,
    quoteStats,
    ticketMedio,
    taxaConversao,
    financeiro: { entradas, saidas, saldo: entradas - saidas, aReceber, aPagar },
  };
}

// ── Status maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  rejeitado: 'Rejeitado', faturado: 'Faturado', produzindo: 'Em Prod.', entregue: 'Entregue',
};
const STATUS_CLS: Record<string, string> = {
  rascunho:  'bg-gray-500/20 text-gray-400 border-gray-500/30',
  enviado:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  aprovado:  'bg-green-500/20 text-green-400 border-green-500/30',
  rejeitado: 'bg-red-500/20 text-red-400 border-red-500/30',
  faturado:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  produzindo:'bg-orange-500/20 text-orange-400 border-orange-500/30',
  entregue:  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

function dueDateAlert(dueDate: string | null) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate + 'T00:00:00');
  const diff  = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `Vencido há ${Math.abs(diff)}d`, cls: 'text-red-400' };
  if (diff === 0) return { label: 'Vence hoje', cls: 'text-orange-400' };
  if (diff <= 7)  return { label: `${diff}d`,   cls: 'text-yellow-400' };
  return { label: `${diff}d`, cls: 'text-muted-foreground' };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const now = new Date();
  const todayStr    = now.toISOString().split('T')[0];
  const monthStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { from = monthStart, to = todayStr } = await searchParams;

  const data = await getDashboardData(from, to);
  const { financeiro: fin, quoteStats: qs } = data;
  const label = rangeLabel(from, to);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-6 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>

      <main className="flex-1 space-y-6 p-4 md:p-6">

        {/* ── Row 1: Financeiro ────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo em Caixa</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${fin.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(fin.saldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Entradas: {formatCurrency(fin.entradas)} · Saídas: {formatCurrency(fin.saidas)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-yellow-400">
                {formatCurrency(fin.aReceber)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Transações pendentes de entrada</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-red-400">
                {formatCurrency(fin.aPagar)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Despesas pendentes de quitação</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Operacional ───────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">

          {/* Orçamentos com date range filter */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Orçamentos
                </CardTitle>
                <DateRangeFilter from={from} to={to} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qs.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {qs.aprovados} aprovados · {qs.emProducao} em prod. · {qs.faturados} faturados
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Volume: {formatCurrency(qs.valorTotal)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Produção</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-400">{data.osCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Ordens de serviço ativas</p>
              <Link href="/os" className="text-xs text-primary hover:underline mt-0.5 block">Ver todas →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {data.ticketMedio > 0 ? formatCurrency(data.ticketMedio) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Orçamentos aprovados / em produção</p>
              {data.taxaConversao !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conversão no período:{' '}
                  <span className="text-green-400 font-medium">{data.taxaConversao}%</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom: tabelas ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orçamentos Recentes</CardTitle>
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum orçamento no período.
                </p>
              ) : (
                <div>
                  {data.recentQuotes.map((q: Record<string, unknown>) => (
                    <Link
                      key={q.id as string}
                      href={`/quotes/editor/${q.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">
                          #{q.quote_number as number}
                        </span>
                        <span className="text-sm truncate">{q.customer_name as string}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${STATUS_CLS[q.status as string] || ''}`}>
                          {STATUS_LABEL[q.status as string] || (q.status as string)}
                        </Badge>
                        <span className="text-sm font-mono font-medium w-24 text-right">
                          {formatCurrency(q.total as number)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos Vencimentos</CardTitle>
              <CardDescription>Contas a pagar ordenadas por vencimento</CardDescription>
            </CardHeader>
            <CardContent>
              {data.upcomingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conta a pagar pendente.
                </p>
              ) : (
                <div>
                  {data.upcomingPayments.map((t: Record<string, unknown>) => {
                    const alert    = dueDateAlert(t.due_date as string | null);
                    const isOverdue = t.due_date && new Date((t.due_date as string) + 'T00:00:00') < new Date();
                    return (
                      <div
                        key={t.id as string}
                        className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOverdue
                            ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            : <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-sm truncate">{t.description as string}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {alert && <span className={`text-xs font-medium ${alert.cls}`}>{alert.label}</span>}
                          <span className="text-sm font-mono font-medium text-red-400 w-24 text-right">
                            {formatCurrency(t.amount as number)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2">
                    <Link href="/financeiro/pagar" className="text-xs text-primary hover:underline">
                      Ver todas as contas a pagar →
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

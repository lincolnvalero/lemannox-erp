import { createClient } from '@/lib/supabase-server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, FileText, Users, Package, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';

async function getDashboardData() {
  const supabase = await createClient();

  const [quotesRes, transactionsRes, customersRes, productsRes] = await Promise.all([
    supabase.from('quotes').select('id, quote_number, customer_name, total, status, date').order('quote_number', { ascending: false }).limit(5),
    supabase.from('financial_transactions').select('id, description, amount, type, transaction_date, status').order('id_lanc', { ascending: false }).limit(5),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
  ]);

  const allQuotes = await supabase.from('quotes').select('total, status');
  const allTx = await supabase.from('financial_transactions').select('amount, type, status');

  const quoteStats = {
    total: allQuotes.data?.length || 0,
    aprovados: allQuotes.data?.filter(q => q.status === 'aprovado').length || 0,
    produzindo: allQuotes.data?.filter(q => q.status === 'produzindo').length || 0,
    faturados: allQuotes.data?.filter(q => q.status === 'faturado').length || 0,
    valorTotal: allQuotes.data?.reduce((acc, q) => acc + (Number(q.total) || 0), 0) || 0,
  };

  const txPagas = allTx.data?.filter(t => t.status === 'pago') || [];
  const entradas = txPagas.filter(t => t.type === 'entrada').reduce((acc, t) => acc + Number(t.amount), 0);
  const saidas = txPagas.filter(t => t.type === 'saida').reduce((acc, t) => acc + Number(t.amount), 0);
  const pendente = allTx.data?.filter(t => t.status === 'pendente').reduce((acc, t) => acc + Number(t.amount), 0) || 0;

  return {
    recentQuotes: quotesRes.data || [],
    recentTransactions: transactionsRes.data || [],
    customerCount: customersRes.count || 0,
    productCount: productsRes.count || 0,
    quoteStats,
    financeiro: { entradas, saidas, saldo: entradas - saidas, pendente },
  };
}

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  rejeitado: 'Rejeitado', faturado: 'Faturado', produzindo: 'Produzindo', entregue: 'Entregue',
};

const statusColor: Record<string, string> = {
  rascunho: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  enviado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  aprovado: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejeitado: 'bg-red-500/20 text-red-400 border-red-500/30',
  faturado: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  produzindo: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  entregue: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>

      <main className="flex-1 space-y-6 p-4 md:p-8">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Financeiro</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${data.financeiro.saldo >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                {formatCurrency(data.financeiro.saldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Entradas: {formatCurrency(data.financeiro.entradas)} · Saídas: {formatCurrency(data.financeiro.saidas)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-yellow-400">{formatCurrency(data.financeiro.pendente)}</div>
              <p className="text-xs text-muted-foreground mt-1">Transações pendentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.quoteStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.quoteStats.aprovados} aprovados · {data.quoteStats.produzindo} em produção
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes / Produtos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.customerCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.productCount} produtos cadastrados</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orçamentos Recentes</CardTitle>
              <CardDescription>Últimos orçamentos criados</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento ainda.</p>
              ) : (
                <div className="space-y-3">
                  {data.recentQuotes.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">#{q.quote_number}</span>
                        <span className="text-sm truncate">{q.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${statusColor[q.status] || ''}`}>
                          {statusLabel[q.status] || q.status}
                        </Badge>
                        <span className="text-sm font-mono font-medium">{formatCurrency(q.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transações Recentes</CardTitle>
              <CardDescription>Últimas movimentações financeiras</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação ainda.</p>
              ) : (
                <div className="space-y-3">
                  {data.recentTransactions.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {t.type === 'entrada'
                          ? <TrendingUp className="h-4 w-4 text-green-400 shrink-0" />
                          : <TrendingDown className="h-4 w-4 text-destructive shrink-0" />}
                        <span className="text-sm truncate">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.status === 'pendente' && <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>}
                        <span className={`text-sm font-mono font-medium ${t.type === 'entrada' ? 'text-green-400' : 'text-destructive'}`}>
                          {t.type === 'entrada' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

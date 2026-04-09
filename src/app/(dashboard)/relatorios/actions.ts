'use server';

import { createClient } from '@/lib/supabase-server';

export type ReportData = {
  faturamentoMensal: { mes: string; total: number; quantidade: number }[];
  topClientes: { name: string; total: number; count: number }[];
  topProdutos: { name: string; quantidade: number; total: number }[];
  resumoFinanceiro: {
    totalEntradas: number;
    totalSaidas: number;
    resultado: number;
    aPagar: number;
    aReceber: number;
  };
  materiaisAbaixoMinimo: { name: string; quantity: number; minQuantity: number; unit: string }[];
  statusOrcamentos: { status: string; count: number; total: number }[];
};

export async function getReportData(months = 6): Promise<{ success: boolean; data?: ReportData; error?: string }> {
  try {
    const supabase = await createClient();
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().split('T')[0];

    const [quotesRes, transactionsRes, materialsRes] = await Promise.all([
      supabase.from('quotes').select('*').gte('date', sinceStr),
      supabase.from('financial_transactions').select('*').gte('transaction_date', sinceStr),
      supabase.from('materials').select('name, quantity, min_quantity, unit'),
    ]);

    const quotes = quotesRes.data ?? [];
    const transactions = transactionsRes.data ?? [];
    const materials = materialsRes.data ?? [];

    // Faturamento mensal por data do orçamento aprovado/entregue
    const monthMap = new Map<string, { total: number; quantidade: number }>();
    for (const q of quotes) {
      if (['aprovado', 'produzindo', 'entregue', 'faturado'].includes(q.status)) {
        const mes = q.date.substring(0, 7); // YYYY-MM
        const prev = monthMap.get(mes) ?? { total: 0, quantidade: 0 };
        monthMap.set(mes, { total: prev.total + (q.total ?? 0), quantidade: prev.quantidade + 1 });
      }
    }
    const faturamentoMensal = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({
        mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        ...v,
      }));

    // Top 5 clientes por total de orçamentos aprovados
    const clienteMap = new Map<string, { total: number; count: number }>();
    for (const q of quotes) {
      if (['aprovado', 'produzindo', 'entregue', 'faturado'].includes(q.status)) {
        const prev = clienteMap.get(q.customer_name) ?? { total: 0, count: 0 };
        clienteMap.set(q.customer_name, { total: prev.total + (q.total ?? 0), count: prev.count + 1 });
      }
    }
    const topClientes = Array.from(clienteMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5)
      .map(([name, v]) => ({ name, ...v }));

    // Top 5 produtos (por nome do item nos orçamentos)
    const prodMap = new Map<string, { quantidade: number; total: number }>();
    for (const q of quotes) {
      if (['aprovado', 'produzindo', 'entregue', 'faturado'].includes(q.status)) {
        const items = Array.isArray(q.items) ? q.items : [];
        for (const item of items) {
          const name = (item as Record<string, unknown>).name as string ?? 'Sem nome';
          const qty = Number((item as Record<string, unknown>).quantity ?? 0);
          const total = Number((item as Record<string, unknown>).total ?? 0);
          const prev = prodMap.get(name) ?? { quantidade: 0, total: 0 };
          prodMap.set(name, { quantidade: prev.quantidade + qty, total: prev.total + total });
        }
      }
    }
    const topProdutos = Array.from(prodMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5)
      .map(([name, v]) => ({ name, ...v }));

    // Resumo financeiro
    const pagas = transactions.filter(t => t.status === 'pago');
    const pendentes = transactions.filter(t => t.status === 'pendente');
    const resumoFinanceiro = {
      totalEntradas: pagas.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0),
      totalSaidas: pagas.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0),
      resultado: 0,
      aPagar: pendentes.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0),
      aReceber: pendentes.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0),
    };
    resumoFinanceiro.resultado = resumoFinanceiro.totalEntradas - resumoFinanceiro.totalSaidas;

    // Materiais abaixo do mínimo
    const materiaisAbaixoMinimo = materials
      .filter(m => m.min_quantity > 0 && m.quantity <= m.min_quantity)
      .map(m => ({ name: m.name, quantity: m.quantity, minQuantity: m.min_quantity, unit: m.unit }));

    // Status dos orçamentos
    const statusMap = new Map<string, { count: number; total: number }>();
    for (const q of quotes) {
      const prev = statusMap.get(q.status) ?? { count: 0, total: 0 };
      statusMap.set(q.status, { count: prev.count + 1, total: prev.total + (q.total ?? 0) });
    }
    const statusOrcamentos = Array.from(statusMap.entries())
      .map(([status, v]) => ({ status, ...v }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      data: { faturamentoMensal, topClientes, topProdutos, resumoFinanceiro, materiaisAbaixoMinimo, statusOrcamentos },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar relatórios';
    return { success: false, error: message };
  }
}

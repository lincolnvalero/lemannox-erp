'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';

function rowToTransaction(row: Record<string, unknown>): FinancialTransaction {
  return {
    id: row.id as string,
    idLanc: row.id_lanc as number | undefined,
    description: row.description as string,
    amount: row.amount as number,
    type: row.type as FinancialTransaction['type'],
    category: row.category as string,
    transactionDate: row.transaction_date as string,
    dueDate: (row.due_date as string) || undefined,
    status: row.status as FinancialTransaction['status'],
    relatedType: (row.related_type as string) || undefined,
    relatedId: (row.related_id as string) || undefined,
  };
}

function rowToAccount(row: Record<string, unknown>): ChartOfAccount {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as ChartOfAccount['type'],
  };
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<{
  success: boolean;
  transactions?: FinancialTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('id_lanc', { ascending: false });

    if (error) throw error;

    return { success: true, transactions: (data ?? []).map(rowToTransaction) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar lançamentos';
    return { success: false, error: message };
  }
}

// Busca transações por origem (related_type).
// 'caixa' inclui os lançamentos legados marcados como 'manual'.
export async function getTransactionsBySource(sources: string[]): Promise<{
  success: boolean;
  transactions?: FinancialTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    // Para 'caixa', inclui também os registros legados ('manual')
    const effectiveSources = sources.includes('caixa')
      ? [...sources, 'manual']
      : sources;

    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .in('related_type', effectiveSources)
      .order('transaction_date', { ascending: false })
      .order('id_lanc', { ascending: false });

    if (error) throw error;

    return { success: true, transactions: (data ?? []).map(rowToTransaction) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar lançamentos';
    return { success: false, error: message };
  }
}

export async function getTransaction(id: string): Promise<{
  success: boolean;
  transaction?: FinancialTransaction;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { success: true, transaction: rowToTransaction(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar lançamento';
    return { success: false, error: message };
  }
}

export async function upsertTransaction(formData: FormData): Promise<{
  success: boolean;
  transaction?: FinancialTransaction;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;

    // 'source' identifica a origem do lançamento (caixa | conta_pagar | conta_receber).
    // Garante que edições via editor preservem a origem original.
    const source = (formData.get('source') as string) || null;

    const payload: Record<string, unknown> = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type') as string,
      category: formData.get('category') as string,
      transaction_date: formData.get('transactionDate') as string,
      due_date: (formData.get('dueDate') as string) || null,
      status: formData.get('status') as string,
    };

    // Só sobrescreve related_type se uma origem explícita foi fornecida
    if (source) payload.related_type = source;

    if (id) payload.id = id;

    const { data, error } = await supabase
      .from('financial_transactions')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/financeiro', 'layout');
    return { success: true, transaction: rowToTransaction(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar lançamento';
    return { success: false, error: message };
  }
}

export async function getPendingTransactions(type: 'entrada' | 'saida'): Promise<{
  success: boolean;
  transactions?: FinancialTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('type', type)
      .eq('status', 'pendente')
      .order('due_date', { ascending: true });

    if (error) throw error;
    return { success: true, transactions: (data ?? []).map(rowToTransaction) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar lançamentos pendentes';
    return { success: false, error: message };
  }
}

export async function markAsPaid(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('financial_transactions')
      .update({ status: 'pago', transaction_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/financeiro', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao marcar como pago';
    return { success: false, error: message };
  }
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/financeiro', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir lançamento';
    return { success: false, error: message };
  }
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export async function getAccounts(): Promise<{
  success: boolean;
  accounts?: ChartOfAccount[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return { success: true, accounts: (data ?? []).map(rowToAccount) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar plano de contas';
    return { success: false, error: message };
  }
}

export async function upsertAccount(formData: FormData): Promise<{
  success: boolean;
  account?: ChartOfAccount;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;

    const payload: Record<string, unknown> = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
    };

    if (id) payload.id = id;

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/financeiro', 'layout');
    return { success: true, account: rowToAccount(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar conta';
    return { success: false, error: message };
  }
}

// ── Baixa de Contas a Receber via Controle do Caixa ─────────────────────────

// Busca o lançamento pendente de Contas a Receber vinculado a um número de
// Pedido (orçamento), para o Caixa oferecer a baixa automática.
export async function findReceivableByQuoteNumber(quoteNumber: number): Promise<{
  success: boolean;
  receivable?: {
    transactionId: string;
    quoteId: string;
    customerLabel: string;
    pendingAmount: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, trade_name, customer_name')
      .eq('quote_number', quoteNumber)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quote) return { success: false, error: `Pedido #${quoteNumber} não encontrado.` };

    const { data: tx, error: txError } = await supabase
      .from('financial_transactions')
      .select('id, amount')
      .eq('related_type', 'conta_receber')
      .eq('related_id', quote.id)
      .eq('status', 'pendente')
      .maybeSingle();

    if (txError) throw txError;
    if (!tx) return { success: false, error: `Pedido #${quoteNumber} não tem Contas a Receber pendente.` };

    return {
      success: true,
      receivable: {
        transactionId: tx.id,
        quoteId: quote.id,
        customerLabel: (quote as { trade_name?: string; customer_name?: string }).trade_name
          || (quote as { customer_name?: string }).customer_name
          || 'Cliente',
        pendingAmount: tx.amount,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar Contas a Receber do pedido';
    return { success: false, error: message };
  }
}

// Lança o recebimento no Caixa e dá baixa (total ou parcial) no Contas a
// Receber vinculado. Se o valor recebido zerar o saldo, o status vira "pago"
// (Quitado); se sobrar saldo, o lançamento original é atualizado com o valor
// restante e continua "pendente".
export async function receiveAgainstQuote(input: {
  transactionId: string;
  amount: number;
  description: string;
  category: string;
  transactionDate: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: receivable, error: fetchError } = await supabase
      .from('financial_transactions')
      .select('id, amount, related_id')
      .eq('id', input.transactionId)
      .single();

    if (fetchError) throw fetchError;

    const remaining = Math.round((receivable.amount - input.amount) * 100) / 100;

    // Lançamento de entrada no Caixa (é este que compõe o saldo do Caixa).
    const { error: insertError } = await supabase.from('financial_transactions').insert({
      description: input.description,
      amount: input.amount,
      type: 'entrada',
      category: input.category,
      transaction_date: input.transactionDate,
      status: 'pago',
      related_type: 'caixa',
      related_id: receivable.related_id,
    });
    if (insertError) throw insertError;

    // Baixa no Contas a Receber original.
    if (remaining <= 0.01) {
      const { error: updateError } = await supabase
        .from('financial_transactions')
        .update({ status: 'pago', amount: 0 })
        .eq('id', receivable.id);
      if (updateError) throw updateError;
    } else {
      const { error: updateError } = await supabase
        .from('financial_transactions')
        .update({ amount: remaining })
        .eq('id', receivable.id);
      if (updateError) throw updateError;
    }

    revalidatePath('/financeiro', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar recebimento';
    return { success: false, error: message };
  }
}

export async function deleteAccount(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/financeiro', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir conta';
    return { success: false, error: message };
  }
}

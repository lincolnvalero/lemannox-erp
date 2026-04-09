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

    const payload: Record<string, unknown> = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type') as string,
      category: formData.get('category') as string,
      transaction_date: formData.get('transactionDate') as string,
      due_date: (formData.get('dueDate') as string) || null,
      status: formData.get('status') as string,
      related_type: 'manual',
    };

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

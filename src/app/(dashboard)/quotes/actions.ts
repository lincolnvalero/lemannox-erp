'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Quote, QuoteItem } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cria o lançamento em Contas a Receber na primeira vez que um orçamento é
// aprovado. Idempotente por related_id — se já existir um lançamento para
// este orçamento, não cria outro (mesmo que o status seja revertido e
// aprovado de novo depois). O valor e a data ficam travados no momento da
// aprovação: mudanças posteriores no orçamento não tocam este lançamento.
async function ensureReceivableForApprovedQuote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  quote: { id: string; quote_number: number; total: number; trade_name?: string; customer_name?: string; status: string }
) {
  if (quote.status !== 'aprovado') return;

  const { data: existing } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('related_type', 'conta_receber')
    .eq('related_id', quote.id)
    .maybeSingle();

  if (existing) return;

  const customerLabel = quote.trade_name || quote.customer_name || 'Cliente';

  await supabase.from('financial_transactions').insert({
    description: `Venda a ${customerLabel} ref. Pedido ${quote.quote_number}`,
    amount: quote.total,
    type: 'entrada',
    category: 'Contas a Receber',
    transaction_date: new Date().toISOString().split('T')[0],
    status: 'pendente',
    related_type: 'conta_receber',
    related_id: quote.id,
  });
}

function rowToQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    quoteNumber: row.quote_number as number,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    customerDetails: (row.customer_details as Quote['customerDetails']) || undefined,
    obra: (row.obra as string) || undefined,
    status: row.status as Quote['status'],
    items: (Array.isArray(row.items) ? row.items : []) as QuoteItem[],
    subtotal: row.subtotal as number,
    total: row.total as number,
    freight: (row.freight as number) || undefined,
    discount: (row.discount as number) || undefined,
    date: row.date as string,
    expiryDate: (row.expiry_date as string) || undefined,
    deliveryTime: (row.delivery_time as string) || undefined,
    manufacturingDeadline: (row.manufacturing_deadline as string) || undefined,
    actualDeliveryDate: (row.actual_delivery_date as string) || undefined,
    osNumber: (row.os_number as number) || undefined,
    notes: (row.notes as string) || undefined,
    paymentTerms: (row.payment_terms as string) || undefined,
    warranty: (row.warranty as string) || undefined,
  };
}

// Colunas para a listagem — inclui items para coluna Produto; exclui customer_details (não necessário na lista)
const QUOTES_LIST_COLUMNS = [
  'id', 'quote_number', 'customer_id', 'customer_name', 'obra', 'status',
  'subtotal', 'total', 'freight', 'discount', 'date', 'expiry_date',
  'delivery_time', 'manufacturing_deadline', 'actual_delivery_date',
  'os_number', 'notes', 'payment_terms', 'warranty', 'items',
].join(', ');

export async function getQuotes(): Promise<{ success: boolean; quotes?: Quote[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select(QUOTES_LIST_COLUMNS)
      .order('quote_number', { ascending: false });

    if (error) throw error;

    return { success: true, quotes: ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToQuote) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar orçamentos';
    return { success: false, error: message };
  }
}

export async function getQuote(id: string): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { success: true, quote: rowToQuote(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar orçamento';
    return { success: false, error: message };
  }
}

export async function upsertQuote(
  data: Record<string, unknown>,
  quoteId: string | null
): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  try {
    const supabase = await createClient();

    const customerId = data.customerId as string;
    const items = (data.items ?? []) as QuoteItem[];
    const freight = parseFloat(String(data.freight || 0)) || 0;
    const discount = parseFloat(String(data.discount || 0)) || 0;

    const subtotal = items.reduce((sum, item) => sum + (item.total ?? 0), 0);
    const taxTotal = items.reduce((sum, item) => sum + (Number(item.tax) || item.total * 0.045 || 0), 0);
    const total = subtotal + taxTotal + freight - discount;

    // Busca detalhes do cliente para snapshot
    let customerDetails: Quote['customerDetails'] = {};
    let resolvedCustomerName = data.customerName as string;
    const { data: customerRow } = await supabase
      .from('customers')
      .select('cnpj, contact_name, contact_phone, email, trade_name, name')
      .eq('id', customerId)
      .maybeSingle();

    if (customerRow) {
      customerDetails = {
        cnpj: customerRow.cnpj || undefined,
        contactName: customerRow.contact_name || undefined,
        contactPhone: customerRow.contact_phone || undefined,
        email: customerRow.email || undefined,
      };
      // Usa nome de fantasia se existir
      if (customerRow.trade_name) resolvedCustomerName = customerRow.trade_name;
    }

    const payload: Record<string, unknown> = {
      customer_id: customerId,
      customer_name: resolvedCustomerName,
      customer_details: customerDetails,
      obra: (data.obra as string) || null,
      status: (data.status as string) || 'rascunho',
      items,
      subtotal,
      total,
      freight: freight || null,
      discount: discount || null,
      date: (data.date as string) || new Date().toISOString().split('T')[0],
      expiry_date: (data.expiryDate as string) || null,
      delivery_time: (data.deliveryTime as string) || null,
      manufacturing_deadline: (data.manufacturingDeadline as string) || null,
      actual_delivery_date: (data.actualDeliveryDate as string) || null,
      notes: (data.notes as string) || null,
      payment_terms: (data.paymentTerms as string) || null,
      warranty: (data.warranty as string) || null,
    };

    let saved: Record<string, unknown>;

    if (quoteId) {
      // EDIÇÃO: UPDATE direto — não toca na sequence do quote_number
      const { data, error } = await supabase
        .from('quotes')
        .update(payload)
        .eq('id', quoteId)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      // CRIAÇÃO: INSERT — gera quote_number uma única vez
      const { data, error } = await supabase
        .from('quotes')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    }

    // Auto-cria OS quando status muda para 'aprovado' e ainda não tem OS
    if (saved.status === 'aprovado' && !saved.os_number) {
      const { data: osData } = await supabase
        .from('ordens_servico')
        .insert({ quote_id: saved.id, status: 'aberta' })
        .select()
        .single();

      if (osData) {
        await supabase
          .from('quotes')
          .update({ os_number: osData.os_number })
          .eq('id', saved.id);
        saved.os_number = osData.os_number;
      }
    }

    await ensureReceivableForApprovedQuote(supabase, {
      id: saved.id as string,
      quote_number: saved.quote_number as number,
      total: saved.total as number,
      trade_name: resolvedCustomerName,
      status: saved.status as string,
    });

    revalidatePath('/quotes');
    revalidatePath('/production');
    revalidatePath('/financeiro', 'layout');
    return { success: true, quote: rowToQuote(saved) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar orçamento';
    return { success: false, error: message };
  }
}

export async function deleteQuote(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/quotes');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir orçamento';
    return { success: false, error: message };
  }
}

export async function updateQuoteStatus(
  id: string,
  status: string
): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Auto-cria OS quando status muda para 'aprovado' e ainda não tem OS
    if (data.status === 'aprovado' && !data.os_number) {
      const { data: osData } = await supabase
        .from('ordens_servico')
        .insert({ quote_id: data.id, status: 'aberta' })
        .select()
        .single();

      if (osData) {
        await supabase
          .from('quotes')
          .update({ os_number: osData.os_number })
          .eq('id', data.id);
        data.os_number = osData.os_number;
      }
    }

    await ensureReceivableForApprovedQuote(supabase, {
      id: data.id,
      quote_number: data.quote_number,
      total: data.total,
      trade_name: data.customer_name,
      status: data.status,
    });

    revalidatePath('/quotes');
    revalidatePath('/production');
    revalidatePath('/financeiro', 'layout');
    return { success: true, quote: rowToQuote(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
    return { success: false, error: message };
  }
}

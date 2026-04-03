'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Quote, QuoteItem } from '@/lib/types';

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

export async function getQuotes(): Promise<{ success: boolean; quotes?: Quote[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('quote_number', { ascending: false });

    if (error) throw error;

    return { success: true, quotes: (data ?? []).map(rowToQuote) };
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
    const total = subtotal + freight - discount;

    // Busca detalhes do cliente para snapshot
    let customerDetails: Quote['customerDetails'] = {};
    const { data: customerRow } = await supabase
      .from('customers')
      .select('cnpj, contact_name, contact_phone, email')
      .eq('id', customerId)
      .maybeSingle();

    if (customerRow) {
      customerDetails = {
        cnpj: customerRow.cnpj || undefined,
        contactName: customerRow.contact_name || undefined,
        contactPhone: customerRow.contact_phone || undefined,
        email: customerRow.email || undefined,
      };
    }

    const payload: Record<string, unknown> = {
      customer_id: customerId,
      customer_name: data.customerName as string,
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

    if (quoteId) payload.id = quoteId;

    const { data: saved, error } = await supabase
      .from('quotes')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/quotes');
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

    revalidatePath('/quotes');
    return { success: true, quote: rowToQuote(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
    return { success: false, error: message };
  }
}

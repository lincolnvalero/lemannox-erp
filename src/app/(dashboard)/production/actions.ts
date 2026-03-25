'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Quote, QuoteItem, ScheduleItem } from '@/lib/types';

const PRODUCTION_STATUSES = ['aprovado', 'produzindo', 'entregue'];

function quoteToScheduleItems(quote: Record<string, unknown>): ScheduleItem[] {
  const items = (quote.items ?? []) as QuoteItem[];
  return items.map((item, index) => ({
    quoteId: quote.id as string,
    itemIndex: index,
    pedido: quote.quote_number as number,
    osNumber: (quote.os_number as number) || undefined,
    data: quote.date as string,
    cliente: quote.customer_name as string,
    obra: (quote.obra as string) || '',
    produto: item.name,
    previsao: (quote.manufacturing_deadline as string) || (quote.delivery_time as string) || '',
    concluidoEm: item.productionStatus?.concluidoEm ?? null,
    entregueEm: item.productionStatus?.entregueEm ?? null,
  }));
}

export async function getProductionScheduleItems(): Promise<{
  success: boolean;
  items?: ScheduleItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, os_number, customer_name, obra, date, manufacturing_deadline, delivery_time, items, status')
      .in('status', PRODUCTION_STATUSES)
      .order('quote_number', { ascending: false });

    if (error) throw error;

    const scheduleItems: ScheduleItem[] = (data ?? []).flatMap(quoteToScheduleItems);

    return { success: true, items: scheduleItems };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar programação de produção';
    return { success: false, error: message };
  }
}

export async function updateProductionItemDate(
  quoteId: string,
  itemIndex: number,
  status: 'concluidoEm' | 'entregueEm',
  date: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Carrega o quote atual para atualizar o JSONB de items
    const { data: quoteRow, error: fetchError } = await supabase
      .from('quotes')
      .select('items')
      .eq('id', quoteId)
      .single();

    if (fetchError) throw fetchError;

    const items = (quoteRow.items ?? []) as QuoteItem[];

    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new Error(`Índice de item inválido: ${itemIndex}`);
    }

    const updatedItems = items.map((item, idx) => {
      if (idx !== itemIndex) return item;
      return {
        ...item,
        productionStatus: {
          concluidoEm: item.productionStatus?.concluidoEm ?? null,
          entregueEm: item.productionStatus?.entregueEm ?? null,
          [status]: date,
        },
      };
    });

    const { error: updateError } = await supabase
      .from('quotes')
      .update({ items: updatedItems })
      .eq('id', quoteId);

    if (updateError) throw updateError;

    revalidatePath('/production');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar data de produção';
    return { success: false, error: message };
  }
}

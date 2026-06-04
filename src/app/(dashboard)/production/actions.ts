'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { QuoteItem, ScheduleItem, FabricadoItem } from '@/lib/types';

const PRODUCTION_STATUSES = ['aprovado', 'produzindo', 'entregue'];

function quoteToScheduleItems(quote: Record<string, unknown>): ScheduleItem[] {
  const items = (quote.items ?? []) as QuoteItem[];
  // Pega o os_number da tabela ordens_servico via join (mais confiável que quotes.os_number)
  const osRows = (quote.ordens_servico as { os_number: number }[] | null) ?? [];
  const osNumber = osRows.length > 0 ? osRows[0].os_number : ((quote.os_number as number) || undefined);

  return items.map((item, index) => ({
    quoteId: quote.id as string,
    itemIndex: index,
    pedido: quote.quote_number as number,
    osNumber,
    data: quote.date as string,
    cliente: (quote.trade_name as string) || (quote.customer_name as string),
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
      .select('id, quote_number, os_number, customer_name, obra, date, manufacturing_deadline, delivery_time, items, status, ordens_servico(os_number)')
      .in('status', PRODUCTION_STATUSES);

    if (error) throw error;

    const scheduleItems: ScheduleItem[] = (data ?? []).flatMap(quoteToScheduleItems);

    // Ordena por previsão ascendente — mais antigas (mais urgentes) primeiro
    // Itens sem previsão ficam no final
    scheduleItems.sort((a, b) => {
      if (!a.previsao && !b.previsao) return 0;
      if (!a.previsao) return 1;
      if (!b.previsao) return -1;
      return new Date(a.previsao).getTime() - new Date(b.previsao).getTime();
    });

    return { success: true, items: scheduleItems };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar programação de produção';
    return { success: false, error: message };
  }
}

// Statuses que podem conter itens com productionStatus preenchido
const FABRICADO_STATUSES = ['aprovado', 'produzindo', 'entregue', 'faturado'];

export async function getManufacturedItems(
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; items?: FabricadoItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, items')
      .in('status', FABRICADO_STATUSES);

    if (error) throw error;

    const result: FabricadoItem[] = [];

    for (const quote of (data ?? []) as Record<string, unknown>[]) {
      const items = (quote.items ?? []) as QuoteItem[];
      for (const item of items) {
        const ps = item.productionStatus;
        if (!ps) continue;

        const isoData = ps.concluidoEm || ps.entregueEm;
        if (!isoData) continue;

        // Compara apenas a parte da data (YYYY-MM-DD) para ignorar fuso horário
        const dataStr = isoData.split('T')[0];
        if (startDate && dataStr < startDate) continue;
        if (endDate && dataStr > endDate) continue;

        result.push({
          quoteId: quote.id as string,
          pedido: quote.quote_number as number,
          cliente: (quote.customer_name as string) || '—',
          categoria: item.category?.trim() || 'Sem categoria',
          produto: item.name,
          valor: item.total || 0,
          dataConclusao: isoData,
        });
      }
    }

    // Ordena: cliente → categoria → produto
    result.sort((a, b) => {
      const c = a.cliente.localeCompare(b.cliente, 'pt-BR', { sensitivity: 'base' });
      if (c !== 0) return c;
      const cat = a.categoria.localeCompare(b.categoria, 'pt-BR', { sensitivity: 'base' });
      if (cat !== 0) return cat;
      return a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' });
    });

    return { success: true, items: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar produtos fabricados';
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

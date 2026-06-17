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
    material: item.material || '',
    categoria: item.category || '',
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

// Statuses de orçamentos que representam produção concluída / em finalização
const FABRICADO_STATUSES = ['aprovado', 'produzindo', 'entregue', 'faturado'];

export async function getManufacturedItems(
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; items?: FabricadoItem[]; error?: string }> {
  try {
    const supabase = await createClient();

    // Busca orçamentos com campos de data de conclusão, número de OS e obra
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, obra, items, os_number, actual_delivery_date, manufacturing_deadline, date')
      .in('status', FABRICADO_STATUSES);

    if (error) throw error;

    // Tabela de lookup: productId → categoria
    const { data: productsData } = await supabase
      .from('products')
      .select('id, category');

    const productCategoryMap = new Map<string, string>();
    for (const p of (productsData ?? []) as { id: string; category: string }[]) {
      productCategoryMap.set(p.id, p.category);
    }

    const result: FabricadoItem[] = [];

    for (const quote of (data ?? []) as Record<string, unknown>[]) {
      const items = (quote.items ?? []) as QuoteItem[];

      for (const item of items) {
        // Só inclui itens com data de conclusão individual marcada na programação
        const ps = item.productionStatus;
        const isoData = ps?.concluidoEm || ps?.entregueEm;
        if (!isoData) continue;

        const dataStr = isoData.split('T')[0];
        if (startDate && dataStr < startDate) continue;
        if (endDate && dataStr > endDate) continue;

        // Categoria: campo no item > lookup por productId > fallback
        const categoria =
          item.category?.trim() ||
          (item.productId ? productCategoryMap.get(item.productId) : undefined) ||
          'Sem categoria';

        result.push({
          quoteId: quote.id as string,
          osNumber: (quote.os_number as number) || undefined,
          pedido: quote.quote_number as number,
          obra: (quote.obra as string) || undefined,
          cliente: (quote.customer_name as string) || '—',
          categoria,
          produto: item.name,
          quantidade: item.quantity || 1,
          valor: item.total || 0,
          dataConclusao: isoData,
        });
      }
    }

    // Ordena: cliente → nº OS → produto
    result.sort((a, b) => {
      const c = a.cliente.localeCompare(b.cliente, 'pt-BR', { sensitivity: 'base' });
      if (c !== 0) return c;
      const aOs = a.osNumber ?? Infinity;
      const bOs = b.osNumber ?? Infinity;
      if (aOs !== bOs) return aOs - bOs;
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

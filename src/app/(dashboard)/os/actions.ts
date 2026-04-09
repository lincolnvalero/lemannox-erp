'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { OrdemServico } from '@/lib/types';

function rowToOrdem(row: Record<string, unknown>): OrdemServico {
  // Suporte para dados com join de quotes (getOrdensServico) ou sem (create/update)
  const q = (row.quotes as Record<string, unknown> | null) ?? null;
  return {
    id: row.id as string,
    osNumber: row.os_number as number,
    quoteId: (row.quote_id as string) || undefined,
    quoteNumber: (q?.quote_number as number) || undefined,
    customerName: (q?.customer_name as string) || undefined,
    obra: (q?.obra as string) || undefined,
    status: row.status as OrdemServico['status'],
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) || undefined,
  };
}

export async function getOrdensServico(): Promise<{
  success: boolean;
  ordens?: OrdemServico[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*, quotes(quote_number, customer_name, obra)')
      .order('os_number', { ascending: false });

    if (error) throw error;

    return { success: true, ordens: (data ?? []).map(rowToOrdem) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar ordens de serviço';
    return { success: false, error: message };
  }
}

export async function getOrdemServicoPorQuote(quoteId: string): Promise<{
  success: boolean;
  ordem?: OrdemServico;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*')
      .eq('quote_id', quoteId)
      .order('os_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: true, ordem: undefined };

    return { success: true, ordem: rowToOrdem(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar OS';
    return { success: false, error: message };
  }
}

export async function createOrdemServico(quoteId: string): Promise<{
  success: boolean;
  ordem?: OrdemServico;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ordens_servico')
      .insert({ quote_id: quoteId, status: 'aberta' })
      .select()
      .single();

    if (error) throw error;

    // Atualiza o quote para referenciar a OS gerada
    await supabase
      .from('quotes')
      .update({ os_number: data.os_number })
      .eq('id', quoteId);

    revalidatePath('/os');
    revalidatePath('/quotes');
    return { success: true, ordem: rowToOrdem(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar ordem de serviço';
    return { success: false, error: message };
  }
}

export async function updateOrdemServico(
  id: string,
  updateData: Partial<OrdemServico>
): Promise<{ success: boolean; ordem?: OrdemServico; error?: string }> {
  try {
    const supabase = await createClient();

    const payload: Record<string, unknown> = {};
    if (updateData.status !== undefined) payload.status = updateData.status;
    if (updateData.notes !== undefined) payload.notes = updateData.notes;
    if (updateData.quoteId !== undefined) payload.quote_id = updateData.quoteId;

    const { data, error } = await supabase
      .from('ordens_servico')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/os');
    return { success: true, ordem: rowToOrdem(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar ordem de serviço';
    return { success: false, error: message };
  }
}

export async function deleteOrdemServico(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Busca o quoteId para limpar os_number no orçamento
    const { data: os } = await supabase
      .from('ordens_servico')
      .select('quote_id')
      .eq('id', id)
      .single();

    if (os?.quote_id) {
      await supabase
        .from('quotes')
        .update({ os_number: null })
        .eq('id', os.quote_id);
    }

    const { error } = await supabase.from('ordens_servico').delete().eq('id', id);
    if (error) throw error;

    revalidatePath('/os');
    revalidatePath('/quotes');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir ordem de serviço';
    return { success: false, error: message };
  }
}

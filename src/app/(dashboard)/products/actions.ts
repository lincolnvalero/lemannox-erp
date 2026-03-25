'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Product, ProductVariation } from '@/lib/types';

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    category: row.category as string,
    model: row.model as string,
    measurement: row.measurement as string,
    variations: (row.variations ?? []) as ProductVariation[],
  };
}

export async function getProducts(): Promise<{ success: boolean; products?: Product[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('model', { ascending: true });

    if (error) throw error;

    return { success: true, products: (data ?? []).map(rowToProduct) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar produtos';
    return { success: false, error: message };
  }
}

export async function upsertProduct(
  formData: FormData
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;
    const variationsRaw = formData.get('variations') as string;
    const variations: ProductVariation[] = variationsRaw ? JSON.parse(variationsRaw) : [];

    const payload: Record<string, unknown> = {
      model: formData.get('model') as string,
      measurement: formData.get('measurement') as string,
      category: formData.get('category') as string,
      variations,
    };
    if (id) payload.id = id;

    const { data, error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/products');
    return { success: true, product: rowToProduct(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar produto';
    return { success: false, error: message };
  }
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/products');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir produto';
    return { success: false, error: message };
  }
}

export async function bulkUpdatePrices(
  percentage: number,
  targetModel: string | 'all'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase.from('products').select('id, variations');
    if (targetModel !== 'all') {
      query = query.eq('model', targetModel);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const multiplier = 1 + percentage / 100;

    for (const row of data ?? []) {
      const updatedVariations = ((row.variations ?? []) as ProductVariation[]).map((v) => ({
        ...v,
        price: Math.round(v.price * multiplier * 100) / 100,
      }));

      const { error: updateError } = await supabase
        .from('products')
        .update({ variations: updatedVariations })
        .eq('id', row.id);

      if (updateError) throw updateError;
    }

    revalidatePath('/products');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar preços em lote';
    return { success: false, error: message };
  }
}

export async function updateProductPrice(
  productId: string,
  variations: ProductVariation[]
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('products')
      .update({ variations })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/products');
    return { success: true, product: rowToProduct(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar preço do produto';
    return { success: false, error: message };
  }
}

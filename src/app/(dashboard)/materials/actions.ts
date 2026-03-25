'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Material } from '@/lib/types';

function rowToMaterial(row: Record<string, unknown>): Material {
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    category: (row.category as string) || undefined,
    quantity: row.quantity as number,
    minQuantity: row.min_quantity as number,
    unitCost: row.unit_cost as number,
    supplierId: (row.supplier_id as string) || undefined,
    supplierName: (row.supplier_name as string) || undefined,
  };
}

export async function getMaterials(): Promise<{ success: boolean; materials?: Material[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return { success: true, materials: (data ?? []).map(rowToMaterial) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar materiais';
    return { success: false, error: message };
  }
}

export async function upsertMaterial(
  formData: FormData
): Promise<{ success: boolean; material?: Material; error?: string }> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;

    const payload: Record<string, unknown> = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      category: (formData.get('category') as string) || null,
      quantity: parseFloat(formData.get('quantity') as string) || 0,
      min_quantity: parseFloat(formData.get('minQuantity') as string) || 0,
      unit_cost: parseFloat(formData.get('unitCost') as string) || 0,
      supplier_id: (formData.get('supplierId') as string) || null,
      supplier_name: (formData.get('supplierName') as string) || null,
    };

    if (id) payload.id = id;

    const { data, error } = await supabase
      .from('materials')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/materials');
    return { success: true, material: rowToMaterial(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar material';
    return { success: false, error: message };
  }
}

export async function deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/materials');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir material';
    return { success: false, error: message };
  }
}

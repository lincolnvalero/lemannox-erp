'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Supplier, SupplierPerformance } from '@/lib/types';

function rowToSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    name: row.name as string,
    cnpj: (row.cnpj as string) || undefined,
    category: row.category as string,
    contactName: row.contact_name as string,
    phone: row.phone as string,
    email: (row.email as string) || undefined,
    rating: row.rating as number | undefined,
    totalSpent: row.total_spent as number | undefined,
    joinDate: (row.join_date as string) || undefined,
    performance: (row.performance as SupplierPerformance) || undefined,
  };
}

export async function getSuppliers(): Promise<{ success: boolean; suppliers?: Supplier[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return { success: true, suppliers: (data ?? []).map(rowToSupplier) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar fornecedores';
    return { success: false, error: message };
  }
}

export async function upsertSupplier(
  formData: FormData
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;
    const isNew = !id;

    const payload: Record<string, unknown> = {
      name: formData.get('name') as string,
      cnpj: (formData.get('cnpj') as string) || null,
      category: formData.get('category') as string,
      contact_name: formData.get('contactName') as string,
      phone: formData.get('phone') as string,
      email: (formData.get('email') as string) || null,
    };

    if (id) payload.id = id;

    if (isNew) {
      payload.rating = 4.0;
      payload.total_spent = 0;
      payload.join_date = new Date().toISOString().split('T')[0];
      payload.performance = { price: 3, quality: 3, delivery: 3 };
    }

    const { data, error } = await supabase
      .from('suppliers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/suppliers');
    return { success: true, supplier: rowToSupplier(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar fornecedor';
    return { success: false, error: message };
  }
}

export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/suppliers');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir fornecedor';
    return { success: false, error: message };
  }
}

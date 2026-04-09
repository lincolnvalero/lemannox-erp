'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { Customer } from '@/lib/types';

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    name: row.name as string,
    cnpj: (row.cnpj as string) || undefined,
    ie: (row.ie as string) || undefined,
    contactName: (row.contact_name as string) || undefined,
    contactPhone: (row.contact_phone as string) || undefined,
    email: (row.email as string) || undefined,
    zipCode: (row.zip_code as string) || undefined,
    addressStreet: (row.address_street as string) || undefined,
    addressNumber: (row.address_number as string) || undefined,
    addressComplement: (row.address_complement as string) || undefined,
    neighborhood: (row.neighborhood as string) || undefined,
    city: (row.city as string) || undefined,
    state: (row.state as string) || undefined,
    notes: (row.notes as string) || undefined,
    category: (row.category as string) || undefined,
  };
}

export async function getCustomers(): Promise<{ success: boolean; customers?: Customer[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return { success: true, customers: (data ?? []).map(rowToCustomer) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar clientes';
    return { success: false, error: message };
  }
}

export async function upsertCustomer(
  formData: FormData
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string | null;

    const payload: Record<string, unknown> = {
      name: formData.get('name') as string,
      cnpj: (formData.get('cnpj') as string) || null,
      ie: (formData.get('ie') as string) || null,
      contact_name: (formData.get('contactName') as string) || null,
      contact_phone: (formData.get('contactPhone') as string) || null,
      email: (formData.get('email') as string) || null,
      zip_code: (formData.get('zipCode') as string) || null,
      address_street: (formData.get('addressStreet') as string) || null,
      address_number: (formData.get('addressNumber') as string) || null,
      address_complement: (formData.get('addressComplement') as string) || null,
      neighborhood: (formData.get('neighborhood') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
      notes: (formData.get('notes') as string) || null,
      category: (formData.get('category') as string) || null,
    };

    if (id) payload.id = id;

    const { data, error } = await supabase
      .from('customers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/customers');
    return { success: true, customer: rowToCustomer(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar cliente';
    return { success: false, error: message };
  }
}

export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/customers');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir cliente';
    return { success: false, error: message };
  }
}

export async function updateProductionStatus(
  id: string,
  productionStatus: Customer['productionStatus']
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('customers')
      .update({ production_status: productionStatus })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/customers');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
    return { success: false, error: message };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { StockMovement } from '@/lib/types';

function rowToMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row.id as string,
    materialId: row.material_id as string,
    materialName: (row.material_name as string) || undefined,
    movementType: row.movement_type as StockMovement['movementType'],
    quantity: row.quantity as number,
    unitCost: (row.unit_cost as number) || undefined,
    totalCost: (row.total_cost as number) || undefined,
    supplierId: (row.supplier_id as string) || undefined,
    supplierName: (row.supplier_name as string) || undefined,
    reference: (row.reference as string) || undefined,
    notes: (row.notes as string) || undefined,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

export async function getStockMovements(materialId?: string): Promise<{
  success: boolean;
  movements?: StockMovement[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('stock_movements')
      .select('*')
      .order('date', { ascending: false })
      .limit(100);

    if (materialId) query = query.eq('material_id', materialId);

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, movements: (data ?? []).map(rowToMovement) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar movimentações';
    return { success: false, error: message };
  }
}

export async function registerStockMovement(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const materialId = formData.get('materialId') as string;
    const movementType = formData.get('movementType') as string;
    const quantity = parseFloat(formData.get('quantity') as string);
    const unitCost = parseFloat(formData.get('unitCost') as string) || null;
    const supplierName = (formData.get('supplierName') as string) || null;
    const reference = (formData.get('reference') as string) || null;
    const notes = (formData.get('notes') as string) || null;
    const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0];

    // Busca nome do material
    const { data: mat } = await supabase.from('materials').select('name, quantity').eq('id', materialId).single();

    const payload = {
      material_id: materialId,
      material_name: mat?.name ?? '',
      movement_type: movementType,
      quantity,
      unit_cost: unitCost,
      total_cost: unitCost ? quantity * unitCost : null,
      supplier_name: supplierName,
      reference,
      notes,
      date,
    };

    const { error: insertError } = await supabase.from('stock_movements').insert(payload);
    if (insertError) throw insertError;

    // Atualiza quantidade do material
    const currentQty = (mat?.quantity as number) ?? 0;
    const newQty = movementType === 'entrada'
      ? currentQty + quantity
      : Math.max(0, currentQty - quantity);

    const updatePayload: Record<string, unknown> = { quantity: newQty };
    if (movementType === 'entrada' && unitCost) updatePayload.unit_cost = unitCost;

    const { error: updateError } = await supabase
      .from('materials')
      .update(updatePayload)
      .eq('id', materialId);

    if (updateError) throw updateError;

    revalidatePath('/materials');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar movimentação';
    return { success: false, error: message };
  }
}

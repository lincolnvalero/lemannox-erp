'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerStockMovement } from '@/app/(dashboard)/materials/stock-actions';
import type { Material } from '@/lib/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onSuccess: () => void;
};

export function StockMovementDialog({ open, onOpenChange, material, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'consumo' | 'ajuste'>('entrada');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!material) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set('materialId', material.id);
    formData.set('movementType', movementType);

    const result = await registerStockMovement(formData);
    if (result.success) {
      toast({ title: 'Movimentação registrada!', description: `Estoque de "${material.name}" atualizado.` });
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setLoading(false);
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar Estoque</DialogTitle>
          <DialogDescription>
            {material.name} — Estoque atual: <strong>{material.quantity} {material.unit}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Movimentação</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as typeof movementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (Compra / Recebimento)</SelectItem>
                <SelectItem value="consumo">Consumo (Uso na Produção)</SelectItem>
                <SelectItem value="ajuste">Ajuste (Inventário)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade ({material.unit})</Label>
              <Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" required placeholder="0" />
            </div>
            {movementType === 'entrada' && (
              <div className="space-y-2">
                <Label htmlFor="unitCost">Custo unitário (R$)</Label>
                <Input id="unitCost" name="unitCost" type="number" step="0.01" min="0" placeholder={String(material.unitCost ?? 0)} />
              </div>
            )}
          </div>

          {movementType === 'entrada' && (
            <div className="space-y-2">
              <Label htmlFor="supplierName">Fornecedor</Label>
              <Input id="supplierName" name="supplierName" placeholder={material.supplierName ?? 'Nome do fornecedor'} defaultValue={material.supplierName ?? ''} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Referência (NF, OS...)</Label>
              <Input id="reference" name="reference" placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" name="notes" placeholder="Opcional" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

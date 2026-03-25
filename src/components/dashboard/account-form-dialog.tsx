'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { upsertAccount } from '@/app/(dashboard)/financeiro/actions';
import type { ChartOfAccount } from '@/lib/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount: ChartOfAccount | null;
  onSaveSuccess: (account: ChartOfAccount) => void;
};

export function AccountFormDialog({ open, onOpenChange, editingAccount, onSaveSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>(editingAccount?.type || 'saida');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (editingAccount) formData.set('id', editingAccount.id);
    formData.set('type', type);

    const result = await upsertAccount(formData);
    if (result.success && result.account) {
      toast({ title: editingAccount ? 'Conta atualizada' : 'Conta criada' });
      onSaveSuccess(result.account);
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            <DialogDescription>Plano de contas contábil</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Conta *</Label>
              <Input id="name" name="name" required defaultValue={editingAccount?.name} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Receita (Entrada)</SelectItem>
                  <SelectItem value="saida">Despesa (Saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

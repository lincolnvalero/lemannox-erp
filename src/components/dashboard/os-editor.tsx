'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Quote } from '@/lib/types';

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  quote: Quote | null;
  onSuccess?: (osNumber: number) => void;
};

export function OsEditor({ open, onOpenChange, quote, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('aberta');

  if (!quote) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { createOrdemServico } = await import('@/app/(dashboard)/os/actions');
      const result = await createOrdemServico(quote.id);
      if (result.success) {
        toast({ title: 'OS criada com sucesso!', description: `OS #${result.osNumber} gerada.` });
        onSuccess?.(result.osNumber || 0);
        onOpenChange?.(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao criar OS', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gerar Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Orçamento #{quote.quoteNumber} — {quote.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status Inicial</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="os-notes">Observações</Label>
              <Textarea
                id="os-notes"
                placeholder="Instruções especiais, materiais, prioridades..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-1">
              <p className="font-medium text-foreground">{quote.items.length} item(s) no orçamento:</p>
              {quote.items.slice(0, 3).map((item, i) => (
                <p key={i} className="text-muted-foreground">
                  · {item.quantity}x {item.name} {item.measurement} ({item.material})
                </p>
              ))}
              {quote.items.length > 3 && (
                <p className="text-muted-foreground">...e mais {quote.items.length - 3} itens</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar OS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

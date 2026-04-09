'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Quote, OrdemServico } from '@/lib/types';
import { OsPreview } from '@/components/dashboard/os-preview';

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  quote: Quote | null;
  onSuccess?: (osNumber: number) => void;
};

export function OsEditor({ open, onOpenChange, quote, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('aberta');
  const [createdOs, setCreatedOs] = useState<OrdemServico | null>(null);
  const [existingOs, setExistingOs] = useState<OrdemServico | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Se o quote já tem OS, busca ela ao montar
  useEffect(() => {
    if (!quote?.id || !quote.osNumber) return;
    setCheckingExisting(true);
    import('@/app/(dashboard)/os/actions').then(({ getOrdemServicoPorQuote }) => {
      getOrdemServicoPorQuote(quote.id).then((result) => {
        if (result.success && result.ordem) {
          setExistingOs(result.ordem);
          setEditStatus(result.ordem.status);
          setEditNotes(result.ordem.notes ?? '');
        }
        setCheckingExisting(false);
      });
    });
  }, [quote?.id, quote?.osNumber]);

  if (!quote) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { createOrdemServico } = await import('@/app/(dashboard)/os/actions');
      const result = await createOrdemServico(quote.id);
      if (result.success) {
        toast({ title: 'OS criada com sucesso!', description: `OS #${result.ordem?.osNumber} gerada.` });
        onSuccess?.(result.ordem?.osNumber || 0);
        if (result.ordem) {
          setCreatedOs(result.ordem);
          setExistingOs(result.ordem);
        }
        onOpenChange?.(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao criar OS', description: result.error });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingOs) return;
    setSaving(true);
    try {
      const { updateOrdemServico } = await import('@/app/(dashboard)/os/actions');
      const result = await updateOrdemServico(existingOs.id, { status: editStatus as OrdemServico['status'], notes: editNotes });
      if (result.success) {
        toast({ title: 'OS atualizada!' });
        setExistingOs({ ...existingOs, status: editStatus as OrdemServico['status'], notes: editNotes });
        setShowEditForm(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
    setSaving(false);
  };

  const createFormFields = (
    <>
      <div className="grid gap-2">
        <Label>Status Inicial</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
    </>
  );

  const editFormFields = (
    <form onSubmit={handleUpdate} className="grid gap-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={editStatus} onValueChange={setEditStatus}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Observações</Label>
        <Textarea
          value={editNotes}
          onChange={e => setEditNotes(e.target.value)}
          rows={3}
          className="text-sm"
          placeholder="Instruções especiais..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditForm(false)}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );

  // Se tem OS existente (ou acabou de criar), mostra preview + opção de editar
  const osToShow = existingOs ?? createdOs;
  if (osToShow) {
    return (
      <div>
        <OsPreview os={osToShow} quote={quote} />
        <div className="mt-4 border rounded-lg p-4 bg-muted/30">
          <button
            onClick={() => setShowEditForm(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar status / observações
            {showEditForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showEditForm && editFormFields}
        </div>
      </div>
    );
  }

  // Carregando verificação
  if (checkingExisting) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando OS...
      </div>
    );
  }

  // Modo inline (sem prop open) — mostrar formulário de criação
  if (open === undefined) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Ordem de Serviço
          </CardTitle>
          <CardDescription>Orçamento #{quote.quoteNumber} — {quote.customerName}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {createFormFields}
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar OS
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Modo dialog
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
            {createFormFields}
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

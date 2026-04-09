'use client';

import { useState, useEffect } from 'react';
import { getOrdensServico, updateOrdemServico, deleteOrdemServico } from './actions';
import { getQuote } from '../quotes/actions';
import type { OrdemServico, Quote } from '@/lib/types';
import { OsPreview } from '@/components/dashboard/os-preview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Pencil, Printer, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const STATUS_COLOR: Record<string, string> = {
  aberta: 'border-blue-500/40 text-blue-400',
  em_andamento: 'border-yellow-500/40 text-yellow-400',
  concluida: 'border-green-500/40 text-green-400',
  cancelada: 'border-red-500/40 text-red-400',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function OrdensServicoPage() {
  const { toast } = useToast();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editingOs, setEditingOs] = useState<OrdemServico | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingOs, setDeletingOs] = useState<OrdemServico | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Print preview dialog
  const [previewOs, setPreviewOs] = useState<OrdemServico | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await getOrdensServico();
    if (result.success) setOrdens(result.ordens ?? []);
    else toast({ variant: 'destructive', title: 'Erro ao carregar OS', description: result.error });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (os: OrdemServico) => {
    setEditingOs(os);
    setEditStatus(os.status);
    setEditNotes(os.notes ?? '');
  };

  const handleUpdate = async () => {
    if (!editingOs) return;
    setSaving(true);
    const result = await updateOrdemServico(editingOs.id, {
      status: editStatus as OrdemServico['status'],
      notes: editNotes,
    });
    if (result.success) {
      toast({ title: 'OS atualizada.' });
      setEditingOs(null);
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingOs) return;
    setDeleting(true);
    const result = await deleteOrdemServico(deletingOs.id);
    if (result.success) {
      toast({ title: 'OS excluída.' });
      setDeletingOs(null);
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setDeleting(false);
  };

  const handlePrint = async (os: OrdemServico) => {
    if (!os.quoteId) {
      toast({ variant: 'destructive', title: 'OS sem orçamento vinculado.' });
      return;
    }
    setPreviewOs(os);
    setPreviewQuote(null);
    setPreviewLoading(true);
    const result = await getQuote(os.quoteId);
    if (result.success && result.quote) {
      setPreviewQuote(result.quote);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar orçamento', description: result.error });
      setPreviewOs(null);
    }
    setPreviewLoading(false);
  };

  return (
    <>
      {/* Edit Dialog */}
      <Dialog open={!!editingOs} onOpenChange={() => setEditingOs(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar OS #{String(editingOs?.osNumber ?? '').padStart(4, '0')}</DialogTitle>
            <DialogDescription>{editingOs?.customerName} — Pedido #{String(editingOs?.quoteNumber ?? '').padStart(4, '0')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={4}
                placeholder="Instruções especiais, prioridades..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOs(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingOs} onOpenChange={() => setDeletingOs(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir OS #{String(deletingOs?.osNumber ?? '').padStart(4, '0')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a OS permanentemente e desvinculará do orçamento #{String(deletingOs?.quoteNumber ?? '').padStart(4, '0')} — {deletingOs?.customerName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Preview Dialog */}
      <Dialog open={!!previewOs} onOpenChange={() => { setPreviewOs(null); setPreviewQuote(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar / Imprimir OS</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando dados do orçamento...
            </div>
          ) : previewOs && previewQuote ? (
            <OsPreview os={previewOs} quote={previewQuote} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Page */}
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ordens de Serviço</h1>
            <p className="text-sm text-muted-foreground">Gerencie e acompanhe todas as OSs emitidas</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de OS</CardTitle>
                <CardDescription className="text-xs">Ordenadas pela OS mais recente</CardDescription>
              </div>
              {!loading && (
                <span className="text-sm text-muted-foreground">{ordens.length} OS{ordens.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-[80px]">OS #</TableHead>
                  <TableHead className="w-[80px]">Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Obra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Emissão</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : ordens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma OS emitida ainda.
                    </TableCell>
                  </TableRow>
                ) : ordens.map(os => (
                  <TableRow key={os.id}>
                    <TableCell className="pl-6 font-mono font-semibold text-primary">
                      #{String(os.osNumber).padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {os.quoteNumber ? `#${String(os.quoteNumber).padStart(4, '0')}` : '—'}
                    </TableCell>
                    <TableCell className="font-medium">{os.customerName ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[140px] truncate" title={os.obra}>
                      {os.obra ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', STATUS_COLOR[os.status])}>
                        {STATUS_LABEL[os.status] ?? os.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDate(os.createdAt)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Visualizar / Imprimir" onClick={() => handlePrint(os)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(os)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeletingOs(os)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

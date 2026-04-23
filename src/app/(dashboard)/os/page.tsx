'use client';

import { useState, useEffect } from 'react';
import { getOrdensServico, updateOrdemServico, deleteOrdemServico } from './actions';
import { getQuote } from '../quotes/actions';
import type { OrdemServico, OsItem, Quote } from '@/lib/types';
import { OsPreview } from '@/components/dashboard/os-preview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { FileText, Pencil, Printer, Trash2, Loader2, PlusCircle, X, ChevronDown, ListFilter } from 'lucide-react';
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

function emptyItem(): OsItem {
  return { name: '', material: '', measurement: '', quantity: 1, notes: '' };
}

const OS_STATUSES: OrdemServico['status'][] = ['aberta', 'em_andamento', 'concluida', 'cancelada'];

function formatPrevisao(dateStr?: string) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

export default function OrdensServicoPage() {
  const { toast } = useToast();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de status
  const [statusFilter, setStatusFilter] = useState<OrdemServico['status'][]>(['aberta', 'em_andamento']);
  const [tempStatusFilter, setTempStatusFilter] = useState<OrdemServico['status'][]>(statusFilter);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Edit dialog
  const [editingOs, setEditingOs] = useState<OrdemServico | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<OsItem[]>([]);
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

  const openEdit = (os: OrdemServico, quote?: Quote) => {
    setEditingOs(os);
    setEditStatus(os.status);
    setEditNotes(os.notes ?? '');
    // Usa custom_items se existir, caso contrário traz os itens do orçamento
    if (os.customItems && os.customItems.length > 0) {
      setEditItems(os.customItems);
    } else if (quote) {
      setEditItems(quote.items.map(i => ({
        name: i.name,
        material: i.material,
        measurement: i.measurement,
        quantity: i.quantity,
        notes: i.notes ?? '',
      })));
    } else {
      setEditItems([]);
    }
  };

  const handleOpenEdit = async (os: OrdemServico) => {
    // Carrega o orçamento para pré-preencher itens
    if (os.quoteId) {
      const result = await getQuote(os.quoteId);
      openEdit(os, result.success ? result.quote : undefined);
    } else {
      openEdit(os);
    }
  };

  const handleUpdate = async () => {
    if (!editingOs) return;
    setSaving(true);
    const result = await updateOrdemServico(editingOs.id, {
      status: editStatus as OrdemServico['status'],
      notes: editNotes,
      customItems: editItems.filter(i => i.name.trim()),
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

  const handleInlineStatus = async (os: OrdemServico, newStatus: OrdemServico['status']) => {
    // Optimistic update
    setOrdens(prev => prev.map(o => o.id === os.id ? { ...o, status: newStatus } : o));
    const result = await updateOrdemServico(os.id, { status: newStatus });
    if (!result.success) {
      // Reverte em caso de erro
      setOrdens(prev => prev.map(o => o.id === os.id ? { ...o, status: os.status } : o));
      toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: result.error });
    }
  };

  const handleFilterOpenChange = (open: boolean) => {
    if (open) setTempStatusFilter(statusFilter);
    setFilterMenuOpen(open);
  };

  const applyFilter = () => {
    setStatusFilter(tempStatusFilter);
    setFilterMenuOpen(false);
  };

  const filteredOrdens = ordens.filter(os =>
    statusFilter.length === 0 || statusFilter.includes(os.status)
  );

  const updateItem = (idx: number, field: keyof OsItem, value: string | number) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  return (
    <>
      {/* Edit Dialog */}
      <Dialog open={!!editingOs} onOpenChange={() => setEditingOs(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar OS #{String(editingOs?.osNumber ?? '').padStart(4, '0')}</DialogTitle>
            <DialogDescription>{editingOs?.customerName} — Pedido #{String(editingOs?.quoteNumber ?? '').padStart(4, '0')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Status e Observações */}
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
                rows={3}
                placeholder="Instruções especiais, prioridades..."
              />
            </div>

            {/* Itens a produzir */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Itens a Produzir</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditItems(prev => [...prev, emptyItem()])}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {editItems.map((item, idx) => (
                  <div key={idx} className="grid gap-1.5 border rounded-md p-2 bg-muted/30 relative">
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="col-span-3">
                        <Input
                          placeholder="Descrição do produto"
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Input
                        placeholder="Material"
                        value={item.material}
                        onChange={e => updateItem(idx, 'material', e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="Medida"
                        value={item.measurement}
                        onChange={e => updateItem(idx, 'measurement', e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Qtd"
                        value={item.quantity}
                        min={1}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="h-7 text-xs"
                      />
                    </div>
                    <Input
                      placeholder="Obs. do item (opcional)"
                      value={item.notes ?? ''}
                      onChange={e => updateItem(idx, 'notes', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
                {editItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum item. Clique em "Adicionar" para inserir.
                  </p>
                )}
              </div>
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
              <div className="flex items-center gap-2">
                {!loading && (
                  <span className="text-sm text-muted-foreground">{filteredOrdens.length} OS{filteredOrdens.length !== 1 ? 's' : ''}</span>
                )}
                {/* Filtro de status */}
                <DropdownMenu open={filterMenuOpen} onOpenChange={handleFilterOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="text-xs">Status</span>
                      {statusFilter.length < OS_STATUSES.length && (
                        <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                          {statusFilter.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuLabel className="text-xs">Filtrar por status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {OS_STATUSES.map(s => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        className="text-xs"
                        checked={tempStatusFilter.includes(s)}
                        onSelect={e => e.preventDefault()}
                        onCheckedChange={checked => {
                          setTempStatusFilter(prev =>
                            checked ? [...prev, s] : prev.filter(x => x !== s)
                          );
                        }}
                      >
                        <span className={cn(
                          'inline-block w-2 h-2 rounded-full mr-1.5',
                          s === 'aberta' && 'bg-blue-400',
                          s === 'em_andamento' && 'bg-yellow-400',
                          s === 'concluida' && 'bg-green-400',
                          s === 'cancelada' && 'bg-red-400',
                        )} />
                        {STATUS_LABEL[s]}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <div className="flex gap-1 px-2 pb-1">
                      <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setTempStatusFilter([...OS_STATUSES])}>Todos</Button>
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={applyFilter}>Aplicar</Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                  <TableHead className="hidden lg:table-cell w-[100px]">Previsão</TableHead>
                  <TableHead className="hidden sm:table-cell">Emissão</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredOrdens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhuma OS encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : filteredOrdens.map(os => (
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors hover:opacity-80 focus:outline-none',
                              STATUS_COLOR[os.status]
                            )}
                          >
                            {STATUS_LABEL[os.status] ?? os.status}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[160px]">
                          {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <DropdownMenuItem
                              key={value}
                              className={cn(
                                'text-xs cursor-pointer',
                                os.status === value && 'font-semibold'
                              )}
                              onClick={() => handleInlineStatus(os, value as OrdemServico['status'])}
                            >
                              <span className={cn(
                                'inline-block w-2 h-2 rounded-full mr-2',
                                value === 'aberta' && 'bg-blue-400',
                                value === 'em_andamento' && 'bg-yellow-400',
                                value === 'concluida' && 'bg-green-400',
                                value === 'cancelada' && 'bg-red-400',
                              )} />
                              {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {formatPrevisao(os.deliveryTime)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDate(os.createdAt)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Visualizar / Imprimir" onClick={() => handlePrint(os)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => handleOpenEdit(os)}>
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

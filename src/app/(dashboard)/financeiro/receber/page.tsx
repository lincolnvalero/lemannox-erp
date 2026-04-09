'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, AlertTriangle, Clock, Plus, Save, Trash2, FilePenLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { getPendingTransactions, markAsPaid, getAccounts, upsertTransaction, deleteTransaction } from '../actions';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';
import { format as fmtDate } from 'date-fns';
import Link from 'next/link';

function alertInfo(dueDate?: string) {
  if (!dueDate) return { label: 'Sem vencimento', cls: 'text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" /> };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `Atrasado ${Math.abs(diff)}d`,  cls: 'text-red-400',    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> };
  if (diff === 0) return { label: 'Vence hoje',                   cls: 'text-orange-400', icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" /> };
  if (diff <= 7)  return { label: `Receber em ${diff}d`,          cls: 'text-yellow-400', icon: <Clock className="h-3.5 w-3.5 text-yellow-400" /> };
  return { label: `Receber em ${diff}d`, cls: 'text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" /> };
}

const schema = z.object({
  description: z.string().min(3, 'Obrigatório.'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser > 0.'),
  category: z.string().min(1, 'Selecione uma categoria.'),
  transactionDate: z.string().min(1, 'Obrigatório.'),
  dueDate: z.string().min(1, 'Previsão de recebimento obrigatória.'),
});
type FormVals = z.infer<typeof schema>;

export default function ContasAReceberPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FinancialTransaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [res, acc] = await Promise.all([getPendingTransactions('entrada'), getAccounts()]);
    if (res.success) setItems(res.transactions ?? []);
    if (acc.success) setAccounts(acc.accounts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() =>
    accounts.filter(a => a.type === 'entrada').map(a => a.name).sort(), [accounts]);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '', amount: 0, category: '',
      transactionDate: fmtDate(new Date(), 'yyyy-MM-dd'),
      dueDate: '',
    },
  });

  const openDialog = () => { form.reset({ description: '', amount: 0, category: '', transactionDate: fmtDate(new Date(), 'yyyy-MM-dd'), dueDate: '' }); setDialogOpen(true); };

  const onSubmit = async (vals: FormVals) => {
    setSaving(true);
    const fd = new FormData();
    fd.append('description', vals.description);
    fd.append('amount', String(vals.amount));
    fd.append('type', 'entrada');
    fd.append('category', vals.category);
    fd.append('transactionDate', vals.transactionDate);
    fd.append('dueDate', vals.dueDate);
    fd.append('status', 'pendente');
    const result = await upsertTransaction(fd);
    if (result.success) {
      toast({ title: 'Recebimento registrado!' });
      setDialogOpen(false);
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setSaving(false);
  };

  const handleReceive = async (t: FinancialTransaction) => {
    setReceiving(t.id);
    const result = await markAsPaid(t.id);
    if (result.success) {
      toast({ title: 'Recebido!', description: `"${t.description}" lançado no caixa.` });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setReceiving(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteTransaction(deleting.id);
    if (result.success) { toast({ title: 'Removido.' }); load(); }
    else toast({ variant: 'destructive', title: 'Erro', description: result.error });
    setDeleting(null);
  };

  const total = items.reduce((s, t) => s + t.amount, 0);
  const overdue = items.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < new Date());
  const totalOverdue = overdue.reduce((s, t) => s + t.amount, 0);

  return (
    <>
      {/* Dialog nova conta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
            <DialogDescription>Registre um recebimento futuro. Ao confirmar recebimento, será lançado no caixa.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-2">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Recebimento pedido #1612, comissão..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <ScrollArea className="h-[180px]">
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="transactionDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Lançamento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsão de Recebimento *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Alert delete */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recebimento?</AlertDialogTitle>
            <AlertDialogDescription>Isto removerá permanentemente &quot;{deleting?.description}&quot;.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Contas a Receber</h1>
          <Button onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" />Nova Conta a Receber
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Total a Receber</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Recebimentos Pendentes</p>
              <p className="text-xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Em Atraso</p>
              <p className={cn('text-xl font-bold', overdue.length > 0 ? 'text-red-400' : '')}>{overdue.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Total em Atraso</p>
              <p className={cn('text-xl font-bold', overdue.length > 0 ? 'text-red-400' : '')}>{formatCurrency(totalOverdue)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recebimentos Pendentes</CardTitle>
            <CardDescription>Ordenados por vencimento. Ao confirmar, o valor é lançado no caixa automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nenhum recebimento pendente.
                    </TableCell>
                  </TableRow>
                ) : items.map(t => {
                  const al = alertInfo(t.dueDate);
                  const isOverdue = t.dueDate && new Date(t.dueDate + 'T00:00:00') < new Date();
                  return (
                    <TableRow key={t.id} className={isOverdue ? 'bg-red-500/5' : ''}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{t.category}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(t.transactionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>
                        <div className={cn('flex items-center gap-1.5 text-sm', al.cls)}>
                          {al.icon}
                          <span>{t.dueDate ? new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                          <span className="text-xs opacity-80">({al.label})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-400">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/financeiro/editor/${t.id}`}><FilePenLine className="h-4 w-4" /></Link>
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(t)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" disabled={receiving === t.id} onClick={() => handleReceive(t)}>
                            <CheckCircle className="mr-1 h-4 w-4 text-green-400" />
                            Recebido
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

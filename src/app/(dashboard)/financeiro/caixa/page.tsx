'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';
import {
  getTransactions, getAccounts, deleteTransaction, upsertTransaction, getTransaction,
} from '../actions';
import {
  ArrowDownCircle, ArrowUpCircle, FileDown, FilePenLine,
  MoreHorizontal, Plus, Save, Search, Trash2, X,
} from 'lucide-react';
import { format as formatDate, isWithinInterval } from 'date-fns';
import { ExportTransactionsPdfDialog } from '@/components/dashboard/export-transactions-pdf-dialog';
import Link from 'next/link';

// ─── Schema do formulário ───────────────────────────────
const formSchema = z.object({
  description: z.string().min(3, 'Descrição é obrigatória.'),
  amount: z.coerce.number().min(0.01, 'O valor deve ser maior que zero.'),
  type: z.enum(['entrada', 'saida'], { required_error: 'O tipo é obrigatório.' }),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  transactionDate: z.string().min(1, 'A data da transação é obrigatória.'),
  status: z.enum(['pago', 'pendente']),
  dueDate: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

// ─── Página principal ───────────────────────────────────
export default function ControleCaixaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('historico');

  // ── Estado compartilhado ──
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      const [tr, ac] = await Promise.all([getTransactions(), getAccounts()]);
      if (tr.success) setTransactions(tr.transactions || []);
      if (ac.success) setAccounts(ac.accounts || []);
      setLoadingData(false);
    })();
  }, [toast]);

  const refreshTransactions = async () => {
    const tr = await getTransactions();
    if (tr.success) setTransactions(tr.transactions || []);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Controle do Caixa</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="nova">Nova Transação</TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          <HistoricoTab
            transactions={transactions}
            loading={loadingData}
            onRefresh={refreshTransactions}
            onNova={() => setActiveTab('nova')}
          />
        </TabsContent>
        <TabsContent value="nova" className="mt-4">
          <NovaTransacaoTab
            accounts={accounts}
            onSuccess={() => { refreshTransactions(); setActiveTab('historico'); }}
            onCancel={() => setActiveTab('historico')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Aba Histórico ──────────────────────────────────────
function HistoricoTab({
  transactions, loading, onRefresh, onNova,
}: {
  transactions: FinancialTransaction[];
  loading: boolean;
  onRefresh: () => void;
  onNova: () => void;
}) {
  const { toast } = useToast();
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pago' | 'pendente'>('todos');

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    const result = await deleteTransaction(deletingTransaction.id);
    if (result.success) {
      toast({ title: 'Transação Excluída' });
      onRefresh();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao Excluir', description: result.error });
    }
    setDeletingTransaction(null);
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.transactionDate);
      const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
      const inRange = (!from || d >= from) && (!to || d <= to);
      const matchSearch = !searchTerm ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'todos' || t.type === typeFilter;
      const matchStatus = statusFilter === 'todos' || t.status === statusFilter;
      return inRange && matchSearch && matchType && matchStatus;
    });
  }, [transactions, searchTerm, dateFrom, dateTo, typeFilter, statusFilter]);

  const totalEntradas = filtered.filter(t => t.type === 'entrada' && t.status === 'pago').reduce((s, t) => s + t.amount, 0);
  const totalSaidas = filtered.filter(t => t.type === 'saida' && t.status === 'pago').reduce((s, t) => s + t.amount, 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <>
      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto irá excluir permanentemente &quot;{deletingTransaction?.description}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ExportTransactionsPdfDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        transactions={filtered}
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Entradas (pagas)</p>
            <p className="text-xl font-bold text-green-500">{formatCurrency(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Saídas (pagas)</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Saldo</p>
            <p className={cn('text-xl font-bold', saldo >= 0 ? 'text-green-500' : 'text-red-500')}>
              {formatCurrency(saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>Visualize, filtre e gerencie todas as transações financeiras.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button onClick={onNova}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Input type="date" className="w-[140px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="De" />
            <Input type="date" className="w-[140px]" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Até" />
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[120px]">Valor</TableHead>
                <TableHead className="w-[50px]"><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.idLanc}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.type === 'entrada'
                          ? <ArrowUpCircle className="h-4 w-4 text-green-500 shrink-0" />
                          : <ArrowDownCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className="font-medium">{t.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.category}</TableCell>
                    <TableCell className="text-sm">{new Date(t.transactionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.status === 'pago' ? 'default' : 'outline'}
                        className={cn(t.status === 'pago' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30')}
                      >
                        {t.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('text-right font-mono font-semibold', t.type === 'entrada' ? 'text-green-500' : 'text-red-500')}>
                      {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/financeiro/editor/${t.id}`}>
                              <FilePenLine className="mr-2 h-4 w-4" />Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingTransaction(t)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Aba Nova Transação ─────────────────────────────────
function NovaTransacaoTab({
  accounts, onSuccess, onCancel,
}: {
  accounts: ChartOfAccount[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: 'saida',
      category: '',
      transactionDate: formatDate(new Date(), 'yyyy-MM-dd'),
      status: 'pago',
      dueDate: '',
    },
  });

  const watchedType = form.watch('type');
  const watchedStatus = form.watch('status');

  const categories = useMemo(() =>
    accounts.filter(a => a.type === watchedType).map(a => a.name).sort(),
    [accounts, watchedType]
  );

  useEffect(() => {
    form.setValue('category', '');
  }, [watchedType, form]);

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    const formData = new FormData();
    formData.append('description', values.description);
    formData.append('amount', String(values.amount));
    formData.append('type', values.type);
    formData.append('category', values.category);
    formData.append('transactionDate', values.transactionDate);
    formData.append('status', values.status);
    if (values.dueDate) formData.append('dueDate', values.dueDate);

    const result = await upsertTransaction(formData);
    if (result.success) {
      toast({ title: 'Lançamento adicionado com sucesso!' });
      form.reset({
        description: '', amount: 0, type: 'saida', category: '',
        transactionDate: formatDate(new Date(), 'yyyy-MM-dd'), status: 'pago', dueDate: '',
      });
      onSuccess();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: result.error });
    }
    setIsSaving(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Nova Transação Financeira</CardTitle>
            <CardDescription>Preencha os detalhes para registrar um novo lançamento no caixa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Input placeholder={watchedType === 'entrada' ? 'Ex: Venda do Pedido #123' : 'Ex: Compra de matéria-prima'} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="entrada">Receita (Entrada)</SelectItem>
                      <SelectItem value="saida">Despesa (Saída)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="transactionDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione uma categoria..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {watchedStatus === 'pendente' && (
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

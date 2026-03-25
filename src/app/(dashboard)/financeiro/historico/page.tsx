'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';
import { getTransactions, getAccounts, deleteTransaction } from '../actions';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileDown,
  FilePenLine,
  MoreHorizontal,
  PlusCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { ExportTransactionsPdfDialog } from '@/components/dashboard/export-transactions-pdf-dialog';

type DateRange = {
  from?: Date;
  to?: Date;
};

export default function FinancialHistoryPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pago' | 'pendente'>('todos');

  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      const [transactionsResult] = await Promise.all([
        getTransactions(),
      ]);

      if (transactionsResult.success) {
        setTransactions(transactionsResult.transactions || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar transações',
          description: transactionsResult.error,
        });
      }
      
      setLoading(false);
    };

    fetchFinancialData();
  }, [toast]);

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    const result = await deleteTransaction(deletingTransaction.id);
    if (result.success) {
        toast({ title: 'Transação Excluída' });
        setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
    } else {
        toast({ variant: 'destructive', title: 'Erro ao Excluir', description: result.error });
    }
    setDeletingTransaction(null);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const transactionDate = new Date(t.transactionDate);
      const inDateRange = !dateRange?.from || isWithinInterval(transactionDate, {
        start: dateRange.from,
        end: dateRange.to || new Date(8640000000000000), // Far future date
      });

      const matchesSearch = searchTerm === '' ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'todos' || t.type === typeFilter;
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;

      return inDateRange && matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, dateRange, searchTerm, typeFilter, statusFilter]);

  return (
    <>
      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                    Isto irá excluir permanentemente a transação &quot;{deletingTransaction?.description}&quot;.
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
        transactions={filteredTransactions}
      />
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>
                Visualize, filtre e gerencie todas as suas transações financeiras.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button asChild>
                <Link href="/financeiro/editor">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nova Transação
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t">
              <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Buscar por descrição..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="grid gap-2">
                <Input
                  type="date"
                  value={formatDateForInput(dateRange?.from)}
                  onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value ? new Date(e.target.value + "T00:00:00") : undefined}))}
                />
              </div>
              <div className="grid gap-2">
                <Input
                  type="date"
                  value={formatDateForInput(dateRange?.to)}
                  onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value ? new Date(e.target.value + "T23:59:59") : undefined}))}
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="todos">Todos Tipos</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="saida">Saídas</SelectItem>
                  </SelectContent>
              </Select>
               <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
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
                <TableHead>ID Lanç.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-code">{t.idLanc}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.type === 'entrada' ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium">{t.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell>{new Date(t.transactionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'pago' ? 'default' : 'outline'} className={cn(t.status === 'pago' && 'bg-green-500/80')}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className={cn("text-right font-code font-semibold", t.type === 'entrada' ? 'text-green-500' : 'text-red-500')}>
                      {t.type === 'entrada' ? '+ ' : '- '} {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/financeiro/editor/${t.id}`}>
                              <FilePenLine className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingTransaction(t)}><Trash2 className="mr-2 h-4 w-4" /><span>Excluir</span></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">Nenhuma transação encontrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

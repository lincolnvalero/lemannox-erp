
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  Search,
  FilePenLine,
  Trash2,
  MoreHorizontal,
  ListFilter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
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

import { getQuotes, deleteQuote } from './actions';
import type { Quote } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const quoteStatusVariant = (status: Quote['status']) => {
  switch (status) {
    case 'aprovado':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'enviado':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'rascunho':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'rejeitado':
       return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'faturado':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'produzindo':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'entregue':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    default:
      return 'secondary';
  }
};
const quoteStatuses: Quote['status'][] = ['rascunho', 'enviado', 'aprovado', 'rejeitado', 'faturado', 'produzindo', 'entregue'];

export default function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(
    quoteStatuses.filter((s) => s !== 'entregue')
  );
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>(statusFilter);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  useEffect(() => {
    const fetchQuotes = async () => {
      setLoading(true);
      const result = await getQuotes();
      if (result.success) {
        setQuotes(result.quotes || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar orçamentos',
          description: result.error,
        });
      }
      setLoading(false);
    };

    fetchQuotes();
  }, [toast]);

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;
    const result = await deleteQuote(quoteToDelete.id);
    if(result.success) {
      setQuotes((prev) => prev.filter((q) => q.id !== quoteToDelete.id));
      toast({
        title: 'Orçamento Excluído',
        description: `O orçamento #${quoteToDelete.quoteNumber} foi removido com sucesso.`,
      });
    } else {
        toast({
            variant: 'destructive',
            title: 'Erro ao excluir',
            description: result.error
        });
    }
    setQuoteToDelete(null);
  };
  
  const handleFilterOpenChange = (open: boolean) => {
    if (open) {
      setTempStatusFilter(statusFilter);
    }
    setFilterMenuOpen(open);
  };

  const applyStatusFilter = () => {
    setStatusFilter(tempStatusFilter);
    setFilterMenuOpen(false);
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || String(quote.quoteNumber).includes(searchTerm);
    const matchesStatus = statusFilter.length > 0 ? statusFilter.includes(quote.status) : false;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <AlertDialog
        open={!!quoteToDelete}
        onOpenChange={() => setQuoteToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir
              permanentemente o orçamento &quot;#{quoteToDelete?.quoteNumber}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Histórico de Orçamentos</CardTitle>
                <CardDescription>
                    Visualize, gerencie e crie novos orçamentos para seus clientes.
                </CardDescription>
              </div>
               <Link href="/quotes/editor">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Novo Orçamento
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-2 pt-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente ou número..."
                        className="w-full rounded-lg bg-background pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <DropdownMenu open={filterMenuOpen} onOpenChange={handleFilterOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between">
                      Status ({statusFilter.length})
                      <ListFilter className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[200px]" align="end">
                    <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {quoteStatuses.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        className="capitalize"
                        checked={tempStatusFilter.includes(status)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempStatusFilter((prev) => [...prev, status]);
                          } else {
                            setTempStatusFilter((prev) =>
                              prev.filter((s) => s !== status)
                            );
                          }
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 focus:bg-transparent">
                      <Button onClick={applyStatusFilter} className="w-full" size="sm">
                        Aplicar Filtros
                      </Button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredQuotes.length > 0 ? (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium font-code">#{quote.quoteNumber}</TableCell>
                      <TableCell>{quote.customerName}</TableCell>
                      <TableCell>{quote.obra || '-'}</TableCell>
                      <TableCell>{new Date(quote.date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('capitalize', quoteStatusVariant(quote.status))}
                        >
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-code">
                        {formatCurrency(quote.total)}
                      </TableCell>
                       <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/quotes/editor/${quote.id}`}>
                                  <FilePenLine className="mr-2 h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setQuoteToDelete(quote)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum orçamento encontrado.
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

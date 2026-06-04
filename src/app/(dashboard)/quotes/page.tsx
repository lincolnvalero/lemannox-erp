
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

import { getQuotes, deleteQuote, getQuote } from './actions';
import type { Quote } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { QuotePreview } from '@/components/dashboard/quote-preview';

const formatMaterial = (material: string) => {
  if (!material) return '';
  if (material.toLowerCase() === 'aço carbono') return 'Carbono';
  return material;
};

const formatItemLabel = (item: { name: string; material?: string }) => {
  const mat = item.material ? ` - ${formatMaterial(item.material)}` : '';
  return `${item.name}${mat}`;
};

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
  const router = useRouter();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(
    quoteStatuses.filter((s) => s !== 'entregue')
  );
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>(statusFilter);
  // Estados SEPARADOS para os dois dropdowns (evita abrir ambos ao mesmo tempo)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenPreview = async (quoteId: string) => {
    setLoadingPreview(true);
    const result = await getQuote(quoteId);
    if (result.success && result.quote) {
      setPreviewQuote(result.quote);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar orçamento', description: result.error });
    }
    setLoadingPreview(false);
  };

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
  
  const handleMobileFilterOpen = (open: boolean) => {
    if (open) setTempStatusFilter(statusFilter);
    setMobileFilterOpen(open);
  };

  const handleDesktopFilterOpen = (open: boolean) => {
    if (open) setTempStatusFilter(statusFilter);
    setDesktopFilterOpen(open);
  };

  const applyMobileFilter = () => {
    setStatusFilter(tempStatusFilter);
    setMobileFilterOpen(false);
  };

  const applyDesktopFilter = () => {
    setStatusFilter(tempStatusFilter);
    setDesktopFilterOpen(false);
  };

  // Memoizado para evitar recomputação a cada render
  const filteredQuotes = useMemo(() => quotes.filter(quote => {
    const matchesSearch = quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || String(quote.quoteNumber).includes(searchTerm);
    const matchesStatus = statusFilter.length > 0 ? statusFilter.includes(quote.status) : false;
    return matchesSearch && matchesStatus;
  }), [quotes, searchTerm, statusFilter]);

  // Reseta para página 1 ao mudar filtro ou busca
  useEffect(() => { setPage(1); }, [statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const pageQuotes = useMemo(
    () => filteredQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredQuotes, page, PAGE_SIZE]
  );

  const STATUS_LABEL_BR: Record<string, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
    rejeitado: 'Rejeitado', faturado: 'Faturado', produzindo: 'Em Prod.', entregue: 'Entregue',
  };

  return (
    <>
      {/* Preview Dialog */}
      <Dialog open={!!previewQuote} onOpenChange={(open) => { if (!open) setPreviewQuote(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {previewQuote && <QuotePreview quote={previewQuote} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!quoteToDelete} onOpenChange={() => setQuoteToDelete(null)}>
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
            <AlertDialogAction onClick={handleDeleteQuote}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-3 md:p-0">
        {/* ═══ Toolbar ═══ */}
        <div className="flex flex-wrap items-center gap-2 mb-3 md:hidden">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8 h-9 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu open={mobileFilterOpen} onOpenChange={handleMobileFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <ListFilter className="h-4 w-4" />
                <span className="text-xs">({statusFilter.length})</span>
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
                    if (checked) setTempStatusFilter((prev) => [...prev, status]);
                    else setTempStatusFilter((prev) => prev.filter((s) => s !== status));
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  {STATUS_LABEL_BR[status] ?? status}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 focus:bg-transparent">
                <Button onClick={applyMobileFilter} className="w-full" size="sm">Aplicar</Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/quotes/editor">
            <Button size="sm" className="h-9 gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Novo
            </Button>
          </Link>
        </div>

        {/* ═══ MOBILE: Card list ═══ */}
        <div className="md:hidden space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-5 w-40" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum orçamento encontrado.
            </div>
          ) : pageQuotes.map((quote) => (
            <div key={quote.id} className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Número + status */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <button onClick={() => handleOpenPreview(quote.id)} disabled={loadingPreview} className="text-xs font-mono text-muted-foreground hover:text-primary hover:underline disabled:opacity-50">#{quote.quoteNumber}</button>
                    <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', quoteStatusVariant(quote.status))}>
                      {STATUS_LABEL_BR[quote.status] ?? quote.status}
                    </Badge>
                  </div>
                  {/* Cliente */}
                  <p className="font-semibold text-sm leading-tight">{quote.customerName}</p>
                  {/* Obra */}
                  {quote.obra && (
                    <p className="text-xs text-muted-foreground mt-0.5">{quote.obra}</p>
                  )}
                  {/* Data + valor */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(quote.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-sm font-bold font-mono">{formatCurrency(quote.total)}</span>
                  </div>
                </div>
                {/* Ações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => window.location.assign(`/quotes/editor?id=${quote.id}`)}>
                      <FilePenLine className="mr-2 h-4 w-4" />
                      Editar
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
              </div>
            </div>
          ))}
        </div>

        {/* ═══ DESKTOP: Card + Table ═══ */}
        <Card className="hidden md:block">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Histórico de Orçamentos</CardTitle>
                <CardDescription>Visualize, gerencie e crie novos orçamentos para seus clientes.</CardDescription>
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
              <DropdownMenu open={desktopFilterOpen} onOpenChange={handleDesktopFilterOpen}>
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
                        if (checked) setTempStatusFilter((prev) => [...prev, status]);
                        else setTempStatusFilter((prev) => prev.filter((s) => s !== status));
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {STATUS_LABEL_BR[status] ?? status}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 focus:bg-transparent">
                    <Button onClick={applyDesktopFilter} className="w-full" size="sm">Aplicar Filtros</Button>
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
                  <TableHead>Produto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[72px]"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredQuotes.length > 0 ? (
                  pageQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        <button
                          onClick={() => handleOpenPreview(quote.id)}
                          disabled={loadingPreview}
                          className="font-medium font-mono hover:text-primary hover:underline cursor-pointer text-sm disabled:opacity-50"
                        >
                          #{quote.quoteNumber}
                        </button>
                      </TableCell>
                      <TableCell>{quote.customerName}</TableCell>
                      <TableCell>{quote.obra || '-'}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {quote.items.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-muted-foreground truncate">{formatItemLabel(item)}</p>
                        ))}
                        {quote.items.length > 2 && (
                          <p className="text-xs text-muted-foreground">+{quote.items.length - 2} item(s)</p>
                        )}
                      </TableCell>
                      <TableCell>{new Date(quote.date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize', quoteStatusVariant(quote.status))}>
                          {STATUS_LABEL_BR[quote.status] ?? quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-code">{formatCurrency(quote.total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/quotes/editor?id=${quote.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Editar orçamento"
                          >
                            <FilePenLine className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Excluir orçamento"
                            onClick={() => setQuoteToDelete(quote)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum orçamento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/* Paginação desktop */}
            {filteredQuotes.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-2 pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredQuotes.length)} de {filteredQuotes.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginação mobile */}
        {filteredQuotes.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3 md:hidden">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredQuotes.length)} de {filteredQuotes.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

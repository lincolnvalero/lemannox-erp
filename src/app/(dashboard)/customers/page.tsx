
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Customer } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  PlusCircle,
  FilePenLine,
  Trash2,
  MessageSquare,
  Pencil,
  MapPin,
  Mail,
  Users,
} from 'lucide-react';
import { AddCustomerDialog } from '@/components/dashboard/add-customer-dialog';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
  getCustomers,
  deleteCustomer,
  patchCustomer,
} from './actions';
import { Skeleton } from '@/components/ui/skeleton';

type InlineField = 'tradeName' | 'contactPhone';
type InlineEdit = { id: string; field: InlineField; value: string } | null;

const CATEGORY_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  revendedor: 'Revendedor',
  construtora: 'Construtora',
  pessoa_fisica: 'Pessoa Física',
};

const CATEGORY_COLOR: Record<string, string> = {
  cliente: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  revendedor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  construtora: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  pessoa_fisica: 'bg-green-500/15 text-green-400 border-green-500/30',
};

export default function CustomersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit>(null);
  const inlineRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const result = await getCustomers();
    if (result.success) {
      setCustomers(result.customers || []);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao buscar clientes', description: result.error });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDialogOpen = (customer: Customer | null) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleSaveSuccess = (savedCustomer: Customer) => {
    setCustomers(prev => {
      const idx = prev.findIndex(c => c.id === savedCustomer.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = savedCustomer;
        return next;
      }
      return [...prev, savedCustomer].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    const result = await deleteCustomer(customerToDelete.id);
    if (result.success) {
      toast({ title: 'Cliente excluído', description: `"${customerToDelete.name}" removido.` });
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
    } else {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: result.error });
    }
    setCustomerToDelete(null);
  };

  const startInlineEdit = useCallback((id: string, field: InlineField, current: string) => {
    setInlineEdit({ id, field, value: current });
    setTimeout(() => inlineRef.current?.focus(), 0);
  }, []);

  const commitInlineEdit = useCallback(async () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    setInlineEdit(null);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value || undefined } : c));
    const dbField = field === 'tradeName' ? 'trade_name' : 'contact_phone';
    const result = await patchCustomer(id, { [dbField]: value || null });
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
      fetchCustomers();
    }
  }, [inlineEdit, toast, fetchCustomers]);

  const filtered = customers.filter(c => {
    const matchSearch =
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.tradeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.cnpj || '').includes(searchTerm);
    const matchCat = categoryFilter === 'all' || c.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <>
      <AddCustomerDialog
        open={isDialogOpen}
        onOpenChange={() => { setIsDialogOpen(false); setEditingCustomer(null); }}
        onSaveSuccess={handleSaveSuccess}
        editingCustomer={editingCustomer}
      />
      <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente &quot;{customerToDelete?.name}&quot; será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-1 flex-col">
        {/* Header — sticky abaixo do top bar mobile */}
        <header className="sticky top-14 md:top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
          {/* Linha 1: Título (desktop) + ações */}
          <div className="flex items-center gap-3 px-4 py-2 md:py-0 md:h-16 md:px-8">
            <div className="hidden md:flex items-center gap-2 mr-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-lg font-bold">Clientes</h1>
            </div>

            {/* Mobile: busca full-width + botão */}
            <div className="flex flex-1 md:ml-auto items-center gap-2 md:flex-none">
              <div className="relative flex-1 md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-8 h-9 w-full md:w-[220px] lg:w-[300px]"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtro categoria — apenas desktop */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[160px] hidden md:flex">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="revendedor">Revendedor</SelectItem>
                  <SelectItem value="construtora">Construtora</SelectItem>
                  <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>

              <Button className="h-9 gap-1.5 shrink-0" onClick={() => handleDialogOpen(null)}>
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Cliente</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>

          {/* Linha 2: Filtro categoria no mobile */}
          <div className="flex md:hidden items-center gap-2 px-4 pb-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="revendedor">Revendedor</SelectItem>
                <SelectItem value="construtora">Construtora</SelectItem>
                <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
              </SelectContent>
            </Select>
            {!loading && (
              <span className="text-xs text-muted-foreground shrink-0">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-3 md:p-8">
          {/* ═══ MOBILE: Card list ═══ */}
          <div className="md:hidden space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum cliente encontrado.
              </div>
            ) : filtered.map(customer => (
              <div
                key={customer.id}
                className="rounded-xl border bg-card px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  {/* Nome + categoria */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm leading-tight">{customer.name}</span>
                    {customer.category && (
                      <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', CATEGORY_COLOR[customer.category])}>
                        {CATEGORY_LABEL[customer.category] ?? customer.category}
                      </Badge>
                    )}
                  </div>

                  {/* Nome fantasia */}
                  {inlineEdit?.id === customer.id && inlineEdit.field === 'tradeName' ? (
                    <input
                      ref={inlineRef}
                      className="mt-0.5 text-xs h-6 px-1.5 rounded border border-primary bg-background text-foreground w-full focus:outline-none"
                      value={inlineEdit.value}
                      placeholder="nome fantasia"
                      onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : prev)}
                      onBlur={commitInlineEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                        if (e.key === 'Escape') setInlineEdit(null);
                      }}
                    />
                  ) : (
                    <button
                      className="mt-0.5 text-xs text-muted-foreground italic flex items-center gap-1"
                      onClick={() => startInlineEdit(customer.id, 'tradeName', customer.tradeName ?? '')}
                    >
                      {customer.tradeName ?? <span className="opacity-40 not-italic">+ nome fantasia</span>}
                      <Pencil className="h-2.5 w-2.5 opacity-40" />
                    </button>
                  )}

                  {/* Linha de detalhes */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {customer.cnpj && (
                      <span className="text-[11px] font-mono text-muted-foreground">{customer.cnpj}</span>
                    )}
                    {customer.contactPhone && (
                      <a
                        href={`https://wa.me/55${customer.contactPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5 hover:text-primary"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {customer.contactPhone}
                      </a>
                    )}
                    {customer.city && (
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {customer.city}{customer.state ? `/${customer.state}` : ''}
                      </span>
                    )}
                    {customer.email && (
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5 hover:text-primary"
                      >
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </a>
                    )}
                  </div>
                </div>

                {/* Ações mobile */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDialogOpen(customer)}>
                    <FilePenLine className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setCustomerToDelete(customer)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ═══ DESKTOP: Table ═══ */}
          <Card className="hidden md:block">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Clientes</CardTitle>
                  <CardDescription>Visualize e edite os dados cadastrais.</CardDescription>
                </div>
                {!loading && (
                  <span className="text-sm text-muted-foreground">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 min-w-[200px]">Cliente</TableHead>
                    <TableHead className="hidden md:table-cell w-[150px]">CNPJ / CPF</TableHead>
                    <TableHead className="hidden lg:table-cell">E-mail</TableHead>
                    <TableHead className="hidden lg:table-cell w-[140px]">Cidade</TableHead>
                    <TableHead className="hidden md:table-cell w-[130px]">Categoria</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6"><Skeleton className="h-10 w-48" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell className="pl-6 py-3">
                        <div className="font-medium leading-tight">{customer.name}</div>
                        <div className="mt-0.5 flex items-center gap-1 group/trade">
                          {inlineEdit?.id === customer.id && inlineEdit.field === 'tradeName' ? (
                            <input
                              ref={inlineRef}
                              className="text-xs h-5 px-1.5 rounded border border-primary bg-background text-foreground w-44 focus:outline-none"
                              value={inlineEdit.value}
                              placeholder="nome fantasia"
                              onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : prev)}
                              onBlur={commitInlineEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                if (e.key === 'Escape') setInlineEdit(null);
                              }}
                            />
                          ) : (
                            <button
                              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                              onClick={() => startInlineEdit(customer.id, 'tradeName', customer.tradeName ?? '')}
                            >
                              {customer.tradeName
                                ? <span className="italic">{customer.tradeName}</span>
                                : <span className="opacity-35">+ nome fantasia</span>}
                              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/trade:opacity-50 transition-opacity" />
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 group/phone">
                          {inlineEdit?.id === customer.id && inlineEdit.field === 'contactPhone' ? (
                            <input
                              ref={inlineRef}
                              className="text-xs h-5 px-1.5 rounded border border-primary bg-background text-foreground w-36 focus:outline-none"
                              value={inlineEdit.value}
                              placeholder="(11) 99999-9999"
                              onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : prev)}
                              onBlur={commitInlineEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                if (e.key === 'Escape') setInlineEdit(null);
                              }}
                            />
                          ) : customer.contactPhone ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={`https://wa.me/55${customer.contactPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-primary transition-colors"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {customer.contactPhone}
                              </a>
                              <button
                                className="opacity-0 group-hover/phone:opacity-50 transition-opacity"
                                onClick={() => startInlineEdit(customer.id, 'contactPhone', customer.contactPhone ?? '')}
                              >
                                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground transition-colors opacity-35 hover:opacity-100"
                              onClick={() => startInlineEdit(customer.id, 'contactPhone', '')}
                            >
                              <MessageSquare className="h-3 w-3" />
                              + telefone
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {customer.cnpj
                          ? <span className="font-mono text-xs text-muted-foreground">{customer.cnpj}</span>
                          : <span className="text-xs text-muted-foreground opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.email ? (
                          <a href={`mailto:${customer.email}`} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors">
                            <Mail className="h-3 w-3 shrink-0" />
                            {customer.email}
                          </a>
                        ) : <span className="text-xs text-muted-foreground opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.city ? (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {customer.city}{customer.state ? ` / ${customer.state}` : ''}
                          </span>
                        ) : <span className="text-xs text-muted-foreground opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {customer.category ? (
                          <Badge variant="outline" className={cn('text-xs', CATEGORY_COLOR[customer.category])}>
                            {CATEGORY_LABEL[customer.category] ?? customer.category}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => handleDialogOpen(customer)}>
                            <FilePenLine className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir" onClick={() => setCustomerToDelete(customer)}>
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
        </main>
      </div>
    </>
  );
}

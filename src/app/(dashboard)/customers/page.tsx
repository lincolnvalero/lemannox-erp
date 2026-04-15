
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
  updateProductionStatus,
  patchCustomer,
} from './actions';
import { Skeleton } from '@/components/ui/skeleton';

type InlineField = 'tradeName' | 'contactPhone';
type InlineEdit = { id: string; field: InlineField; value: string } | null;

const financialBadgeVariant = (status: NonNullable<Customer['financialStatus']> | undefined) => {
  switch (status) {
    case 'Pago':
      return 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30';
    case 'Em dia':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30';
    case 'Vencido':
      return 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30';
    default:
      return 'secondary';
  }
};

const productionBadgeVariant = (status: NonNullable<Customer['productionStatus']> | undefined) => {
  switch (status) {
    case 'Em orçamento':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Aprovado':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Produção':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Entrega':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Devolução para ajuste':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Concluído':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Pausado':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'secondary';
  }
};

const productionStatuses: NonNullable<Customer['productionStatus']>[] = [
  'Em orçamento',
  'Aprovado',
  'Produção',
  'Entrega',
  'Concluído',
  'Devolução para ajuste',
  'Pausado',
];

const customerSegments = [
  'Restaurante',
  'Construtora',
  'Residencial',
  'Design de Interiores',
  'Projetos de Cozinhas',
];

export default function CustomersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [productionStatusFilter, setProductionStatusFilter] = useState('all');
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
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar clientes',
        description: result.error,
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleDialogOpen = (customer: Customer | null) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleSaveSuccess = (savedCustomer: Customer) => {
    setCustomers(currentCustomers => {
        const index = currentCustomers.findIndex(c => c.id === savedCustomer.id);
        if (index !== -1) {
            // Update existing customer
            const newCustomers = [...currentCustomers];
            newCustomers[index] = savedCustomer;
            return newCustomers;
        } else {
            // Add new customer and sort
            const newCustomers = [...currentCustomers, savedCustomer];
            return newCustomers.sort((a, b) => a.name.localeCompare(b.name));
        }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    const result = await deleteCustomer(customerToDelete.id);
    if (result.success) {
      toast({
        title: 'Cliente Excluído',
        description: `O cliente "${customerToDelete.name}" foi removido.`,
      });
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: result.error,
      });
    }
    setCustomerToDelete(null);
  };

  const handleProductionStatusChange = async (
    customerId: string,
    newStatus: Customer['productionStatus']
  ) => {
    const originalCustomers = [...customers];
    setCustomers((prevCustomers) =>
      prevCustomers.map((customer) =>
        customer.id === customerId
          ? { ...customer, productionStatus: newStatus }
          : customer
      )
    );

    const result = await updateProductionStatus(customerId, newStatus);

    if (!result.success) {
      setCustomers(originalCustomers);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: result.error,
      });
    }
  };

  const startInlineEdit = useCallback((id: string, field: InlineField, current: string) => {
    setInlineEdit({ id, field, value: current });
    setTimeout(() => inlineRef.current?.focus(), 0);
  }, []);

  const commitInlineEdit = useCallback(async () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    setInlineEdit(null);

    // Optimistic update
    setCustomers(prev => prev.map(c =>
      c.id === id ? { ...c, [field]: value || undefined } : c
    ));

    const dbField = field === 'tradeName' ? 'trade_name' : 'contact_phone';
    const result = await patchCustomer(id, { [dbField]: value || null });
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
      // Reverte buscando de novo
      fetchCustomers();
    }
  }, [inlineEdit, toast, fetchCustomers]);

  const filteredCustomers = customers.filter((customer) => {
    const name = customer.name || '';
    const company = customer.company || '';
    const productionStatus = customer.productionStatus || '';

    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = segmentFilter === 'all' || company === segmentFilter;
    const matchesProductionStatus =
      productionStatusFilter === 'all' ||
      productionStatus === productionStatusFilter;

    return matchesSearch && matchesSegment && matchesProductionStatus;
  });

  return (
    <>
      <AddCustomerDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        onSaveSuccess={handleSaveSuccess}
        editingCustomer={editingCustomer}
      />
      <AlertDialog
        open={!!customerToDelete}
        onOpenChange={() => setCustomerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir permanentemente
              o cliente &quot;{customerToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
          <h1 className="text-xl font-bold">Clientes</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[280px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="hidden w-[180px] lg:flex">
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Segmentos</SelectItem>
                {customerSegments.map((segment) => (
                  <SelectItem key={segment} value={segment}>
                    {segment}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={productionStatusFilter}
              onValueChange={setProductionStatusFilter}
            >
              <SelectTrigger className="hidden w-[180px] lg:flex">
                <SelectValue placeholder="Status de Produção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {productionStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="gap-2"
              onClick={() => {
                handleDialogOpen(null);
              }}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Novo Cliente</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 space-y-8 p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>
                Visualize, edite ou exclua clientes da sua base de dados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Segmento
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Financeiro
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Produção
                    </TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-40" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          {/* Nome / Razão Social */}
                          <div className="font-medium">{customer.name}</div>

                          {/* Nome Fantasia — inline editável */}
                          <div className="mt-0.5 flex items-center gap-1 group/trade">
                            {inlineEdit?.id === customer.id && inlineEdit.field === 'tradeName' ? (
                              <input
                                ref={inlineRef}
                                className="text-xs h-5 px-1 rounded border border-primary bg-background text-foreground w-40 focus:outline-none"
                                value={inlineEdit.value}
                                onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : prev)}
                                onBlur={commitInlineEdit}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                  if (e.key === 'Escape') setInlineEdit(null);
                                }}
                              />
                            ) : (
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                title="Clique para editar nome fantasia"
                                onClick={() => startInlineEdit(customer.id, 'tradeName', customer.tradeName ?? '')}
                              >
                                {customer.tradeName
                                  ? <span className="italic">{customer.tradeName}</span>
                                  : <span className="opacity-40">+ nome fantasia</span>
                                }
                                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/trade:opacity-60 transition-opacity" />
                              </button>
                            )}
                          </div>

                          {/* Telefone — inline editável */}
                          <div className="mt-0.5 flex items-center gap-1 group/phone">
                            {inlineEdit?.id === customer.id && inlineEdit.field === 'contactPhone' ? (
                              <input
                                ref={inlineRef}
                                className="text-xs h-5 px-1 rounded border border-primary bg-background text-foreground w-36 focus:outline-none"
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
                                  className="text-xs text-muted-foreground hidden items-center gap-1 hover:text-primary md:inline-flex"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {customer.contactPhone}
                                </a>
                                <button
                                  className="opacity-0 group-hover/phone:opacity-60 transition-opacity"
                                  title="Editar telefone"
                                  onClick={() => startInlineEdit(customer.id, 'contactPhone', customer.contactPhone ?? '')}
                                >
                                  <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1 hover:text-foreground transition-colors opacity-40 hover:opacity-100"
                                title="Adicionar telefone"
                                onClick={() => startInlineEdit(customer.id, 'contactPhone', '')}
                              >
                                <MessageSquare className="h-3 w-3" />
                                + telefone
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {customer.company}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={cn(
                              'justify-center',
                              financialBadgeVariant(customer.financialStatus)
                            )}
                          >
                            {customer.financialStatus || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Select
                            value={customer.productionStatus}
                            onValueChange={(newStatus) =>
                              handleProductionStatusChange(
                                customer.id,
                                newStatus as NonNullable<Customer['productionStatus']>
                              )
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                'w-full justify-center border-0 focus:ring-0',
                                productionBadgeVariant(customer.productionStatus)
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {productionStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                handleDialogOpen(customer);
                              }}
                            >
                              <FilePenLine className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setCustomerToDelete(customer)}
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
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nenhum cliente encontrado. Comece a adicionar novos
                        clientes!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}

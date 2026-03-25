
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Supplier } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, PlusCircle, FilePenLine, Trash2 } from 'lucide-react';
import { AddSupplierDialog } from '@/components/dashboard/add-supplier-dialog';
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
import { getSuppliers, deleteSupplier } from './actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuppliersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const result = await getSuppliers();
    if (result.success) {
      setSuppliers(result.suppliers || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Fornecedores',
        description: result.error,
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSaveSuccess = () => {
    setEditingSupplier(null);
    fetchSuppliers();
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;
    const result = await deleteSupplier(supplierToDelete.id);
    if (result.success) {
      toast({
        title: 'Fornecedor Excluído',
        description: `O fornecedor "${supplierToDelete.name}" foi removido.`,
      });
      setSuppliers(prev => prev.filter(s => s.id !== supplierToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir',
        description: result.error,
      });
    }
    setSupplierToDelete(null);
  };

  const supplierCategories = [
    ...new Set(suppliers.map((s) => s.category)),
  ].sort();

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch = supplier.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || supplier.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <AddSupplierDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaveSuccess={handleSaveSuccess}
        editingSupplier={editingSupplier}
      />
      <AlertDialog
        open={!!supplierToDelete}
        onOpenChange={() => setSupplierToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir permanentemente o
              fornecedor &quot;{supplierToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Fornecedores</CardTitle>
              <CardDescription>
                Gerencie seus fornecedores de matéria-prima e serviços.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[280px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {supplierCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="gap-2"
                onClick={() => {
                  setEditingSupplier(null);
                  setIsDialogOpen(true);
                }}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Novo Fornecedor</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({length: 4}).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{supplier.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{supplier.contactName}</div>
                      <div className="text-sm text-muted-foreground">
                        {supplier.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setIsDialogOpen(true);
                          }}
                        >
                          <FilePenLine className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setSupplierToDelete(supplier)}
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
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum fornecedor encontrado.
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

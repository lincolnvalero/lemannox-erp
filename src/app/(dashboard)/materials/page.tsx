
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { RawMaterial } from '@/lib/types';
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
import { Button } from '@/components/ui/button';
import { FilePenLine, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getMaterials, deleteMaterial } from './actions';
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
import { AddMaterialDialog } from '@/components/dashboard/add-material-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<RawMaterial | null>(null);
  const { toast } = useToast();

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const result = await getMaterials();
    if (result.success) {
      setMaterials(result.materials || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Materiais',
        description: result.error,
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingMaterial(null);
    setIsDialogOpen(true);
  };

  const handleSaveSuccess = (savedMaterial: RawMaterial) => {
    setMaterials(currentMaterials => {
      const index = currentMaterials.findIndex(m => m.id === savedMaterial.id);
      let newMaterials;
      if (index !== -1) {
        // Update existing item
        newMaterials = [...currentMaterials];
        newMaterials[index] = savedMaterial;
      } else {
        // Add new item
        newMaterials = [...currentMaterials, savedMaterial];
      }
      // Re-sort the list to maintain a consistent order
      newMaterials.sort((a, b) => {
          const categoryA = a.category || '';
          const categoryB = b.category || '';
          const nameA = a.name || '';
          const nameB = b.name || '';
          const categoryCompare = categoryA.localeCompare(categoryB);
          if (categoryCompare !== 0) return categoryCompare;
          return nameA.localeCompare(nameB);
      });
      return newMaterials;
    });
  };

  const handleDeleteConfirm = async () => {
    if (!materialToDelete) return;
    const result = await deleteMaterial(materialToDelete.id);
    if (result.success) {
      toast({
        title: 'Material Excluído',
        description: `O item "${materialToDelete.name}" foi removido.`,
      });
      setMaterials(prev => prev.filter(m => m.id !== materialToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir',
        description: result.error,
      });
    }
    setMaterialToDelete(null);
  };


  return (
    <>
      <AddMaterialDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaveSuccess={handleSaveSuccess}
        editingMaterial={editingMaterial}
      />
      <AlertDialog
        open={!!materialToDelete}
        onOpenChange={() => setMaterialToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir permanentemente o item &quot;{materialToDelete?.name}&quot;.
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

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Catálogo de Matérias-Primas e Custos</h1>
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Item
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Base de Custos</CardTitle>
            <CardDescription>
              Adicione, edite e gerencie todos os materiais, componentes e serviços com seus respectivos custos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Dimensões/Especificação</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : materials.length > 0 ? (
                  materials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">
                        {material.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {material.category === 'Chapa' ? `${material.width}x${material.height}mm` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-code">
                        {formatCurrency(material.price)} / {material.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           <Button variant="ghost" size="icon" onClick={() => handleEdit(material)}>
                            <FilePenLine className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setMaterialToDelete(material)}
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
                      Nenhuma matéria-prima encontrada. Comece a adicionar novos itens.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Product } from '@/lib/types';
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
  Percent,
  FileDown,
} from 'lucide-react';
import { AddProductDialog } from '@/components/dashboard/add-product-dialog';
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
import { ExportProductsPdfDialog } from '@/components/dashboard/export-products-pdf-dialog';
import { getProducts, deleteProduct, bulkUpdatePrices, updateProductPrice } from './actions';
import { Skeleton } from '@/components/ui/skeleton';

const materialColumns = ['Inox 430', 'Inox 304', 'Aço Carbono'];

const ProductsTable = ({
  products,
  handlePriceChange,
  handleEditProduct,
  setProductToDelete,
  isSavingPrice,
}: {
  products: Product[];
  handlePriceChange: (
    productId: string,
    material: string,
    newPriceStr: string
  ) => void;
  handleEditProduct: (product: Product) => void;
  setProductToDelete: (product: Product | null) => void;
  isSavingPrice: string | null;
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[150px]">Categoria</TableHead>
          <TableHead className="min-w-[200px]">Modelo</TableHead>
          <TableHead className="min-w-[150px]">Medida</TableHead>
          {materialColumns.map((material) => (
            <TableHead key={material} className="text-right min-w-[150px]">
              {material}
            </TableHead>
          ))}
          <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.length > 0 ? (
          products.map((product) => {
            const pricesByMaterial = product.variations.reduce(
              (acc, v) => {
                acc[v.material] = v.price;
                return acc;
              },
              {} as Record<string, number>
            );

            return (
              <TableRow key={product.id}>
                <TableCell>{product.category}</TableCell>
                <TableCell className="font-medium">{product.model}</TableCell>
                <TableCell>{product.measurement}</TableCell>
                {product.category === 'Outros' ? (
                  <>
                    <TableCell className="text-right font-code">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-full text-right pr-3 pl-8"
                          defaultValue={
                            pricesByMaterial['Padrão'] !== undefined
                              ? pricesByMaterial['Padrão'].toFixed(2)
                              : ''
                          }
                          placeholder="-"
                          onBlur={(e) =>
                            handlePriceChange(
                              product.id,
                              'Padrão',
                              e.target.value
                            )
                          }
                          disabled={isSavingPrice === `${product.id}-Padrão`}
                        />
                      </div>
                    </TableCell>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground"
                    >
                      Não aplicável
                    </TableCell>
                  </>
                ) : (
                  materialColumns.map((material) => (
                    <TableCell key={material} className="text-right font-code">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-full text-right pr-3 pl-8"
                          defaultValue={
                            pricesByMaterial[material] !== undefined
                              ? pricesByMaterial[material].toFixed(2)
                              : ''
                          }
                          placeholder="-"
                          onBlur={(e) =>
                            handlePriceChange(
                              product.id,
                              material,
                              e.target.value
                            )
                          }
                          disabled={
                            isSavingPrice === `${product.id}-${material}`
                          }
                        />
                      </div>
                    </TableCell>
                  ))
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditProduct(product)}
                    >
                      <FilePenLine className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setProductToDelete(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={materialColumns.length + 4}
              className="h-24 text-center text-muted-foreground"
            >
              Nenhum produto encontrado para os filtros selecionados.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [percentageUpdate, setPercentageUpdate] = useState('');
  const [updateTarget, setUpdateTarget] = useState('all');
  const [isSavingPrice, setIsSavingPrice] = useState<string | null>(null);

  const [productGroup, setProductGroup] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');

  const { toast } = useToast();
  const priceUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const result = await getProducts();
    if (result.success) {
      setProducts(result.products || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar produtos',
        description: result.error,
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setCategoryFilter('all');
  }, [productGroup]);

  useEffect(() => {
    setModelFilter('all');
  }, [categoryFilter]);

  const handleSaveSuccess = (savedProduct: Product) => {
    const getMeasurementValue = (measurement: string): number => {
      if (!measurement) return 0;
      const cleaned = measurement.replace(/^[^0-9]+/, '');
      const match = cleaned.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    setProducts(currentProducts => {
        const index = currentProducts.findIndex(p => p.id === savedProduct.id);
        let newProducts;
        if (index !== -1) {
            newProducts = [...currentProducts];
            newProducts[index] = savedProduct;
        } else {
            newProducts = [...currentProducts, savedProduct];
        }
        
        newProducts.sort((a, b) => {
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            if (a.model < b.model) return -1;
            if (a.model > b.model) return 1;
            const measureA = getMeasurementValue(a.measurement);
            const measureB = getMeasurementValue(b.measurement);
            return measureA - measureB;
        });
        return newProducts;
    });
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    const result = await deleteProduct(productToDelete.id);
    if (result.success) {
      toast({
        title: 'Produto Excluído',
        description: `O produto "${productToDelete.model}" foi removido.`,
      });
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: result.error,
      });
    }
    setProductToDelete(null);
  };
  
  const handleOpenDialog = (product: Product | null) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  }

  const debouncedUpdatePrice = useCallback(
    (productId: string, updatedVariations: Product['variations']) => {
      if (priceUpdateTimeout.current) {
        clearTimeout(priceUpdateTimeout.current);
      }
      priceUpdateTimeout.current = setTimeout(async () => {
        const result = await updateProductPrice(productId, updatedVariations);
        setIsSavingPrice(null);
        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Erro ao salvar',
            description: 'Não foi possível salvar o preço. O valor será revertido.',
          });
          fetchProducts(); // Revert by refetching
        } else {
            toast({
              title: 'Preço Salvo!',
              description: 'O novo preço foi salvo com sucesso.',
            });
        }
      }, 1000); // 1-second debounce
    },
    [fetchProducts, toast]
  );

  const handlePriceChange = (
    productId: string,
    material: string,
    newPriceStr: string
  ) => {
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) && newPriceStr !== '' && newPriceStr !== '.') return;
  
    let variationsToSave: Product['variations'] | undefined;
  
    setProducts(currentProducts =>
      currentProducts.map(p => {
        if (p.id === productId) {
          const variationExists = p.variations.some(
            v => v.material === material
          );
          
          let calculatedVariations: Product['variations'];
  
          if (variationExists) {
            calculatedVariations = p.variations.map(v =>
              v.material === material
                ? { ...v, price: isNaN(newPrice) ? 0 : newPrice }
                : v
            );
          } else {
            calculatedVariations = [
              ...p.variations,
              {
                id: `var-${Date.now()}-${Math.random()}`,
                material: material,
                price: isNaN(newPrice) ? 0 : newPrice,
              },
            ];
          }
          variationsToSave = calculatedVariations;
          return { ...p, variations: calculatedVariations };
        }
        return p;
      })
    );
  
    if (variationsToSave) {
      setIsSavingPrice(`${productId}-${material}`);
      debouncedUpdatePrice(productId, variationsToSave);
    }
  };

  const handleBulkUpdate = async () => {
    const percentage = parseFloat(percentageUpdate);
    if (isNaN(percentage)) {
      toast({
        variant: 'destructive',
        title: 'Valor Inválido',
        description: 'Por favor, insira um percentual válido.',
      });
      return;
    }
    
    setLoading(true);
    const result = await bulkUpdatePrices(percentage, updateTarget);

    if (result.success) {
        toast({
            title: 'Preços Atualizados!',
            description: `Aumento de ${percentage}% aplicado com sucesso.`,
        });
        fetchProducts();
    } else {
        toast({
            variant: 'destructive',
            title: 'Erro na atualização',
            description: result.error,
        });
        setLoading(false);
    }
    setPercentageUpdate('');
  };
  
  const allCategories = useMemo(() => [...new Set(products.map((p) => p.category as string))].filter(Boolean).sort(), [products]);
  const allModels = useMemo(() => [...new Set(products.map((p) => p.model as string))].filter(Boolean).sort(), [products]);

  const searchedProducts = useMemo(() => products.filter((product) =>
    `${product.category} ${product.model} ${product.measurement}`.toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

  const currentCategories = useMemo(() => {
    if (productGroup === 'all') return allCategories;
    const coifaCats = ['Coifa de Cozinha', 'Coifa de Churrasqueira'];
    const grillCats: string[] = ['Grill'];
    const grelhaCats: string[] = ['Grelha'];
    const caixaCats: string[] = ['Caixa Refratária'];
    const outrosCats: string[] = ['Outros'];
    const complementCats = allCategories.filter(c => !coifaCats.includes(c) && !grillCats.includes(c) && !grelhaCats.includes(c) && !caixaCats.includes(c) && !outrosCats.includes(c));
    
    if (productGroup === 'coifas') return coifaCats.filter(c => allCategories.includes(c));
    if (productGroup === 'grills') return grillCats.filter(c => allCategories.includes(c));
    if (productGroup === 'grelhas') return grelhaCats.filter(c => allCategories.includes(c));
    if (productGroup === 'caixas') return caixaCats.filter(c => allCategories.includes(c));
    if (productGroup === 'complementos') return complementCats;
    if (productGroup === 'outros') return outrosCats.filter(c => allCategories.includes(c));
    return [];
  }, [productGroup, allCategories]);

  const currentModels = useMemo(() => {
      if (categoryFilter === 'all') return [];
      return [...new Set(searchedProducts.filter(p => p.category === categoryFilter).map(p => p.model))].sort();
  }, [categoryFilter, searchedProducts]);
  
  const filteredProducts = useMemo(() => {
      return searchedProducts.filter(p => {
          let groupMatch = true;
          if (productGroup !== 'all') {
              const coifaCats = ['Coifa de Cozinha', 'Coifa de Churrasqueira'];
              const grillCats: string[] = ['Grill'];
              const grelhaCats: string[] = ['Grelha'];
              const caixaCats: string[] = ['Caixa Refratária'];
              const outrosCats: string[] = ['Outros'];
              
              if (productGroup === 'coifas') {
                  groupMatch = coifaCats.includes(p.category);
              } else if (productGroup === 'grills') {
                  groupMatch = grillCats.includes(p.category);
              } else if (productGroup === 'grelhas') {
                  groupMatch = grelhaCats.includes(p.category);
              } else if (productGroup === 'caixas') {
                  groupMatch = caixaCats.includes(p.category);
              } else if (productGroup === 'outros') {
                  groupMatch = outrosCats.includes(p.category);
              } else if (productGroup === 'complementos') {
                  groupMatch = !coifaCats.includes(p.category) && !grillCats.includes(p.category) && !grelhaCats.includes(p.category) && !caixaCats.includes(p.category) && !outrosCats.includes(p.category);
              }
          }
          
          if (!groupMatch) return false;
          
          const categoryMatch = categoryFilter === 'all' || p.category === categoryFilter;
          const modelMatch = modelFilter === 'all' || p.model === modelFilter;
          
          return categoryMatch && modelMatch;
      });
  }, [searchedProducts, productGroup, categoryFilter, modelFilter]);


  return (
    <>
      <AddProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingProduct={editingProduct}
        categories={allCategories}
        onSaveSuccess={handleSaveSuccess}
      />
      <AlertDialog
        open={!!productToDelete}
        onOpenChange={() => setProductToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir
              permanentemente o produto &quot;{productToDelete?.model}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ExportProductsPdfDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        products={products}
        categories={allCategories}
        materials={materialColumns}
      />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-auto flex-wrap items-center justify-between gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur-sm md:px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Produtos</h1>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por categoria, modelo..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[240px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <div className="flex items-center gap-2 border-l pl-2 ml-auto">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Aumento"
                  className="w-[110px] pl-8"
                  value={percentageUpdate}
                  onChange={(e) => setPercentageUpdate(e.target.value)}
                />
                <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Select value={updateTarget} onValueChange={setUpdateTarget}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Aplicar a..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tabela Inteira</SelectItem>
                  {allModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleBulkUpdate} disabled={!percentageUpdate || loading}>
                Aplicar
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsExportDialogOpen(true)}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              className="gap-2"
              onClick={() => handleOpenDialog(null)}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Novo Produto</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 space-y-8 p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Tabela de Preços</CardTitle>
              <CardDescription>
                Navegue e filtre as categorias para visualizar e editar os produtos. Os preços podem ser alterados diretamente na tabela.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex flex-wrap items-center gap-4 mb-4">
                    <Select value={productGroup} onValueChange={(value) => setProductGroup(value)}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue placeholder="Filtrar Grupo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Grupos</SelectItem>
                            <SelectItem value="coifas">Coifas</SelectItem>
                            <SelectItem value="grills">Grills</SelectItem>
                            <SelectItem value="grelhas">Grelhas</SelectItem>
                            <SelectItem value="caixas">Caixas Refratárias</SelectItem>
                            <SelectItem value="complementos">Complementos</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                    </Select>
                    {productGroup !== 'all' && (
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="Filtrar Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {productGroup === 'coifas' ? 'Todas as Coifas' : 
                                     productGroup === 'grills' ? 'Todos os Grills' :
                                     productGroup === 'grelhas' ? 'Todas as Grelhas' :
                                     productGroup === 'caixas' ? 'Todas as Caixas' :
                                     productGroup === 'outros' ? 'Todos os Outros' :
                                     'Todas as Categorias'}
                                </SelectItem>
                                {currentCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    )}
                    {categoryFilter !== 'all' && (
                         <Select value={modelFilter} onValueChange={setModelFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filtrar Modelo" />
                            </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="all">Todos os Modelos</SelectItem>
                                {currentModels.map(model => (<SelectItem key={model} value={model}>{model}</SelectItem>))}
                             </SelectContent>
                         </Select>
                    )}
                </div>
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : (
                    <ProductsTable
                      products={filteredProducts}
                      handlePriceChange={handlePriceChange}
                      handleEditProduct={handleOpenDialog}
                      setProductToDelete={setProductToDelete}
                      isSavingPrice={isSavingPrice}
                    />
                )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}


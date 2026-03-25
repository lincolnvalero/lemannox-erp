
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { Save, Trash2, X, PlusCircle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Customer, Product, Quote } from '@/lib/types';
import { getCustomers } from '@/app/(dashboard)/customers/actions';
import { getProducts } from '@/app/(dashboard)/products/actions';
import { getQuote, upsertQuote } from '@/app/(dashboard)/quotes/actions';
import { cn, formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { QuotePreview } from '@/components/dashboard/quote-preview';
import { OsEditor } from '@/components/dashboard/os-editor';


const quoteItemSchema = z.object({
  productId: z.string(),
  name: z.string().min(1, 'A descrição é obrigatória.'),
  measurement: z.string(),
  quantity: z.coerce.number().min(0.01, 'Quantidade deve ser maior que 0.'),
  material: z.string().min(1, 'Material é obrigatório.'),
  unitPrice: z.coerce.number().min(0, 'Preço deve ser positivo.'),
  tax: z.coerce.number().min(0, 'Imposto deve ser positivo.'),
  total: z.number(),
});

const quoteSchema = z.object({
  customerId: z.string().min(1, 'O cliente é obrigatório.'),
  date: z.string().min(1, 'A data é obrigatória.'),
  expiryDate: z.string().optional(),
  status: z.enum(['rascunho', 'enviado', 'aprovado', 'rejeitado', 'faturado', 'produzindo', 'entregue']),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um item.'),
  notes: z.string().optional(),
  discount: z.coerce.number().min(0, 'Desconto deve ser positivo.'),
  freight: z.coerce.number().min(0, 'Frete deve ser positivo.'),
  cpf: z.string().optional(),
  obra: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryTime: z.string().optional(),
  manufacturingDeadline: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  customerName: z.string().optional(),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

export default function QuoteEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quoteNumber, setQuoteNumber] = useState<number | null>(null);
  
  const [addItemGroup, setAddItemGroup] = useState('');
  const [addItemCategory, setAddItemCategory] = useState('');
  const [addItemModel, setAddItemModel] = useState('');
  const [addItemMeasurement, setAddItemMeasurement] = useState('');
  const [addItemMaterial, setAddItemMaterial] = useState('');

  const quoteId = params.id ? (params.id as string[])[0] : null;
  const isEditMode = !!quoteId;

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'rascunho',
      items: [],
      discount: 0,
      freight: 0,
      cpf: '',
      obra: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      paymentTerms: '50% no pedido, 50% na entrega',
      deliveryTime: '',
      expiryDate: '',
      manufacturingDeadline: '',
      actualDeliveryDate: '',
    },
  });

  const { control, register, watch, setValue, getValues } = form;
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const watchedDiscount = watch('discount');
  const watchedFreight = watch('freight');
  const watchedCustomerId = watch('customerId');

  const allWatchedData = watch();
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === watchedCustomerId) || null,
    [customers, watchedCustomerId]
  );
  
  const fullQuoteDataForOs = isEditMode ? { ...allWatchedData, id: quoteId, quoteNumber: quoteNumber!, customerId: watchedCustomerId, subtotal: 0, total: 0 } as unknown as Quote : null;


  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type === 'change' && name && name.startsWith('items.')) {
        const parts = name.split('.');
        if (parts.length === 3 && (parts[2] === 'quantity' || parts[2] === 'unitPrice')) {
          const index = parseInt(parts[1], 10);
          
          const quantity = getValues(`items.${index}.quantity`);
          const unitPrice = getValues(`items.${index}.unitPrice`);

          const numQuantity = Number(quantity) || 0;
          const numUnitPrice = Number(unitPrice) || 0;

          const newTotal = numQuantity * numUnitPrice;
          const newTax = newTotal * 0.045;

          setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
          setValue(`items.${index}.tax`, newTax, { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, getValues]);


  const totals = useMemo(() => {
    const itemsSubtotal = watchedItems.reduce(
      (acc, item) => acc + (item.total || 0),
      0
    );
    const taxTotal = watchedItems.reduce(
      (acc, item) => acc + (Number(item.tax) || 0),
      0
    );
    const grandTotal =
      itemsSubtotal +
      taxTotal +
      (watchedFreight || 0) -
      (watchedDiscount || 0);

    return {
      itemsSubtotal,
      taxTotal,
      grandTotal,
    };
  }, [watchedItems, watchedDiscount, watchedFreight]);

  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      const customerResult = await getCustomers();
      if (customerResult.success) {
        setCustomers(customerResult.customers || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar clientes',
          description: customerResult.error,
        });
      }

      const productResult = await getProducts();
      if (productResult.success) {
          setProducts(productResult.products || []);
      } else {
          toast({
              variant: 'destructive',
              title: 'Erro ao carregar produtos',
              description: productResult.error
          });
      }

      if (isEditMode && quoteId) {
        const quoteResult = await getQuote(quoteId);
        if (quoteResult.success && quoteResult.quote) {
          const existingQuote = quoteResult.quote;
          setQuoteNumber(existingQuote.quoteNumber);
          form.reset({
            ...existingQuote,
            date: format(new Date(existingQuote.date), 'yyyy-MM-dd'),
            items: existingQuote.items.map((item) => ({ ...item })),
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: quoteResult.error || 'Orçamento não encontrado.',
          });
          router.push('/quotes');
        }
      } else {
        form.setValue('date', format(new Date(), 'yyyy-MM-dd'));
      }
      setIsLoading(false);
    }
    loadData();
  }, [quoteId, isEditMode, router, toast, form]);

  useEffect(() => {
    if (watchedCustomerId) {
      const customer = customers.find((c) => c.id === watchedCustomerId);
      if (customer) {
        setValue('cpf', customer.cnpj || '');
        setValue('customerName', customer.name);
      }
    }
  }, [watchedCustomerId, customers, setValue]);

  const handleMaterialChange = (index: number, newMaterial: string) => {
    const item = getValues(`items.${index}`);
    const product = products.find((p) => p.id === item.productId);
    const variation = product?.variations.find(
      (v) => v.material === newMaterial
    );

    const newUnitPrice = variation?.price || 0;
    const quantity = item.quantity || 0;
    const newTotal = quantity * newUnitPrice;
    const newTax = newTotal * 0.045;

    update(index, {
      ...item,
      material: newMaterial,
      unitPrice: newUnitPrice,
      tax: newTax,
      total: newTotal,
    });
  };

  async function onSubmit(data: QuoteFormValues) {
    setIsSaving(true);
    const result = await upsertQuote(data, quoteId);

    if (result.success) {
      toast({
        title: `Orçamento ${isEditMode ? 'Atualizado' : 'Criado'}!`,
        description: `O orçamento foi salvo com sucesso.`,
      });
      router.push('/quotes');
      router.refresh(); 
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Salvar',
        description: result.error,
      });
      window.scrollTo(0, 0);
    }
    setIsSaving(false);
  }

  // Add Product Logic
  const productGroups = [
    { value: 'coifas', label: 'Coifas' },
    { value: 'grills', label: 'Grills' },
    { value: 'grelhas', label: 'Grelha' },
    { value: 'caixas', label: 'Caixa Refratária' },
    { value: 'complementos', label: 'Complemento' },
    { value: 'outros', label: 'Outros' }
  ];

  const groupToCategoryMap: Record<string, Product['category'][]> = {
    coifas: ['Coifa de Cozinha', 'Coifa de Churrasqueira'],
    grills: ['Grill'],
    grelhas: ['Grelha'],
    caixas: ['Caixa Refratária'],
    complementos: ['Complemento'],
    outros: ['Outros'],
  };

  const availableCategories = useMemo(() => {
    if (!addItemGroup) return [];
    const categoriesForGroup = groupToCategoryMap[addItemGroup] || [];
    return Array.from(new Set(products
        .filter(p => categoriesForGroup.includes(p.category))
        .map(p => p.category)
    )).sort();
  }, [addItemGroup, products]);

  const availableModels = useMemo(() => {
      if (!addItemCategory) return [];
      return Array.from(new Set(products
          .filter(p => p.category === addItemCategory)
          .map(p => p.model)
      )).sort();
  }, [addItemCategory, products]);

  const availableMeasurements = useMemo(() => {
      if (!addItemModel) return [];
      return Array.from(new Set(products
          .filter(p => p.category === addItemCategory && p.model === addItemModel)
          .map(p => p.measurement)
      )).sort();
  }, [addItemCategory, addItemModel, products]);

  const availableMaterials = useMemo(() => {
    if (!addItemMeasurement) return [];
    const product = products.find(p => 
        p.category === addItemCategory &&
        p.model === addItemModel &&
        p.measurement === addItemMeasurement
    );
    return product ? product.variations.map(v => v.material).sort() : [];
  }, [addItemCategory, addItemModel, addItemMeasurement, products]);

  const handleGroupChange = (value: string) => {
      setAddItemGroup(value);
      setAddItemCategory('');
      setAddItemModel('');
      setAddItemMeasurement('');
      setAddItemMaterial('');
  };

  const handleCategoryChange = (value: string) => {
      setAddItemCategory(value);
      setAddItemModel('');
      setAddItemMeasurement('');
      setAddItemMaterial('');
  };

  const handleModelChange = (value: string) => {
      setAddItemModel(value);
      setAddItemMeasurement('');
      setAddItemMaterial('');
  };

  const handleMeasurementChange = (value: string) => {
    setAddItemMeasurement(value);
    const product = products.find(
      (p) =>
        p.category === addItemCategory &&
        p.model === addItemModel &&
        p.measurement === value
    );
    if (product?.category === 'Outros' && product.variations.length > 0) {
      setAddItemMaterial(product.variations[0].material);
    } else {
      setAddItemMaterial('');
    }
  };

  const handleProductAdd = () => {
    const isOutrosCategory = addItemCategory === 'Outros';
    const product = products.find(p => 
        p.category === addItemCategory &&
        p.model === addItemModel &&
        p.measurement === addItemMeasurement
    );
    if (product) {
        const materialToUse = isOutrosCategory ? 'Padrão' : addItemMaterial;
        const variation = product.variations.find(v => v.material === materialToUse);
        if (variation) {
            const price = variation.price || 0;
            const total = 1 * price;
            const tax = total * 0.045;
            append({
                productId: product.id,
                name: product.model,
                measurement: product.measurement,
                quantity: 1,
                material: variation.material,
                unitPrice: price,
                tax: tax,
                total: total,
            });

            // Reset all fields
            setAddItemGroup('');
            setAddItemCategory('');
            setAddItemModel('');
            setAddItemMeasurement('');
            setAddItemMaterial('');
        } else {
            toast({
                variant: 'destructive',
                title: 'Material não encontrado',
                description: 'A variação de material selecionada não foi encontrada para este produto.'
            })
        }
    } else {
        toast({
            variant: 'destructive',
            title: 'Produto não encontrado',
            description: 'Não foi possível adicionar o produto com as especificações selecionadas.'
        })
    }
  };

  const isOutrosCategory = addItemCategory === 'Outros';


  if (isLoading) {
    return <QuoteFormSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8">
       <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditMode ? `Editar Orçamento #${quoteNumber}` : 'Novo Orçamento'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode
                ? `Editando o orçamento para ${selectedCustomer?.name || '...'}`
                : 'Preencha os detalhes para criar um novo orçamento.'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="editor" className="mt-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center no-print">
                <TabsList>
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Visualizar</TabsTrigger>
                    <TabsTrigger value="os" disabled={!isEditMode}>Emitir OS</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 mt-6">
                <Form {...form}>
                <form
                    id="quote-form"
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                >
                    <Card>
                        <CardHeader>
                        <CardTitle>1. Informações do Orçamento</CardTitle>
                        <CardDescription>
                            Detalhes do cliente, prazos e condições de pagamento.
                        </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Cliente</FormLabel>
                                <FormControl>
                                    <Combobox
                                    options={customerOptions}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Selecione um cliente"
                                    searchPlaceholder="Buscar cliente..."
                                    emptyPlaceholder="Nenhum cliente encontrado."
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                control={control}
                                name="cpf"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>CPF / CNPJ</FormLabel>
                                    <FormControl>
                                        <Input placeholder="CPF ou CNPJ do cliente" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={control}
                                name="obra"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Obra</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ID da Obra" {...field} maxLength={20} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <FormField
                                control={control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Data do Orçamento</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="expiryDate"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Validade do Orçamento</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                            control={control}
                            name="paymentTerms"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Condição de Pagamento</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: 50% / 50%" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="rascunho">Rascunho</SelectItem>
                                    <SelectItem value="enviado">Enviado</SelectItem>
                                    <SelectItem value="aprovado">Aprovado</SelectItem>
                                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                                    <SelectItem value="faturado">Faturado</SelectItem>
                                    <SelectItem value="produzindo">Produzindo</SelectItem>
                                    <SelectItem value="entregue">Entregue</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={control}
                                name="deliveryTime"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Previsão de Entrega</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={control}
                                name="manufacturingDeadline"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Término Fabricação</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={control}
                                name="actualDeliveryDate"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Data Entrega</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                        <CardTitle>2. Itens do Orçamento</CardTitle>
                        <CardDescription>
                            Adicione produtos e edite os detalhes. Os totais são calculados
                            automaticamente.
                        </CardDescription>
                        </CardHeader>
                        <CardContent>
                        <div className="p-4 border rounded-lg mb-6 bg-background/50">
                                <h4 className="font-semibold mb-3 text-sm">Adicionar Novo Produto</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                                    <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-xs">Grupo</FormLabel>
                                        <Select value={addItemGroup} onValueChange={handleGroupChange}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {productGroups.map((group) => (
                                                    <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-xs">Categoria</FormLabel>
                                        <Select value={addItemCategory} onValueChange={handleCategoryChange} disabled={!addItemGroup || availableCategories.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableCategories.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-xs">Modelo</FormLabel>
                                        <Select value={addItemModel} onValueChange={handleModelChange} disabled={!addItemCategory || availableModels.length === 0}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableModels.map((model) => (
                                                    <SelectItem key={model} value={model}>{model}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-xs">Medida</FormLabel>
                                        <Select value={addItemMeasurement} onValueChange={handleMeasurementChange} disabled={!addItemModel || availableMeasurements.length === 0}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableMeasurements.map((m) => (
                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                     <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-xs">Material</FormLabel>
                                        <Select value={addItemMaterial} onValueChange={setAddItemMaterial} disabled={!addItemMeasurement || availableMaterials.length === 0 || isOutrosCategory}>
                                            <SelectTrigger><SelectValue placeholder={isOutrosCategory ? 'Padrão' : "Selecione..."} /></SelectTrigger>
                                            <SelectContent>
                                                {availableMaterials.map((material) => (
                                                    <SelectItem key={material} value={material}>{material}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <Button 
                                        type="button" 
                                        onClick={handleProductAdd} 
                                        disabled={!addItemMeasurement || (addItemCategory !== 'Outros' && !addItemMaterial)}
                                        className="w-full lg:w-auto"
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Adicionar
                                    </Button>
                                </div>
                            </div>

                        <div className="overflow-x-auto">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead className="w-[25%]">Produto</TableHead>
                                <TableHead className="w-[150px]">Medida</TableHead>
                                <TableHead className="w-[180px]">Material</TableHead>
                                <TableHead className="w-[80px] text-center">Qtd.</TableHead>
                                <TableHead className="w-[140px] text-right">
                                    Vlr. Unitário
                                </TableHead>
                                <TableHead className="w-[120px] text-right">Impostos</TableHead>
                                <TableHead className="w-[140px] text-right">
                                    Total Item
                                </TableHead>
                                <TableHead className="w-[50px]">
                                    <span className="sr-only">Ações</span>
                                </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((item, index) => {
                                  const product = products.find(p => p.id === item.productId);
                                  const isOutrosItem = product?.category === 'Outros';

                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="align-top">
                                      <Textarea
                                          {...register(`items.${index}.name`)}
                                          className="font-medium min-h-0 h-10 p-2"
                                      />
                                      </TableCell>
                                      <TableCell className="align-top">
                                      <Input
                                          {...register(`items.${index}.measurement`)}
                                          className="min-h-0 h-10 p-2"
                                      />
                                      </TableCell>
                                      <TableCell className="align-top">
                                      <Select
                                          value={item.material}
                                          onValueChange={(value) =>
                                          handleMaterialChange(index, value)
                                          }
                                          disabled={isOutrosItem}
                                      >
                                          <SelectTrigger>
                                          <SelectValue placeholder="Material" />
                                          </SelectTrigger>
                                          <SelectContent>
                                          {products
                                              .find((p) => p.id === item.productId)
                                              ?.variations.map((v) => (
                                              <SelectItem key={v.id} value={v.material}>
                                                  {v.material}
                                              </SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      </TableCell>
                                      <TableCell className="align-top">
                                      <Input
                                          type="number"
                                          {...register(`items.${index}.quantity`)}
                                          className="text-center"
                                      />
                                      </TableCell>
                                      <TableCell className="align-top">
                                      <Input
                                          type="number"
                                          step="0.01"
                                          {...register(`items.${index}.unitPrice`)}
                                          className="text-right"
                                      />
                                      </TableCell>
                                      <TableCell className="align-top text-right font-medium font-code">
                                          {formatCurrency(watchedItems[index]?.tax || 0)}
                                      </TableCell>
                                      <TableCell className="align-top text-right font-medium font-code">
                                      {formatCurrency(watchedItems[index]?.total || 0)}
                                      </TableCell>
                                      <TableCell className="align-top">
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          type="button"
                                          onClick={() => remove(index)}
                                      >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                      </TableCell>
                                  </TableRow>
                                  )
                                })}
                            </TableBody>
                            </Table>
                        </div>
                        
                        {form.formState.errors.items && (
                            <p className="text-sm font-medium text-destructive mt-2">
                            {form.formState.errors.items.message ||
                                form.formState.errors.items.root?.message}
                            </p>
                        )}
                        </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>3. Resumo Financeiro e Observações</CardTitle>
                        <CardDescription>
                          Ajuste os valores finais e adicione notas para o cliente.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Subtotal dos Itens
                              </span>
                              <span className="font-medium font-code">
                                {formatCurrency(totals.itemsSubtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Total de Impostos (4,5%)
                              </span>
                              <span className="font-medium font-code">
                                {formatCurrency(totals.taxTotal)}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold text-lg">
                              <span>Total Bruto</span>
                              <span className="font-code">
                                {formatCurrency(
                                  totals.itemsSubtotal + totals.taxTotal
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={control}
                              name="freight"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Frete</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      className="font-code"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name="discount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Desconto (-)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      className="font-code"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="space-y-2 rounded-lg border-2 border-primary bg-primary/10 p-4">
                            <div className="flex justify-between items-center font-bold text-2xl text-primary">
                              <span className="uppercase">Total Geral</span>
                              <span className="font-code">
                                {formatCurrency(totals.grandTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-4">
                           <FormField
                            control={control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem className="flex flex-col flex-grow">
                                <FormLabel>Observações Adicionais</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="Garantia, validade do orçamento, detalhes técnicos, etc."
                                    className="min-h-[150px] flex-grow"
                                    {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => router.push('/quotes')}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                              <Save className="mr-2 h-4 w-4" />
                              {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    </form>
                </Form>
            </TabsContent>
            <TabsContent value="preview" className="mt-6 print-this">
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="no-print">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Visualização do Orçamento</CardTitle>
                                    <CardDescription>Esta é uma prévia de como o documento será impresso. Use a função "Salvar como PDF" do seu navegador para exportar.</CardDescription>
                                </div>
                                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir / Exportar para PDF</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="print-container">
                             <QuotePreview
                                quote={{ ...allWatchedData, id: quoteId ?? '', quoteNumber: quoteNumber ?? 0, customerId: watchedCustomerId, subtotal: 0, total: 0 } as unknown as Quote}
                             />
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
             <TabsContent value="os" className="flex-1 mt-6">
                <OsEditor quote={fullQuoteDataForOs} />
            </TabsContent>
        </Tabs>
    </div>
  );
}

function QuoteFormSkeleton() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="space-y-8">
         <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/3" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <Skeleton className="h-10 w-full" />
                 <div className="grid md:grid-cols-4 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
               <Skeleton className="h-7 w-1/4" />
               <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-1/2 mt-4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
               <Skeleton className="h-7 w-1/4" />
               <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

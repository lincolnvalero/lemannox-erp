
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getMaterials } from '@/app/(dashboard)/materials/actions';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Bot, Calculator, ReceiptText, TrendingUp, Sparkles, AlertTriangle, XCircle } from 'lucide-react';
import type { RawMaterial } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  width: z.coerce.number().min(0, 'Largura é obrigatória'),
  depth: z.coerce.number().min(0, 'Profundidade é obrigatória'),
  height: z.coerce.number().min(0, 'Altura é obrigatória'),
  sheetDimensions: z.string().optional(),
  materialName1: z.string().optional(), // Para frente/laterais
  materialName2: z.string().optional(), // Para costas/teto
  paintingCost: z.coerce.number().min(0),
  filterCount: z.coerce.number().int().min(0),
  trimLength: z.coerce.number().min(0),
  hasLighting: z.boolean(),
  lightingLampType: z.enum(['none', 'cozinha', 'churrasqueira']),
  lightingLampCount: z.coerce.number().int().min(0),
  lightingFonte: z.boolean(),
  lightingBotoeira: z.boolean(),
  lightingBotao: z.boolean(),
  lightingChicoteCount: z.coerce.number().int().min(0),
  laborCost: z.coerce.number().min(0, "Custo da mão de obra não pode ser negativo"),
  profitMargin: z.coerce.number().min(0, "Margem de lucro não pode ser negativa"),
});

type FormValues = z.infer<typeof formSchema>;

type CalculationResults = {
    sheetCost: number;
    additionalCosts: number;
    totalCost: number;
    finalPrice: number;
    details: { label: string; value: string; }[];
};

export default function CostCalculatorPage() {
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      width: 0,
      depth: 0,
      height: 0,
      sheetDimensions: '',
      materialName1: '',
      materialName2: '',
      paintingCost: 0,
      filterCount: 0,
      trimLength: 0,
      hasLighting: false,
      lightingLampType: 'none',
      lightingLampCount: 0,
      lightingFonte: false,
      lightingBotoeira: false,
      lightingBotao: false,
      lightingChicoteCount: 0,
      laborCost: 0,
      profitMargin: 50,
    },
  });
  
  const resetFormAndResults = () => {
    form.reset({
      width: 0,
      depth: 0,
      height: 0,
      sheetDimensions: '',
      materialName1: '',
      materialName2: '',
      paintingCost: 0,
      filterCount: 0,
      trimLength: 0,
      hasLighting: false,
      lightingLampType: 'none',
      lightingLampCount: 0,
      lightingFonte: false,
      lightingBotoeira: false,
      lightingBotao: false,
      lightingChicoteCount: 0,
      laborCost: 0,
      profitMargin: 50,
    });
    setResults(null);
  }

  const fetchInitialData = useCallback(async () => {
    setIsDataLoading(true);
    const result = await getMaterials();
    if(result.success) {
        setMaterials(result.materials || []);
    } else {
        toast({ variant: 'destructive', title: 'Erro ao carregar materiais', description: result.error });
    }
    resetFormAndResults();
    setIsDataLoading(false);
  }, [toast]);
  
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  
  const uniqueSheetDimensions = useMemo(() => Array.from(
    new Set(
        materials
            .filter(m => m.category === 'Chapa' && m.width && m.height)
            .map(m => `${m.width}x${m.height}`)
    )
    ).map(dim => ({
        value: dim,
        label: `${dim}mm`
    })), [materials]);

  const chapaMaterialNames = useMemo(() => Array.from(
    new Set(
        materials
            .filter(m => m.category === 'Chapa')
            .map(m => m.name)
    )
    ).map(name => ({
        value: name,
        label: name
    })), [materials]);

  const { watch, setValue } = form;
  const watchedHasLighting = watch('hasLighting');
  const watchedLampType = watch('lightingLampType');

  useEffect(() => {
    if (watchedLampType === 'none') {
        setValue('lightingLampCount', 0);
    }
  }, [watchedLampType, setValue]);

  function findMaterialByName(name: string): RawMaterial | undefined {
    return materials.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  function onSubmit(values: FormValues) {
    if (!values.sheetDimensions || !values.materialName1) {
      toast({
        variant: 'destructive',
        title: 'Campos Obrigatórios',
        description: 'Por favor, selecione o tamanho da chapa e o material principal antes de calcular.',
      });
      return;
    }
    setIsLoading(true);
    setResults(null);
    try {
        const details: { label: string; value: string; }[] = [];

        // 1. Sheet Cost Calculation
        const { width, depth, height } = values;

        const [sheetW, sheetH] = values.sheetDimensions.split('x').map(Number);
        
        const runBinPacking = (pieceWidths: number[], sheetWidth: number, sheetPrice: number): { cost: number; displaySheets: number } => {
          if (!pieceWidths || pieceWidths.length === 0) return { cost: 0, displaySheets: 0 };
          
          pieceWidths.sort((a,b) => b - a); // Sort descending for better packing
          const bins: number[] = [];

          for (const pieceW of pieceWidths) {
              if (pieceW > sheetWidth) {
                  throw new Error(`A largura de uma peça (${pieceW}mm) é maior que a da chapa (${sheetWidth}mm).`);
              }
              let placed = false;
              for(let i=0; i < bins.length; i++) {
                  if(pieceW <= bins[i]) {
                      bins[i] -= pieceW;
                      placed = true;
                      break;
                  }
              }
              if (!placed) {
                  bins.push(sheetWidth - pieceW);
              }
          }
          
          let totalCost = 0;
          let displaySheets = 0;

          if (bins.length > 0) {
            bins.forEach(remainingSpace => {
                const leftoverWidth = remainingSpace;
                if (leftoverWidth >= 500) {
                    const usedWidth = sheetWidth - leftoverWidth;
                    totalCost += (usedWidth / sheetWidth) * sheetPrice;
                } else {
                    totalCost += sheetPrice;
                }
            });

            const fullSheets = bins.length - 1;
            const lastSheetUsage = (sheetWidth - bins[bins.length - 1]) / sheetWidth;
            let lastSheetFraction = 0;
            if (lastSheetUsage > 0 && lastSheetUsage <= 0.5) {
                lastSheetFraction = 0.5;
            } else if (lastSheetUsage > 0.5) {
                lastSheetFraction = 1;
            }
            displaySheets = fullSheets + lastSheetFraction;
          }
          
          return { cost: totalCost, displaySheets: displaySheets || bins.length };
        };

        const weldAllowance = 20;
        const commonHeight1 = height;
        if (commonHeight1 > sheetH) {
            throw new Error(`A altura da coifa (${commonHeight1}mm) é maior que a da chapa (${sheetH}mm).`);
        }
        
        // Material 1 (Front + 2 Sides)
        const frontPiece = width;
        const sidePiece = depth + weldAllowance;
        const pieceWidths1 = [frontPiece, sidePiece, sidePiece];
        
        const material1 = materials.find(m => m.name === values.materialName1 && m.width === sheetW && m.height === sheetH);
        if(!material1) throw new Error(`Material '${values.materialName1}' não encontrado para o tamanho de chapa ${values.sheetDimensions}mm. Verifique o cadastro.`);
        
        let costSheets1 = 0;
        let numSheets1 = 0;
        
        const sortedPieces = [...pieceWidths1].sort((a,b) => a-b);
        if (sortedPieces.length === 3 && (sortedPieces[0] + sortedPieces[1]) <= sheetW) {
             const { cost, displaySheets } = runBinPacking([sortedPieces[0] + sortedPieces[1], sortedPieces[2]], sheetW, material1.price);
             costSheets1 = cost;
             numSheets1 = displaySheets;
        } else {
            const { cost, displaySheets } = runBinPacking(pieceWidths1, sheetW, material1.price);
            costSheets1 = cost;
            numSheets1 = displaySheets;
        }
        details.push({label: `Chapas (Frente/Laterais)`, value: `${numSheets1.toFixed(1)} un. de ${material1.name} = ${formatCurrency(costSheets1)}`});

        // Material 2 (Back + Top)
        const material2Name = values.materialName2 || values.materialName1;
        const material2 = materials.find(m => m.name === material2Name && m.width === sheetW && m.height === sheetH);
        if(!material2) throw new Error(`Material '${material2Name}' não encontrado para o tamanho de chapa ${values.sheetDimensions}mm. Verifique o cadastro.`);
        
        const backPiece = { height: height, width: width };
        const topPiece = { height: depth, width: width };
        
        let costSheets2 = 0;
        let numSheets2 = 0;

        if (backPiece.height === topPiece.height) { // Can be packed together
            const { cost, displaySheets } = runBinPacking([backPiece.width, topPiece.width], sheetW, material2.price);
            costSheets2 += cost;
            numSheets2 += displaySheets;
        } else {
             if (backPiece.height > sheetH || topPiece.height > sheetH) {
                 throw new Error(`A altura de uma peça (${Math.max(backPiece.height, topPiece.height)}mm) é maior que a da chapa (${sheetH}mm).`);
             }
             const { cost: costBack, displaySheets: sheetsBack } = runBinPacking([backPiece.width], sheetW, material2.price);
             const { cost: costTop, displaySheets: sheetsTop } = runBinPacking([topPiece.width], sheetW, material2.price);
             costSheets2 = costBack + costTop;
             numSheets2 = sheetsBack + sheetsTop;
        }
        details.push({label: `Chapas (Costas/Teto)`, value: `${numSheets2.toFixed(1)} un. de ${material2.name} = ${formatCurrency(costSheets2)}`});
        
        const sheetCost = costSheets1 + costSheets2;

        // 2. Additional Costs Calculation
        let additionalCosts = 0;
        
        if (values.paintingCost > 0) {
            additionalCosts += values.paintingCost;
            details.push({label: `Custo de Pintura`, value: formatCurrency(values.paintingCost)});
        }
        if (values.filterCount > 0) {
            const filter = findMaterialByName('Filtro Inercial');
            if(filter) {
                const filterCost = values.filterCount * filter.price;
                additionalCosts += filterCost;
                details.push({label: `Filtros Inerciais`, value: `${values.filterCount} un. = ${formatCurrency(filterCost)}`});
            } else {
                 details.push({label: 'Filtros Inerciais', value: 'Material não encontrado'});
            }
        }
        if (values.trimLength > 0) {
            const trim = findMaterialByName('Friso Decorativo');
            if(trim) {
                const trimCost = values.trimLength * trim.price;
                additionalCosts += trimCost;
                details.push({label: `Frisos Decorativos`, value: `${values.trimLength}m = ${formatCurrency(trimCost)}`});
            } else {
                 details.push({label: 'Frisos Decorativos', value: 'Material não encontrado'});
            }
        }
        
        if (values.hasLighting) {
            let lightingCost = 0;
            const lightingDetails: {label: string, value: string}[] = [];

            const checkComponent = (key: keyof FormValues, name: string) => {
                if (values[key]) {
                    const material = findMaterialByName(name);
                    if (material) {
                        lightingCost += material.price;
                        lightingDetails.push({label: `  - ${name}`, value: formatCurrency(material.price)});
                    } else {
                        lightingDetails.push({label: `  - ${name}`, value: 'Não encontrado'});
                    }
                }
            }
            
            if (values.lightingLampType !== 'none' && values.lightingLampCount > 0) {
                const lampName = values.lightingLampType === 'cozinha' ? 'Lâmpada p/ Cozinha' : 'Lâmpada p/ Churrasqueira';
                const lamp = findMaterialByName(lampName);
                if (lamp) {
                    const lampCost = values.lightingLampCount * lamp.price;
                    lightingCost += lampCost;
                    lightingDetails.push({label: `  - ${lampName}`, value: `${values.lightingLampCount} un. = ${formatCurrency(lampCost)}`});
                } else {
                    lightingDetails.push({label: `  - ${lampName}`, value: 'Não encontrado'});
                }
            }
            
            if (values.lightingChicoteCount > 0) {
                const chicote = findMaterialByName('Chicote Elétrico');
                if (chicote) {
                    const chicoteCost = values.lightingChicoteCount * chicote.price;
                    lightingCost += chicoteCost;
                    lightingDetails.push({ label: '  - Chicote Elétrico', value: `${values.lightingChicoteCount} un. = ${formatCurrency(chicoteCost)}` });
                } else {
                    lightingDetails.push({ label: '  - Chicote Elétrico', value: 'Não encontrado' });
                }
            }
            
            checkComponent('lightingFonte', 'Fonte de Alimentação');
            checkComponent('lightingBotoeira', 'Botoeira Pulsante');
            checkComponent('lightingBotao', 'Botão Interruptor');
            
            if (lightingCost > 0) {
                additionalCosts += lightingCost;
                details.push({label: 'Kit Iluminação', value: formatCurrency(lightingCost)});
                details.push(...lightingDetails);
            }
        }
        
        // 3. Final Calculation
        const totalCost = sheetCost + additionalCosts + values.laborCost;
        const finalPrice = totalCost * (1 + values.profitMargin / 100);

      setResults({ sheetCost, additionalCosts, totalCost, finalPrice, details });
      toast({
        title: 'Cálculo Concluído!',
        description: 'Os custos e o preço de venda foram estimados.',
      });
    } catch (error: any) {
      console.error('Calculation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Erro no Cálculo',
        description: error.message || 'Não foi possível realizar o cálculo. Verifique os dados de entrada.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isDataLoading) {
    return (
        <div className="flex flex-col h-screen max-h-screen p-4 md:p-8">
            <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Calculadora de Custos de Produto</h1>
            </div>
            <div className="mt-4 flex-1 min-h-0 flex gap-8 animate-pulse">
                <div className="w-2/5">
                    <div className="space-y-6">
                        <Skeleton className="h-[450px] w-full" />
                        <Skeleton className="h-[550px] w-full" />
                        <Skeleton className="h-[250px] w-full" />
                    </div>
                </div>
                <div className="flex-1">
                    <Skeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-theme(spacing.32))] p-4 md:p-8">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Calculadora de Custos de Produto</h1>
      </div>
      <div className="mt-4 flex-1 min-h-0 flex gap-8">
          <ScrollArea className="w-2/5 flex-shrink-0 pr-6">
              <Form {...form}>
                  <form id="calculator-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <Card>
                          <CardHeader>
                              <CardTitle>1. Dimensões e Materiais</CardTitle>
                              <CardDescription>Insira as medidas em milímetros e escolha os materiais.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div className="grid grid-cols-3 gap-4">
                                  <FormField control={form.control} name="width" render={({ field }) => ( <FormItem><FormLabel>Largura</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                  <FormField control={form.control} name="depth" render={({ field }) => ( <FormItem><FormLabel>Profundidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                  <FormField control={form.control} name="height" render={({ field }) => ( <FormItem><FormLabel>Altura</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                              </div>
                              <FormField control={form.control} name="sheetDimensions" render={({ field }) => ( <FormItem><FormLabel>Tamanho da Chapa Padrão</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{uniqueSheetDimensions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="materialName1" render={({ field }) => ( <FormItem><FormLabel>Material (Frente e Laterais)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{chapaMaterialNames.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="materialName2" render={({ field }) => ( <FormItem><FormLabel>Material (Costas e Teto)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opcional (usa material principal)" /></SelectTrigger></FormControl><SelectContent>{chapaMaterialNames.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                          </CardContent>
                      </Card>
                      <Card>
                          <CardHeader>
                              <CardTitle>2. Custos Adicionais</CardTitle>
                              <CardDescription>Selecione os componentes e serviços extras.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                  <FormField control={form.control} name="paintingCost" render={({ field }) => ( <FormItem><FormLabel>Custo de Pintura (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem> )} />
                                  <FormField control={form.control} name="filterCount" render={({ field }) => ( <FormItem><FormLabel>Qtd. Filtros Inerciais</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                                  <FormField control={form.control} name="trimLength" render={({ field }) => ( <FormItem><FormLabel>Metros de Friso (m)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem> )} />
                              </div>
                              <FormField
                                  control={form.control}
                                  name="hasLighting"
                                  render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 rounded-md border p-4 mt-4">
                                      <FormControl>
                                          <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                          <FormLabel>
                                          Adicionar Kit Iluminação
                                          </FormLabel>
                                          <FormDescription>
                                          Selecione para ver e escolher os componentes.
                                          </FormDescription>
                                      </div>
                                      </FormItem>
                                  )}
                              />
                              {watchedHasLighting && (
                                  <div className="space-y-4 rounded-md border p-4">
                                      <h4 className="font-medium text-sm">Componentes de Iluminação</h4>
                                      
                                      <div className="grid grid-cols-3 gap-4 items-end">
                                          <FormField
                                              control={form.control}
                                              name="lightingLampType"
                                              render={({ field }) => (
                                                  <FormItem className="col-span-2">
                                                      <FormLabel>Tipo de Lâmpada</FormLabel>
                                                      <Select onValueChange={field.onChange} value={field.value}>
                                                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                                          <SelectContent>
                                                              <SelectItem value="none">Nenhuma</SelectItem>
                                                              <SelectItem value="cozinha">Lâmpada p/ Cozinha</SelectItem>
                                                              <SelectItem value="churrasqueira">Lâmpada p/ Churrasqueira</SelectItem>
                                                          </SelectContent>
                                                      </Select>
                                                  </FormItem>
                                              )}
                                          />
                                          <FormField
                                              control={form.control}
                                              name="lightingLampCount"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel>Qtd.</FormLabel>
                                                      <FormControl><Input type="number" {...field} disabled={watchedLampType === 'none'} /></FormControl>
                                                  </FormItem>
                                              )}
                                          />
                                      </div>

                                      <FormField
                                          control={form.control}
                                          name="lightingChicoteCount"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel>Qtd. Chicotes Elétricos</FormLabel>
                                                  <FormControl><Input type="number" {...field} /></FormControl>
                                              </FormItem>
                                          )}
                                      />
                                      
                                      <div className="grid grid-cols-2 gap-4 pt-2">
                                          <FormField control={form.control} name="lightingFonte" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Fonte de Alimentação</FormLabel></FormItem> )} />
                                          <FormField control={form.control} name="lightingBotoeira" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Botoeira Pulsante</FormLabel></FormItem> )} />
                                          <FormField control={form.control} name="lightingBotao" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Botão Interruptor</FormLabel></FormItem> )} />
                                      </div>
                                  </div>
                              )}
                          </CardContent>
                      </Card>
                      <Card>
                          <CardHeader>
                              <CardTitle>3. Custos Finais e Margem</CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="laborCost" render={({ field }) => ( <FormItem><FormLabel>Custo Mão de Obra (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="profitMargin" render={({ field }) => ( <FormItem><FormLabel>Margem de Lucro (%)</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          </CardContent>
                          <CardFooter className="flex flex-col gap-2">
                              <Button type="submit" disabled={isLoading} className="w-full">
                                  <Calculator className="mr-2 h-4 w-4" />
                                  {isLoading ? 'Calculando...' : 'Calcular Custo e Preço'}
                              </Button>
                              <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={resetFormAndResults}
                                  >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Limpar
                              </Button>
                          </CardFooter>
                      </Card>
                  </form>
              </Form>
          </ScrollArea>
          
          <ScrollArea className="flex-1">
              <Card>
                  <CardHeader>
                      <CardTitle>Resultados do Cálculo</CardTitle>
                      <CardDescription>Resumo de custos e preço de venda sugerido.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {isLoading && <div className="flex items-center justify-center h-96"><Sparkles className="h-8 w-8 animate-spin text-primary" /></div>}
                      
                      {!results && !isLoading && (
                          <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground p-4">
                              <Bot className="h-10 w-10 mb-4" />
                              <p className="font-semibold">Aguardando cálculo</p>
                              <p className="text-sm">Preencha os dados e clique em "Calcular" para ver os resultados.</p>
                          </div>
                      )}
                      
                      {results && !isLoading && (
                          <div className="space-y-6">
                              <div>
                                  <h3 className="font-semibold mb-2 flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Detalhamento de Custos</h3>
                                  <div className="space-y-2 rounded-lg border p-4 text-sm">
                                      {results.details.map((item, index) => (
                                          <div key={index} className="flex justify-between items-center">
                                              <span className="text-muted-foreground">{item.label}</span>
                                              <span className="font-medium font-code">{item.value}</span>
                                          </div>
                                      ))}
                                      <Separator />
                                      <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Mão de Obra</span>
                                          <span className="font-medium font-code">{formatCurrency(form.getValues('laborCost'))}</span>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="space-y-4">
                                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                                          <AlertTriangle className="h-6 w-6 text-destructive" />
                                      </div>
                                      <div>
                                          <div className="text-sm text-muted-foreground">Custo Total de Fabricação</div>
                                          <div className="text-2xl font-bold font-code text-destructive">
                                              {formatCurrency(results.totalCost)}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10">
                                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                                          <TrendingUp className="h-6 w-6 text-primary" />
                                      </div>
                                      <div>
                                          <div className="text-sm text-muted-foreground">Preço Final de Venda (com {form.getValues('profitMargin')}% de margem)</div>
                                          <div className="text-2xl font-bold font-code text-primary">
                                              {formatCurrency(results.finalPrice)}
                                          </div>
                                      </div>
                                  </div>
                              </div>

                          </div>
                      )}
                  </CardContent>
              </Card>
          </ScrollArea>
      </div>
    </div>
  );
}

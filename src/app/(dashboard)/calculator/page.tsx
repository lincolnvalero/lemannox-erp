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
import { getCalculatorReferenceData, generatePriceTableCoifasCozinha } from './actions';
import { calculateCoifa, type CoifaCalculatorInput, type CoifaCalculationResult } from '@/lib/coifa-calculator';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Bot, Calculator, ReceiptText, TrendingUp, Sparkles, AlertTriangle, XCircle, Copy, ListChecks } from 'lucide-react';
import { CalculatorDiagram } from '@/components/dashboard/calculator-diagram';
import type { CalculatorReferenceData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

// Campos numéricos que nascem vazios (sem "0" a apagar) — item 1 do pedido.
const numField = z.union([z.literal(''), z.coerce.number()]).transform(v => (v === '' ? 0 : v));

const formSchema = z.object({
  width: numField.pipe(z.number().min(1, 'Largura é obrigatória')),
  depth: numField.pipe(z.number().min(1, 'Profundidade é obrigatória')),
  height: numField.pipe(z.number().min(1, 'Altura é obrigatória')),
  modelo: z.enum(['Box', 'Piramidal', 'Linea', 'Tube']),
  tetoWidth: numField.optional(),
  tetoDepth: numField.optional(),
  carenagemWidth: numField.optional(),
  carenagemDepth: numField.optional(),
  carenagemHeight: numField.optional(),
  material: z.string().min(1, 'Selecione o material'),
  larguraPadrao: z.coerce.number().min(1, 'Selecione a chapa padrão'),
  larguraPadraoCarenagem: z.coerce.number().optional(),
  tipoAplicacao: z.enum(['Cozinha', 'Churrasqueira']),
  tipoInstalacao: z.enum(['Parede', 'Ilha']),
  filtro: z.enum(['nenhum', 'aluminio', 'inercial_430', 'inercial_304']),
  coletor: z.enum(['nenhum', 'simples', 'duplo']),
  frisoFrente: z.boolean(),
  frisoLD: z.boolean(),
  frisoLE: z.boolean(),
  frisoLinhas: z.coerce.number().min(1).max(3),
  outros: numField,
  paintingCost: numField,
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  width: 0, depth: 0, height: 0,
  modelo: 'Box',
  tetoWidth: 0, tetoDepth: 0,
  carenagemWidth: 0, carenagemDepth: 0, carenagemHeight: 0,
  material: '', larguraPadrao: 0, larguraPadraoCarenagem: 0,
  tipoAplicacao: 'Cozinha', tipoInstalacao: 'Parede',
  filtro: 'nenhum', coletor: 'nenhum',
  frisoFrente: false, frisoLD: false, frisoLE: false, frisoLinhas: 1,
  outros: 0, paintingCost: 0,
};

export default function CostCalculatorPage() {
  const [results, setResults] = useState<CoifaCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ref, setRef] = useState<CalculatorReferenceData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateSummary, setGenerateSummary] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGeneratePriceTable = async () => {
    setGenerating(true);
    setGenerateSummary(null);
    const result = await generatePriceTableCoifasCozinha();
    setGenerating(false);
    if (result.success) {
      const summary = `${result.created ?? 0} produto(s) criado(s), ${result.updated ?? 0} atualizado(s).`;
      setGenerateSummary(result.errors ? `${summary} ${result.errors.length} com erro — veja o console.` : summary);
      if (result.errors) console.error('Erros na geração da tabela de preços:', result.errors);
      toast({ title: 'Tabela de Preços gerada!', description: summary });
    } else {
      toast({ variant: 'destructive', title: 'Erro ao gerar tabela', description: result.error });
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const fetchInitialData = useCallback(async () => {
    setIsDataLoading(true);
    const result = await getCalculatorReferenceData();
    if (result.success && result.data) {
      setRef(result.data);
      form.reset({ ...defaultValues, paintingCost: result.data.parametros['pintura_padrao'] ?? 0 });
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar dados da calculadora', description: result.error });
    }
    setResults(null);
    setIsDataLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Nome da "família" do material a partir do nome cadastrado no Estoque
  // (ex: "Chapa Inox 430 #20 (1,00mm) 2000" -> "Inox 430").
  const familiaMaterial = (nome: string) => nome.replace(/^Chapa\s+/i, '').split('#')[0].trim();

  const materiaisDisponiveis = useMemo(
    () => Array.from(new Set((ref?.materiaisEstoque ?? []).map(m => familiaMaterial(m.name)))).sort(),
    [ref]
  );

  const { watch } = form;
  const watchedModelo = watch('modelo');
  const watchedFiltro = watch('filtro');
  const watchedMaterial = watch('material');
  const watchedWidth = watch('width');
  const watchedDepth = watch('depth');
  const watchedHeight = watch('height');

  const larguraPadraoDisponivel = useMemo(() => {
    if (!watchedMaterial) return [];
    return Array.from(new Set(
      (ref?.materiaisEstoque ?? [])
        .filter(m => familiaMaterial(m.name) === watchedMaterial && m.width)
        .map(m => m.width as number)
    )).sort((a, b) => a - b);
  }, [ref, watchedMaterial]);

  const isPiramidal = watchedModelo === 'Piramidal';
  const isLinea = watchedModelo === 'Linea';
  const isTube = watchedModelo === 'Tube';
  const showColetor = watchedFiltro === 'inercial_430' || watchedFiltro === 'inercial_304';

  // A Tube não tem Largura/Profundidade — é cilíndrica, com diâmetro sempre
  // fixo em 500mm (conforme instrução do Levi). Só a Altura é digitada.
  useEffect(() => {
    if (isTube) {
      form.setValue('width', 500);
      form.setValue('depth', 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTube]);

  function onSubmit(values: FormValues) {
    if (!ref) return;
    setIsLoading(true);
    setResults(null);
    try {
      const input: CoifaCalculatorInput = {
        width: values.width, depth: values.depth, height: values.height,
        modelo: values.modelo,
        tetoWidth: values.tetoWidth, tetoDepth: values.tetoDepth,
        carenagemWidth: values.carenagemWidth, carenagemDepth: values.carenagemDepth, carenagemHeight: values.carenagemHeight,
        material: values.material,
        larguraPadrao: values.larguraPadrao,
        larguraPadraoCarenagem: values.larguraPadraoCarenagem || undefined,
        tipoAplicacao: values.tipoAplicacao,
        tipoInstalacao: values.tipoInstalacao,
        filtro: values.filtro,
        coletor: values.filtro === 'nenhum' ? 'nenhum' : values.coletor,
        frisoFrente: values.frisoFrente, frisoLD: values.frisoLD, frisoLE: values.frisoLE,
        frisoLinhas: values.frisoLinhas as 1 | 2 | 3,
        outros: values.outros,
        paintingCost: values.paintingCost,
      };
      const result = calculateCoifa(input, ref);
      setResults(result);
      if (result.warnings.length > 0) {
        toast({ variant: 'destructive', title: 'Cálculo concluído com avisos', description: result.warnings.join(' ') });
      } else {
        toast({ title: 'Cálculo concluído!', description: 'Custos e preço final estimados.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível calcular. Verifique os dados.';
      toast({ variant: 'destructive', title: 'Erro no cálculo', description: message });
    } finally {
      setIsLoading(false);
    }
  }

  const copyDescricao = () => {
    if (!results) return;
    navigator.clipboard.writeText(results.descricaoAuto);
    toast({ title: 'Descrição copiada!' });
  };

  if (isDataLoading) {
    return (
      <div className="flex flex-col h-screen max-h-screen p-4 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Calculadora de Custos — Coifas</h1>
        <div className="mt-4 flex-1 min-h-0 flex gap-8 animate-pulse">
          <div className="w-2/5"><Skeleton className="h-[700px] w-full" /></div>
          <div className="flex-1"><Skeleton className="h-full w-full" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-theme(spacing.32))] p-4 md:p-8 overflow-x-auto">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Calculadora de Custos — Coifas</h1>
      </div>
      <div className="mt-4 flex-1 min-h-0 flex gap-8 min-w-[900px]">
        <ScrollArea className="w-2/5 flex-shrink-0 pr-6">
          <Form {...form}>
            <form id="calculator-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>1. Modelo, Dimensões e Materiais</CardTitle>
                  <CardDescription>Medidas em milímetros.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="modelo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Box">Box</SelectItem>
                          <SelectItem value="Piramidal">Piramidal</SelectItem>
                          <SelectItem value="Linea">Línea</SelectItem>
                          <SelectItem value="Tube">Tube</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {isTube ? (
                    <div className="grid grid-cols-2 gap-4">
                      <FormItem>
                        <FormLabel>Diâmetro</FormLabel>
                        <FormControl><Input value="Ø 500mm (fixo)" disabled /></FormControl>
                      </FormItem>
                      <FormField control={form.control} name="height" render={({ field }) => ( <FormItem><FormLabel>Altura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="width" render={({ field }) => ( <FormItem><FormLabel>Largura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="depth" render={({ field }) => ( <FormItem><FormLabel>Profundidade</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="height" render={({ field }) => ( <FormItem><FormLabel>Altura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                  )}

                  {isPiramidal && (
                    <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/30">
                      <FormField control={form.control} name="tetoWidth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Medida do Teto — Largura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                      <FormField control={form.control} name="tetoDepth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Medida do Teto — Profundidade</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                    </div>
                  )}
                  {isLinea && (
                    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="carenagemWidth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Carenagem — Largura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="carenagemDepth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Carenagem — Profundidade</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="carenagemHeight" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Carenagem — Altura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                      </div>
                      <FormField control={form.control} name="larguraPadraoCarenagem" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Chapa Padrão — Carenagem (bitola 24)</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ''} disabled={!watchedMaterial}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Mesma da chapa acima" /></SelectTrigger></FormControl>
                            <SelectContent>{larguraPadraoDisponivel.map(l => <SelectItem key={l} value={String(l)}>{l}mm</SelectItem>)}</SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Só preencha se a carenagem usar chapa de tamanho diferente do corpo.</FormDescription>
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="material" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); form.setValue('larguraPadrao', 0); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                          <SelectContent>{materiaisDisponiveis.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Uma coifa nunca mistura materiais — só o filtro inercial pode ser 430 ou 304 independente disso.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="larguraPadrao" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chapa Padrão</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ''} disabled={!watchedMaterial}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                          <SelectContent>{larguraPadraoDisponivel.map(l => <SelectItem key={l} value={String(l)}>{l}mm</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tipoAplicacao" render={({ field }) => ( <FormItem><FormLabel>Aplicação</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Cozinha">Cozinha</SelectItem><SelectItem value="Churrasqueira">Churrasqueira</SelectItem></SelectContent></Select></FormItem> )} />
                    <FormField control={form.control} name="tipoInstalacao" render={({ field }) => ( <FormItem><FormLabel>Instalação</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Parede">Parede</SelectItem><SelectItem value="Ilha">Ilha</SelectItem></SelectContent></Select><FormDescription className="text-xs">Ilha soma o acréscimo de mão de obra da tabela — não é mais um modelo à parte.</FormDescription></FormItem> )} />
                  </div>
                  {isTube && (
                    <p className="text-xs text-muted-foreground rounded-md border p-2 bg-muted/30">
                      Coifa Tube sempre usa 2 lâmpadas + 1 botoeira + 1 chicote, fixo — não varia por medida ou instalação.
                      Diâmetro sempre 500mm; mão de obra calculada pela altura. Se marcar friso, o custo usa a fórmula
                      própria da Tube (25% do valor da chapa em matéria-prima + 25% em mão de obra por linha), não a extensão em cm.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Custos Adicionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="filtro" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filtro</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="nenhum">Sem filtro</SelectItem>
                          <SelectItem value="aluminio">Filtro Alumínio</SelectItem>
                          <SelectItem value="inercial_430">Filtro Inercial 430</SelectItem>
                          <SelectItem value="inercial_304">Filtro Inercial 304</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {showColetor && (
                    <FormField control={form.control} name="coletor" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Coletor de Gordura</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="nenhum">Sem coletor</SelectItem>
                            <SelectItem value="simples">Simples</SelectItem>
                            <SelectItem value="duplo">Duplo (chicanes frente e fundo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  )}

                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">Frisos</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <FormField control={form.control} name="frisoFrente" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Frente</FormLabel></FormItem> )} />
                      <FormField control={form.control} name="frisoLD" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Lateral Direita</FormLabel></FormItem> )} />
                      <FormField control={form.control} name="frisoLE" render={({ field }) => ( <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Lateral Esquerda</FormLabel></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="frisoLinhas" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Quantidade de linhas de friso</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                          <FormControl><SelectTrigger className="w-40"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="1">1 linha</SelectItem><SelectItem value="2">2 linhas</SelectItem><SelectItem value="3">3 linhas</SelectItem></SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="outros" render={({ field }) => ( <FormItem><FormLabel>Outros (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0,00" {...field} value={field.value || ''} /></FormControl><FormDescription className="text-xs">Tubos de paneleiro etc.</FormDescription></FormItem> )} />
                    <FormField control={form.control} name="paintingCost" render={({ field }) => ( <FormItem><FormLabel>Pintura (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0,00" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button type="submit" disabled={isLoading} className="w-full">
                    <Calculator className="mr-2 h-4 w-4" />
                    {isLoading ? 'Calculando...' : 'Calcular Custo e Preço'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => { form.reset(defaultValues); setResults(null); }}>
                    <XCircle className="mr-2 h-4 w-4" />Limpar
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Emissão da Tabela de Preços</CardTitle>
                  <CardDescription>
                    Gera/atualiza os produtos de Coifas de Cozinha (Box de Parede, Box Ilha, Piramidal de Parede, Línea, Tube — 1000 a 3000mm, Inox 430/304/Carbono) a partir deste motor de cálculo. Não apaga produtos existentes.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col items-stretch gap-2">
                  <Button type="button" variant="secondary" disabled={generating} onClick={handleGeneratePriceTable}>
                    {generating ? 'Gerando...' : 'Gerar Tabela de Preços — Coifas de Cozinha'}
                  </Button>
                  {generateSummary && <p className="text-xs text-muted-foreground text-center">{generateSummary}</p>}
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
                <div className="space-y-4">
                  <CalculatorDiagram width={watchedWidth} height={watchedHeight} depth={watchedDepth} />
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Bot className="h-10 w-10 mb-4" />
                    <p className="font-semibold">Aguardando cálculo</p>
                    <p className="text-sm">Preencha os dados e clique em &quot;Calcular&quot; para ver os resultados.</p>
                  </div>
                </div>
              )}

              {results && !isLoading && (
                <div className="space-y-6">
                  {results.warnings.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
                      {results.warnings.map((w, i) => <p key={i} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{w}</p>)}
                    </div>
                  )}

                  <div className="rounded-lg border p-3 flex items-start justify-between gap-2">
                    <p className="text-sm italic text-muted-foreground">{results.descricaoAuto}</p>
                    <Button size="sm" variant="ghost" onClick={copyDescricao}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Detalhamento de Custos</h3>
                    <div className="space-y-2 rounded-lg border p-4 text-sm">
                      {results.details.map((item, index) => (
                        <div key={index} className="flex justify-between items-center gap-4">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium font-code text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Custo Total de Fabricação</div>
                        <div className="text-2xl font-bold font-code text-destructive">{formatCurrency(results.totalCost)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Preço Final de Venda</div>
                        <div className="text-2xl font-bold font-code text-primary">{formatCurrency(results.finalPrice)}</div>
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

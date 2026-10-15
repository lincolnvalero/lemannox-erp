'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getQuotes } from '@/app/(dashboard)/quotes/actions';
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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCalculatorReferenceData, generatePriceTableCoifas, salvarTetoPadraoPiramidal } from './actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CHAVE_TETO_LARGURA, CHAVE_TETO_PROFUNDIDADE, TETO_MIN, TETO_MAX, tetoPadraoDefinido, CHAVE_ITEM_PENDENTE_ORCAMENTO } from '@/lib/coifa-padroes';
import { calculateCoifa, kitIluminacaoPadrao, tipoControleEfetivo, type CoifaCalculatorInput, type CoifaCalculationResult } from '@/lib/coifa-calculator';
import { planejarFuros, resumoFuros } from '@/lib/coifa-furos';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Bot, Calculator, ReceiptText, TrendingUp, Sparkles, AlertTriangle, XCircle, Copy, ListChecks, Box as BoxIcon, RotateCcw, FilePlus2, Download } from 'lucide-react';
import dynamic from 'next/dynamic';

const CoifaViewer3D = dynamic(
  () => import('@/components/dashboard/coifa-viewer-3d').then(m => m.CoifaViewer3D),
  { ssr: false, loading: () => <div className="h-[380px] rounded-md bg-muted/30 animate-pulse" /> },
);
import type { CalculatorReferenceData, CoifaParamsSalvos, Quote, QuoteItem } from '@/lib/types';
import type { CoifaViewer3DHandle } from '@/components/dashboard/coifa-viewer-3d';
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
  // Ajuste manual do kit de iluminação — vazio = usa o padrão da tabela.
  qtdLampadasManual: z.number().min(0).max(50).optional(),
  qtdBotoesManual: z.number().min(0).max(50).optional(),
  // Churrasqueira: botões avulsos ou botoeira. Parede: onde ficam as lâmpadas.
  controle: z.enum(['botoes', 'botoeira']),
  posicaoLampadas: z.enum(['frente', 'parede']),
});

const MAX_KIT = 50;

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
  qtdLampadasManual: undefined, qtdBotoesManual: undefined,
  controle: 'botoes', posicaoLampadas: 'frente',
};

export default function CostCalculatorPage() {
  const [results, setResults] = useState<CoifaCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ref, setRef] = useState<CalculatorReferenceData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateSummary, setGenerateSummary] = useState<string | null>(null);
  const { toast } = useToast();

  // Teto padrão da Piramidal: obrigatório pra gerar a Tabela de Preços, mas
  // só é pedido uma vez (quando ainda não existe) — depois fica salvo e pode
  // ser alterado pelo link no próprio card ou na Memória de Cálculos.
  const [tetoDialog, setTetoDialog] = useState<null | 'gerar' | 'editar'>(null);
  const [tetoLargura, setTetoLargura] = useState('');
  const [tetoProfundidade, setTetoProfundidade] = useState('');
  const [salvandoTeto, setSalvandoTeto] = useState(false);
  const tetoAtual = ref ? tetoPadraoDefinido(ref.parametros) : null;

  const abrirDialogoTeto = (modo: 'gerar' | 'editar') => {
    // Sugestão inicial = exemplo da planilha original (Piramidal 1200 com teto 500×500).
    setTetoLargura(String(tetoAtual?.largura ?? 500));
    setTetoProfundidade(String(tetoAtual?.profundidade ?? 500));
    setTetoDialog(modo);
  };

  const gerarTabela = async () => {
    setGenerating(true);
    setGenerateSummary(null);
    const result = await generatePriceTableCoifas();
    setGenerating(false);
    if (result.success) {
      const summary = `${result.created ?? 0} produto(s) criado(s), ${result.updated ?? 0} atualizado(s), ${result.removed ?? 0} antigo(s) removido(s).`;
      setGenerateSummary(result.errors ? `${summary} ${result.errors.length} com erro — veja o console.` : summary);
      if (result.errors) console.error('Erros na geração da tabela de preços:', result.errors);
      toast({ title: 'Tabela de Preços gerada!', description: summary });
    } else if (result.precisaTetoPadrao) {
      abrirDialogoTeto('gerar');
    } else {
      toast({ variant: 'destructive', title: 'Erro ao gerar tabela', description: result.error });
    }
  };

  const handleGeneratePriceTable = () => {
    if (!tetoAtual) { abrirDialogoTeto('gerar'); return; }
    gerarTabela();
  };

  const salvarTeto = async () => {
    const largura = Number(tetoLargura), profundidade = Number(tetoProfundidade);
    setSalvandoTeto(true);
    const result = await salvarTetoPadraoPiramidal(largura, profundidade);
    setSalvandoTeto(false);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Teto não salvo', description: result.error });
      return;
    }
    setRef(r => r ? { ...r, parametros: { ...r.parametros, [CHAVE_TETO_LARGURA]: Math.round(largura), [CHAVE_TETO_PROFUNDIDADE]: Math.round(profundidade) } } : r);
    const modo = tetoDialog;
    setTetoDialog(null);
    toast({ title: 'Teto padrão salvo', description: `${Math.round(largura)} × ${Math.round(profundidade)} mm` });
    if (modo === 'gerar') gerarTabela();
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
  const watchedTetoWidth = watch('tetoWidth');
  const watchedTetoDepth = watch('tetoDepth');
  const watchedCarenagemWidth = watch('carenagemWidth');
  const watchedCarenagemDepth = watch('carenagemDepth');
  const watchedCarenagemHeight = watch('carenagemHeight');
  const watchedAplicacao = watch('tipoAplicacao');
  const watchedInstalacao = watch('tipoInstalacao');
  const watchedLampadasManual = watch('qtdLampadasManual');
  const [watchedColetor, watchedFrisoFrente, watchedFrisoLD, watchedFrisoLE, watchedFrisoLinhas] =
    watch(['coletor', 'frisoFrente', 'frisoLD', 'frisoLE', 'frisoLinhas']);
  const watchedBotoesManual = watch('qtdBotoesManual');
  const watchedControle = watch('controle');
  const watchedPosicaoLampadas = watch('posicaoLampadas');
  const tipoControle = tipoControleEfetivo({ modelo: watchedModelo, tipoAplicacao: watchedAplicacao, controle: watchedControle });

  // Quantidade padrão (da tabela de iluminação / regra da Tube) — pré-preenche
  // os campos editáveis e serve de referência pro aviso de divergência.
  const kitPadrao = useMemo(() => {
    if (!ref) return null;
    return kitIluminacaoPadrao(
      { modelo: watchedModelo, width: Number(watchedWidth) || 0, tipoAplicacao: watchedAplicacao, tipoInstalacao: watchedInstalacao, controle: watchedControle },
      ref,
    );
  }, [ref, watchedModelo, watchedWidth, watchedAplicacao, watchedInstalacao, watchedControle]);
  const qtdLampadasEfetiva = watchedLampadasManual ?? kitPadrao?.qtdLampadas ?? 0;
  const qtdBotoesEfetiva = watchedBotoesManual ?? kitPadrao?.qtdBotoes ?? 0;
  const lampadasDivergem = watchedLampadasManual !== undefined && kitPadrao !== null && watchedLampadasManual !== kitPadrao.qtdLampadas;
  const botoesDivergem = watchedBotoesManual !== undefined && kitPadrao !== null && watchedBotoesManual !== kitPadrao.qtdBotoes;
  const nomeBotao = tipoControle === 'botoeira' ? 'Botoeiras' : 'Botões';
  // Furos que o desenho mostra (base para o futuro DXF de fabricação).
  const furosResumo = useMemo(() => {
    if (!(Number(watchedHeight) > 0)) return null;
    return resumoFuros(planejarFuros({
      modelo: watchedModelo, width: Number(watchedWidth) || 0, depth: Number(watchedDepth) || 0, height: Number(watchedHeight) || 0,
      mount: watchedInstalacao, qtdLampadas: qtdLampadasEfetiva, qtdBotoes: qtdBotoesEfetiva,
      tipoControle, posicaoLampadas: watchedPosicaoLampadas,
    }));
  }, [watchedModelo, watchedWidth, watchedDepth, watchedHeight, watchedInstalacao, qtdLampadasEfetiva, qtdBotoesEfetiva, tipoControle, watchedPosicaoLampadas]);
  // Texto em edição dos campos do kit: permite apagar o número inteiro antes
  // de digitar outro (sem isso o campo "voltava" pro padrão a cada Backspace).
  const [kitRascunho, setKitRascunho] = useState<Partial<Record<'qtdLampadasManual' | 'qtdBotoesManual', string>>>({});

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
        qtdLampadasManual: values.qtdLampadasManual,
        qtdBotoesManual: values.qtdBotoesManual,
        controle: values.controle,
      };
      const result = calculateCoifa(input, ref);
      setResults(result);
      setUltimoInput(input);
      setUltimaPosicaoLampadas(values.posicaoLampadas);
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

  // Exporta o desenho (com cotas, e legenda se o modo Chapas estiver ligado)
  // como PNG — pra mandar por WhatsApp/e-mail.
  const viewerRef = useRef<CoifaViewer3DHandle | null>(null);
  const exportarImagem = () => {
    const url = viewerRef.current?.capturePng();
    if (!url) {
      toast({ variant: 'destructive', title: 'Nada para exportar', description: 'Informe as medidas para gerar o desenho.' });
      return;
    }
    const v = form.getValues();
    const medidas = v.modelo === 'Tube' ? `D500x${v.height}` : `${v.width}x${v.depth}x${v.height}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `coifa_${v.modelo.toLowerCase()}_${medidas}.png`;
    a.click();
  };

  // ── Adicionar ao orçamento ─────────────────────────────────────────────
  // Usa exatamente os dados do último cálculo (não o que estiver digitado
  // agora no formulário), pra o preço levado bater com o mostrado.
  const router = useRouter();
  const [ultimoInput, setUltimoInput] = useState<CoifaCalculatorInput | null>(null);
  const [ultimaPosicaoLampadas, setUltimaPosicaoLampadas] = useState<'frente' | 'parede'>('frente');
  const [orcDialog, setOrcDialog] = useState(false);
  const [orcamentosAbertos, setOrcamentosAbertos] = useState<Quote[] | null>(null);
  const [orcDestino, setOrcDestino] = useState<string>('novo');

  const itemParaOrcamento = useMemo((): QuoteItem | null => {
    if (!results || !ultimoInput) return null;
    const i = ultimoInput;
    const preco = Math.round(results.finalPrice * 100) / 100;
    // Descrição sem as medidas (elas vão na coluna Medida).
    const partes = results.descricaoAuto.split(', ');
    const nome = (partes.length > 1 ? partes.slice(0, -1) : partes).join(', ').replace('Coifa Linea', 'Coifa Línea')
      + (i.tipoInstalacao === 'Ilha' ? ', instalação em Ilha' : '');
    const medida = i.modelo === 'Tube' ? `Ø500 x ${i.height}mm` : `${i.width}x${i.depth}x${i.height}mm`;
    const coifaParams: CoifaParamsSalvos = {
      modelo: i.modelo, width: i.width, depth: i.depth, height: i.height,
      tetoWidth: i.tetoWidth, tetoDepth: i.tetoDepth,
      carenagemWidth: i.carenagemWidth, carenagemDepth: i.carenagemDepth, carenagemHeight: i.carenagemHeight,
      tipoAplicacao: i.tipoAplicacao, tipoInstalacao: i.tipoInstalacao, material: i.material,
      filtro: i.filtro, coletor: i.coletor,
      frisoFrente: i.frisoFrente, frisoLD: i.frisoLD, frisoLE: i.frisoLE, frisoLinhas: i.frisoLinhas,
      qtdLampadas: results.qtdLampadas, qtdBotoes: results.qtdBotoes,
      controle: results.tipoControle, posicaoLampadas: ultimaPosicaoLampadas,
    };
    return {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `calc-${Date.now()}`,
      productId: '',
      name: nome,
      category: i.tipoAplicacao === 'Cozinha' ? 'Coifa de Cozinha' : 'Coifa de Churrasqueira',
      measurement: medida,
      material: i.material,
      quantity: 1,
      unitPrice: preco,
      tax: Math.round(preco * 0.045 * 100) / 100,
      total: preco,
      notes: results.descricaoAuto,
      coifaParams,
    };
  }, [results, ultimoInput, ultimaPosicaoLampadas]);

  const abrirDialogoOrcamento = async () => {
    setOrcDestino('novo');
    setOrcDialog(true);
    if (orcamentosAbertos === null) {
      const r = await getQuotes();
      setOrcamentosAbertos(
        r.success && r.quotes ? r.quotes.filter(q => ['rascunho', 'aguardando', 'enviado'].includes(q.status)).slice(0, 40) : [],
      );
    }
  };

  const enviarParaOrcamento = () => {
    if (!itemParaOrcamento) return;
    try {
      sessionStorage.setItem(CHAVE_ITEM_PENDENTE_ORCAMENTO, JSON.stringify(itemParaOrcamento));
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível levar o item', description: 'O navegador bloqueou o armazenamento temporário.' });
      return;
    }
    setOrcDialog(false);
    router.push(orcDestino === 'novo' ? '/quotes/editor?adicionarItem=1' : `/quotes/editor?id=${orcDestino}&adicionarItem=1`);
  };

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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen p-4 md:p-6 overflow-x-auto">
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
                  {(isLinea || isPiramidal) && (
                    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                      <p className="text-xs font-medium">
                        Carenagem{isPiramidal ? ' (opcional — deixe em branco se não tiver)' : ''}
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="carenagemWidth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Largura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="carenagemDepth" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Profundidade</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="carenagemHeight" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Altura</FormLabel><FormControl><Input type="number" placeholder="mm" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
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
                  {(watchedAplicacao === 'Churrasqueira' && !isTube) && (
                    <FormField control={form.control} name="controle" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comando</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); form.setValue('qtdBotoesManual', undefined); setKitRascunho(d => ({ ...d, qtdBotoesManual: undefined })); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="botoes">2 botões</SelectItem>
                            <SelectItem value="botoeira">Botoeira (5 botões)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Aparece no desenho e muda o item do Estoque usado no preço.</FormDescription>
                      </FormItem>
                    )} />
                  )}
                  {watchedInstalacao === 'Parede' ? (
                    <FormField control={form.control} name="posicaoLampadas" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posição das lâmpadas</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="frente">Na frente</SelectItem>
                            <SelectItem value="parede">Junto à parede</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Só muda o desenho — não altera o preço.</FormDescription>
                      </FormItem>
                    )} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Ilha: metade das lâmpadas fica na frente e metade no fundo.</p>
                  )}
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">Kit de Iluminação</p>
                    <p className="text-xs text-muted-foreground">
                      Vem preenchido com o padrão da tabela de iluminação. Ajuste só quando o pedido for fora do padrão —
                      o valor ajustado vale tanto pro preço quanto pro desenho 3D.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {([
                        { name: 'qtdLampadasManual' as const, label: 'Lâmpadas', manual: watchedLampadasManual, efetiva: qtdLampadasEfetiva, padrao: kitPadrao?.qtdLampadas, diverge: lampadasDivergem },
                        { name: 'qtdBotoesManual' as const, label: nomeBotao, manual: watchedBotoesManual, efetiva: qtdBotoesEfetiva, padrao: kitPadrao?.qtdBotoes, diverge: botoesDivergem },
                      ]).map(campo => (
                        <div key={campo.name} className="space-y-1">
                          <Label className="text-xs">{campo.label}</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={MAX_KIT}
                              step={1}
                              value={kitRascunho[campo.name] ?? String(campo.efetiva)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setKitRascunho(d => ({ ...d, [campo.name]: v }));
                                const n = Number(v);
                                if (v !== '' && Number.isFinite(n)) {
                                  form.setValue(campo.name, Math.min(MAX_KIT, Math.max(0, Math.round(n))));
                                }
                              }}
                              onBlur={() => {
                                // Campo deixado vazio = volta ao padrão da tabela.
                                if (kitRascunho[campo.name] === '') form.setValue(campo.name, undefined);
                                setKitRascunho(d => ({ ...d, [campo.name]: undefined }));
                              }}
                              className={campo.diverge ? 'border-amber-500' : undefined}
                            />
                            {campo.manual !== undefined && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Voltar ao padrão da tabela"
                                onClick={() => {
                                  form.setValue(campo.name, undefined);
                                  setKitRascunho(d => ({ ...d, [campo.name]: undefined }));
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          {campo.diverge && (
                            <p className="text-[11px] text-amber-600">Diferente do padrão da tabela ({campo.padrao}).</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {isTube && (
                    <p className="text-xs text-muted-foreground rounded-md border p-2 bg-muted/30">
                      Coifa Tube usa por padrão 2 lâmpadas + 1 botoeira + 1 chicote — não varia por medida ou instalação.
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
                  <Button type="button" variant="outline" className="w-full" onClick={() => { form.reset(defaultValues); setKitRascunho({}); setResults(null); }}>
                    <XCircle className="mr-2 h-4 w-4" />Limpar
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Emissão da Tabela de Preços</CardTitle>
                  <CardDescription>
                    Gera os produtos de Coifas de Cozinha e de Churrasqueira (Box de Parede, Box Ilha, Piramidal de Parede, Piramidal Ilha, Línea, Tube — 1000 a 3000mm, Inox 430/304/Carbono) a partir deste motor de cálculo. Substitui os valores antigos dessas coifas: os itens em formato LxPxA são removidos e a lista de Churrasqueira é refeita.
                  </CardDescription>
                  <p className="text-xs text-muted-foreground pt-1">
                    Teto padrão da Piramidal:{' '}
                    {tetoAtual
                      ? <span className="font-medium text-foreground">{tetoAtual.largura} × {tetoAtual.profundidade} mm</span>
                      : <span className="font-medium text-amber-600">não definido (será pedido ao gerar)</span>}
                    {tetoAtual && (
                      <Button type="button" variant="link" className="h-auto p-0 pl-2 text-xs" onClick={() => abrirDialogoTeto('editar')}>alterar</Button>
                    )}
                  </p>
                </CardHeader>
                <CardFooter className="flex flex-col items-stretch gap-2">
                  <Button type="button" variant="secondary" disabled={generating} onClick={handleGeneratePriceTable}>
                    {generating ? 'Gerando...' : 'Gerar Tabela de Preços — Coifas'}
                  </Button>
                  {generateSummary && <p className="text-xs text-muted-foreground text-center">{generateSummary}</p>}
                </CardFooter>
              </Card>
            </form>
          </Form>
        </ScrollArea>

        <ScrollArea className="flex-1">
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2"><BoxIcon className="h-5 w-5 text-primary" />Visualização 3D</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={exportarImagem}>
                  <Download className="mr-1.5 h-4 w-4" />Exportar imagem
                </Button>
              </div>
              <CardDescription>
                Só ilustrativo — o preço vem exclusivamente do cálculo abaixo. Arraste pra girar, botão direito (ou Shift) pra mover, roda do mouse pra zoom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(Number(watchedHeight) > 0 && (isTube || (Number(watchedWidth) > 0 && Number(watchedDepth) > 0))) ? (
                <CoifaViewer3D
                  className="h-[min(72vh,820px)] min-h-[420px]"
                  modelo={watchedModelo}
                  width={Number(watchedWidth) || 0}
                  depth={Number(watchedDepth) || 0}
                  height={Number(watchedHeight) || 0}
                  tetoWidth={Number(watchedTetoWidth) || undefined}
                  tetoDepth={Number(watchedTetoDepth) || undefined}
                  carenagemWidth={Number(watchedCarenagemWidth) || undefined}
                  carenagemDepth={Number(watchedCarenagemDepth) || undefined}
                  carenagemHeight={Number(watchedCarenagemHeight) || undefined}
                  mount={watchedInstalacao}
                  qtdLampadas={qtdLampadasEfetiva}
                  qtdBotoes={qtdBotoesEfetiva}
                  controle={tipoControle}
                  posicaoLampadas={watchedPosicaoLampadas}
                  material={watchedMaterial}
                  filtro={watchedFiltro}
                  coletor={watchedFiltro === 'nenhum' ? 'nenhum' : watchedColetor}
                  frisoFrente={watchedFrisoFrente}
                  frisoLD={watchedFrisoLD}
                  frisoLE={watchedFrisoLE}
                  frisoLinhas={Number(watchedFrisoLinhas) || 1}
                  ref={viewerRef}
                />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground border rounded-md bg-muted/20">
                  Informe as medidas para ver a coifa em 3D.
                </div>
              )}
              {furosResumo && (furosResumo.lampadas || furosResumo.botoes) && (
                <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">Furos</p>
                  {furosResumo.botoes && <p>{furosResumo.botoes}</p>}
                  {furosResumo.lampadas && <p>{furosResumo.lampadas}</p>}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resultados do Cálculo</CardTitle>
              <CardDescription>Resumo de custos e preço de venda sugerido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading && <div className="flex items-center justify-center h-96"><Sparkles className="h-8 w-8 animate-spin text-primary" /></div>}

              {!results && !isLoading && (
                <div className="space-y-4">
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
                    <Button type="button" className="w-full" onClick={abrirDialogoOrcamento} disabled={!itemParaOrcamento}>
                      <FilePlus2 className="mr-2 h-4 w-4" />Adicionar ao orçamento
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollArea>
      </div>
      <Dialog open={tetoDialog !== null} onOpenChange={(open) => { if (!open && !salvandoTeto) setTetoDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teto padrão da Piramidal</DialogTitle>
            <DialogDescription>
              A Tabela de Preços calcula todas as Piramidais de 1000 a 3000mm com um teto padrão. Sem ele, a chapa do
              teto não entra no custo e o preço sai abaixo do real. Informe uma vez — fica salvo (dá pra mudar depois
              aqui ou na Memória de Cálculos).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="teto-largura">Largura do teto (mm)</Label>
              <Input id="teto-largura" type="number" min={TETO_MIN} max={TETO_MAX} value={tetoLargura} onChange={e => setTetoLargura(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teto-profundidade">Profundidade do teto (mm)</Label>
              <Input id="teto-profundidade" type="number" min={TETO_MIN} max={TETO_MAX} value={tetoProfundidade} onChange={e => setTetoProfundidade(e.target.value)} />
            </div>
          </div>
          {!tetoAtual && (
            <p className="text-xs text-muted-foreground">Sugestão preenchida: 500 × 500 mm, o exemplo da planilha original. Confirme ou ajuste.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvandoTeto} onClick={() => setTetoDialog(null)}>Cancelar</Button>
            <Button type="button" disabled={salvandoTeto} onClick={salvarTeto}>
              {salvandoTeto ? 'Salvando...' : tetoDialog === 'gerar' ? 'Salvar e gerar tabela' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={orcDialog} onOpenChange={setOrcDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar ao orçamento</DialogTitle>
            <DialogDescription>
              A coifa vai com o preço e as medidas exatas deste cálculo — o desenho 3D do orçamento fica fiel ao que foi calculado.
            </DialogDescription>
          </DialogHeader>
          {itemParaOrcamento && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">{itemParaOrcamento.name}</p>
              <p className="text-muted-foreground">{itemParaOrcamento.measurement} · {itemParaOrcamento.material}</p>
              <p className="font-code">{formatCurrency(itemParaOrcamento.unitPrice)} <span className="text-xs text-muted-foreground">(+ 4,5% de imposto no orçamento)</span></p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={orcDestino} onValueChange={setOrcDestino}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo orçamento</SelectItem>
                {(orcamentosAbertos ?? []).map(q => (
                  <SelectItem key={q.id} value={q.id}>
                    #{String(q.quoteNumber).padStart(4, '0')} — {q.customerName}{q.obra ? ` (${q.obra})` : ''} · {q.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {orcamentosAbertos === null ? 'Carregando orçamentos em aberto...' : 'Aparecem os orçamentos em rascunho, aguardando ou enviados.'}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOrcDialog(false)}>Cancelar</Button>
            <Button type="button" onClick={enviarParaOrcamento} disabled={!itemParaOrcamento}>Adicionar e abrir orçamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

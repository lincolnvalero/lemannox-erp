'use client';

// Painel "Imagens das coifas" do orçamento: mostra, item a item, quem tem
// imagem e quem não tem (e por quê). Para os que não têm, o usuário informa os
// dados que faltam e manda gerar o desenho — nunca é inventado nada.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle2, AlertTriangle, ImageOff, Pencil, Wand2 } from 'lucide-react';
import type { CoifaParamsSalvos, QuoteItem } from '@/lib/types';
import { avaliarDesenhoDoItem, sugerirDadosDoItem, type AvaliacaoDesenho, type CoifaItemParams } from '@/lib/coifa-viewer-from-item';
import { formatarMedidaCoifa } from '@/lib/coifa-padroes';
import { POSICOES_COMANDO, type PosicaoComando } from '@/lib/coifa-furos';
import { useContextoDesenho } from '@/components/dashboard/use-contexto-desenho';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CoifaViewer3D = dynamic(
  () => import('@/components/dashboard/coifa-viewer-3d').then((m) => m.CoifaViewer3D),
  { ssr: false, loading: () => <div className="h-[300px] rounded-md bg-muted/30 animate-pulse" /> },
);

type Modelo = CoifaParamsSalvos['modelo'];

interface Props {
  items: QuoteItem[];
  /** Aplica um ajuste (ex: o desenho definido) ao item de índice `index`. */
  onChangeItem: (index: number, patch: Partial<QuoteItem>) => void;
}

const ORIGEM: Record<string, string> = {
  calculadora: 'medidas da Calculadora',
  manual: 'desenho definido à mão',
  tabela: 'produto da Tabela de Preços',
  texto: 'medidas escritas no item',
};

export function CoifaImagensPanel({ items, onChangeItem }: Props) {
  const ctx = useContextoDesenho(items);
  const [editando, setEditando] = useState<number | null>(null);

  const linhas = useMemo(
    () => items
      .map((item, index) => ({ item, index, av: avaliarDesenhoDoItem(item, ctx) as AvaliacaoDesenho }))
      .filter((l) => l.item.semDesenho || l.av.situacao !== 'nao-coifa'),
    [items, ctx],
  );

  if (!ctx.pronto || linhas.length === 0) return null;
  const comImagem = linhas.filter((l) => l.av.situacao === 'com-imagem').length;
  const faltam = linhas.filter((l) => l.av.situacao === 'sem-imagem').length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {faltam > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
            Imagens das coifas no orçamento
          </CardTitle>
          <CardDescription>
            {comImagem} de {linhas.filter((l) => !l.item.semDesenho).length} coifa(s) com imagem.
            {faltam > 0 ? ' Quando faltam dados, informe as medidas e gere o desenho — a imagem nunca é adivinhada.' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {linhas.map(({ item, index, av }) => (
            <div key={`${item.id ?? index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium break-words">{item.name} {item.measurement && <span className="text-muted-foreground font-normal">— {item.measurement}</span>}</p>
                {item.semDesenho ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ImageOff className="h-3.5 w-3.5" />Marcado como &quot;não precisa de imagem&quot;.</p>
                ) : av.situacao === 'com-imagem' ? (
                  <>
                    <p className="text-xs text-green-700 dark:text-green-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Com imagem — {ORIGEM[av.origem]}.</p>
                    {av.aviso && <p className="text-xs text-amber-700 dark:text-amber-500 flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{av.aviso}</p>}
                  </>
                ) : av.situacao === 'sem-imagem' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Sem imagem: {av.motivo}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.semDesenho ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChangeItem(index, { semDesenho: false })}>Voltar a exigir imagem</Button>
                ) : av.situacao === 'sem-imagem' ? (
                  <>
                    <Button type="button" size="sm" onClick={() => setEditando(index)}><Wand2 className="mr-1.5 h-3.5 w-3.5" />Informar dados e gerar imagem</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onChangeItem(index, { semDesenho: true })}>Não precisa</Button>
                  </>
                ) : av.situacao === 'com-imagem' ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditando(index)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />{av.origem === 'manual' ? 'Editar desenho' : 'Personalizar medidas'}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {editando !== null && items[editando] && (
        <DefinirDesenhoDialog
          item={items[editando]}
          atual={linhas.find((l) => l.index === editando)?.av}
          onClose={() => setEditando(null)}
          onSave={(params, atualizarMedida) => {
            const patch: Partial<QuoteItem> = { coifaParams: { ...params, manual: true }, semDesenho: false };
            if (atualizarMedida) patch.measurement = formatarMedidaCoifa(params.modelo, params.width, params.depth, params.height);
            onChangeItem(editando, patch);
            setEditando(null);
          }}
        />
      )}
    </>
  );
}

// ── Diálogo: informar os dados e gerar o desenho ───────────────────────────

type Form = {
  modelo: Modelo | '';
  mount: 'Parede' | 'Ilha';
  aplicacao: 'Cozinha' | 'Churrasqueira';
  L: string; P: string; A: string;
  tetoL: string; tetoP: string;
  carL: string; carP: string; carA: string;
  lamp: string; bot: string;
  controle: 'botoes' | 'botoeira';
  posLamp: 'frente' | 'parede';
  posCmd: PosicaoComando;
  filtro: NonNullable<CoifaParamsSalvos['filtro']>;
  coletor: NonNullable<CoifaParamsSalvos['coletor']>;
  frisoF: boolean; frisoLD: boolean; frisoLE: boolean; frisoLinhas: string;
};

const txt = (v: number | undefined) => (v && v > 0 ? String(v) : '');

// Parâmetros de um desenho já existente → valores do formulário.
function salvosDeParams(p: CoifaItemParams): Partial<CoifaParamsSalvos> {
  return {
    modelo: p.modelo, width: p.width, depth: p.depth, height: p.height,
    tetoWidth: p.tetoWidth, tetoDepth: p.tetoDepth,
    carenagemWidth: p.carenagemWidth, carenagemDepth: p.carenagemDepth, carenagemHeight: p.carenagemHeight,
    tipoInstalacao: p.mount, tipoAplicacao: p.tipoAplicacao, material: p.material,
    filtro: p.filtro, coletor: p.coletor, frisoFrente: p.frisoFrente, frisoLD: p.frisoLD, frisoLE: p.frisoLE, frisoLinhas: p.frisoLinhas,
    qtdLampadas: p.qtdLampadas, qtdBotoes: p.qtdBotoes, controle: p.controle, posicaoLampadas: p.posicaoLampadas, posicaoComando: p.posicaoComando,
  };
}

function formInicial(item: QuoteItem, atual?: AvaliacaoDesenho): Form {
  const base: Partial<CoifaParamsSalvos> = atual?.params ? salvosDeParams(atual.params) : (item.coifaParams ?? sugerirDadosDoItem(item));
  return {
    modelo: base.modelo ?? '',
    mount: base.tipoInstalacao ?? 'Parede',
    aplicacao: base.tipoAplicacao ?? 'Cozinha',
    L: txt(base.modelo === 'Tube' && !base.width ? 500 : base.width), P: txt(base.depth), A: txt(base.height),
    tetoL: txt(base.tetoWidth), tetoP: txt(base.tetoDepth),
    carL: txt(base.carenagemWidth), carP: txt(base.carenagemDepth), carA: txt(base.carenagemHeight),
    lamp: String(base.qtdLampadas ?? 0), bot: String(base.qtdBotoes ?? 0),
    controle: base.controle ?? 'botoeira',
    posLamp: base.posicaoLampadas ?? 'frente',
    posCmd: base.posicaoComando ?? 'frente-centro',
    filtro: base.filtro ?? 'nenhum',
    coletor: base.coletor ?? 'nenhum',
    frisoF: !!base.frisoFrente, frisoLD: !!base.frisoLD, frisoLE: !!base.frisoLE, frisoLinhas: String(base.frisoLinhas ?? 1),
  };
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

function montarParametros(f: Form, material: string): { params: CoifaParamsSalvos | null; erros: string[] } {
  const erros: string[] = [];
  if (!f.modelo) return { params: null, erros: ['Escolha o modelo.'] };
  const tube = f.modelo === 'Tube';
  const L = num(f.L), P = num(f.P), A = num(f.A);
  if (tube) {
    if (!(L >= 200 && L <= 1500)) erros.push('Informe o diâmetro (200 a 1500 mm).');
    if (!(A >= 100 && A <= 4000)) erros.push('Informe a altura (100 a 4000 mm).');
  } else {
    if (!(L >= 100)) erros.push('Informe a largura.');
    if (!(P >= 100)) erros.push('Informe a profundidade.');
    if (!(A >= 50)) erros.push('Informe a altura do corpo.');
  }
  const tetoL = num(f.tetoL), tetoP = num(f.tetoP);
  const carL = num(f.carL), carP = num(f.carP), carA = num(f.carA);
  if (f.modelo === 'Piramidal' && !(tetoL >= 100 && tetoP >= 100)) erros.push('Informe a largura e a profundidade do teto.');
  if (f.modelo === 'Linea' && !(carL >= 100 && carP >= 100 && carA >= 100)) erros.push('Informe largura, profundidade e altura da carenagem.');
  if (f.modelo === 'Piramidal' && Number.isFinite(carA) && !(carA >= 100)) erros.push('Altura da carenagem inválida.');
  const lamp = Number(f.lamp), bot = Number(f.bot);
  if (!Number.isInteger(lamp) || lamp < 0 || lamp > 50) erros.push('Lâmpadas: número inteiro de 0 a 50.');
  if (!Number.isInteger(bot) || bot < 0 || bot > 50) erros.push('Botões/botoeiras: número inteiro de 0 a 50.');
  if (erros.length > 0) return { params: null, erros };

  const params: CoifaParamsSalvos = {
    modelo: f.modelo,
    width: L, depth: tube ? L : P, height: A,
    tipoAplicacao: f.aplicacao, tipoInstalacao: f.mount, material,
    qtdLampadas: lamp, qtdBotoes: bot, controle: f.controle, posicaoLampadas: f.posLamp, posicaoComando: f.posCmd,
    filtro: f.filtro, coletor: f.filtro === 'nenhum' ? 'nenhum' : f.coletor,
    frisoFrente: f.frisoF, frisoLD: f.frisoLD, frisoLE: f.frisoLE, frisoLinhas: Number(f.frisoLinhas) || 1,
  };
  if (f.modelo === 'Piramidal') { params.tetoWidth = tetoL; params.tetoDepth = tetoP; }
  if ((f.modelo === 'Piramidal' || f.modelo === 'Linea') && Number.isFinite(carA)) {
    params.carenagemHeight = carA;
    params.carenagemWidth = Number.isFinite(carL) ? carL : tetoL;
    params.carenagemDepth = Number.isFinite(carP) ? carP : tetoP;
  }
  return { params, erros: [] };
}

function DefinirDesenhoDialog({ item, atual, onClose, onSave }: { item: QuoteItem; atual?: AvaliacaoDesenho; onClose: () => void; onSave: (p: CoifaParamsSalvos, atualizarMedida: boolean) => void }) {
  const [f, setF] = useState<Form>(() => formInicial(item, atual));
  const [atualizarMedida, setAtualizarMedida] = useState(true);
  // Itens de catálogo não guardam o kit: o usuário precisa confirmar lâmpadas e comando.
  const kitDesconhecido = atual?.params ? atual.params.qtdLampadas === undefined : false;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((o) => ({ ...o, [k]: v }));
  const { params, erros } = useMemo(() => montarParametros(f, item.material), [f, item.material]);
  const tube = f.modelo === 'Tube';
  const campo = (rotulo: string, k: keyof Form, placeholder = 'mm') => (
    <div className="space-y-1">
      <Label className="text-xs">{rotulo}</Label>
      <Input type="number" inputMode="numeric" placeholder={placeholder} value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{atual?.params ? 'Personalizar medidas e imagem' : 'Informar dados e gerar a imagem'}</DialogTitle>
          <DialogDescription>
            {item.name}{item.measurement ? ` — ${item.measurement}` : ''}. Preencha as medidas reais; o desenho é gerado exatamente com o que você informar
            e só vale para este item (material: {item.material || 'não informado'}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                <Select value={f.modelo} onValueChange={(v) => set('modelo', v as Modelo)}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Box">Box</SelectItem>
                    <SelectItem value="Piramidal">Piramidal</SelectItem>
                    <SelectItem value="Linea">Línea</SelectItem>
                    <SelectItem value="Tube">Tube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instalação</Label>
                <Select value={f.mount} onValueChange={(v) => set('mount', v as Form['mount'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Parede">Parede</SelectItem><SelectItem value="Ilha">Ilha</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aplicação</Label>
                <Select value={f.aplicacao} onValueChange={(v) => set('aplicacao', v as Form['aplicacao'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Cozinha">Cozinha</SelectItem><SelectItem value="Churrasqueira">Churrasqueira</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {tube ? (
              <div className="grid grid-cols-2 gap-3">{campo('Diâmetro (Ø)', 'L')}{campo('Altura', 'A')}</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">{campo('Largura', 'L')}{campo('Profundidade', 'P')}{campo(f.modelo === 'Linea' ? 'Altura do corpo' : 'Altura', 'A')}</div>
            )}

            {f.modelo === 'Piramidal' && (
              <div className="space-y-1.5 rounded-md border p-2.5">
                <p className="text-xs font-medium">Teto</p>
                <div className="grid grid-cols-2 gap-3">{campo('Largura', 'tetoL')}{campo('Profundidade', 'tetoP')}</div>
              </div>
            )}
            {(f.modelo === 'Piramidal' || f.modelo === 'Linea') && (
              <div className="space-y-1.5 rounded-md border p-2.5">
                <p className="text-xs font-medium">Carenagem{f.modelo === 'Piramidal' ? ' (opcional)' : ''}</p>
                <div className="grid grid-cols-3 gap-3">{campo('Largura', 'carL')}{campo('Profundidade', 'carP')}{campo('Altura', 'carA')}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {campo('Lâmpadas (qtd)', 'lamp', '0')}
              {campo(f.controle === 'botoeira' ? 'Botoeiras (qtd)' : 'Botões (qtd)', 'bot', '0')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Comando</Label>
                <Select value={f.controle} onValueChange={(v) => set('controle', v as Form['controle'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="botoes">Botões</SelectItem><SelectItem value="botoeira">Botoeira</SelectItem></SelectContent>
                </Select>
              </div>
              {f.mount === 'Parede' && (
                <div className="space-y-1">
                  <Label className="text-xs">Lâmpadas</Label>
                  <Select value={f.posLamp} onValueChange={(v) => set('posLamp', v as Form['posLamp'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="frente">Na frente</SelectItem><SelectItem value="parede">Junto à parede</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!tube && (
              <div className="space-y-1">
                <Label className="text-xs">Posição {f.controle === 'botoeira' ? 'da botoeira' : 'dos botões'}</Label>
                <Select value={f.posCmd} onValueChange={(v) => set('posCmd', v as PosicaoComando)}>
                  <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                  <SelectContent>{POSICOES_COMANDO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {!tube && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Filtro</Label>
                  <Select value={f.filtro} onValueChange={(v) => set('filtro', v as Form['filtro'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem filtro</SelectItem>
                      <SelectItem value="aluminio">Alumínio</SelectItem>
                      <SelectItem value="inercial_430">Inercial 430</SelectItem>
                      <SelectItem value="inercial_304">Inercial 304</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(f.filtro === 'inercial_430' || f.filtro === 'inercial_304') && (
                  <div className="space-y-1">
                    <Label className="text-xs">Coletor de gordura</Label>
                    <Select value={f.coletor} onValueChange={(v) => set('coletor', v as Form['coletor'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="nenhum">Sem coletor</SelectItem><SelectItem value="simples">Simples</SelectItem><SelectItem value="duplo">Duplo</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="text-xs font-medium">Frisos:</span>
              {([['frisoF', 'Frente'], ['frisoLD', 'Lat. direita'], ['frisoLE', 'Lat. esquerda']] as const).map(([k, rot]) => (
                <label key={k} className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={f[k]} onCheckedChange={(v) => set(k, v === true)} />{rot}
                </label>
              ))}
              <Select value={f.frisoLinhas} onValueChange={(v) => set('frisoLinhas', v)}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1 linha</SelectItem><SelectItem value="2">2 linhas</SelectItem><SelectItem value="3">3 linhas</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {params ? (
              <CoifaViewer3D
                className="h-[320px]"
                embedded
                modelo={params.modelo}
                width={params.width} depth={params.depth} height={params.height}
                tetoWidth={params.tetoWidth} tetoDepth={params.tetoDepth}
                carenagemWidth={params.carenagemWidth} carenagemDepth={params.carenagemDepth} carenagemHeight={params.carenagemHeight}
                mount={params.tipoInstalacao}
                qtdLampadas={params.qtdLampadas} qtdBotoes={params.qtdBotoes}
                controle={params.controle} posicaoLampadas={params.posicaoLampadas} posicaoComando={params.posicaoComando}
                material={params.material}
                filtro={params.filtro} coletor={params.coletor}
                frisoFrente={params.frisoFrente} frisoLD={params.frisoLD} frisoLE={params.frisoLE} frisoLinhas={params.frisoLinhas}
              />
            ) : (
              <div className="h-[320px] rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground flex flex-col justify-center gap-1">
                <p className="font-medium text-foreground">Falta informar:</p>
                {erros.map((e) => <p key={e}>• {e}</p>)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">A prévia mostra exatamente o que será salvo no orçamento.</p>
            {kitDesconhecido && (
              <p className="text-xs text-amber-700 dark:text-amber-500">Este item vem do catálogo e não guarda a quantidade de lâmpadas e botões — confira esses campos.</p>
            )}
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox checked={atualizarMedida} onCheckedChange={(v) => setAtualizarMedida(v === true)} className="mt-0.5" />
              <span>Atualizar a coluna Medida do item com estas medidas. <strong>O preço não é recalculado</strong> — ajuste o valor unitário ou recalcule na Calculadora se o tamanho mudou.</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!params} onClick={() => params && onSave(params, atualizarMedida)}>
            <Wand2 className="mr-1.5 h-4 w-4" />Gerar imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


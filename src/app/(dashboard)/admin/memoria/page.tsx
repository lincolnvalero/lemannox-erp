'use client';

import { useState, useEffect, useMemo } from 'react';
import { BookOpen, HardHat, Lightbulb, SlidersHorizontal, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  getMaoDeObra, updateMaoDeObraRows,
  getIluminacao, updateIluminacaoRows, type IluminacaoRowUpdate,
  getCalculatorReferenceData, updateParametrosGlobaisRows,
} from '@/app/(dashboard)/calculator/actions';
import type { MaoDeObraRow, IluminacaoRow } from '@/lib/types';
import { CHAVE_DESENHO, DESENHO_INICIAL, type ParametrosDesenho } from '@/lib/coifa-desenho';
import {
  CHAVES_CARENAGEM_ATE_1300, CHAVES_CARENAGEM_ACIMA_1300, CARENAGEM_ATE_1300_INICIAL, CARENAGEM_ACIMA_1300_INICIAL,
  CHAVE_LOTE_PROFUNDIDADE, CHAVE_LOTE_ALTURA, CHAVE_LOTE_ALTURA_CORPO_LINEA, CHAVE_LOTE_PAINEL_PIRAMIDAL,
} from '@/lib/coifa-padroes';

// ── Mão de Obra ──────────────────────────────────────────────────────────

const MODELOS: MaoDeObraRow['modelo'][] = ['Box', 'Piramidal', 'Linea', 'Tube', 'Ilha'];
const MODELO_LABELS: Record<MaoDeObraRow['modelo'], string> = {
  Box: 'Box',
  Piramidal: 'Piramidal',
  Linea: 'Línea',
  Tube: 'Tube',
  Ilha: 'Acréscimo — Instalação Ilha',
};

function MaoDeObraSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MaoDeObraRow[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const result = await getMaoDeObra();
    if (result.success && result.rows) {
      setRows(result.rows);
      setEdits({});
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar mão de obra', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const porModelo = useMemo(() => {
    const map: Record<string, MaoDeObraRow[]> = {};
    for (const modelo of MODELOS) {
      map[modelo] = rows.filter(r => r.modelo === modelo).sort((a, b) => a.medida - b.medida);
    }
    return map;
  }, [rows]);

  const dirtyCount = Object.keys(edits).length;

  const handleSave = async () => {
    const toSave = Object.entries(edits).map(([id, valor]) => ({ id, valor }));
    if (toSave.length === 0) return;
    setSaving(true);
    const result = await updateMaoDeObraRows(toSave);
    setSaving(false);
    if (result.success) {
      toast({ title: 'Mão de obra salva!', description: `${toSave.length} valor(es) atualizado(s).` });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Valor de mão de obra (R$) por modelo e medida (mm). &quot;Ilha&quot; não é um modelo — é o acréscimo somado
          quando a instalação é em Ilha, independente do modelo escolhido.
        </p>
        <Button onClick={handleSave} disabled={dirtyCount === 0 || saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : `Salvar alterações${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </Button>
      </div>
      <Tabs defaultValue="Box">
        <TabsList>
          {MODELOS.map(modelo => <TabsTrigger key={modelo} value={modelo}>{MODELO_LABELS[modelo]}</TabsTrigger>)}
        </TabsList>
        {MODELOS.map(modelo => (
          <TabsContent key={modelo} value={modelo}>
            <Card>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-6">
                {porModelo[modelo]?.map(row => (
                  <div key={row.id} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{row.medida}mm</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={edits[row.id] ?? row.valor}
                      onChange={(e) => setEdits(v => ({ ...v, [row.id]: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                ))}
                {(!porModelo[modelo] || porModelo[modelo].length === 0) && (
                  <p className="text-sm text-muted-foreground col-span-full">Nenhuma medida cadastrada para este modelo.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ── Iluminação ───────────────────────────────────────────────────────────

type CampoIluminacao = 'qtdLampadas' | 'qtdFonte' | 'qtdBotoeira' | 'qtdBotao' | 'qtdChicote';

// Cozinha usa Botoeira; Churrasqueira usa Fonte + Botão. Cada tela mostra só
// os campos que fazem sentido pro tipo (mesma estrutura da planilha original).
const CAMPOS_COZINHA: { key: CampoIluminacao; label: string }[] = [
  { key: 'qtdLampadas', label: 'Lâmpada' },
  { key: 'qtdBotoeira', label: 'Botoeira' },
  { key: 'qtdChicote', label: 'Chicote' },
];
const CAMPOS_CHURRASQUEIRA: { key: CampoIluminacao; label: string }[] = [
  { key: 'qtdLampadas', label: 'Lâmpada' },
  { key: 'qtdFonte', label: 'Fonte' },
  { key: 'qtdBotao', label: 'Botão' },
  { key: 'qtdChicote', label: 'Chicote' },
];

function IluminacaoTable({
  tipoCoifa, rows, edits, onEdit,
}: {
  tipoCoifa: 'Cozinha' | 'Churrasqueira';
  rows: IluminacaoRow[];
  edits: Record<string, Partial<Record<CampoIluminacao, number>>>;
  onEdit: (id: string, campo: CampoIluminacao, valor: number) => void;
}) {
  const campos = tipoCoifa === 'Cozinha' ? CAMPOS_COZINHA : CAMPOS_CHURRASQUEIRA;
  const medidas = useMemo(() => Array.from(new Set(rows.map(r => r.medida))).sort((a, b) => a - b), [rows]);
  const byMedidaInstalacao = useMemo(() => {
    const map = new Map<string, IluminacaoRow>();
    rows.forEach(r => map.set(`${r.medida}-${r.tipoInstalacao}`, r));
    return map;
  }, [rows]);

  const valorAtual = (row: IluminacaoRow | undefined, campo: CampoIluminacao) => {
    if (!row) return 0;
    return edits[row.id]?.[campo] ?? row[campo];
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th rowSpan={2} className="p-2 text-left align-bottom">Medida</th>
            <th colSpan={campos.length} className="p-2 text-center border-l">Parede</th>
            <th colSpan={campos.length} className="p-2 text-center border-l">Ilha</th>
          </tr>
          <tr className="border-b bg-muted/20">
            {campos.map(c => <th key={`p-${c.key}`} className="p-1.5 text-xs font-normal border-l whitespace-nowrap">{c.label}</th>)}
            {campos.map(c => <th key={`i-${c.key}`} className="p-1.5 text-xs font-normal border-l whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {medidas.map(medida => {
            const parede = byMedidaInstalacao.get(`${medida}-Parede`);
            const ilha = byMedidaInstalacao.get(`${medida}-Ilha`);
            return (
              <tr key={medida} className="border-b last:border-0">
                <td className="p-2 font-medium whitespace-nowrap">{medida}mm</td>
                {campos.map(c => (
                  <td key={`p-${c.key}`} className="p-1 border-l">
                    <Input
                      type="number"
                      className="h-8 w-16"
                      value={valorAtual(parede, c.key)}
                      onChange={(e) => parede && onEdit(parede.id, c.key, parseInt(e.target.value) || 0)}
                      disabled={!parede}
                    />
                  </td>
                ))}
                {campos.map(c => (
                  <td key={`i-${c.key}`} className="p-1 border-l">
                    <Input
                      type="number"
                      className="h-8 w-16"
                      value={valorAtual(ilha, c.key)}
                      onChange={(e) => ilha && onEdit(ilha.id, c.key, parseInt(e.target.value) || 0)}
                      disabled={!ilha}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IluminacaoSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<IluminacaoRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Record<CampoIluminacao, number>>>>({});

  const load = async () => {
    setLoading(true);
    const result = await getIluminacao();
    if (result.success && result.rows) {
      setRows(result.rows);
      setEdits({});
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar iluminação', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (id: string, campo: CampoIluminacao, valor: number) => {
    setEdits(v => ({ ...v, [id]: { ...v[id], [campo]: valor } }));
  };

  const dirtyCount = Object.keys(edits).length;

  const handleSave = async () => {
    const byId = new Map(rows.map(r => [r.id, r]));
    const toSave: IluminacaoRowUpdate[] = Object.entries(edits)
      .map(([id, partial]) => {
        const original = byId.get(id);
        if (!original) return null;
        return {
          id,
          qtdLampadas: partial.qtdLampadas ?? original.qtdLampadas,
          qtdFonte: partial.qtdFonte ?? original.qtdFonte,
          qtdBotoeira: partial.qtdBotoeira ?? original.qtdBotoeira,
          qtdBotao: partial.qtdBotao ?? original.qtdBotao,
          qtdChicote: partial.qtdChicote ?? original.qtdChicote,
        };
      })
      .filter((r): r is IluminacaoRowUpdate => r !== null);

    if (toSave.length === 0) return;
    setSaving(true);
    const result = await updateIluminacaoRows(toSave);
    setSaving(false);
    if (result.success) {
      toast({ title: 'Iluminação salva!', description: `${toSave.length} linha(s) atualizada(s).` });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const cozinhaRows = rows.filter(r => r.tipoCoifa === 'Cozinha');
  const churrasqueiraRows = rows.filter(r => r.tipoCoifa === 'Churrasqueira');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Quantidade de cada item por medida e instalação. O preço unitário de cada item vem do{' '}
          <a href="/materials" className="underline">Estoque</a> (categoria &quot;Elétrico Coifa&quot;) — aqui só se define a quantidade.
        </p>
        <Button onClick={handleSave} disabled={dirtyCount === 0 || saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : `Salvar alterações${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </Button>
      </div>
      <Tabs defaultValue="Cozinha">
        <TabsList>
          <TabsTrigger value="Cozinha">Cozinha</TabsTrigger>
          <TabsTrigger value="Churrasqueira">Churrasqueira</TabsTrigger>
        </TabsList>
        <TabsContent value="Cozinha">
          <IluminacaoTable tipoCoifa="Cozinha" rows={cozinhaRows} edits={edits} onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="Churrasqueira">
          <IluminacaoTable tipoCoifa="Churrasqueira" rows={churrasqueiraRows} edits={edits} onEdit={handleEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Parâmetros Globais ───────────────────────────────────────────────────

const GRUPOS_PARAMETROS: { titulo: string; chaves: string[] }[] = [
  { titulo: 'Margem e Pintura', chaves: ['margem_lucro_padrao', 'pintura_padrao'] },
  { titulo: 'Friso decorativo', chaves: ['preco_friso_por_cm'] },
  { titulo: 'Filtro inercial (fórmula: constante ÷ 0,7 × L×P ÷ 1.000.000)', chaves: ['filtro_constante_430', 'filtro_constante_304', 'filtro_constante_aluminio', 'filtro_coletor_gordura_por_cm'] },
  { titulo: 'Desenho — furos (mm)', chaves: ['furoBotoeira', 'espacoBotoeira', 'furoBotao', 'furoLampadaCozinha', 'furoLampadaChurrasqueira'].map(k => CHAVE_DESENHO[k as keyof ParametrosDesenho]) },
  { titulo: 'Desenho — posição das lâmpadas na largura', chaves: ['lampPercentual', 'lampLimite', 'lampFixa'].map(k => CHAVE_DESENHO[k as keyof ParametrosDesenho]) },
  { titulo: 'Desenho — dobras e chapas', chaves: ['acrescimoDobra', 'espessura22', 'espessura24', 'larguraChapa', 'margemChapa', 'espacoPecas'].map(k => CHAVE_DESENHO[k as keyof ParametrosDesenho]) },
  { titulo: 'Desenho — peças da Box (regras de oficina, do exemplo Coifa Israel)', chaves: ['abaTopo', 'frenteRetorno', 'frentePainel', 'frenteAba', 'frenteBainha', 'frentePainelRecuo', 'costaRetorno', 'costaDegrau', 'costaAba', 'costaBainha', 'costaRecuo', 'lateralAba', 'tampaFolga', 'alivioLargura', 'alivioAltura'].map(k => CHAVE_DESENHO[k as keyof ParametrosDesenho]) },
  { titulo: 'Tabela de Preços — medidas do corpo (mm)', chaves: [CHAVE_LOTE_PROFUNDIDADE, CHAVE_LOTE_ALTURA, CHAVE_LOTE_ALTURA_CORPO_LINEA, CHAVE_LOTE_PAINEL_PIRAMIDAL] },
  { titulo: 'Tabela de Preços — carenagem (Línea e Piramidal) em coifas até 1300 mm', chaves: Object.values(CHAVES_CARENAGEM_ATE_1300) },
  { titulo: 'Tabela de Preços — carenagem (Línea e Piramidal) em coifas a partir de 1400 mm', chaves: Object.values(CHAVES_CARENAGEM_ACIMA_1300) },
];

const ROTULOS_DESENHO: Record<keyof ParametrosDesenho, string> = {
  furoBotoeira: 'Furos da botoeira — diâmetro (5 furos)', espacoBotoeira: 'Furos da botoeira/botões — espaço entre furos',
  furoBotao: 'Furos dos botões — diâmetro (2 botões)', furoLampadaCozinha: 'Furo da lâmpada — Cozinha (diâmetro)',
  furoLampadaChurrasqueira: 'Furo da lâmpada — Churrasqueira (diâmetro)',
  lampPercentual: 'Lateral → 1ª lâmpada (até o limite): % da largura', lampLimite: 'Largura limite da regra do % (mm)',
  lampFixa: 'Lateral → 1ª lâmpada acima do limite (mm)',
  acrescimoDobra: 'Acréscimo da dobradeira por dobra (mm)', espessura22: 'Espessura chapa 22 — frente e laterais (mm)',
  espessura24: 'Espessura chapa 24 — costas, teto e carenagens (mm)', larguraChapa: 'Largura da chapa (mm)',
  margemChapa: 'Margem da borda da chapa no encaixe (mm)', espacoPecas: 'Espaço entre peças no encaixe (mm)',
  abaTopo: 'Aba superior (mm)', frenteRetorno: 'Frente — trecho antes do painel de baixo (mm)', frentePainel: 'Frente — painel de baixo, com as lâmpadas (mm)',
  frenteAba: 'Frente — aba após o painel (mm)', frenteBainha: 'Frente — bainha final (mm)', frentePainelRecuo: 'Frente — recuo lateral do painel de baixo (mm)',
  costaRetorno: 'Costas — retorno de baixo (mm)', costaDegrau: 'Costas — degrau (mm)', costaAba: 'Costas — aba (mm)',
  costaBainha: 'Costas — bainha final, cada uma das duas (mm)', costaRecuo: 'Costas — recuo lateral da parte de baixo (mm)',
  lateralAba: 'Laterais — aba lateral (mm)', tampaFolga: 'Tampa — folga em largura e profundidade (mm)',
  alivioLargura: 'Recorte de canto — largura (mm)', alivioAltura: 'Recorte de canto — altura (mm)',
};
const PARAM_LABELS: Record<string, string> = {
  ...Object.fromEntries((Object.keys(CHAVE_DESENHO) as (keyof ParametrosDesenho)[]).map(k => [CHAVE_DESENHO[k], ROTULOS_DESENHO[k]])),
  margem_lucro_padrao: 'Margem de lucro padrão (%)',
  pintura_padrao: 'Pintura — valor padrão sugerido (R$)',
  preco_friso_por_cm: 'Friso — preço por cm (R$)',
  filtro_constante_430: 'Constante — Filtro Inercial 430',
  filtro_constante_304: 'Constante — Filtro Inercial 304',
  filtro_constante_aluminio: 'Constante — Filtro Alumínio',
  filtro_coletor_gordura_por_cm: 'Coletor de gordura — acréscimo por cm de largura (R$)',
  [CHAVE_LOTE_PROFUNDIDADE]: 'Profundidade padrão das coifas (mm) — padrão 700',
  [CHAVE_LOTE_ALTURA]: 'Altura padrão de Box e Piramidal (mm) — padrão 1000',
  [CHAVE_LOTE_ALTURA_CORPO_LINEA]: 'Altura do corpo da Línea (mm) — padrão 100',
  [CHAVE_LOTE_PAINEL_PIRAMIDAL]: 'Painel vertical da frente da Piramidal (mm) — padrão 100',
  [CHAVES_CARENAGEM_ATE_1300.largura]: 'Largura da carenagem (mm) — padrão 320',
  [CHAVES_CARENAGEM_ATE_1300.profundidade]: 'Profundidade da carenagem (mm) — padrão 300',
  [CHAVES_CARENAGEM_ATE_1300.altura]: 'Altura da carenagem (mm) — padrão 1000 (é a que muda o preço)',
  [CHAVES_CARENAGEM_ACIMA_1300.largura]: 'Largura da carenagem (mm) — padrão 500',
  [CHAVES_CARENAGEM_ACIMA_1300.profundidade]: 'Profundidade da carenagem (mm) — padrão 300',
  [CHAVES_CARENAGEM_ACIMA_1300.altura]: 'Altura da carenagem (mm) — padrão 1000 (é a que muda o preço)',
};

// Valor mostrado enquanto o parâmetro ainda não foi gravado no banco.
const PARAM_PADRAO: Record<string, number> = {
  ...Object.fromEntries((Object.keys(CHAVE_DESENHO) as (keyof ParametrosDesenho)[]).map(k => [CHAVE_DESENHO[k], DESENHO_INICIAL[k]])),
  [CHAVE_LOTE_PROFUNDIDADE]: 700,
  [CHAVE_LOTE_ALTURA]: 1000,
  [CHAVE_LOTE_ALTURA_CORPO_LINEA]: 100,
  [CHAVE_LOTE_PAINEL_PIRAMIDAL]: 100,
  [CHAVES_CARENAGEM_ATE_1300.largura]: CARENAGEM_ATE_1300_INICIAL.largura,
  [CHAVES_CARENAGEM_ATE_1300.profundidade]: CARENAGEM_ATE_1300_INICIAL.profundidade,
  [CHAVES_CARENAGEM_ATE_1300.altura]: CARENAGEM_ATE_1300_INICIAL.altura,
  [CHAVES_CARENAGEM_ACIMA_1300.largura]: CARENAGEM_ACIMA_1300_INICIAL.largura,
  [CHAVES_CARENAGEM_ACIMA_1300.profundidade]: CARENAGEM_ACIMA_1300_INICIAL.profundidade,
  [CHAVES_CARENAGEM_ACIMA_1300.altura]: CARENAGEM_ACIMA_1300_INICIAL.altura,
};

function ParametrosSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});
  const [edits, setEdits] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const result = await getCalculatorReferenceData();
    if (result.success && result.data) {
      setValues(result.data.parametros);
      setEdits({});
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar parâmetros', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dirtyCount = Object.keys(edits).length;

  const handleSave = async () => {
    const toSave = Object.entries(edits).map(([chave, valor]) => ({ chave, valor }));
    if (toSave.length === 0) return;
    setSaving(true);
    const result = await updateParametrosGlobaisRows(toSave);
    setSaving(false);
    if (result.success) {
      toast({ title: 'Parâmetros salvos!', description: `${toSave.length} valor(es) atualizado(s).` });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Margem, pintura, friso e filtro inercial. Os preços de lâmpada/fonte/botoeira/botão/chicote ficam no{' '}
          <a href="/materials" className="underline">Estoque</a> (categoria &quot;Elétrico Coifa&quot;), e o preço das chapas
          fica no Estoque (categoria &quot;Chapa&quot;) — só o que está aqui embaixo é exclusivo desta tela.
        </p>
        <Button onClick={handleSave} disabled={dirtyCount === 0 || saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : `Salvar alterações${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </Button>
      </div>
      {GRUPOS_PARAMETROS.map(grupo => (
        <Card key={grupo.titulo}>
          <CardHeader>
            <CardTitle className="text-base">{grupo.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {grupo.chaves.map(chave => (
              <div key={chave} className="space-y-1.5">
                <Label className="text-xs">{PARAM_LABELS[chave] ?? chave}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={edits[chave] ?? values[chave] ?? PARAM_PADRAO[chave] ?? 0}
                  onChange={(e) => setEdits(v => ({ ...v, [chave]: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────

export default function MemoriaPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Memória de Cálculos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados de referência da Calculadora de Coifas. Edite direto na tabela e clique em &quot;Salvar alterações&quot;.
        </p>
      </div>

      <Tabs defaultValue="mao-de-obra">
        <TabsList>
          <TabsTrigger value="mao-de-obra"><HardHat className="mr-1.5 h-4 w-4" />Mão de Obra</TabsTrigger>
          <TabsTrigger value="iluminacao"><Lightbulb className="mr-1.5 h-4 w-4" />Iluminação</TabsTrigger>
          <TabsTrigger value="parametros"><SlidersHorizontal className="mr-1.5 h-4 w-4" />Parâmetros Globais</TabsTrigger>
        </TabsList>
        <TabsContent value="mao-de-obra"><MaoDeObraSection /></TabsContent>
        <TabsContent value="iluminacao"><IluminacaoSection /></TabsContent>
        <TabsContent value="parametros"><ParametrosSection /></TabsContent>
      </Tabs>
    </div>
  );
}

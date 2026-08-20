// Motor de cálculo de coifas — regras extraídas de "Planilha_de_Cálculos.pdf"
// (Levi) e da especificação técnica que o Gemini escreveu a partir dela.
// Módulo puro: recebe os dados de referência já carregados do banco
// (materiais_chapas, tabela_iluminacao, mao_de_obra, parametros_globais) e
// devolve o detalhamento de custo. É usado tanto pela calculadora
// interativa quanto pela geração em lote da Tabela de Preços (Fase 3).

import type { CalculatorReferenceData, ChapaMaterial } from './types';

export type ModeloCoifa = 'Box' | 'Piramidal' | 'Linea' | 'Tube' | 'Ilha';
export type TipoAplicacao = 'Cozinha' | 'Churrasqueira';
export type TipoInstalacaoCoifa = 'Parede' | 'Ilha';
export type FiltroTipo = 'nenhum' | 'aluminio' | 'inercial_430' | 'inercial_304';
export type ColetorTipo = 'nenhum' | 'simples' | 'duplo';

export interface CoifaCalculatorInput {
  width: number;  // largura (mm)
  depth: number;  // profundidade (mm)
  height: number; // altura (mm)
  modelo: ModeloCoifa;
  // Piramidal — medida do teto
  tetoWidth?: number;
  tetoDepth?: number;
  // Línea — medidas da carenagem
  carenagemWidth?: number;
  carenagemDepth?: number;
  carenagemHeight?: number;
  materialFrenteLaterais: string; // '430' | '304' | 'Carbono'
  materialCostas: string;
  materialTeto: string;
  tipoAplicacao: TipoAplicacao;
  tipoInstalacao: TipoInstalacaoCoifa;
  filtro: FiltroTipo;
  coletor: ColetorTipo;
  frisoFrente: boolean;
  frisoLD: boolean;
  frisoLE: boolean;
  frisoLinhas: 1 | 2;
  outros: number;
  paintingCost: number;
}

export type CalculationDetail = { label: string; value: string };

export type CoifaCalculationResult = {
  sheetCost: number;
  filtroCost: number;
  frisoCost: number;
  iluminacaoCost: number;
  laborCost: number;
  outrosCost: number;
  paintingCost: number;
  totalCost: number;
  finalPrice: number;
  larguraPadrao: number;
  details: CalculationDetail[];
  warnings: string[];
  descricaoAuto: string;
};

const WELD_ALLOWANCE = 20; // mm, folga de solda usada na planilha original

// Chapa padrão automática: comprimento <= 1900mm usa chapa de 2000mm,
// senão usa chapa de 3000mm (regra do documento técnico, item A).
export function chapaPadraoAutomatica(width: number): number {
  return width <= 1900 ? 2000 : 3000;
}

// Encontra a linha da tabela cuja "medida" é a maior menor-ou-igual à
// medida informada (mesmo comportamento de um PROCV por faixa ordenado
// crescente). Fora da faixa, usa o extremo mais próximo.
function findByMedidaFaixa<T extends { medida: number }>(rows: T[], medida: number): T | undefined {
  if (rows.length === 0) return undefined;
  const sorted = [...rows].sort((a, b) => a.medida - b.medida);
  let match = sorted[0];
  for (const row of sorted) {
    if (row.medida <= medida) match = row;
    else break;
  }
  return match;
}

function findChapa(chapas: ChapaMaterial[], material: string, bitola: number, larguraPadrao: number): ChapaMaterial | undefined {
  return chapas.find(c => c.material === material && c.bitola === bitola && c.larguraPadrao === larguraPadrao);
}

// Encaixe simples (bin-packing) de peças na largura da chapa — mesma lógica
// já usada na calculadora anterior, mantida por já ser testada e mais
// precisa que uma contagem fixa de chapas.
function runBinPacking(pieceWidths: number[], sheetWidth: number, sheetPrice: number): { cost: number; sheets: number } {
  const pieces = [...pieceWidths].sort((a, b) => b - a);
  const bins: number[] = [];
  for (const p of pieces) {
    if (p > sheetWidth) throw new Error(`Peça de ${p}mm é maior que a largura da chapa (${sheetWidth}mm).`);
    let placed = false;
    for (let i = 0; i < bins.length; i++) {
      if (p <= bins[i]) { bins[i] -= p; placed = true; break; }
    }
    if (!placed) bins.push(sheetWidth - p);
  }
  if (bins.length === 0) return { cost: 0, sheets: 0 };

  let cost = 0;
  bins.forEach(remaining => {
    const usedWidth = sheetWidth - remaining;
    cost += remaining >= 500 ? (usedWidth / sheetWidth) * sheetPrice : sheetPrice;
  });

  const fullSheets = bins.length - 1;
  const lastUsage = (sheetWidth - bins[bins.length - 1]) / sheetWidth;
  const lastFraction = lastUsage <= 0.5 ? 0.5 : 1;
  const sheets = fullSheets + lastFraction;

  return { cost, sheets };
}

export function calculateCoifa(input: CoifaCalculatorInput, ref: CalculatorReferenceData): CoifaCalculationResult {
  const details: CalculationDetail[] = [];
  const warnings: string[] = [];
  const p = ref.parametros;
  const { width, depth, height } = input;

  // ── 1. Chapas (frente/laterais/costas/teto) ────────────────────────────
  const larguraPadrao = chapaPadraoAutomatica(width);
  if (height > larguraPadrao) {
    warnings.push(`A altura da coifa (${height}mm) é maior que a chapa selecionada (${larguraPadrao}mm) — confira as medidas.`);
  }

  const chapaFrente = findChapa(ref.materiaisChapas, input.materialFrenteLaterais, 22, larguraPadrao);
  if (!chapaFrente) warnings.push(`Chapa ${input.materialFrenteLaterais} bitola 22 / ${larguraPadrao}mm não cadastrada — custo considerado R$0.`);

  const sidePiece = depth + WELD_ALLOWANCE;
  const { cost: costFrenteLaterais, sheets: sheetsFrenteLaterais } = chapaFrente
    ? runBinPacking([width, sidePiece, sidePiece], larguraPadrao, chapaFrente.valorChapa)
    : { cost: 0, sheets: 0 };
  details.push({ label: 'Chapas (Frente/Laterais)', value: `${sheetsFrenteLaterais.toFixed(1)} un. de ${input.materialFrenteLaterais} — ${brl(costFrenteLaterais)}` });

  const chapaCostas = findChapa(ref.materiaisChapas, input.materialCostas, 24, larguraPadrao);
  const chapaTeto = findChapa(ref.materiaisChapas, input.materialTeto, 24, larguraPadrao);
  if (!chapaCostas) warnings.push(`Chapa ${input.materialCostas} bitola 24 / ${larguraPadrao}mm não cadastrada — custo considerado R$0.`);
  if (!chapaTeto) warnings.push(`Chapa ${input.materialTeto} bitola 24 / ${larguraPadrao}mm não cadastrada — custo considerado R$0.`);

  let costCostasTeto = 0;
  let sheetsCostasTeto = 0;
  if (input.materialCostas === input.materialTeto && chapaCostas) {
    // Mesmo material — encaixa costas e teto juntos na mesma chapa.
    const { cost, sheets } = runBinPacking([width, width], larguraPadrao, chapaCostas.valorChapa);
    costCostasTeto = cost;
    sheetsCostasTeto = sheets;
  } else {
    if (chapaCostas) {
      const { cost, sheets } = runBinPacking([width], larguraPadrao, chapaCostas.valorChapa);
      costCostasTeto += cost;
      sheetsCostasTeto += sheets;
    }
    if (chapaTeto) {
      const { cost, sheets } = runBinPacking([width], larguraPadrao, chapaTeto.valorChapa);
      costCostasTeto += cost;
      sheetsCostasTeto += sheets;
    }
  }
  details.push({ label: 'Chapas (Costas/Teto)', value: `${sheetsCostasTeto.toFixed(1)} un. — ${brl(costCostasTeto)}` });

  const sheetCost = costFrenteLaterais + costCostasTeto;

  // ── 2. Filtro inercial ──────────────────────────────────────────────────
  let filtroCost = 0;
  if (input.filtro !== 'nenhum') {
    const constKey = input.filtro === 'inercial_430' ? 'filtro_constante_430'
      : input.filtro === 'inercial_304' ? 'filtro_constante_304'
      : 'filtro_constante_aluminio';
    const constante = p[constKey] ?? 0;
    filtroCost = (constante / 0.7) * (width * depth) / 1_000_000;

    if (input.coletor !== 'nenhum') {
      const larguraCm = width / 10;
      const acrescimo = larguraCm * (p['filtro_coletor_gordura_por_cm'] ?? 0) * (input.coletor === 'duplo' ? 2 : 1);
      filtroCost += acrescimo;
      details.push({ label: 'Filtro inercial + coletor de gordura', value: brl(filtroCost) });
    } else {
      details.push({ label: 'Filtro inercial', value: brl(filtroCost) });
    }
  }

  // ── 3. Frisos ────────────────────────────────────────────────────────────
  let frisoCost = 0;
  const extensaoMm = (input.frisoFrente ? width : 0) + (input.frisoLD ? depth : 0) + (input.frisoLE ? depth : 0);
  if (extensaoMm > 0) {
    const extensaoCm = extensaoMm / 10;
    frisoCost = extensaoCm * (p['preco_friso_por_cm'] ?? 0) * input.frisoLinhas;
    details.push({ label: `Frisos (${extensaoCm.toFixed(0)}cm × ${input.frisoLinhas})`, value: brl(frisoCost) });
  }

  // ── 4. Iluminação ────────────────────────────────────────────────────────
  const iluminacaoRow = findByMedidaFaixa(
    ref.tabelaIluminacao.filter(r => r.tipoCoifa === input.tipoAplicacao && r.tipoInstalacao === input.tipoInstalacao),
    width
  );
  let iluminacaoCost = 0;
  if (iluminacaoRow) {
    const precoLampada = input.tipoAplicacao === 'Cozinha' ? p['preco_lampada_cozinha'] : p['preco_lampada_churrasqueira'];
    iluminacaoCost += iluminacaoRow.qtdLampadas * (precoLampada ?? 0);
    iluminacaoCost += iluminacaoRow.qtdFonte * (p['preco_fonte'] ?? 0);
    iluminacaoCost += iluminacaoRow.qtdBotoeira * (p['preco_botoeira'] ?? 0);
    iluminacaoCost += iluminacaoRow.qtdBotao * (p['preco_botao'] ?? 0);
    iluminacaoCost += iluminacaoRow.qtdChicote * (p['preco_chicote'] ?? 0);
    details.push({
      label: 'Kit Iluminação',
      value: `${iluminacaoRow.qtdLampadas} lâmp., ${iluminacaoRow.qtdBotoeira || iluminacaoRow.qtdBotao} bot., ${iluminacaoRow.qtdChicote} chicote — ${brl(iluminacaoCost)}`,
    });
  } else {
    warnings.push('Nenhuma faixa de iluminação encontrada para essa medida/aplicação/instalação.');
  }

  // ── 5. Mão de obra ───────────────────────────────────────────────────────
  const maoDeObraRow = findByMedidaFaixa(ref.maoDeObra.filter(r => r.modelo === input.modelo), width);
  const laborCost = maoDeObraRow?.valor ?? 0;
  if (!maoDeObraRow) warnings.push(`Mão de obra não encontrada para o modelo ${input.modelo} nessa medida.`);
  details.push({ label: `Mão de obra (${input.modelo})`, value: brl(laborCost) });

  // ── 6. Outros + Pintura ──────────────────────────────────────────────────
  if (input.outros > 0) details.push({ label: 'Outros', value: brl(input.outros) });
  if (input.paintingCost > 0) details.push({ label: 'Pintura', value: brl(input.paintingCost) });

  const totalCost = sheetCost + filtroCost + frisoCost + iluminacaoCost + laborCost + input.outros + input.paintingCost;
  const margem = p['margem_lucro_padrao'] ?? 0;
  const finalPrice = totalCost * (1 + margem / 100);

  const descricaoAuto = buildDescricaoAuto(input, iluminacaoRow);

  return {
    sheetCost, filtroCost, frisoCost, iluminacaoCost, laborCost,
    outrosCost: input.outros, paintingCost: input.paintingCost,
    totalCost, finalPrice, larguraPadrao, details, warnings, descricaoAuto,
  };
}

function buildDescricaoAuto(
  input: CoifaCalculatorInput,
  iluminacao: { qtdLampadas: number; qtdBotoeira: number; qtdBotao: number } | undefined
): string {
  const parts: string[] = [`Coifa ${input.modelo} ${input.tipoAplicacao}`];
  if (iluminacao) {
    parts.push(`${iluminacao.qtdLampadas} lâmpadas`);
    if (input.tipoAplicacao === 'Cozinha' && iluminacao.qtdBotoeira > 0) {
      parts.push(`${iluminacao.qtdBotoeira} botoeira${iluminacao.qtdBotoeira > 1 ? 's' : ''}`);
    } else if (iluminacao.qtdBotao > 0) {
      parts.push(iluminacao.qtdBotao > 1 ? `${iluminacao.qtdBotao} botões` : '1 botão');
    }
  }
  if (input.filtro !== 'nenhum') {
    const nome = input.filtro === 'inercial_430' ? 'Filtro inercial 430'
      : input.filtro === 'inercial_304' ? 'Filtro inercial 304'
      : 'Filtro alumínio';
    parts.push(input.coletor !== 'nenhum' ? `${nome} com Coletor de Gordura` : nome);
  } else {
    parts.push('Sem filtros');
  }
  return parts.join(', ');
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

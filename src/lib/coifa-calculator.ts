// Motor de cálculo de coifas — regras extraídas de "Planilha_de_Cálculos.pdf"
// (Levi), da especificação técnica que o Gemini escreveu a partir dela, e
// das correções enviadas depois (materiais únicos por coifa, Ilha como
// acréscimo de mão de obra, fórmulas específicas de Tube/Línea, e a divisão
// corpo/carenagem da Línea explicada em 24/8/26). Módulo puro: recebe os
// dados de referência já carregados do banco (materiais de chapa e elétricos
// do Estoque, tabela_iluminacao, mao_de_obra, parametros_globais) e devolve
// o detalhamento de custo. Usado pela calculadora interativa e pela geração
// em lote da Tabela de Preços.

import type { CalculatorReferenceData, RawMaterial } from './types';

export type ModeloCoifa = 'Box' | 'Piramidal' | 'Linea' | 'Tube';
export type TipoAplicacao = 'Cozinha' | 'Churrasqueira';
export type TipoInstalacaoCoifa = 'Parede' | 'Ilha';
export type FiltroTipo = 'nenhum' | 'aluminio' | 'inercial_430' | 'inercial_304';
export type ColetorTipo = 'nenhum' | 'simples' | 'duplo';

export interface CoifaCalculatorInput {
  width: number;  // largura (mm) — para Tube, é o diâmetro
  depth: number;  // profundidade (mm)
  height: number; // altura (mm) — para Tube, alimenta o corpo cilíndrico (bitola 24)
  modelo: ModeloCoifa;
  // Piramidal — medida do teto (abertura/duto, menor que a base da coifa)
  tetoWidth?: number;
  tetoDepth?: number;
  // Línea — medidas da carenagem (a "moldura" que sobe até o teto). Só a
  // altura entra no cálculo (mesma fórmula da altura da Tube); largura e
  // profundidade são só informativas/físicas.
  carenagemWidth?: number;
  carenagemDepth?: number;
  carenagemHeight?: number;
  material: string;       // '430' | '304' | 'Carbono' — uma única entrada para toda a coifa
  larguraPadrao: number;  // 2000 | 3000 — chapa bitola 22 (corpo, na Línea/Tube; frente/laterais no Box/Piramidal)
  // Línea usa duas bitolas (22 no corpo, 24 na carenagem) que podem vir de
  // chapas de tamanho padrão diferente — se omitido, usa o mesmo de larguraPadrao.
  larguraPadraoCarenagem?: number;
  tipoAplicacao: TipoAplicacao;
  tipoInstalacao: TipoInstalacaoCoifa; // Ilha soma o acréscimo de mão de obra da coluna "Ilha"
  filtro: FiltroTipo;      // pode ser 304 ou 430 independente do material da coifa
  coletor: ColetorTipo;
  frisoFrente: boolean;
  frisoLD: boolean;
  frisoLE: boolean;
  frisoLinhas: 1 | 2 | 3;
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
  details: CalculationDetail[];
  warnings: string[];
  descricaoAuto: string;
};

// Tabela de "altura equivalente" (bitola 24 / 0,6mm) usada tanto pela
// carenagem da Línea quanto pelo corpo cilíndrico da Tube — em ambos os
// casos, o consumo de chapa escala pela ALTURA (não pela largura).
// Transcrita tal como enviada; a queda entre 1600→2000 (2900) e 2000→2100
// (3600) é exatamente o que a fórmula original do Excel produz
// (SES(...E3<=2000;1700+2400...E3<=2100;3400+200...) — confirmado célula a
// célula, não é erro de transcrição.
const ALTURA_EQUIVALENTE_CARENAGEM: { ate: number; valor: number }[] = [
  { ate: 1000, valor: 1700 }, { ate: 1100, valor: 1900 }, { ate: 1200, valor: 2100 },
  { ate: 1300, valor: 2300 }, { ate: 1400, valor: 2500 }, { ate: 1500, valor: 2700 },
  { ate: 1600, valor: 2900 }, { ate: 2000, valor: 4100 }, { ate: 2100, valor: 3600 },
  { ate: 2200, valor: 3800 }, { ate: 2300, valor: 4000 }, { ate: 2400, valor: 4200 },
  { ate: 2500, valor: 4400 }, { ate: 2600, valor: 4600 }, { ate: 2700, valor: 4800 },
  { ate: 2800, valor: 5000 }, { ate: 2900, valor: 5200 }, { ate: 3000, valor: 5400 },
];

function alturaEquivalenteCarenagem(altura: number): number {
  for (const row of ALTURA_EQUIVALENTE_CARENAGEM) {
    if (altura <= row.ate) return row.valor;
  }
  return ALTURA_EQUIVALENTE_CARENAGEM[ALTURA_EQUIVALENTE_CARENAGEM.length - 1].valor;
}

// Corpo da Línea (bitola 22 / 0,8mm): consumo de chapa pela LARGURA da
// coifa — é a parte baixa (80-100mm de altura), que pode ser bem larga.
// Transcrita da fórmula enviada em 24/8/26.
const LINEA_CORPO_POR_LARGURA: { ate: number; valor: number }[] = [
  { ate: 1000, valor: 1000 }, { ate: 1100, valor: 1200 }, { ate: 1200, valor: 1400 },
  { ate: 1300, valor: 1500 }, { ate: 1400, valor: 1600 }, { ate: 1500, valor: 1700 },
  { ate: 2000, valor: 2000 }, { ate: 2100, valor: 2200 }, { ate: 2200, valor: 2400 },
  { ate: 2300, valor: 2500 }, { ate: 2400, valor: 2600 }, { ate: 2500, valor: 3000 },
];

function metragemLineaCorpo(largura: number): number {
  for (const row of LINEA_CORPO_POR_LARGURA) {
    if (largura <= row.ate) return row.valor;
  }
  return 3000; // acima de 2500mm, a fórmula original também usa 3000 (branch "VERDADEIRO")
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

function findChapaEstoque(materiais: RawMaterial[], material: string, bitola: number, larguraPadrao: number): RawMaterial | undefined {
  return materiais.find(m =>
    m.category === 'Chapa' &&
    m.bitola === bitola &&
    m.width === larguraPadrao &&
    m.name.toLowerCase().includes(material.toLowerCase())
  );
}

// Preço de um componente elétrico (lâmpada, fonte, botoeira, botão,
// chicote) cadastrado no Estoque — substitui os valores fixos que ficavam
// em parametros_globais, para que o preço fique no mesmo lugar onde o
// Levi já reajusta o preço das chapas.
function precoEletrico(eletricos: RawMaterial[], nome: string): number {
  const item = eletricos.find(m => m.name.toLowerCase() === nome.toLowerCase());
  return item?.unitCost ?? 0;
}

// Custo de um grupo de chapa: soma linear das medidas das peças (mm) ÷
// largura da chapa × preço unitário. Sem encaixe/otimização — é a mesma
// conta que a planilha original faz (confirmada com o exemplo do PDF:
// 1400+1000+1000=3400mm ÷ 2000mm = 1,70 chapas × R$165 = R$280,50).
function custoGrupoChapa(metragemMm: number, larguraPadrao: number, chapa: RawMaterial | undefined): { cost: number; chapas: number } {
  if (!chapa || metragemMm <= 0) return { cost: 0, chapas: 0 };
  const chapas = metragemMm / larguraPadrao;
  return { cost: chapas * chapa.unitCost, chapas };
}

export function calculateCoifa(input: CoifaCalculatorInput, ref: CalculatorReferenceData): CoifaCalculationResult {
  const details: CalculationDetail[] = [];
  const warnings: string[] = [];
  const p = ref.parametros;
  const { width, depth, height, larguraPadrao } = input;
  const materiaisEstoque = ref.materiaisEstoque ?? [];
  const eletricos = ref.eletricosEstoque ?? [];

  // ── 1. Chapas ────────────────────────────────────────────────────────────
  let sheetCost = 0;

  if (input.modelo === 'Tube') {
    // Tampas (as duas pontas do cilindro): sempre 1/4 de chapa bitola 22,
    // fixo, independente do diâmetro — conforme instrução específica.
    const chapaTampas = findChapaEstoque(materiaisEstoque, input.material, 22, larguraPadrao);
    if (!chapaTampas) warnings.push(`Chapa ${input.material} bitola 22 / ${larguraPadrao}mm não encontrada no Estoque (tampas da Tube).`);
    const costTampas = 0.25 * (chapaTampas?.unitCost ?? 0);
    details.push({ label: 'Chapa (Tube — 2 tampas, 1/4 chapa)', value: brl(costTampas) });

    // Corpo cilíndrico: sempre bitola 24, consumo pela ALTURA (mesma fórmula
    // da carenagem da Línea).
    const alturaEq = alturaEquivalenteCarenagem(height);
    const chapaCorpo = findChapaEstoque(materiaisEstoque, input.material, 24, larguraPadrao);
    if (!chapaCorpo) warnings.push(`Chapa ${input.material} bitola 24 / ${larguraPadrao}mm não encontrada no Estoque (corpo da Tube).`);
    const { cost: costCorpo, chapas: chapasCorpo } = custoGrupoChapa(alturaEq, larguraPadrao, chapaCorpo);
    details.push({ label: `Chapa (Tube — corpo, altura equiv. ${alturaEq}mm)`, value: `${chapasCorpo.toFixed(2)} un. — ${brl(costCorpo)}` });

    sheetCost = costTampas + costCorpo;
  } else if (input.modelo === 'Linea') {
    // Corpo (parte baixa e larga): bitola 22, consumo pela LARGURA.
    const metragemCorpo = metragemLineaCorpo(width);
    const chapaCorpo = findChapaEstoque(materiaisEstoque, input.material, 22, larguraPadrao);
    if (!chapaCorpo) warnings.push(`Chapa ${input.material} bitola 22 / ${larguraPadrao}mm não encontrada no Estoque (corpo da Línea).`);
    const { cost: costCorpo, chapas: chapasCorpo } = custoGrupoChapa(metragemCorpo, larguraPadrao, chapaCorpo);
    details.push({ label: `Chapa (Línea — corpo, ${metragemCorpo}mm)`, value: `${chapasCorpo.toFixed(2)} un. — ${brl(costCorpo)}` });

    // Carenagem (moldura até o teto): bitola 24, consumo pela ALTURA DA
    // CARENAGEM (campo próprio) — pode usar chapa padrão diferente do corpo.
    let costCarenagem = 0;
    if (input.carenagemHeight && input.carenagemHeight > 0) {
      const larguraPadraoCarenagem = input.larguraPadraoCarenagem || larguraPadrao;
      const alturaEq = alturaEquivalenteCarenagem(input.carenagemHeight);
      const chapaCarenagem = findChapaEstoque(materiaisEstoque, input.material, 24, larguraPadraoCarenagem);
      if (!chapaCarenagem) warnings.push(`Chapa ${input.material} bitola 24 / ${larguraPadraoCarenagem}mm não encontrada no Estoque (carenagem da Línea).`);
      const { cost, chapas } = custoGrupoChapa(alturaEq, larguraPadraoCarenagem, chapaCarenagem);
      costCarenagem = cost;
      details.push({ label: `Chapa (Línea — carenagem, altura equiv. ${alturaEq}mm)`, value: `${chapas.toFixed(2)} un. — ${brl(cost)}` });
    } else {
      warnings.push('Altura da carenagem não informada — custo da carenagem da Línea não incluído.');
    }

    sheetCost = costCorpo + costCarenagem;
  } else {
    const chapaFrente = findChapaEstoque(materiaisEstoque, input.material, 22, larguraPadrao);
    if (!chapaFrente) warnings.push(`Chapa ${input.material} bitola 22 / ${larguraPadrao}mm não encontrada no Estoque.`);
    const metragemFrenteLaterais = width + depth + depth;
    const { cost: costFrente, chapas: chapasFrente } = custoGrupoChapa(metragemFrenteLaterais, larguraPadrao, chapaFrente);
    details.push({ label: 'Chapa (Frente/Laterais)', value: `${chapasFrente.toFixed(2)} un. — ${brl(costFrente)}` });

    const chapaCostasTeto = findChapaEstoque(materiaisEstoque, input.material, 24, larguraPadrao);
    if (!chapaCostasTeto) warnings.push(`Chapa ${input.material} bitola 24 / ${larguraPadrao}mm não encontrada no Estoque.`);
    const tetoContribuicao = input.modelo === 'Piramidal' ? (input.tetoWidth || 0) : width;
    const metragemCostasTeto = width + tetoContribuicao;
    const { cost: costCostasTeto, chapas: chapasCostasTeto } = custoGrupoChapa(metragemCostasTeto, larguraPadrao, chapaCostasTeto);
    details.push({ label: 'Chapa (Costas/Teto)', value: `${chapasCostasTeto.toFixed(2)} un. — ${brl(costCostasTeto)}` });

    sheetCost = costFrente + costCostasTeto;
  }

  // ── 2. Filtro inercial (material do filtro é independente do da coifa) ──
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

  // ── 4. Iluminação (preços vêm do Estoque, não mais de parâmetros fixos) ──
  let iluminacaoCost = 0;
  let lampadasDescricao = 0;
  let botaoOuBotoeiraDescricao = 0;

  if (input.modelo === 'Tube') {
    // Fórmula fixa, independente de medida/instalação: 2 lâmpadas + 1
    // botoeira + 1 chicote — sempre, conforme instrução específica.
    const precoLampada = precoEletrico(eletricos, input.tipoAplicacao === 'Cozinha' ? 'Lâmpada Cozinha' : 'Lâmpada Churrasqueira');
    const precoBotoeira = precoEletrico(eletricos, 'Botoeira');
    const precoChicote = precoEletrico(eletricos, 'Chicote');
    iluminacaoCost = 2 * precoLampada + 1 * precoBotoeira + 1 * precoChicote;
    lampadasDescricao = 2;
    botaoOuBotoeiraDescricao = 1;
    details.push({ label: 'Kit Iluminação (Tube — fixo)', value: `2 lâmp., 1 botoeira, 1 chicote — ${brl(iluminacaoCost)}` });
  } else {
    const iluminacaoRow = findByMedidaFaixa(
      ref.tabelaIluminacao.filter(r => r.tipoCoifa === input.tipoAplicacao && r.tipoInstalacao === input.tipoInstalacao),
      width
    );
    if (iluminacaoRow) {
      const precoLampada = precoEletrico(eletricos, input.tipoAplicacao === 'Cozinha' ? 'Lâmpada Cozinha' : 'Lâmpada Churrasqueira');
      const precoFonte = precoEletrico(eletricos, 'Fonte');
      const precoBotoeira = precoEletrico(eletricos, 'Botoeira');
      const precoBotao = precoEletrico(eletricos, 'Botão');
      const precoChicote = precoEletrico(eletricos, 'Chicote');
      iluminacaoCost += iluminacaoRow.qtdLampadas * precoLampada;
      iluminacaoCost += iluminacaoRow.qtdFonte * precoFonte;
      iluminacaoCost += iluminacaoRow.qtdBotoeira * precoBotoeira;
      iluminacaoCost += iluminacaoRow.qtdBotao * precoBotao;
      iluminacaoCost += iluminacaoRow.qtdChicote * precoChicote;
      lampadasDescricao = iluminacaoRow.qtdLampadas;
      botaoOuBotoeiraDescricao = iluminacaoRow.qtdBotoeira || iluminacaoRow.qtdBotao;
      details.push({
        label: 'Kit Iluminação',
        value: `${iluminacaoRow.qtdLampadas} lâmp., ${botaoOuBotoeiraDescricao} bot., ${iluminacaoRow.qtdChicote} chicote — ${brl(iluminacaoCost)}`,
      });
    } else {
      warnings.push('Nenhuma faixa de iluminação encontrada para essa medida/aplicação/instalação.');
    }
  }

  // ── 5. Mão de obra (+ acréscimo de Ilha, quando for o caso) ─────────────
  const maoDeObraRow = findByMedidaFaixa(ref.maoDeObra.filter(r => r.modelo === input.modelo), width);
  let laborCost = maoDeObraRow?.valor ?? 0;
  if (!maoDeObraRow) warnings.push(`Mão de obra não encontrada para o modelo ${input.modelo} nessa medida.`);
  details.push({ label: `Mão de obra (${input.modelo})`, value: brl(laborCost) });

  if (input.tipoInstalacao === 'Ilha') {
    const ilhaRow = findByMedidaFaixa(ref.maoDeObra.filter(r => r.modelo === 'Ilha'), width);
    const acrescimoIlha = ilhaRow?.valor ?? 0;
    laborCost += acrescimoIlha;
    details.push({ label: 'Acréscimo mão de obra (Instalação Ilha)', value: brl(acrescimoIlha) });
  }

  // ── 6. Outros + Pintura ──────────────────────────────────────────────────
  if (input.outros > 0) details.push({ label: 'Outros', value: brl(input.outros) });
  if (input.paintingCost > 0) details.push({ label: 'Pintura', value: brl(input.paintingCost) });

  const totalCost = sheetCost + filtroCost + frisoCost + iluminacaoCost + laborCost + input.outros + input.paintingCost;
  const margem = p['margem_lucro_padrao'] ?? 0;
  const finalPrice = totalCost * (1 + margem / 100);

  const descricaoAuto = buildDescricaoAuto(input, lampadasDescricao, botaoOuBotoeiraDescricao);

  return {
    sheetCost, filtroCost, frisoCost, iluminacaoCost, laborCost,
    outrosCost: input.outros, paintingCost: input.paintingCost,
    totalCost, finalPrice, details, warnings, descricaoAuto,
  };
}

function buildDescricaoAuto(input: CoifaCalculatorInput, qtdLampadas: number, qtdBotaoOuBotoeira: number): string {
  const parts: string[] = [`Coifa ${input.modelo} ${input.tipoAplicacao}`];
  if (qtdLampadas > 0) {
    parts.push(`${qtdLampadas} lâmpada${qtdLampadas !== 1 ? 's' : ''}`);
    if (qtdBotaoOuBotoeira > 0) {
      const nome = input.tipoAplicacao === 'Cozinha' ? 'botoeira' : 'botão';
      parts.push(`${qtdBotaoOuBotoeira} ${nome}${qtdBotaoOuBotoeira !== 1 ? (nome === 'botão' ? 'es' : 's') : ''}`);
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
  parts.push(`${input.width}x${input.depth}x${input.height}mm`);
  return parts.join(', ');
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

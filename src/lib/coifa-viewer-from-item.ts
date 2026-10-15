// Reconstrói os parâmetros do visualizador 3D a partir de um item de
// orçamento — só quando o desenho é comprovadamente fiel ao item.

import type { QuoteItem } from './types';
import type { CoifaViewer3DProps } from '@/components/dashboard/coifa-viewer-3d';
import {
  LOTE_PROFUNDIDADE, LOTE_ALTURA, LOTE_ALTURA_CORPO_LINEA, LINHAS_TABELA,
  CATEGORIA_COIFA_COZINHA, CATEGORIA_COIFA_CHURRASQUEIRA, formatarMedidaCoifa, type PadroesTabela,
} from './coifa-padroes';

export type CoifaItemParams = Omit<CoifaViewer3DProps, 'className' | 'embedded' | 'onViewChange'> & {
  tipoAplicacao: 'Cozinha' | 'Churrasqueira';
  /** true quando as medidas vieram da Calculadora (não da convenção da tabela). */
  exato: boolean;
};

/** Produto do catálogo (Tabela de Preços), por id — é o "código" que liga o item ao desenho. */
export type ProdutoCatalogo = { category: string; model: string; measurement: string };

const semEspacos = (t: string | undefined) => (t ?? '').toLowerCase().replace(/\s+/g, '');

/**
 * Só devolve parâmetros de desenho quando dá pra GARANTIR que o desenho
 * representa o item. Na dúvida devolve null — o orçamento então não mostra
 * imagem, em vez de mostrar uma imagem errada.
 *
 * 1) Item da Calculadora (`coifaParams`): vale se a medida e o material
 *    escritos no item ainda são os do cálculo (se o usuário editou, o desenho
 *    antigo deixaria de bater).
 * 2) Item da Tabela de Preços: vale se o `productId` ainda existe e o produto
 *    tem o mesmo modelo e a mesma medida do item, e é um modelo gerado pela
 *    Tabela de Preços (as medidas de profundidade/altura/teto/carenagem vêm da
 *    mesma convenção usada para calcular o preço).
 * 3) Item cadastrado/digitado com todas as medidas escritas (Box "1300x650x670",
 *    Tube "Ø400x1100"): o desenho usa SÓ o que está escrito no próprio item.
 *    Piramidal e Línea ficam sem desenho nesse caso — teto e carenagem não
 *    constam no texto e não dá para adivinhar.
 */
export function coifaParamsFromQuoteItem(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'productId' | 'category' | 'coifaParams'>,
  contexto: { produtos: Map<string, ProdutoCatalogo> | null; padroes: PadroesTabela | null },
): CoifaItemParams | null {
  const salvo = item.coifaParams;
  if (salvo) {
    if (!salvo.modelo || !(salvo.height > 0)) return null;
    const medida = formatarMedidaCoifa(salvo.modelo, salvo.width, salvo.depth, salvo.height);
    if (semEspacos(item.measurement) !== semEspacos(medida)) return null;
    if (salvo.material && item.material && salvo.material !== item.material) return null;
    return {
      modelo: salvo.modelo,
      width: salvo.modelo === 'Tube' ? 500 : salvo.width,
      depth: salvo.modelo === 'Tube' ? 500 : salvo.depth,
      height: salvo.height,
      tetoWidth: salvo.tetoWidth,
      tetoDepth: salvo.tetoDepth,
      carenagemWidth: salvo.carenagemWidth,
      carenagemDepth: salvo.carenagemDepth,
      carenagemHeight: salvo.carenagemHeight,
      mount: salvo.tipoInstalacao,
      tipoAplicacao: salvo.tipoAplicacao,
      material: salvo.material ?? item.material,
      filtro: salvo.filtro,
      coletor: salvo.coletor,
      frisoFrente: salvo.frisoFrente,
      frisoLD: salvo.frisoLD,
      frisoLE: salvo.frisoLE,
      frisoLinhas: salvo.frisoLinhas,
      qtdLampadas: salvo.qtdLampadas,
      qtdBotoes: salvo.qtdBotoes,
      controle: salvo.controle,
      posicaoLampadas: salvo.posicaoLampadas,
      exato: true,
    };
  }

  return desenhoDaTabela(item, contexto) ?? desenhoPelasMedidasEscritas(item);
}

// Produto gerado pela Tabela de Preços: tudo precisa bater com o cadastro.
function desenhoDaTabela(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'productId'>,
  contexto: { produtos: Map<string, ProdutoCatalogo> | null; padroes: PadroesTabela | null },
): CoifaItemParams | null {
  const produto = item.productId ? contexto.produtos?.get(item.productId) : undefined;
  if (!produto) return null;
  const linha = LINHAS_TABELA.find(l => l.modelLabel === produto.model);
  if (!linha) return null;
  if (produto.model !== (item.name ?? '').trim() || semEspacos(produto.measurement) !== semEspacos(item.measurement)) return null;
  const tipoAplicacao = produto.category === CATEGORIA_COIFA_CHURRASQUEIRA ? 'Churrasqueira'
    : produto.category === CATEGORIA_COIFA_COZINHA ? 'Cozinha' : null;
  if (!tipoAplicacao) return null;
  const m = /^(\d{4})mm$/i.exec(produto.measurement.trim());
  const medida = m ? Number(m[1]) : NaN;
  if (!(medida >= 1000 && medida <= 3000)) return null;

  const comum = {
    mount: linha.instalacao, tipoAplicacao, material: item.material, exato: false,
    // Churrasqueira de catálogo vem com 2 botões; Cozinha, com botoeira.
    controle: tipoAplicacao === 'Churrasqueira' ? 'botoes' : 'botoeira',
  } as const;

  switch (linha.modelo) {
    case 'Tube':
      // Diâmetro fixo; a medida da tabela é a altura.
      return { ...comum, modelo: 'Tube', width: 500, depth: 500, height: medida };
    case 'Piramidal': {
      const teto = contexto.padroes?.teto;
      if (!teto) return null;
      return { ...comum, modelo: 'Piramidal', width: medida, depth: LOTE_PROFUNDIDADE, height: LOTE_ALTURA, tetoWidth: teto.largura, tetoDepth: teto.profundidade };
    }
    case 'Linea': {
      const car = contexto.padroes?.carenagemLinea;
      if (!car) return null;
      return {
        ...comum, modelo: 'Linea', width: medida, depth: LOTE_PROFUNDIDADE, height: LOTE_ALTURA_CORPO_LINEA,
        carenagemWidth: car.largura, carenagemDepth: car.profundidade, carenagemHeight: car.altura,
      };
    }
    default:
      return { ...comum, modelo: 'Box', width: medida, depth: LOTE_PROFUNDIDADE, height: LOTE_ALTURA };
  }
}

// ── Itens com as medidas escritas no próprio texto ──────────────────────────

// "1300x650x670", "1300 × 650 × 670mm", "Ø400×1100", "1,30 x 0,65 x 0,67 m".
// Só aceita o formato limpo (nada de texto solto) e converte para mm.
function medidasEscritas(texto: string): { valores: number[]; comDiametro: boolean } | null {
  const m = /^\s*([Øø∅]|diam\.?|di[aâ]metro)?\s*(\d+(?:[.,]\d+)*(?:\s*[x×*]\s*\d+(?:[.,]\d+)*){1,2})\s*(mm|cm|m)?\s*$/i.exec(texto);
  if (!m) return null;
  const unidade = (m[3] ?? 'mm').toLowerCase();
  const valores = m[2].split(/\s*[x×*]\s*/i).map(v => {
    // Ponto seguido de exatamente 3 dígitos = milhar ("1.200").
    const limpo = unidade === 'mm' ? v.replace(/\.(?=\d{3}(?:\D|$))/g, '') : v;
    const n = parseFloat(limpo.replace(',', '.'));
    return Math.round(unidade === 'm' ? n * 1000 : unidade === 'cm' ? n * 10 : n);
  });
  if (valores.some(v => !Number.isFinite(v) || v < 50 || v > 6000)) return null;
  return { valores, comDiametro: !!m[1] };
}

function desenhoPelasMedidasEscritas(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material'> & { category?: string },
): CoifaItemParams | null {
  const nome = (item.name ?? '').toLowerCase();
  const modelos = [
    /\btube\b/.test(nome) && 'Tube',
    /l[ií]nea/.test(nome) && 'Linea',
    /piramidal/.test(nome) && 'Piramidal',
    /\bbox\b/.test(nome) && 'Box',
  ].filter(Boolean) as string[];
  if (modelos.length !== 1) return null; // nenhum, ou ambíguo
  const medidas = medidasEscritas(item.measurement ?? '');
  if (!medidas) return null;

  const mount = /\bilha\b/.test(nome) ? 'Ilha' : 'Parede';
  const tipoAplicacao = /churrasq/.test(`${nome} ${(item.category ?? '').toLowerCase()}`) ? 'Churrasqueira' : 'Cozinha';

  // Só desenha lâmpadas/botões se o texto disser quantos.
  const lamp = /(\d+)\s*l[âa]mpadas?/.exec(nome);
  const botoeira = /(?:(\d+)\s*)?botoeiras?/.exec(nome);
  const botoes = /(\d+)\s*bot(?:[õo]es|[ãa]o)/.exec(nome);
  const kit = {
    qtdLampadas: lamp ? Number(lamp[1]) : 0,
    qtdBotoes: botoeira ? Number(botoeira[1] ?? 1) : botoes ? Number(botoes[1]) : 0,
    controle: botoeira ? 'botoeira' : 'botoes',
  } as const;
  const comum = { mount, tipoAplicacao, material: item.material, exato: false, ...kit } as const;

  if (modelos[0] === 'Tube') {
    if (medidas.valores.length !== 2 || !(medidas.valores[0] >= 200 && medidas.valores[0] <= 1500)) return null;
    // Aqui a medida é "diâmetro x altura" — a Calculadora sempre usa Ø500, mas itens antigos podem ter outro.
    return { ...comum, modelo: 'Tube', width: medidas.valores[0], depth: medidas.valores[0], height: medidas.valores[1] };
  }
  if (modelos[0] !== 'Box' || medidas.valores.length !== 3 || medidas.comDiametro) return null;

  const filtro = /alum[ií]nio/.test(nome.slice(nome.search(/filtro/) >= 0 ? nome.search(/filtro/) : nome.length))
    ? 'aluminio'
    : /inercial[^,.]*?(304|430)/.exec(nome) ? (`inercial_${/inercial[^,.]*?(304|430)/.exec(nome)![1]}` as 'inercial_304' | 'inercial_430')
    : undefined;
  const coletor = filtro && filtro !== 'aluminio' && /coletor/.test(nome) ? (/duplo/.test(nome) ? 'duplo' : 'simples') : undefined;
  const [width, depth, height] = medidas.valores;
  return { ...comum, modelo: 'Box', width, depth, height, filtro, coletor };
}

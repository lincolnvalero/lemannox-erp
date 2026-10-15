// Reconstrói os parâmetros do visualizador 3D a partir de um item de
// orçamento — só quando o desenho é comprovadamente fiel ao item — e diz, para
// cada item, se ele tem imagem ou, se não tem, por quê.

import type { QuoteItem, CoifaParamsSalvos } from './types';
import type { CoifaViewer3DProps } from '@/components/dashboard/coifa-viewer-3d';
import {
  loteDefinido, LINHAS_TABELA,
  CATEGORIA_COIFA_COZINHA, CATEGORIA_COIFA_CHURRASQUEIRA, formatarMedidaCoifa, type PadroesTabela,
} from './coifa-padroes';

export type CoifaItemParams = Omit<CoifaViewer3DProps, 'className' | 'embedded' | 'onViewChange'> & {
  tipoAplicacao: 'Cozinha' | 'Churrasqueira';
  /** true quando as medidas vieram da Calculadora (não da convenção da tabela). */
  exato: boolean;
};

/** Produto do catálogo (Tabela de Preços), por id — é o "código" que liga o item ao desenho. */
export type ProdutoCatalogo = { category: string; model: string; measurement: string };

type ItemAvaliavel = Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'productId' | 'category' | 'coifaParams' | 'semDesenho'>;
export type ContextoDesenho = { produtos: Map<string, ProdutoCatalogo> | null; padroes: PadroesTabela | null };

export type AvaliacaoDesenho =
  | { situacao: 'com-imagem'; params: CoifaItemParams; origem: 'calculadora' | 'manual' | 'tabela' | 'texto' }
  | { situacao: 'sem-imagem'; params: null; motivo: string }
  | { situacao: 'nao-coifa'; params: null };

const semEspacos = (t: string | undefined) => (t ?? '').toLowerCase().replace(/\s+/g, '');

// O item é (provavelmente) uma coifa? Usado para avisar quando falta imagem —
// motores, dutos e outros itens simplesmente não entram na conta.
export function ehItemDeCoifa(item: ItemAvaliavel, contexto?: Pick<ContextoDesenho, 'produtos'>): boolean {
  const categoria = (item.category ?? (item.productId ? contexto?.produtos?.get(item.productId)?.category : '') ?? '').toLowerCase();
  if (categoria.startsWith('coifa')) return true;
  const nome = (item.name ?? '').toLowerCase();
  return /\bcoifa\b/.test(nome) || /\btube\b|l[ií]nea|piramidal/.test(nome);
}

/**
 * Diz se o item tem imagem e, se não tem, por quê. Só há imagem quando o
 * desenho é comprovadamente fiel ao item; na dúvida, não há — nunca uma
 * imagem errada.
 *
 * 1) Item da Calculadora (`coifaParams`): vale se a medida e o material
 *    escritos no item ainda são os do cálculo (se o usuário editou, o desenho
 *    antigo deixaria de bater).
 * 1b) Desenho definido à mão no orçamento (`coifaParams.manual`): vale o que o
 *    usuário digitou.
 * 2) Item da Tabela de Preços: vale se o `productId` ainda existe e o produto
 *    tem o mesmo modelo e a mesma medida do item, e é um modelo gerado pela
 *    Tabela de Preços (as medidas de profundidade/altura/teto/carenagem vêm da
 *    mesma convenção usada para calcular o preço).
 * 3) Item cadastrado/digitado com todas as medidas escritas (Box "1300x650x670",
 *    Tube "Ø400x1100"): o desenho usa SÓ o que está escrito no próprio item.
 *    Piramidal e Línea ficam sem desenho nesse caso — teto e carenagem não
 *    constam no texto e não dá para adivinhar.
 */
export function avaliarDesenhoDoItem(item: ItemAvaliavel, contexto: ContextoDesenho): AvaliacaoDesenho {
  if (item.semDesenho) return { situacao: 'nao-coifa', params: null };

  const salvo = item.coifaParams;
  if (salvo) {
    if (!salvo.modelo || !(salvo.height > 0)) {
      return { situacao: 'sem-imagem', params: null, motivo: 'O desenho salvo neste item está incompleto.' };
    }
    if (!salvo.manual) {
      const medida = formatarMedidaCoifa(salvo.modelo, salvo.width, salvo.depth, salvo.height);
      if (semEspacos(item.measurement) !== semEspacos(medida)) {
        return { situacao: 'sem-imagem', params: null, motivo: 'A medida do item foi alterada depois do cálculo — o desenho antigo não bate mais.' };
      }
      if (salvo.material && item.material && salvo.material !== item.material) {
        return { situacao: 'sem-imagem', params: null, motivo: 'O material do item foi alterado depois do cálculo — o desenho antigo não bate mais.' };
      }
    }
    const diametro = salvo.width > 0 ? salvo.width : 500;
    return {
      situacao: 'com-imagem',
      origem: salvo.manual ? 'manual' : 'calculadora',
      params: {
        modelo: salvo.modelo,
        // Tube: width é o diâmetro (a Calculadora sempre grava 500).
        width: salvo.modelo === 'Tube' ? diametro : salvo.width,
        depth: salvo.modelo === 'Tube' ? diametro : salvo.depth,
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
        acabamento: salvo.acabamento,
        exato: true,
      },
    };
  }

  const daTabela = desenhoDaTabela(item, contexto);
  if (daTabela) return { situacao: 'com-imagem', params: daTabela, origem: 'tabela' };
  const doTexto = desenhoPelasMedidasEscritas(item);
  if (doTexto.params) return { situacao: 'com-imagem', params: doTexto.params, origem: 'texto' };
  if (!ehItemDeCoifa(item, contexto)) return { situacao: 'nao-coifa', params: null };
  return { situacao: 'sem-imagem', params: null, motivo: doTexto.motivo };
}

export function coifaParamsFromQuoteItem(item: ItemAvaliavel, contexto: ContextoDesenho): CoifaItemParams | null {
  return avaliarDesenhoDoItem(item, contexto).params;
}

// Produto gerado pela Tabela de Preços: tudo precisa bater com o cadastro.
function desenhoDaTabela(item: ItemAvaliavel, contexto: ContextoDesenho): CoifaItemParams | null {
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

  const lote = contexto.padroes?.lote ?? loteDefinido({});
  switch (linha.modelo) {
    case 'Tube':
      // Diâmetro fixo; a medida da tabela é a altura.
      return { ...comum, modelo: 'Tube', width: 500, depth: 500, height: medida };
    case 'Piramidal': {
      const teto = contexto.padroes?.teto;
      if (!teto) return null;
      return { ...comum, modelo: 'Piramidal', width: medida, depth: lote.profundidade, height: lote.altura, tetoWidth: teto.largura, tetoDepth: teto.profundidade };
    }
    case 'Linea': {
      const car = contexto.padroes?.carenagemLinea;
      if (!car) return null;
      return {
        ...comum, modelo: 'Linea', width: medida, depth: lote.profundidade, height: lote.alturaCorpoLinea,
        carenagemWidth: car.largura, carenagemDepth: car.profundidade, carenagemHeight: car.altura,
      };
    }
    default:
      return { ...comum, modelo: 'Box', width: medida, depth: lote.profundidade, height: lote.altura };
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

/** O que dá para ler do nome/medida do item (sem inventar nada que não esteja escrito). */
function lerTextoDoItem(item: Pick<QuoteItem, 'name' | 'measurement' | 'category'>) {
  const nome = (item.name ?? '').toLowerCase();
  const modelos = [
    /\btube\b/.test(nome) && 'Tube',
    /l[ií]nea/.test(nome) && 'Linea',
    /piramidal/.test(nome) && 'Piramidal',
    /\bbox\b/.test(nome) && 'Box',
  ].filter(Boolean) as CoifaParamsSalvos['modelo'][];

  // Lâmpadas/botões: só contam se o texto disser quantos.
  const lamp = /(\d+)\s*l[âa]mpadas?/.exec(nome);
  const botoeira = /(?:(\d+)\s*)?botoeiras?/.exec(nome);
  const botoes = /(\d+)\s*bot(?:[õo]es|[ãa]o)/.exec(nome);

  const inercial = /inercial[^,.]*?(304|430)/.exec(nome);
  const filtro: CoifaParamsSalvos['filtro'] = /filtro[^,.]*alum[ií]nio/.test(nome) ? 'aluminio'
    : inercial ? (`inercial_${inercial[1]}` as 'inercial_304' | 'inercial_430') : undefined;
  const coletor: CoifaParamsSalvos['coletor'] = filtro && filtro !== 'aluminio' && /coletor/.test(nome)
    ? (/duplo/.test(nome) ? 'duplo' : 'simples') : undefined;

  return {
    modelos,
    medidas: medidasEscritas(item.measurement ?? ''),
    mount: (/\bilha\b/.test(nome) ? 'Ilha' : 'Parede') as 'Ilha' | 'Parede',
    tipoAplicacao: (/churrasq/.test(`${nome} ${(item.category ?? '').toLowerCase()}`) ? 'Churrasqueira' : 'Cozinha') as 'Cozinha' | 'Churrasqueira',
    qtdLampadas: lamp ? Number(lamp[1]) : 0,
    qtdBotoes: botoeira ? Number(botoeira[1] ?? 1) : botoes ? Number(botoes[1]) : 0,
    controle: (botoeira ? 'botoeira' : 'botoes') as 'botoes' | 'botoeira',
    filtro,
    coletor,
  };
}

/**
 * Valores iniciais para o formulário "definir desenho": só o que está escrito
 * no item. O que não consta fica em branco para o usuário informar.
 */
export function sugerirDadosDoItem(item: Pick<QuoteItem, 'name' | 'measurement' | 'category' | 'material'>): Partial<CoifaParamsSalvos> {
  const t = lerTextoDoItem(item);
  const modelo = t.modelos.length === 1 ? t.modelos[0] : undefined;
  const v = t.medidas?.valores ?? [];
  const sug: Partial<CoifaParamsSalvos> = {
    modelo, tipoInstalacao: t.mount, tipoAplicacao: t.tipoAplicacao,
    qtdLampadas: t.qtdLampadas, qtdBotoes: t.qtdBotoes, controle: t.controle,
    filtro: t.filtro, coletor: t.coletor, material: item.material,
  };
  if (modelo === 'Tube' && v.length === 2) { sug.width = v[0]; sug.height = v[1]; }
  else if (modelo !== 'Tube' && v.length === 3) { sug.width = v[0]; sug.depth = v[1]; sug.height = v[2]; }
  return sug;
}

function desenhoPelasMedidasEscritas(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'category'>,
): { params: CoifaItemParams; motivo?: undefined } | { params: null; motivo: string } {
  const t = lerTextoDoItem(item);
  if (t.modelos.length !== 1) {
    return { params: null, motivo: 'Não consegui identificar o modelo (Box, Piramidal, Línea ou Tube) pelo nome do item.' };
  }
  const modelo = t.modelos[0];
  if (modelo === 'Piramidal') return { params: null, motivo: 'Faltam as medidas do teto (e da carenagem, se houver) — não constam no texto do item.' };
  if (modelo === 'Linea') return { params: null, motivo: 'Faltam as medidas da carenagem — não constam no texto do item.' };
  const medidas = t.medidas;
  if (!medidas) return { params: null, motivo: 'A coluna Medida não traz todas as medidas num formato legível (ex: 1300x650x670).' };

  const comum = {
    mount: t.mount, tipoAplicacao: t.tipoAplicacao, material: item.material, exato: false,
    qtdLampadas: t.qtdLampadas, qtdBotoes: t.qtdBotoes, controle: t.controle,
  } as const;

  if (modelo === 'Tube') {
    // "diâmetro x altura" — a Calculadora sempre usa Ø500, mas itens antigos podem ter outro.
    if (medidas.valores.length !== 2 || !(medidas.valores[0] >= 200 && medidas.valores[0] <= 1500)) {
      return { params: null, motivo: 'Para a Tube, a medida precisa ser "diâmetro x altura" (ex: Ø500x2000).' };
    }
    return { params: { ...comum, modelo: 'Tube', width: medidas.valores[0], depth: medidas.valores[0], height: medidas.valores[1] } };
  }
  if (medidas.valores.length !== 3 || medidas.comDiametro) {
    return { params: null, motivo: 'Para a Box, a medida precisa ser "largura x profundidade x altura" (ex: 1300x650x670).' };
  }
  const [width, depth, height] = medidas.valores;
  return { params: { ...comum, modelo: 'Box', width, depth, height, filtro: t.filtro, coletor: t.coletor } };
}

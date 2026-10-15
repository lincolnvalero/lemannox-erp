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
 * 2) Item de catálogo: vale se o `productId` ainda existe e o produto tem o
 *    mesmo modelo e a mesma medida do item, e é um modelo gerado pela Tabela
 *    de Preços (as medidas de profundidade/altura/teto/carenagem vêm da mesma
 *    convenção usada para calcular o preço). Itens digitados à mão nunca são
 *    desenhados.
 */
export function coifaParamsFromQuoteItem(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'productId' | 'coifaParams'>,
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

  // Catálogo: tudo precisa bater com o produto cadastrado.
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

// Reconstrói os parâmetros do visualizador 3D a partir de um item de
// orçamento.
//
// 1) Item vindo da Calculadora ("Adicionar ao orçamento"): traz as medidas
//    exatas em `coifaParams` — o desenho é fiel ao que foi calculado.
// 2) Item de catálogo (Tabela de Preços): só guarda o nome do modelo (ex:
//    "Box Ilha") e a medida (ex: "1200mm"). Usamos as mesmas convenções da
//    geração em lote (lib/coifa-padroes.ts) — para produtos gerados por ela, o
//    desenho corresponde às medidas usadas no preço; para produtos cadastrados
//    à mão, é uma representação aproximada.

import type { QuoteItem } from './types';
import type { CoifaViewer3DProps, CoifaViewerModelo } from '@/components/dashboard/coifa-viewer-3d';
import { LOTE_PROFUNDIDADE, LOTE_ALTURA, LOTE_ALTURA_CORPO_LINEA, LOTE_ALTURA_CARENAGEM } from './coifa-padroes';

function detectarModelo(nome: string): CoifaViewerModelo | null {
  const n = nome.toLowerCase();
  if (n.includes('piramidal')) return 'Piramidal';
  if (n.includes('línea') || n.includes('linea')) return 'Linea';
  if (n.includes('tube')) return 'Tube';
  if (n.includes('box')) return 'Box';
  return null;
}

// Todos os números da medida, convertidos para mm. Aceita "1200mm", "1,20m",
// "120cm" e o formato brasileiro com ponto de milhar ("1.200mm"). A unidade
// escrita depois do último número vale para os anteriores ("1,20 x 0,80m").
function numerosEmMm(medida: string): number[] {
  const partes = [...medida.matchAll(/(\d+(?:[.,]\d+)*)\s*(mm|cm|m(?![a-z]))?/gi)];
  const unidadeFinal = [...partes].reverse().find(p => p[2])?.[2]?.toLowerCase() ?? '';
  return partes
    .map(p => {
      // Ponto seguido de exatamente 3 dígitos = separador de milhar.
      const txt = p[1].replace(/\.(?=\d{3}(?:\D|$))/g, '');
      const valor = parseFloat(txt.replace(',', '.'));
      const unidade = (p[2] || unidadeFinal).toLowerCase();
      return unidade === 'm' ? valor * 1000 : unidade === 'cm' ? valor * 10 : valor;
    })
    .filter(n => Number.isFinite(n) && n >= 100)
    .map(n => Math.round(n));
}

export type CoifaItemParams = Omit<CoifaViewer3DProps, 'className' | 'embedded' | 'onViewChange'> & {
  tipoAplicacao: 'Cozinha' | 'Churrasqueira';
  /** true quando as medidas vieram da Calculadora (não de convenção). */
  exato: boolean;
};

export function coifaParamsFromQuoteItem(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'category' | 'coifaParams'>,
): CoifaItemParams | null {
  const salvo = item.coifaParams;
  if (salvo && salvo.modelo && salvo.height > 0) {
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

  const modelo = detectarModelo(item.name || '');
  if (!modelo) return null;
  const numeros = numerosEmMm(item.measurement || '');
  if (numeros.length === 0) return null;

  const mount = /ilha/i.test(item.name) ? 'Ilha' : 'Parede';
  const tipoAplicacao = /churrasqueira/i.test(`${item.name} ${item.category ?? ''}`) ? 'Churrasqueira' : 'Cozinha';
  const comum = {
    mount, tipoAplicacao, material: item.material, exato: false,
    // Churrasqueira de catálogo vem com 2 botões; Cozinha, com botoeira.
    controle: tipoAplicacao === 'Churrasqueira' ? 'botoes' : 'botoeira',
  } as const;

  if (modelo === 'Tube') {
    // Diâmetro fixo — a medida relevante é a altura, que vem por último
    // quando escrita como "Ø500 x 2000".
    return { ...comum, modelo, width: 500, depth: 500, height: numeros[numeros.length - 1] };
  }
  return {
    ...comum,
    modelo,
    width: numeros[0],
    depth: LOTE_PROFUNDIDADE,
    height: modelo === 'Linea' ? LOTE_ALTURA_CORPO_LINEA : LOTE_ALTURA,
    carenagemHeight: modelo === 'Linea' ? LOTE_ALTURA_CARENAGEM : undefined,
  };
}

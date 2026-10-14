// Reconstrói os parâmetros do visualizador 3D a partir de um item de
// orçamento. O item só guarda o nome do modelo (ex: "Box Ilha") e a medida
// (ex: "1200mm") — não guarda profundidade/altura. Por isso usamos as mesmas
// convenções da geração em lote da Tabela de Preços (calculator/actions.ts):
// profundidade 700mm, altura 600mm, carenagem da Línea 600mm, e na Tube a
// medida é a altura (diâmetro fixo 500mm). Para produtos gerados por aquela
// rotina, o desenho corresponde exatamente às medidas usadas no preço; para
// produtos cadastrados à mão, é uma representação aproximada.
//
// Teto da Piramidal e largura/profundidade da carenagem da Línea não existem
// no item — o visualizador usa proporções padrão só para o desenho.

import type { QuoteItem } from './types';
import type { CoifaViewer3DProps, CoifaViewerModelo } from '@/components/dashboard/coifa-viewer-3d';

const PROFUNDIDADE_PADRAO = 700;
const ALTURA_PADRAO = 600;
const CARENAGEM_PADRAO = 600;

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
      let txt = p[1];
      // Ponto seguido de exatamente 3 dígitos = separador de milhar.
      txt = txt.replace(/\.(?=\d{3}(?:\D|$))/g, '');
      const valor = parseFloat(txt.replace(',', '.'));
      const unidade = (p[2] || unidadeFinal).toLowerCase();
      return unidade === 'm' ? valor * 1000 : unidade === 'cm' ? valor * 10 : valor;
    })
    .filter(n => Number.isFinite(n) && n >= 100)
    .map(n => Math.round(n));
}

export type CoifaItemParams = Omit<CoifaViewer3DProps, 'className' | 'compact' | 'qtdLampadas' | 'qtdBotoes'>;

export function coifaParamsFromQuoteItem(item: Pick<QuoteItem, 'name' | 'measurement'>): CoifaItemParams | null {
  const modelo = detectarModelo(item.name || '');
  if (!modelo) return null;
  const numeros = numerosEmMm(item.measurement || '');
  if (numeros.length === 0) return null;

  const mount = /ilha/i.test(item.name) ? 'Ilha' : 'Parede';

  if (modelo === 'Tube') {
    // Tube: diâmetro fixo — a medida relevante é a altura, que vem por último
    // quando escrita como "Ø500 x 2000".
    return { modelo, width: 500, depth: 500, height: numeros[numeros.length - 1], mount };
  }
  const medida = numeros[0];
  return {
    modelo,
    width: medida,
    depth: PROFUNDIDADE_PADRAO,
    height: ALTURA_PADRAO,
    carenagemHeight: modelo === 'Linea' ? CARENAGEM_PADRAO : undefined,
    mount,
  };
}

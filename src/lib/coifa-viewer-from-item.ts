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

// Primeiro número da medida, convertido para mm ("1200mm", "1,20m", "120cm").
function medidaEmMm(medida: string): number | null {
  const m = medida.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (!m) return null;
  const valor = parseFloat(m[1].replace(',', '.'));
  const unidade = (m[2] || '').toLowerCase();
  const mm = unidade === 'm' ? valor * 1000 : unidade === 'cm' ? valor * 10 : valor;
  return mm >= 100 ? Math.round(mm) : null;
}

export type CoifaItemParams = Omit<CoifaViewer3DProps, 'className' | 'compact' | 'qtdLampadas' | 'qtdBotoes'>;

export function coifaParamsFromQuoteItem(item: Pick<QuoteItem, 'name' | 'measurement'>): CoifaItemParams | null {
  const modelo = detectarModelo(item.name || '');
  if (!modelo) return null;
  const medida = medidaEmMm(item.measurement || '');
  if (!medida) return null;

  const mount = /ilha/i.test(item.name) ? 'Ilha' : 'Parede';

  if (modelo === 'Tube') {
    return { modelo, width: 500, depth: 500, height: medida, mount };
  }
  return {
    modelo,
    width: medida,
    depth: PROFUNDIDADE_PADRAO,
    height: ALTURA_PADRAO,
    carenagemHeight: modelo === 'Linea' ? CARENAGEM_PADRAO : undefined,
    mount,
  };
}

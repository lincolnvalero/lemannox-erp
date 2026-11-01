// Do item de um orçamento de volta para o formulário da Calculadora ("abrir o
// orçamento na calculadora"). Itens criados pela Calculadora trazem tudo em
// `coifaParams`; itens da Tabela de Preços ou digitados à mão só dão o que dá
// para comprovar (ver coifa-viewer-from-item.ts) — o resto fica por conta do
// usuário, e o resultado diz o que faltou.

import type { CoifaParamsSalvos, QuoteItem } from './types';
import { avaliarDesenhoDoItem, sugerirDadosDoItem, type ContextoDesenho } from './coifa-viewer-from-item';

/** Campos do formulário da Calculadora que um item consegue preencher (nomes iguais aos do formulário). */
export interface PreenchimentoCalculadora {
  modelo?: 'Box' | 'Piramidal' | 'Linea' | 'Tube';
  width?: number; depth?: number; height?: number;
  alturaPainel?: number;
  tetoWidth?: number; tetoDepth?: number;
  carenagemWidth?: number; carenagemDepth?: number; carenagemHeight?: number;
  material?: string;
  larguraPadrao?: number; larguraPadraoCarenagem?: number;
  tipoAplicacao?: 'Cozinha' | 'Churrasqueira';
  tipoInstalacao?: 'Parede' | 'Ilha';
  filtro?: 'nenhum' | 'aluminio' | 'inercial_430' | 'inercial_304';
  coletor?: 'nenhum' | 'simples' | 'duplo';
  frisoFrente?: boolean; frisoLD?: boolean; frisoLE?: boolean; frisoLinhas?: number;
  frisoDistBase?: number; frisoDistEntre?: number;
  qtdLampadasManual?: number; qtdBotoesManual?: number;
  controle?: 'botoes' | 'botoeira';
  posicaoLampadas?: 'frente' | 'parede';
  posicaoComando?: NonNullable<CoifaParamsSalvos['posicaoComando']>;
  comCarenagem?: boolean;
  outros?: number; paintingCost?: number;
}

export interface ItemParaCalculadora {
  valores: PreenchimentoCalculadora;
  /** 'completo' = item da Calculadora (pode recalcular direto); 'parcial' = só parte dos dados. */
  origem: 'completo' | 'parcial';
  /** O que o usuário precisa conferir/informar. */
  avisos: string[];
}

const limpar = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function dosParametrosSalvos(c: CoifaParamsSalvos): PreenchimentoCalculadora {
  return limpar({
    modelo: c.modelo, width: c.width, depth: c.depth, height: c.height, alturaPainel: c.alturaPainel,
    tetoWidth: c.tetoWidth, tetoDepth: c.tetoDepth,
    carenagemWidth: c.carenagemWidth, carenagemDepth: c.carenagemDepth, carenagemHeight: c.carenagemHeight,
    material: c.material, larguraPadrao: c.larguraPadrao, larguraPadraoCarenagem: c.larguraPadraoCarenagem,
    tipoAplicacao: c.tipoAplicacao, tipoInstalacao: c.tipoInstalacao, filtro: c.filtro, coletor: c.coletor,
    frisoFrente: c.frisoFrente, frisoLD: c.frisoLD, frisoLE: c.frisoLE, frisoLinhas: c.frisoLinhas,
    frisoDistBase: c.frisoDistBase, frisoDistEntre: c.frisoDistEntre,
    qtdLampadasManual: c.qtdLampadas, qtdBotoesManual: c.qtdBotoes,
    controle: c.controle ?? 'botoeira', posicaoLampadas: c.posicaoLampadas, posicaoComando: c.posicaoComando,
    comCarenagem: c.comCarenagem, outros: c.outros, paintingCost: c.paintingCost,
  });
}

/** Devolve o que dá para levar do item para a Calculadora; null se o item não parece ser uma coifa com dados. */
export function itemParaCalculadora(
  item: Pick<QuoteItem, 'name' | 'measurement' | 'material' | 'productId' | 'category' | 'coifaParams' | 'semDesenho'>,
  contexto: ContextoDesenho,
): ItemParaCalculadora | null {
  if (item.coifaParams) {
    const valores = dosParametrosSalvos(item.coifaParams);
    const avisos: string[] = [];
    if (valores.larguraPadrao === undefined) avisos.push('Este item é de antes do registro da chapa padrão: confira a "Chapa Padrão" e os custos adicionais antes de calcular.');
    return { valores, origem: valores.larguraPadrao === undefined ? 'parcial' : 'completo', avisos };
  }
  const av = avaliarDesenhoDoItem(item, contexto);
  if (av.situacao === 'com-imagem') {
    const p = av.params;
    const valores = limpar<PreenchimentoCalculadora>({
      modelo: p.modelo, width: p.width, depth: p.depth, height: p.height, alturaPainel: p.alturaPainel,
      tetoWidth: p.tetoWidth, tetoDepth: p.tetoDepth,
      carenagemWidth: p.carenagemWidth, carenagemDepth: p.carenagemDepth, carenagemHeight: p.carenagemHeight,
      material: p.material, tipoAplicacao: p.tipoAplicacao, tipoInstalacao: p.mount, filtro: p.filtro, coletor: p.coletor,
      frisoFrente: p.frisoFrente, frisoLD: p.frisoLD, frisoLE: p.frisoLE, frisoLinhas: p.frisoLinhas,
      qtdLampadasManual: p.qtdLampadas || undefined, qtdBotoesManual: p.qtdBotoes || undefined, controle: p.controle,
      posicaoLampadas: p.posicaoLampadas, posicaoComando: p.posicaoComando,
    });
    return { valores, origem: 'parcial', avisos: ['Item da Tabela de Preços ou digitado: só as medidas e escolhas do item foram carregadas. Informe a Chapa Padrão e os custos adicionais.'] };
  }
  const sug = sugerirDadosDoItem(item);
  const s = limpar<PreenchimentoCalculadora>({
    modelo: sug.modelo, width: sug.width, depth: sug.depth, height: sug.height, material: sug.material,
    tipoAplicacao: sug.tipoAplicacao, tipoInstalacao: sug.tipoInstalacao, filtro: sug.filtro, coletor: sug.coletor,
    controle: sug.controle, qtdLampadasManual: sug.qtdLampadas || undefined, qtdBotoesManual: sug.qtdBotoes || undefined,
  });
  if (!s.modelo && s.width === undefined) return null;
  return { valores: s, origem: 'parcial', avisos: ['Só consegui ler parte dos dados pelo texto do item. Confira tudo antes de calcular.'] };
}

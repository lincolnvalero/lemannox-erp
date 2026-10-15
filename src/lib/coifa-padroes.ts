// Convenções da geração em lote da Tabela de Preços, num lugar só. São
// usadas pelo gerador (preço) e pelo desenho 3D dos itens de catálogo no
// orçamento — se mudarem aqui, os dois continuam batendo.

/**
 * Valores iniciais das medidas do corpo na Tabela de Preços — o usuário pode
 * trocá-los (ver `loteDefinido` e a janela "Medidas padrão da Tabela").
 *
 * Profundidade usada para todos os modelos (exceto Tube) na tabela.
 */
export const LOTE_PROFUNDIDADE = 700;
/** Altura usada para Box e Piramidal na tabela. */
export const LOTE_ALTURA = 600;
/**
 * Altura do corpo da Línea (parte baixa, 80–100mm segundo o Levi). Não entra
 * no preço da Línea — só deixa o desenho realista.
 */
export const LOTE_ALTURA_CORPO_LINEA = 100;

export const CHAVE_LOTE_PROFUNDIDADE = 'tabela_profundidade_padrao';
export const CHAVE_LOTE_ALTURA = 'tabela_altura_padrao';
export const CHAVE_LOTE_ALTURA_CORPO_LINEA = 'linea_corpo_altura_padrao';
export const LOTE_PROFUNDIDADE_MIN = 300, LOTE_PROFUNDIDADE_MAX = 1500;
export const LOTE_ALTURA_MIN = 100, LOTE_ALTURA_MAX = 2000;
export const LOTE_CORPO_LINEA_MIN = 50, LOTE_CORPO_LINEA_MAX = 400;

/** Medidas do corpo usadas na tabela (e no desenho dos produtos dela). */
export type LoteTabela = { profundidade: number; altura: number; alturaCorpoLinea: number };

/**
 * Linhas da Tabela de Preços (modelo + instalação → nome do produto). É a
 * lista que o gerador usa e que o orçamento usa para reconhecer um produto
 * gerado pela tabela e desenhá-lo.
 */
export type ModeloCoifaTabela = 'Box' | 'Piramidal' | 'Linea' | 'Tube';
export type LinhaTabela = { modelo: ModeloCoifaTabela; instalacao: 'Parede' | 'Ilha'; modelLabel: string };
export const LINHAS_TABELA: LinhaTabela[] = [
  { modelo: 'Box', instalacao: 'Parede', modelLabel: 'Box de Parede' },
  { modelo: 'Box', instalacao: 'Ilha', modelLabel: 'Box Ilha' },
  { modelo: 'Piramidal', instalacao: 'Parede', modelLabel: 'Piramidal de Parede' },
  { modelo: 'Piramidal', instalacao: 'Ilha', modelLabel: 'Piramidal Ilha' },
  { modelo: 'Linea', instalacao: 'Parede', modelLabel: 'Línea' },
  { modelo: 'Tube', instalacao: 'Parede', modelLabel: 'Tube' },
];
export const CATEGORIA_COIFA_COZINHA = 'Coifa de Cozinha';
export const CATEGORIA_COIFA_CHURRASQUEIRA = 'Coifa de Churrasqueira';

/** Texto da coluna "Medida" de uma coifa calculada na Calculadora. */
export function formatarMedidaCoifa(modelo: ModeloCoifaTabela, width: number, depth: number, height: number): string {
  return modelo === 'Tube' ? `Ø500 x ${height}mm` : `${width}x${depth}x${height}mm`;
}

/** Chaves em parametros_globais do teto padrão da Piramidal na tabela. */
export const CHAVE_TETO_LARGURA = 'piramidal_teto_largura_padrao';
export const CHAVE_TETO_PROFUNDIDADE = 'piramidal_teto_profundidade_padrao';

/** Faixa aceita para o teto padrão (mm) — evita digitação absurda. */
export const TETO_MIN = 100;
export const TETO_MAX = 2000;

/**
 * Carenagem padrão da Línea na Tabela de Preços (L × P × A, mm). Só a altura
 * entra no preço; largura e profundidade são do desenho. Na Calculadora
 * individual não há padrão — tudo é digitado.
 */
export const CHAVE_CARENAGEM_LINEA_LARGURA = 'linea_carenagem_largura_padrao';
export const CHAVE_CARENAGEM_LINEA_PROFUNDIDADE = 'linea_carenagem_profundidade_padrao';
export const CHAVE_CARENAGEM_LINEA_ALTURA = 'linea_carenagem_altura_padrao';
export const CARENAGEM_MIN = 100;
export const CARENAGEM_MAX = 3000;

/**
 * Chave da sessionStorage usada para levar a coifa calculada da Calculadora
 * até o editor de orçamento ("Adicionar ao orçamento"). É só a passagem entre
 * as duas telas: o editor lê, anexa o item e apaga.
 */
export const CHAVE_ITEM_PENDENTE_ORCAMENTO = 'lemannox:item-pendente-orcamento';

export function tetoPadraoDefinido(parametros: Record<string, number | undefined>): { largura: number; profundidade: number } | null {
  const largura = Number(parametros[CHAVE_TETO_LARGURA]);
  const profundidade = Number(parametros[CHAVE_TETO_PROFUNDIDADE]);
  if (!(largura >= TETO_MIN && largura <= TETO_MAX) || !(profundidade >= TETO_MIN && profundidade <= TETO_MAX)) return null;
  return { largura, profundidade };
}

const dentro = (v: number, min: number, max: number) => v >= min && v <= max;

export function carenagemLineaPadraoDefinida(
  parametros: Record<string, number | undefined>,
): { largura: number; profundidade: number; altura: number } | null {
  const largura = Number(parametros[CHAVE_CARENAGEM_LINEA_LARGURA]);
  const profundidade = Number(parametros[CHAVE_CARENAGEM_LINEA_PROFUNDIDADE]);
  const altura = Number(parametros[CHAVE_CARENAGEM_LINEA_ALTURA]);
  if (!dentro(largura, CARENAGEM_MIN, CARENAGEM_MAX) || !dentro(profundidade, CARENAGEM_MIN, CARENAGEM_MAX) || !dentro(altura, CARENAGEM_MIN, CARENAGEM_MAX)) return null;
  return { largura, profundidade, altura };
}

/** Todos os padrões que a Tabela de Preços precisa antes de ser gerada. */
export type PadroesTabela = {
  teto: { largura: number; profundidade: number } | null;
  carenagemLinea: { largura: number; profundidade: number; altura: number } | null;
  /** Sempre definido: se o usuário nunca alterou, valem os valores iniciais. */
  lote: LoteTabela;
};

const valorOu = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};
export function loteDefinido(parametros: Record<string, number | undefined>): LoteTabela {
  return {
    profundidade: valorOu(parametros[CHAVE_LOTE_PROFUNDIDADE], LOTE_PROFUNDIDADE_MIN, LOTE_PROFUNDIDADE_MAX, LOTE_PROFUNDIDADE),
    altura: valorOu(parametros[CHAVE_LOTE_ALTURA], LOTE_ALTURA_MIN, LOTE_ALTURA_MAX, LOTE_ALTURA),
    alturaCorpoLinea: valorOu(parametros[CHAVE_LOTE_ALTURA_CORPO_LINEA], LOTE_CORPO_LINEA_MIN, LOTE_CORPO_LINEA_MAX, LOTE_ALTURA_CORPO_LINEA),
  };
}

export function padroesTabelaDefinidos(parametros: Record<string, number | undefined>): PadroesTabela {
  return { teto: tetoPadraoDefinido(parametros), carenagemLinea: carenagemLineaPadraoDefinida(parametros), lote: loteDefinido(parametros) };
}

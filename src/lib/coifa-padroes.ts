// Convenções da geração em lote da Tabela de Preços, num lugar só. São
// usadas pelo gerador (preço) e pelo desenho 3D dos itens de catálogo no
// orçamento — se mudarem aqui, os dois continuam batendo.

/** Profundidade usada para todos os modelos (exceto Tube) na tabela. */
export const LOTE_PROFUNDIDADE = 700;
/** Altura usada para Box e Piramidal na tabela. */
export const LOTE_ALTURA = 600;
/**
 * Altura do corpo da Línea (parte baixa, 80–100mm segundo o Levi). Não entra
 * no preço da Línea — só deixa o desenho realista.
 */
export const LOTE_ALTURA_CORPO_LINEA = 100;
/** Altura da carenagem da Línea na tabela (essa entra no preço). */
export const LOTE_ALTURA_CARENAGEM = 600;

/** Chaves em parametros_globais do teto padrão da Piramidal na tabela. */
export const CHAVE_TETO_LARGURA = 'piramidal_teto_largura_padrao';
export const CHAVE_TETO_PROFUNDIDADE = 'piramidal_teto_profundidade_padrao';

/** Faixa aceita para o teto padrão (mm) — evita digitação absurda. */
export const TETO_MIN = 100;
export const TETO_MAX = 2000;

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

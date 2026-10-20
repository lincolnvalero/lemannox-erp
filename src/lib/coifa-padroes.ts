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
/** Altura usada para Box e Piramidal na tabela (Levi, 15/10: 1000). */
export const LOTE_ALTURA = 1000;
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
export type AplicacaoCoifa = 'Cozinha' | 'Churrasqueira';
export type LinhaTabela = {
  modelo: ModeloCoifaTabela;
  instalacao: 'Parede' | 'Ilha';
  modelLabel: string;
  /** Aplicações em que o modelo existe (Línea e Tube são só de cozinha — Levi, 19/10). */
  aplicacoes: AplicacaoCoifa[];
};
const AMBAS: AplicacaoCoifa[] = ['Cozinha', 'Churrasqueira'];
export const LINHAS_TABELA: LinhaTabela[] = [
  { modelo: 'Box', instalacao: 'Parede', modelLabel: 'Box de Parede', aplicacoes: AMBAS },
  { modelo: 'Box', instalacao: 'Ilha', modelLabel: 'Box Ilha', aplicacoes: AMBAS },
  { modelo: 'Piramidal', instalacao: 'Parede', modelLabel: 'Piramidal de Parede', aplicacoes: AMBAS },
  { modelo: 'Piramidal', instalacao: 'Ilha', modelLabel: 'Piramidal Ilha', aplicacoes: AMBAS },
  { modelo: 'Linea', instalacao: 'Parede', modelLabel: 'Línea de Parede', aplicacoes: ['Cozinha'] },
  { modelo: 'Linea', instalacao: 'Ilha', modelLabel: 'Línea Ilha', aplicacoes: ['Cozinha'] },
  { modelo: 'Tube', instalacao: 'Parede', modelLabel: 'Tube de Parede', aplicacoes: ['Cozinha'] },
  { modelo: 'Tube', instalacao: 'Ilha', modelLabel: 'Tube Ilha', aplicacoes: ['Cozinha'] },
];
/** Nomes da tabela anterior ("Línea" e "Tube" eram só de parede) — ainda reconhecidos para desenhar itens antigos. */
export const ROTULOS_ANTIGOS: Record<string, string> = { 'Línea': 'Línea de Parede', 'Tube': 'Tube de Parede' };
/** Modelos que só existem para cozinha. */
export const modeloSoCozinha = (modelo: string) => modelo === 'Linea' || modelo === 'Tube';

/** Preço da tabela: zera a unidade (ex: 2.354,90 → 2.350,00) — Levi, 19/10. */
export const arredondarPrecoTabela = (valor: number) => Math.round(valor / 10) * 10;
export const CATEGORIA_COIFA_COZINHA = 'Coifa de Cozinha';
export const CATEGORIA_COIFA_CHURRASQUEIRA = 'Coifa de Churrasqueira';

/** Texto da coluna "Medida" de uma coifa calculada na Calculadora. */
export function formatarMedidaCoifa(modelo: ModeloCoifaTabela, width: number, depth: number, height: number): string {
  return modelo === 'Tube' ? `Ø500 x ${height}mm` : `${width}x${depth}x${height}mm`;
}

/** Largura até a qual a tabela usa as medidas "pequenas" de carenagem/teto (Levi, 15/10). */
export const LIMITE_FAIXA_TABELA = 1300;
/**
 * Teto da Piramidal na tabela (Levi, 16/10): até 1300 de largura, 400 × 350;
 * a partir de 1301, 1/3 da largura × 350. É regra fixa — não há valor a informar.
 */
export const TETO_ATE_1300 = { largura: 400, profundidade: 350 } as const;
export const TETO_ACIMA_1300_FRACAO = 1 / 3;
export const TETO_ACIMA_1300_PROFUNDIDADE = 350;

/**
 * Carenagem (Línea e Piramidal) na Tabela de Preços, em duas faixas de largura
 * (L × P × A, mm): até 1300 → 320x300x1000; a partir de 1400 → 500x300x1000.
 * Só a altura entra no preço; largura e profundidade são do desenho. Na
 * Calculadora individual não há padrão — tudo é digitado.
 */
export type MedidasCarenagem = { largura: number; profundidade: number; altura: number };
export const CARENAGEM_ATE_1300_INICIAL: MedidasCarenagem = { largura: 320, profundidade: 300, altura: 1000 };
export const CARENAGEM_ACIMA_1300_INICIAL: MedidasCarenagem = { largura: 500, profundidade: 300, altura: 1000 };
const chavesCarenagem = (faixa: 'ate1300' | 'acima1300') => ({
  largura: `tabela_carenagem_${faixa}_largura`,
  profundidade: `tabela_carenagem_${faixa}_profundidade`,
  altura: `tabela_carenagem_${faixa}_altura`,
});
export const CHAVES_CARENAGEM_ATE_1300 = chavesCarenagem('ate1300');
export const CHAVES_CARENAGEM_ACIMA_1300 = chavesCarenagem('acima1300');
export const CARENAGEM_MIN = 100;
export const CARENAGEM_MAX = 3000;

/**
 * Chave da sessionStorage usada para levar a coifa calculada da Calculadora
 * até o editor de orçamento ("Adicionar ao orçamento"). É só a passagem entre
 * as duas telas: o editor lê, anexa o item e apaga.
 */
export const CHAVE_ITEM_PENDENTE_ORCAMENTO = 'lemannox:item-pendente-orcamento';

const dentro = (v: number, min: number, max: number) => v >= min && v <= max;

/** Todos os padrões que a Tabela de Preços precisa antes de ser gerada. */
export type PadroesTabela = {
  /** Sempre definidos: se o usuário nunca alterou, valem os valores iniciais do Levi. */
  carenagemAte1300: MedidasCarenagem;
  carenagemAcima1300: MedidasCarenagem;
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

function carenagemDefinida(parametros: Record<string, number | undefined>, chaves: ReturnType<typeof chavesCarenagem>, inicial: MedidasCarenagem): MedidasCarenagem {
  return {
    largura: valorOu(parametros[chaves.largura], CARENAGEM_MIN, CARENAGEM_MAX, inicial.largura),
    profundidade: valorOu(parametros[chaves.profundidade], CARENAGEM_MIN, CARENAGEM_MAX, inicial.profundidade),
    altura: valorOu(parametros[chaves.altura], CARENAGEM_MIN, CARENAGEM_MAX, inicial.altura),
  };
}

export function padroesTabelaDefinidos(parametros: Record<string, number | undefined>): PadroesTabela {
  return {
    carenagemAte1300: carenagemDefinida(parametros, CHAVES_CARENAGEM_ATE_1300, CARENAGEM_ATE_1300_INICIAL),
    carenagemAcima1300: carenagemDefinida(parametros, CHAVES_CARENAGEM_ACIMA_1300, CARENAGEM_ACIMA_1300_INICIAL),
    lote: loteDefinido(parametros),
  };
}

/** Carenagem usada na tabela para uma coifa dessa largura (Línea e Piramidal). */
export function carenagemParaTabela(largura: number, p: PadroesTabela): MedidasCarenagem {
  return largura <= LIMITE_FAIXA_TABELA ? p.carenagemAte1300 : p.carenagemAcima1300;
}

/** Teto da Piramidal na tabela para uma coifa dessa largura. */
export function tetoParaTabela(largura: number): { largura: number; profundidade: number } {
  if (largura <= LIMITE_FAIXA_TABELA) return { ...TETO_ATE_1300 };
  return { largura: Math.round(largura * TETO_ACIMA_1300_FRACAO), profundidade: TETO_ACIMA_1300_PROFUNDIDADE };
}

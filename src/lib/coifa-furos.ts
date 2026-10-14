// Furos da coifa (lâmpadas na face de baixo, botões/botoeira na frente).
//
// Vem do protótipo do Marcelo (Coifas.html), que já registrava a quantidade e
// o diâmetro dos furos de botões e lâmpadas — a ideia é manter essa base para
// um dia gerar o DXF de fabricação a partir do mesmo desenho. Por isso as
// posições saem numa função pura, em milímetros, fora do componente 3D: o
// desenho e o futuro DXF leem exatamente a mesma lista de furos.
//
// Sistema de coordenadas (igual ao do visualizador): origem no centro da base
// da coifa, X para a direita, Z para a frente (z > 0 = lado do usuário), Y
// para cima.

import type { TipoControle } from './coifa-calculator';

/** Onde ficam as lâmpadas numa coifa de Parede (na Ilha é sempre metade/metade). */
export type PosicaoLampadas = 'frente' | 'parede';

/** Medidas padrão dos furos (as mesmas do protótipo do Marcelo). */
export const FURO_PADRAO = {
  botaoDiametro: 12,
  botaoEspacamento: 20,
  lampadaDiametro: 80,
  /** Botões de uma botoeira. */
  botoesPorBotoeira: 5,
  /** Folga da placa da botoeira em volta dos botões. */
  botoeiraFolgaLateral: 18,
  botoeiraFolgaVertical: 14,
  /** Distância entre duas botoeiras lado a lado. */
  botoeiraEntrePlacas: 30,
} as const;

/** Faixa da face de baixo reservada para as lâmpadas, em cada lado. */
export const bandaLampadas = (profundidade: number) => Math.min(120, profundidade * 0.25);

export interface FuroLampada { x: number; z: number }
export interface FuroBotao { x: number; y: number }
export interface PlacaBotoeira { x: number; y: number; largura: number; altura: number }

export interface PlanoFuros {
  lampadas: {
    diametro: number;
    furos: FuroLampada[];
    /** Quantas ficam na frente (z > 0) e quantas no fundo (z < 0). */
    nFrente: number;
    nFundos: number;
  };
  botoes: {
    tipo: TipoControle;
    diametro: number;
    espacamento: number;
    furos: FuroBotao[];
    /** Só na botoeira: a placa onde os 5 botões ficam. */
    placas: PlacaBotoeira[];
  };
}

export interface EntradaFuros {
  modelo: 'Box' | 'Piramidal' | 'Linea' | 'Tube';
  width: number;
  depth: number;
  height: number;
  mount: 'Parede' | 'Ilha';
  qtdLampadas: number;
  qtdBotoes: number;
  tipoControle: TipoControle;
  /** Só vale para Parede. Padrão: frente. */
  posicaoLampadas?: PosicaoLampadas;
}

const MAX_FUROS = 50;

export function planejarFuros(e: EntradaFuros): PlanoFuros {
  const tube = e.modelo === 'Tube';
  const largura = tube ? 500 : e.width;
  const profundidade = tube ? 500 : e.depth;

  // ── Lâmpadas ──────────────────────────────────────────────────────────────
  const nLamp = Math.min(MAX_FUROS, Math.max(0, Math.round(e.qtdLampadas)));
  // Ilha: metade na frente e metade no fundo (a frente fica com a sobra).
  // Parede: tudo na frente, ou tudo junto à parede quando o cliente pede.
  let nFrente: number, nFundos: number;
  if (e.mount === 'Ilha') {
    nFrente = Math.ceil(nLamp / 2);
    nFundos = nLamp - nFrente;
  } else if (e.posicaoLampadas === 'parede') {
    nFrente = 0;
    nFundos = nLamp;
  } else {
    nFrente = nLamp;
    nFundos = 0;
  }

  const banda = bandaLampadas(profundidade);
  const zFileira = profundidade / 2 - banda / 2;
  // Largura útil de uma fileira: a da coifa; na Tube (redonda), 80% da corda.
  const larguraUtil = tube
    ? 2 * Math.sqrt(Math.max(0, 250 * 250 - zFileira * zFileira)) * 0.8
    : largura;
  const maiorFileira = Math.max(nFrente, nFundos, 1);
  const diametroLampada = Math.max(10, Math.min(FURO_PADRAO.lampadaDiametro, larguraUtil / (maiorFileira * 1.5), banda * 0.8));

  const fileira = (n: number, z: number): FuroLampada[] =>
    Array.from({ length: n }, (_, j) => ({ x: -larguraUtil / 2 + larguraUtil * (j + 0.5) / n, z }));
  const furosLampada = [...fileira(nFrente, zFileira), ...fileira(nFundos, -zFileira)];

  // ── Botões / botoeira (face da frente, na saia) ───────────────────────────
  const nBot = Math.min(MAX_FUROS, Math.max(0, Math.round(e.qtdBotoes)));
  const yBotao = Math.min(e.height, 60) / 2;
  const { botaoDiametro: dia, botaoEspacamento: esp, botoesPorBotoeira: porPlaca } = FURO_PADRAO;
  const furosBotao: FuroBotao[] = [];
  const placas: PlacaBotoeira[] = [];
  let escala = 1;

  if (nBot > 0 && !tube) {
    if (e.tipoControle === 'botoeira') {
      const larguraPlaca = porPlaca * dia + (porPlaca - 1) * esp + 2 * FURO_PADRAO.botoeiraFolgaLateral;
      const alturaPlaca = dia + 2 * FURO_PADRAO.botoeiraFolgaVertical;
      const total = nBot * larguraPlaca + (nBot - 1) * FURO_PADRAO.botoeiraEntrePlacas;
      escala = Math.min(1, (largura * 0.9) / total);
      const lp = larguraPlaca * escala, ap = alturaPlaca * escala, gap = FURO_PADRAO.botoeiraEntrePlacas * escala;
      const x0 = -(nBot * lp + (nBot - 1) * gap) / 2;
      for (let i = 0; i < nBot; i++) {
        const cx = x0 + lp / 2 + i * (lp + gap);
        placas.push({ x: cx, y: yBotao, largura: lp, altura: ap });
        const passo = (dia + esp) * escala;
        for (let b = 0; b < porPlaca; b++) furosBotao.push({ x: cx + (b - (porPlaca - 1) / 2) * passo, y: yBotao });
      }
    } else {
      const total = nBot * dia + (nBot - 1) * esp;
      escala = Math.min(1, (largura * 0.9) / total);
      const passo = (dia + esp) * escala;
      for (let i = 0; i < nBot; i++) furosBotao.push({ x: (i - (nBot - 1) / 2) * passo, y: yBotao });
    }
  }

  return {
    lampadas: { diametro: diametroLampada, furos: furosLampada, nFrente, nFundos },
    botoes: { tipo: e.tipoControle, diametro: dia * escala, espacamento: esp * escala, furos: furosBotao, placas },
  };
}

/** Texto curto dos furos, para mostrar na tela (ex: "2 furos Ø12 — botões"). */
export function resumoFuros(plano: PlanoFuros): { lampadas: string | null; botoes: string | null } {
  const l = plano.lampadas;
  const b = plano.botoes;
  const arred = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  let lampadas: string | null = null;
  if (l.furos.length > 0) {
    const onde = l.nFrente > 0 && l.nFundos > 0
      ? `${l.nFrente} na frente + ${l.nFundos} no fundo`
      : l.nFundos > 0 ? 'junto à parede (fundo)' : 'na frente';
    lampadas = `${l.furos.length} furo${l.furos.length !== 1 ? 's' : ''} Ø${arred(l.diametro)} — lâmpadas, ${onde}`;
  }
  let botoes: string | null = null;
  if (b.furos.length > 0) {
    botoes = b.tipo === 'botoeira'
      ? `${b.placas.length} botoeira${b.placas.length !== 1 ? 's' : ''} · ${b.furos.length} furos Ø${arred(b.diametro)} (esp. ${arred(b.espacamento)})`
      : `${b.furos.length} furo${b.furos.length !== 1 ? 's' : ''} Ø${arred(b.diametro)} — botões (esp. ${arred(b.espacamento)})`;
  }
  return { lampadas, botoes };
}

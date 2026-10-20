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

/**
 * Onde ficam os botões/botoeira (o cliente define): na FRENTE da coifa (face
 * da saia) ou EMBAIXO (face de baixo, junto à borda da frente), alinhados à
 * esquerda, ao centro ou à direita.
 */
export type PosicaoComando =
  | 'frente-esquerda' | 'frente-centro' | 'frente-direita'
  | 'embaixo-esquerda' | 'embaixo-centro' | 'embaixo-direita';
export const POSICOES_COMANDO: { value: PosicaoComando; label: string }[] = [
  { value: 'frente-esquerda', label: 'Frente — esquerda' },
  { value: 'frente-centro', label: 'Frente — centro' },
  { value: 'frente-direita', label: 'Frente — direita' },
  { value: 'embaixo-esquerda', label: 'Embaixo — esquerda' },
  { value: 'embaixo-centro', label: 'Embaixo — centro' },
  { value: 'embaixo-direita', label: 'Embaixo — direita' },
];
export const rotuloPosicaoComando = (p: PosicaoComando | undefined) =>
  (POSICOES_COMANDO.find((o) => o.value === p) ?? POSICOES_COMANDO[1]).label;

/** Folga lateral dos botões alinhados à esquerda/direita (a mesma do protótipo do Marcelo). */
const MARGEM_LATERAL_COMANDO = 80;
/** Faixa da borda da frente da face de baixo reservada ao comando "embaixo". */
const FAIXA_COMANDO_EMBAIXO = 40;

export interface FuroLampada { x: number; z: number }
/** Frente: usa x e y (altura). Embaixo: usa x e z (profundidade), y ≈ 0. */
export interface FuroBotao { x: number; y?: number; z?: number }
/** `altura` é a dimensão vertical (frente) ou a profundidade (embaixo) da placa. */
export interface PlacaBotoeira { x: number; y?: number; z?: number; largura: number; altura: number }

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
    /** Só na botoeira: a placa onde os botões ficam. */
    placas: PlacaBotoeira[];
    lado: 'frente' | 'embaixo';
  };
  /** Faixas (mm) da face de baixo, na frente e no fundo, que o filtro deve deixar livres. */
  reservaFrente: number;
  reservaFundo: number;
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
  /** Padrão: frente-centro. */
  posicaoComando?: PosicaoComando;
}

const MAX_FUROS = 50;

export function planejarFuros(e: EntradaFuros): PlanoFuros {
  const tube = e.modelo === 'Tube';
  const diametroTube = e.width > 0 ? e.width : 500;
  const largura = tube ? diametroTube : e.width;
  const profundidade = tube ? diametroTube : e.depth;

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

  const [ladoComando, alinhamento] = (e.posicaoComando ?? 'frente-centro').split('-') as ['frente' | 'embaixo', 'esquerda' | 'centro' | 'direita'];
  const comandoEmbaixo = ladoComando === 'embaixo' && !tube && e.qtdBotoes > 0;
  // Comando embaixo ocupa a borda da frente — as lâmpadas da frente recuam.
  const reservaComando = comandoEmbaixo ? FAIXA_COMANDO_EMBAIXO : 0;

  const banda = bandaLampadas(profundidade);
  const zFileira = profundidade / 2 - reservaComando - banda / 2;
  // Largura útil de uma fileira: a da coifa; na Tube (redonda), 80% da corda.
  const larguraUtil = tube
    ? 2 * Math.sqrt(Math.max(0, (diametroTube / 2) ** 2 - zFileira * zFileira)) * 0.8
    : largura;
  const maiorFileira = Math.max(nFrente, nFundos, 1);
  const diametroLampada = Math.max(10, Math.min(FURO_PADRAO.lampadaDiametro, larguraUtil / (maiorFileira * 1.5), banda * 0.8));

  const fileira = (n: number, z: number): FuroLampada[] =>
    Array.from({ length: n }, (_, j) => ({ x: -larguraUtil / 2 + larguraUtil * (j + 0.5) / n, z }));
  const furosLampada = [...fileira(nFrente, zFileira), ...fileira(nFundos, -(profundidade / 2 - banda / 2))];

  // ── Botões / botoeira ─────────────────────────────────────────────────────
  const nBot = Math.min(MAX_FUROS, Math.max(0, Math.round(e.qtdBotoes)));
  // Na Piramidal a frente é inclinada e a borda de baixo é só uma quina: o painel fica mais acima (≈80mm) pra aparecer.
  const yBotao = Math.min(e.height, e.modelo === 'Piramidal' ? 160 : 60) / 2;
  const { botaoDiametro: dia, botaoEspacamento: esp, botoesPorBotoeira: porPlaca } = FURO_PADRAO;
  const furosBotao: FuroBotao[] = [];
  const placas: PlacaBotoeira[] = [];
  let escala = 1;

  // Centro do conjunto (largura `total`) conforme o alinhamento escolhido.
  const centroDoConjunto = (total: number) => {
    const livre = Math.max(0, largura / 2 - total / 2 - 20);
    if (alinhamento === 'esquerda') return -Math.min(livre, Math.max(0, largura / 2 - MARGEM_LATERAL_COMANDO - total / 2));
    if (alinhamento === 'direita') return Math.min(livre, Math.max(0, largura / 2 - MARGEM_LATERAL_COMANDO - total / 2));
    return 0;
  };
  const posicionar = (x: number, h: number): Pick<FuroBotao, 'y' | 'z'> =>
    comandoEmbaixo ? { z: profundidade / 2 - 6 - h / 2, y: 0 } : { y: yBotao };

  if (nBot > 0 && !tube) {
    if (e.tipoControle === 'botoeira') {
      const larguraPlaca = porPlaca * dia + (porPlaca - 1) * esp + 2 * FURO_PADRAO.botoeiraFolgaLateral;
      const alturaPlaca = dia + 2 * FURO_PADRAO.botoeiraFolgaVertical;
      const total = nBot * larguraPlaca + (nBot - 1) * FURO_PADRAO.botoeiraEntrePlacas;
      escala = Math.min(1, (largura * 0.9) / total);
      const lp = larguraPlaca * escala, ap = alturaPlaca * escala, gap = FURO_PADRAO.botoeiraEntrePlacas * escala;
      const totalEscalado = nBot * lp + (nBot - 1) * gap;
      const x0 = centroDoConjunto(totalEscalado) - totalEscalado / 2;
      for (let i = 0; i < nBot; i++) {
        const cx = x0 + lp / 2 + i * (lp + gap);
        placas.push({ x: cx, largura: lp, altura: ap, ...posicionar(cx, ap) });
        const passo = (dia + esp) * escala;
        for (let b = 0; b < porPlaca; b++) {
          const bx = cx + (b - (porPlaca - 1) / 2) * passo;
          furosBotao.push({ x: bx, ...posicionar(bx, ap) });
        }
      }
    } else {
      const total = nBot * dia + (nBot - 1) * esp;
      escala = Math.min(1, (largura * 0.9) / total);
      const passo = (dia + esp) * escala;
      const totalEscalado = nBot * dia * escala + (nBot - 1) * esp * escala;
      const x0 = centroDoConjunto(totalEscalado) - (nBot - 1) * passo / 2;
      for (let i = 0; i < nBot; i++) furosBotao.push({ x: x0 + i * passo, ...posicionar(0, dia * escala) });
    }
  }

  return {
    lampadas: { diametro: diametroLampada, furos: furosLampada, nFrente, nFundos },
    botoes: { tipo: e.tipoControle, diametro: dia * escala, espacamento: esp * escala, furos: furosBotao, placas, lado: comandoEmbaixo ? 'embaixo' : 'frente' },
    reservaFrente: nFrente > 0 ? banda + reservaComando : comandoEmbaixo ? reservaComando + 10 : 0,
    reservaFundo: nFundos > 0 ? banda : 0,
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

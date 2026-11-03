// Planificação (peças abertas) da coifa Box, encaixe nas chapas e DXF.
//
// Regras tiradas do exemplo "Coifa Israel" (DXF + PDF do Adriano) e das
// respostas do Levi em 20/10/26. Só a Box está coberta — Piramidal, Línea e
// Tube precisam de um exemplo de cada. Tudo em mm; módulo puro.
//
// Convenção das peças abertas: origem no canto inferior esquerdo, y para cima
// (como no CAD). Internamente as medidas "de cima para baixo" (yTopo) são
// convertidas na hora de montar o contorno.

import { distanciaLampadaBorda, diametroFuroLampada, type ParametrosDesenho } from './coifa-desenho';
import { FURO_PADRAO, type PosicaoComando } from './coifa-furos';

export type Ponto = [number, number];

export interface FuroPeca { x: number; y: number; d: number }
export interface Peca {
  id: string;
  nome: string;
  /** 22 = frente e laterais (0,8mm); 24 = costas, teto e carenagens (0,6mm). */
  bitola: 22 | 24;
  /** Tamanho da peça aberta (caixa que a contém). */
  w: number;
  h: number;
  /** Contorno fechado (último ponto = primeiro). */
  contorno: Ponto[];
  furos: FuroPeca[];
  /** Linhas de dobra: [x1, y1, x2, y2]. */
  dobras: [number, number, number, number][];
}

export interface EntradaPlanificacao {
  width: number;   // L (frente)
  depth: number;   // P
  height: number;  // A
  mount: 'Parede' | 'Ilha';
  aplicacao: 'Cozinha' | 'Churrasqueira';
  qtdLampadas: number;
  posicaoLampadas?: 'frente' | 'parede';
  qtdBotoes: number;
  tipoControle: 'botoes' | 'botoeira';
  posicaoComando?: PosicaoComando;
  /** Frisos (Levi, 29/10): cada linha vira uma peça própria e parte a frente em pedaços. */
  frisoFrente?: boolean;
  frisoLD?: boolean;
  frisoLE?: boolean;
  frisoLinhas?: number;
  /** Distância (acabada) da base do corpo da frente ao 1º friso, e entre frisos — borda a borda (mm). */
  frisoDistBase?: number;
  frisoDistEntre?: number;
}

export const FRISO_DIST_BASE_PADRAO = 200;
export const FRISO_DIST_ENTRE_PADRAO = 200;

export interface ResultadoPecas { pecas: Peca[]; avisos: string[] }

const arred = (v: number) => Math.round(v * 100) / 100;

/** Divide as lâmpadas entre frente e fundo, como no desenho 3D. */
function repartirLampadas(e: EntradaPlanificacao): { frente: number; fundo: number } {
  const n = Math.max(0, Math.round(e.qtdLampadas));
  if (e.mount === 'Ilha') { const f = Math.ceil(n / 2); return { frente: f, fundo: n - f }; }
  return e.posicaoLampadas === 'parede' ? { frente: 0, fundo: n } : { frente: n, fundo: 0 };
}

/** Lâmpadas numa faixa [x0, x1] da peça aberta: a borda do furo da 1ª/última fica a `distanciaLampadaBorda` da lateral da coifa (x0 e x1). */
function lampadasNaFaixa(n: number, x0: number, x1: number, larguraCoifa: number, diametro: number, p: ParametrosDesenho): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(x0 + x1) / 2];
  const d = distanciaLampadaBorda(larguraCoifa, p) + diametro / 2;
  const a = x0 + d, b = x1 - d;
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export function planificarBox(e: EntradaPlanificacao, p: ParametrosDesenho): ResultadoPecas {
  const avisos: string[] = [];
  const L = e.width, P = e.depth, A = e.height;
  const a = p.acrescimoDobra;
  const lamp = repartirLampadas(e);
  const dL = diametroFuroLampada(e.aplicacao, p);
  const toY = (h: number, yTopo: number) => arred(h - yTopo);
  const nBot = Math.max(0, Math.round(e.qtdBotoes));

  // ── FRENTE (22): 2 dobras laterais → L − 2·acréscimo. ─────────────────────
  // Sem friso é uma peça só. Com friso (Levi, 29/10) cada linha de friso é uma
  // peça (aba 10 + centro 20 + aba 10) e a frente se parte em pedaços: BAIXO
  // (com o painel das lâmpadas), MEIO(s) e CIMA (o que sobra). Cada pedaço
  // aberto = medida acabada − 2 dobras; cada friso soma 2 dobras ao corpo.
  const frentes: Peca[] = [];
  {
    const W = arred(L - 2 * a);
    const corpo = A - 2 * a;
    const r = p.frentePainelRecuo, aw = p.alivioLargura, ah = p.alivioAltura;
    const dBase = e.frisoDistBase ?? FRISO_DIST_BASE_PADRAO;
    const dEntre = e.frisoDistEntre ?? FRISO_DIST_ENTRE_PADRAO;
    let nFris = e.frisoFrente ? Math.max(1, Math.min(3, Math.round(e.frisoLinhas ?? 1))) : 0;
    let planoFriso: { baixo: number; meios: number[]; cima: number } | null = null;
    if (nFris > 0) {
      const baixo = arred(dBase - 2 * a), meio = arred(dEntre - 2 * a);
      const meios = Array.from({ length: nFris - 1 }, () => meio);
      const cima = arred(corpo - 2 * nFris * a - nFris * p.frisoCentro - baixo - meio * (nFris - 1));
      if (baixo > 0 && meio > 0 && cima > 0) planoFriso = { baixo, meios, cima };
      else {
        avisos.push(`Friso: as distâncias (${dBase} mm da base, ${dEntre} mm entre frisos) não cabem na altura de ${A} mm — frisos fora do desenho.`);
        nFris = 0;
      }
    }

    // Pedaço de baixo: aba de cima + corpo + retorno + painel (lâmpadas) + aba + bainha.
    const pedacoBaixo = (id: string, nome: string, abaCima: number, corpoAberto: number): Peca => {
      const yRet = abaCima + corpoAberto;           // fim do corpo
      const yPainel = yRet + p.frenteRetorno;       // início do painel de baixo
      const yAba = yPainel + p.frentePainel;
      const yBainha = yAba + p.frenteAba;
      const H = arred(yBainha + p.frenteBainha);
      const contorno: Ponto[] = [
        [0, 0], [W, 0], [W, yPainel], [W - aw, yPainel + ah], [W - r + aw, yPainel + ah], [W - r, yPainel],
        [W - r, H], [r, H], [r, yPainel], [r - aw, yPainel + ah], [aw, yPainel + ah], [0, yPainel], [0, 0],
      ].map(([x, y]) => [arred(x), toY(H, y)] as Ponto);

      const furos: FuroPeca[] = [];
      // Lâmpadas da frente: no painel de baixo, medidas a partir da lateral da coifa.
      const yLamp = toY(H, yPainel + p.frentePainel / 2);
      lampadasNaFaixa(lamp.frente, 0, W, L, dL, p).forEach((x) => furos.push({ x: arred(x), y: yLamp, d: dL }));
      // Botões/botoeira.
      if (nBot > 0) {
        const [lado, alinh] = (e.posicaoComando ?? 'frente-centro').split('-') as ['frente' | 'embaixo', 'esquerda' | 'centro' | 'direita'];
        const dia = e.tipoControle === 'botoeira' ? p.furoBotoeira : p.furoBotao;
        const nF = e.tipoControle === 'botoeira' ? FURO_PADRAO.botoesPorBotoeira : nBot;
        const passo = e.tipoControle === 'botoeira' ? p.espacoBotoeira : dia + p.espacoBotoeira; // botoeira: centro a centro
        const total = (nF - 1) * passo;
        const margem = 80;
        const cx = alinh === 'esquerda' ? margem + total / 2 : alinh === 'direita' ? W - margem - total / 2 : W / 2;
        // Frente: no corpo, 45mm acima da dobra de baixo. Embaixo: no segmento de 35mm (retorno), acima das
        // lâmpadas — não ao lado delas (Levi, 02/11).
        const yCmd = lado === 'frente' ? toY(H, yRet - 45) : toY(H, yRet + p.frenteRetorno / 2);
        for (let i = 0; i < nF; i++) furos.push({ x: arred(cx - total / 2 + i * passo), y: yCmd, d: dia });
      }

      const dobras: Peca['dobras'] = [abaCima, yRet, yPainel].map((y) => [0, toY(H, y), W, toY(H, y)] as [number, number, number, number]);
      [yAba, yBainha].forEach((y) => dobras.push([r, toY(H, y), W - r, toY(H, y)]));
      todosFurosDentro(nome, contorno, furos, avisos);
      return { id, nome, bitola: 22, w: W, h: H, contorno, furos, dobras };
    };

    // Faixa lisa (pedaço do meio/de cima e o friso): aba + corpo + aba, 2 dobras.
    const faixaLisa = (id: string, nome: string, abaCima: number, corpoAberto: number, abaBaixo: number): Peca => {
      const H = arred(abaCima + corpoAberto + abaBaixo);
      return {
        id, nome, bitola: 22, w: W, h: H,
        contorno: [[0, 0], [W, 0], [W, H], [0, H], [0, 0]],
        furos: [],
        dobras: [abaCima, abaCima + corpoAberto].map((y) => [0, toY(H, y), W, toY(H, y)] as [number, number, number, number]),
      };
    };

    if (!planoFriso) {
      frentes.push(pedacoBaixo('FRENTE', 'FRENTE', p.abaTopo, corpo));
    } else {
      // De baixo para cima, como na montagem: BAIXO, friso 1, MEIO 1, friso 2, ..., CIMA.
      frentes.push(pedacoBaixo('FRENTE_BAIXO', 'FRENTE BAIXO', p.frisoAbaParte, planoFriso.baixo));
      for (let i = 0; i < nFris; i++) {
        frentes.push(faixaLisa(`FRISO_${i + 1}`, `FRISO ${i + 1}`, p.frisoAba, p.frisoCentro, p.frisoAba));
        if (i < nFris - 1) {
          const n = nFris > 2 ? ` ${i + 1}` : '';
          frentes.push(faixaLisa(`FRENTE_MEIO${i + 1}`, `FRENTE MEIO${n}`, p.frisoAbaParte, planoFriso.meios[i], p.frisoAbaParte));
        }
      }
      frentes.push(faixaLisa('FRENTE_CIMA', 'FRENTE CIMA', p.abaTopo, planoFriso.cima, p.frisoAbaParte));
    }
  }

  // ── COSTA (24): retorno de baixo de 100, degrau e aba mais estreita. ──────
  let costa: Peca;
  {
    const W = arred(L - 2 * a);
    const corpo = A - 2 * a;
    const yRet = p.abaTopo + corpo;
    // Retorno de baixo: profundidade − 545, no mínimo 50 (Levi, 02/11) — antes era fixo em 100.
    const retorno = Math.max(p.costaRetornoMin, arred(P - p.costaRetornoDesconto));
    const yEsc = yRet + retorno + p.costaDegrau;
    const yFim = yEsc + p.costaAba + p.costaDobraExtra + p.costaBainha;
    const H = arred(yFim);
    const c = p.costaRecuo;
    const contorno: Ponto[] = [
      [0, 0], [W, 0], [W, yEsc], [W - c, yEsc], [W - c, yFim], [c, yFim], [c, yEsc], [0, yEsc], [0, 0],
    ].map(([x, y]) => [arred(x), toY(H, y)] as Ponto);
    const furos: FuroPeca[] = [];
    // Lâmpadas do fundo (Ilha ou "junto à parede"): no retorno de baixo.
    const yLamp = toY(H, yRet + retorno / 2);
    lampadasNaFaixa(lamp.fundo, 0, W, L, dL, p).forEach((x) => furos.push({ x: arred(x), y: yLamp, d: dL }));
    const dobras: Peca['dobras'] = [p.abaTopo, yRet, yRet + retorno, yRet + retorno + p.costaDegrau + p.costaAba, yRet + retorno + p.costaDegrau + p.costaAba + p.costaDobraExtra]
      .map((y, i) => (i >= 3 ? [c, toY(H, y), W - c, toY(H, y)] : [0, toY(H, y), W, toY(H, y)]) as [number, number, number, number]);
    if (furos.length && dL > retorno) avisos.push(`Costa: o furo da lâmpada (Ø${dL}) é maior que o retorno de baixo (${retorno} mm) — o furo invade as dobras.`);
    todosFurosDentro('Costa', contorno, furos, avisos);
    costa = { id: 'COSTA', nome: 'COSTA', bitola: 24, w: W, h: H, contorno, furos, dobras };
  }

  // ── LATERAIS (22): 1 dobra → P − acréscimo; aba lateral de 20 e aba de cima. ─
  // Frisos da lateral coincidem com os da frente (Levi, 01/11): mesma quantidade e
  // mesmas distâncias. A parte de baixo só tem 1 dobra (a de cima), então o corpo
  // aberto dela é medida acabada − 1 dobra (199 para 200), não − 2.
  const lateral = (lado: 'ESQ' | 'DIR'): Peca[] => {
    const Wb = arred(P - a);
    const Wt = arred(Wb + p.lateralAba);
    const espelha = (x: number) => arred(lado === 'ESQ' ? x : Wt - x);
    const xb = lado === 'ESQ' ? Wb : Wt - Wb;
    const sufixo = lado === 'ESQ' ? 'ESQ' : 'DIR';
    // Pedaço: aba de cima (só na largura do corpo) + corpo + aba de baixo; a aba lateral vai da aba de cima até o fim.
    const pedaco = (id: string, nome: string, abaCima: number, corpoAberto: number, abaBaixo: number): Peca => {
      const H = arred(abaCima + corpoAberto + abaBaixo);
      const base: Ponto[] = [[0, 0], [Wb, 0], [Wb, abaCima], [Wt, abaCima], [Wt, H], [0, H], [0, 0]];
      const dobras: Peca['dobras'] = [];
      if (abaCima > 0) dobras.push([Math.min(espelha(0), espelha(Wb)), toY(H, abaCima), Math.max(espelha(0), espelha(Wb)), toY(H, abaCima)]);
      if (abaBaixo > 0) dobras.push([Math.min(espelha(0), espelha(Wb)), toY(H, abaCima + corpoAberto), Math.max(espelha(0), espelha(Wb)), toY(H, abaCima + corpoAberto)]);
      dobras.push([xb, 0, xb, toY(H, abaCima)]);
      return { id: `${id}_${sufixo}`, nome: `${nome} ${sufixo}`, bitola: 22, w: Wt, h: H, contorno: base.map(([x, y]) => [espelha(x), toY(H, y)] as Ponto), furos: [], dobras };
    };
    const friso = (n: number): Peca => {
      const H = arred(p.frisoAba * 2 + p.frisoCentro);
      return {
        id: `LAT_FRISO${n}_${sufixo}`, nome: `LAT. FRISO ${n} ${sufixo}`, bitola: 22, w: Wb, h: H,
        contorno: [[0, 0], [Wb, 0], [Wb, H], [0, H], [0, 0]], furos: [],
        dobras: [p.frisoAba, p.frisoAba + p.frisoCentro].map((y) => [0, toY(H, y), Wb, toY(H, y)] as [number, number, number, number]),
      };
    };

    const comFriso = lado === 'ESQ' ? e.frisoLE : e.frisoLD;
    const nFris = comFriso ? Math.max(1, Math.min(3, Math.round(e.frisoLinhas ?? 1))) : 0;
    const dBase = e.frisoDistBase ?? FRISO_DIST_BASE_PADRAO;
    const dEntre = e.frisoDistEntre ?? FRISO_DIST_ENTRE_PADRAO;
    const corpo = A - a;
    if (nFris > 0) {
      const baixo = arred(dBase - a), meio = arred(dEntre - 2 * a);
      const cima = arred(corpo - 2 * nFris * a - nFris * p.frisoCentro - baixo - meio * (nFris - 1));
      if (baixo > 0 && meio > 0 && cima > 0) {
        const partes: Peca[] = [pedaco('LAT_BAIXO', 'LAT. BAIXO', p.frisoAbaParte, baixo, 0)];
        for (let i = 0; i < nFris; i++) {
          partes.push(friso(i + 1));
          if (i < nFris - 1) partes.push(pedaco(`LAT_MEIO${i + 1}`, `LAT. MEIO${nFris > 2 ? ` ${i + 1}` : ''}`, p.frisoAbaParte, meio, p.frisoAbaParte));
        }
        partes.push(pedaco('LAT_CIMA', 'LAT. CIMA', p.abaTopo, cima, p.frisoAbaParte));
        return partes;
      }
      avisos.push(`Friso na lateral ${sufixo}: as distâncias (${dBase} mm da base, ${dEntre} mm entre frisos) não cabem na altura de ${A} mm — frisos fora do desenho.`);
    }
    return [pedaco('LAT', 'LAT.', p.abaTopo, corpo, 0)];
  };

  // ── TAMPA = teto (24): retângulo (L − 20) × (P − 20). ──────────────────────
  const tw = arred(L - p.tampaFolga), th = arred(P - p.tampaFolga);
  const tampa: Peca = {
    id: 'TAMPA', nome: 'TAMPA', bitola: 24, w: tw, h: th,
    contorno: [[0, 0], [tw, 0], [tw, th], [0, th], [0, 0]], furos: [], dobras: [],
  };

  return { pecas: [...frentes, costa, ...lateral('ESQ'), ...lateral('DIR'), tampa], avisos };
}

// Ponto dentro do polígono (ray casting) — só para avisar de furo fora da peça.
function dentroDoPoligono(pt: Ponto, poly: Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function todosFurosDentro(nome: string, contorno: Ponto[], furos: FuroPeca[], avisos: string[]) {
  furos.forEach((f) => {
    const bordas: Ponto[] = [[f.x - f.d / 2, f.y], [f.x + f.d / 2, f.y], [f.x, f.y - f.d / 2], [f.x, f.y + f.d / 2]];
    if (!bordas.every((b) => dentroDoPoligono(b, contorno))) avisos.push(`${nome}: furo Ø${f.d} em x=${f.x} fica fora da peça.`);
  });
}

// ── Encaixe nas chapas (MaxRects, com rotação) ──────────────────────────────

export interface PecaPosicionada { peca: Peca; x: number; y: number; girada: boolean }
export interface ChapaEncaixada {
  indice: number;
  bitola: 22 | 24;
  comprimento: number;
  largura: number;
  pecas: PecaPosicionada[];
  /** % da área da chapa ocupada pelas peças. */
  aproveitamento: number;
}

interface Rect { x: number; y: number; w: number; h: number }

function encaixarGrupo(pecas: Peca[], comprimento: number, largura: number, margem: number, espaco: number, bitola: 22 | 24, inicio: number, avisos: string[]): ChapaEncaixada[] {
  // Área útil aumentada de `espaco` e peças aumentadas de `espaco`: garante margem e folga entre peças.
  const areaW = comprimento - 2 * margem + espaco, areaH = largura - 2 * margem + espaco;
  const chapas: { livres: Rect[]; itens: PecaPosicionada[] }[] = [];
  const ordenadas = [...pecas].sort((a, b) => b.w * b.h - a.w * a.h);

  const melhorEm = (livres: Rect[], w: number, h: number) => {
    let melhor: { r: Rect; girada: boolean; score: number } | null = null;
    for (const r of livres) {
      // Peças sempre em pé (sentido do escovado) — nunca giram (Levi, 29/10).
      for (const girada of [false]) {
        const pw = girada ? h : w, ph = girada ? w : h;
        if (pw <= r.w + 1e-6 && ph <= r.h + 1e-6) {
          const score = Math.min(r.w - pw, r.h - ph);
          if (!melhor || score < melhor.score) melhor = { r, girada, score };
        }
      }
    }
    return melhor;
  };
  const cortar = (livres: Rect[], u: Rect): Rect[] => {
    const out: Rect[] = [];
    for (const r of livres) {
      if (u.x >= r.x + r.w || u.x + u.w <= r.x || u.y >= r.y + r.h || u.y + u.h <= r.y) { out.push(r); continue; }
      if (u.x > r.x) out.push({ x: r.x, y: r.y, w: u.x - r.x, h: r.h });
      if (u.x + u.w < r.x + r.w) out.push({ x: u.x + u.w, y: r.y, w: r.x + r.w - (u.x + u.w), h: r.h });
      if (u.y > r.y) out.push({ x: r.x, y: r.y, w: r.w, h: u.y - r.y });
      if (u.y + u.h < r.y + r.h) out.push({ x: r.x, y: u.y + u.h, w: r.w, h: r.y + r.h - (u.y + u.h) });
    }
    // remove retângulos contidos em outros
    return out.filter((a, i) => !out.some((b, j) => i !== j && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (a.w * a.h < b.w * b.h || (a.w * a.h === b.w * b.h && j < i))));
  };

  for (const peca of ordenadas) {
    const w = peca.w + espaco, h = peca.h + espaco;
    if (!(w <= areaW && h <= areaH)) {
      avisos.push(`${peca.nome} (${peca.w} × ${peca.h}) não cabe em pé numa chapa de ${comprimento} × ${largura} — a peça não pode ser deitada por causa do escovado.`);
      continue;
    }
    let colocada = false;
    for (const ch of chapas) {
      const m = melhorEm(ch.livres, w, h);
      if (!m) continue;
      const pw = m.girada ? h : w, ph = m.girada ? w : h;
      ch.itens.push({ peca, x: margem + m.r.x, y: margem + m.r.y, girada: m.girada });
      ch.livres = cortar(ch.livres, { x: m.r.x, y: m.r.y, w: pw, h: ph });
      colocada = true;
      break;
    }
    if (!colocada) {
      const ch = { livres: [{ x: 0, y: 0, w: areaW, h: areaH }] as Rect[], itens: [] as PecaPosicionada[] };
      chapas.push(ch);
      const m = melhorEm(ch.livres, w, h)!;
      const pw = m.girada ? h : w, ph = m.girada ? w : h;
      ch.itens.push({ peca, x: margem + m.r.x, y: margem + m.r.y, girada: m.girada });
      ch.livres = cortar(ch.livres, { x: m.r.x, y: m.r.y, w: pw, h: ph });
    }
  }
  return chapas.map((c, i) => ({
    indice: inicio + i, bitola, comprimento, largura, pecas: c.itens,
    aproveitamento: Math.round((c.itens.reduce((s, it) => s + it.peca.w * it.peca.h, 0) / (comprimento * largura)) * 1000) / 10,
  }));
}

/** Encaixa as peças em chapas (uma bitola por chapa). `comprimento` = chapa padrão (2000 ou 3000). */
export function encaixarNasChapas(pecas: Peca[], comprimento: number, p: ParametrosDesenho): { chapas: ChapaEncaixada[]; avisos: string[] } {
  const avisos: string[] = [];
  const chapas: ChapaEncaixada[] = [];
  ([22, 24] as const).forEach((b) => {
    const grupo = pecas.filter((x) => x.bitola === b);
    if (grupo.length === 0) return;
    chapas.push(...encaixarGrupo(grupo, comprimento, p.larguraChapa, p.margemChapa, p.espacoPecas, b, chapas.length + 1, avisos));
  });
  return { chapas, avisos };
}

/** Pontos de uma peça já posicionada na chapa (com rotação de 90° quando girada). */
export function pontoNaChapa(pp: PecaPosicionada, [x, y]: Ponto): Ponto {
  // girada: (x, y) → (y, x) — espelha; para manter a peça "de frente" gira 90° anti-horário: (x,y) → (h − y, x).
  if (!pp.girada) return [arred(pp.x + x), arred(pp.y + y)];
  return [arred(pp.x + (pp.peca.h - y)), arred(pp.y + x)];
}

// ── DXF (R12, ASCII: o formato mais aceito por programas de corte) ─────────

export interface OpcoesDxf { linhasDeDobra?: boolean; rotulos?: boolean }

/**
 * Gera o DXF de uma chapa: contornos, furos e piques de dobra na camada CORTE.
 * Em cada dobra vai só um pique de 1mm nas duas extremidades, para guiar o
 * operador da dobradeira (Levi, 22/10) — a linha inteira da dobra não é
 * desenhada, a menos que `linhasDeDobra` seja ligado (camada DOBRA).
 */
export function dxfDaChapa(chapa: ChapaEncaixada, op: OpcoesDxf = {}): string {
  const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const linhas: string[] = [];
  const add = (...v: (string | number)[]) => v.forEach((x) => linhas.push(String(x)));
  const linha = (camada: string, a: Ponto, b: Ponto) => add(0, 'LINE', 8, camada, 62, 7, 10, f(a[0]), 20, f(a[1]), 30, 0, 11, f(b[0]), 21, f(b[1]), 31, 0);
  const circulo = (camada: string, c: Ponto, d: number) => add(0, 'CIRCLE', 8, camada, 62, 7, 10, f(c[0]), 20, f(c[1]), 30, 0, 40, f(d / 2));
  const texto = (camada: string, p: Ponto, h: number, t: string, girado = false) => add(0, 'TEXT', 8, camada, 62, 7, 10, f(p[0]), 20, f(p[1]), 30, 0, 40, f(h), 1, t, ...(girado ? [50, 90] : []));

  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'TABLES');
  add(0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0, 0, 'ENDTAB');
  // Tudo em branco (cor 7): o Levi desenha em fundo escuro no Cadcraft/AutoCAD (01/11).
  const camadas: [string, number][] = [['0', 7], ['CORTE', 7], ['DOBRA', 7], ['TEXTO', 7]];
  add(0, 'TABLE', 2, 'LAYER', 70, camadas.length);
  camadas.forEach(([n, c]) => add(0, 'LAYER', 2, n, 70, 0, 62, c, 6, 'CONTINUOUS'));
  add(0, 'ENDTAB', 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'ENTITIES');

  // Contorno da chapa (referência).
  const C: Ponto[] = [[0, 0], [chapa.comprimento, 0], [chapa.comprimento, chapa.largura], [0, chapa.largura], [0, 0]];
  for (let i = 0; i < 4; i++) linha('0', C[i], C[i + 1]);

  chapa.pecas.forEach((pp) => {
    const P = (pt: Ponto) => pontoNaChapa(pp, pt);
    const c = pp.peca.contorno;
    for (let i = 0; i < c.length - 1; i++) linha('CORTE', P(c[i]), P(c[i + 1]));
    pp.peca.furos.forEach((fu) => circulo('CORTE', P([fu.x, fu.y]), fu.d));
    pp.peca.dobras.forEach(([x1, y1, x2, y2]) => {
      // marcas de 1mm nas duas pontas da dobra
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const u: Ponto = [dx / len, dy / len];
      linha('CORTE', P([x1, y1]), P([x1 + u[0], y1 + u[1]]));
      linha('CORTE', P([x2 - u[0], y2 - u[1]]), P([x2, y2]));
      if (op.linhasDeDobra) linha('DOBRA', P([x1, y1]), P([x2, y2]));
    });
    if (op.rotulos !== false) {
      const cx = pp.peca.w / 2, cy = pp.peca.h / 2;
      texto('TEXTO', P([cx - 60, cy]), 25, pp.peca.nome, pp.girada);
    }
  });
  add(0, 'ENDSEC', 0, 'EOF');
  return linhas.join('\r\n') + '\r\n';
}

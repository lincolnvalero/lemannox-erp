// Planificação (peças abertas) da coifa Box, encaixe nas chapas e DXF.
//
// Regras tiradas do exemplo "Coifa Israel" (DXF + PDF do Adriano) e das
// respostas do Levi em 20/10/26. Só a Box está coberta — Piramidal, Línea e
// Tube precisam de um exemplo de cada. Tudo em mm; módulo puro.
//
// Convenção das peças abertas: origem no canto inferior esquerdo, y para cima
// (como no CAD). Internamente as medidas "de cima para baixo" (yTopo) são
// convertidas na hora de montar o contorno.

import { posicoesLampadasX, diametroFuroLampada, type ParametrosDesenho } from './coifa-desenho';
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
}

export interface ResultadoPecas { pecas: Peca[]; avisos: string[] }

const arred = (v: number) => Math.round(v * 100) / 100;

/** Divide as lâmpadas entre frente e fundo, como no desenho 3D. */
function repartirLampadas(e: EntradaPlanificacao): { frente: number; fundo: number } {
  const n = Math.max(0, Math.round(e.qtdLampadas));
  if (e.mount === 'Ilha') { const f = Math.ceil(n / 2); return { frente: f, fundo: n - f }; }
  return e.posicaoLampadas === 'parede' ? { frente: 0, fundo: n } : { frente: n, fundo: 0 };
}

/** Lâmpadas numa faixa útil [x0, x1] (da peça aberta): a regra do % da largura vale a partir das bordas da faixa. */
function lampadasNaFaixa(n: number, x0: number, x1: number, larguraCoifa: number, p: ParametrosDesenho): number[] {
  if (n <= 0) return [];
  const span = x1 - x0;
  // posicoesLampadasX trabalha com a largura da coifa (define a distância d); reaproveitamos d e aplicamos na faixa.
  const [primeira] = posicoesLampadasX(2, larguraCoifa, p);
  const d = primeira + larguraCoifa / 2;
  if (n === 1) return [x0 + span / 2];
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
  let frente: Peca;
  {
    const W = arred(L - 2 * a);
    const corpo = A - 2 * a;
    const yRet = p.abaTopo + corpo;                 // fim do corpo
    const yPainel = yRet + p.frenteRetorno;         // início do painel de baixo
    const yAba = yPainel + p.frentePainel;
    const yBainha = yAba + p.frenteAba;
    const H = arred(yBainha + p.frenteBainha);
    const r = p.frentePainelRecuo, aw = p.alivioLargura, ah = p.alivioAltura;
    const contorno: Ponto[] = [
      [0, 0], [W, 0], [W, yPainel], [W - aw, yPainel + ah], [W - r + aw, yPainel + ah], [W - r, yPainel],
      [W - r, H], [r, H], [r, yPainel], [r - aw, yPainel + ah], [aw, yPainel + ah], [0, yPainel], [0, 0],
    ].map(([x, y]) => [arred(x), toY(H, y)] as Ponto);

    const furos: FuroPeca[] = [];
    // Lâmpadas da frente: no painel de baixo, medidas a partir das bordas do painel.
    const yLamp = toY(H, yPainel + p.frentePainel / 2);
    lampadasNaFaixa(lamp.frente, r, W - r, L, p).forEach((x) => furos.push({ x: arred(x), y: yLamp, d: dL }));
    // Botões/botoeira.
    if (nBot > 0) {
      const [lado, alinh] = (e.posicaoComando ?? 'frente-centro').split('-') as ['frente' | 'embaixo', 'esquerda' | 'centro' | 'direita'];
      const dia = e.tipoControle === 'botoeira' ? p.furoBotoeira : p.furoBotao;
      const nF = e.tipoControle === 'botoeira' ? FURO_PADRAO.botoesPorBotoeira : nBot;
      const passo = dia + p.espacoBotoeira;
      const total = (nF - 1) * passo;
      const margem = 80;
      const cx = alinh === 'esquerda' ? margem + total / 2 : alinh === 'direita' ? W - margem - total / 2 : W / 2;
      // Frente: no corpo, 45mm acima da dobra de baixo. Embaixo: no painel de baixo.
      const yCmd = lado === 'frente' ? toY(H, yRet - 45) : yLamp;
      for (let i = 0; i < nF; i++) furos.push({ x: arred(cx - total / 2 + i * passo), y: yCmd, d: dia });
    }

    const dobras: Peca['dobras'] = [p.abaTopo, yRet, yPainel].map((y) => [0, toY(H, y), W, toY(H, y)] as [number, number, number, number]);
    [yAba, yBainha].forEach((y) => dobras.push([r, toY(H, y), W - r, toY(H, y)]));
    todosFurosDentro('Frente', contorno, furos, avisos);
    frente = { id: 'FRENTE', nome: 'FRENTE', bitola: 22, w: W, h: H, contorno, furos, dobras };
  }

  // ── COSTA (24): retorno de baixo de 100, degrau e aba mais estreita. ──────
  let costa: Peca;
  {
    const W = arred(L - 2 * a);
    const corpo = A - 2 * a;
    const yRet = p.abaTopo + corpo;
    const yEsc = yRet + p.costaRetorno + p.costaDegrau;
    const yFim = yEsc + p.costaAba + 2 * p.costaBainha;
    const H = arred(yFim);
    const c = p.costaRecuo;
    const contorno: Ponto[] = [
      [0, 0], [W, 0], [W, yEsc], [W - c, yEsc], [W - c, yFim], [c, yFim], [c, yEsc], [0, yEsc], [0, 0],
    ].map(([x, y]) => [arred(x), toY(H, y)] as Ponto);
    const furos: FuroPeca[] = [];
    // Lâmpadas do fundo (Ilha ou "junto à parede"): no retorno de baixo.
    const yLamp = toY(H, yRet + p.costaRetorno / 2);
    lampadasNaFaixa(lamp.fundo, 0, W, L, p).forEach((x) => furos.push({ x: arred(x), y: yLamp, d: dL }));
    const dobras: Peca['dobras'] = [p.abaTopo, yRet, yRet + p.costaRetorno, yRet + p.costaRetorno + p.costaDegrau + p.costaAba, yRet + p.costaRetorno + p.costaDegrau + p.costaAba + p.costaBainha]
      .map((y, i) => (i >= 3 ? [c, toY(H, y), W - c, toY(H, y)] : [0, toY(H, y), W, toY(H, y)]) as [number, number, number, number]);
    todosFurosDentro('Costa', contorno, furos, avisos);
    costa = { id: 'COSTA', nome: 'COSTA', bitola: 24, w: W, h: H, contorno, furos, dobras };
  }

  // ── LATERAIS (22): 1 dobra → P − acréscimo; aba lateral de 20 e aba de cima. ─
  const lateral = (lado: 'ESQ' | 'DIR'): Peca => {
    const Wb = arred(P - a);
    const Wt = arred(Wb + p.lateralAba);
    const H = arred(p.abaTopo + (A - a));
    // Esquerda: aba lateral à direita. Direita: espelhada.
    const base: Ponto[] = [
      [0, 0], [Wb, 0], [Wb, p.abaTopo], [Wt, p.abaTopo], [Wt, H], [0, H], [0, 0],
    ];
    const pts = base.map(([x, y]) => [arred(lado === 'ESQ' ? x : Wt - x), toY(H, y)] as Ponto);
    const xb = lado === 'ESQ' ? Wb : Wt - Wb;
    const dobras: Peca['dobras'] = [
      lado === 'ESQ' ? [0, toY(H, p.abaTopo), Wb, toY(H, p.abaTopo)] : [Wt - Wb, toY(H, p.abaTopo), Wt, toY(H, p.abaTopo)],
      [xb, 0, xb, toY(H, p.abaTopo)],
    ];
    return { id: `LAT_${lado}`, nome: `LAT. ${lado === 'ESQ' ? 'ESQ' : 'DIR'}`, bitola: 22, w: Wt, h: H, contorno: pts, furos: [], dobras };
  };

  // ── TAMPA = teto (24): retângulo (L − 20) × (P − 20). ──────────────────────
  const tw = arred(L - p.tampaFolga), th = arred(P - p.tampaFolga);
  const tampa: Peca = {
    id: 'TAMPA', nome: 'TAMPA', bitola: 24, w: tw, h: th,
    contorno: [[0, 0], [tw, 0], [tw, th], [0, th], [0, 0]], furos: [], dobras: [],
  };

  return { pecas: [frente, costa, lateral('ESQ'), lateral('DIR'), tampa], avisos };
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
      for (const girada of [false, true]) {
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
    if (!((w <= areaW && h <= areaH) || (h <= areaW && w <= areaH))) {
      avisos.push(`${peca.nome} (${peca.w} × ${peca.h}) não cabe numa chapa de ${comprimento} × ${largura}.`);
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
 * Gera o DXF de uma chapa: contornos e furos na camada CORTE, marcas de dobra
 * de 1mm nas bordas (como o desenho do Adriano) na camada MARCAS. Com
 * `linhasDeDobra`, também as linhas inteiras na camada DOBRA — NÃO ligue isso
 * se o programa de corte corta todas as camadas.
 */
export function dxfDaChapa(chapa: ChapaEncaixada, op: OpcoesDxf = {}): string {
  const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const linhas: string[] = [];
  const add = (...v: (string | number)[]) => v.forEach((x) => linhas.push(String(x)));
  const linha = (camada: string, a: Ponto, b: Ponto) => add(0, 'LINE', 8, camada, 10, f(a[0]), 20, f(a[1]), 30, 0, 11, f(b[0]), 21, f(b[1]), 31, 0);
  const circulo = (camada: string, c: Ponto, d: number) => add(0, 'CIRCLE', 8, camada, 10, f(c[0]), 20, f(c[1]), 30, 0, 40, f(d / 2));
  const texto = (camada: string, p: Ponto, h: number, t: string, girado = false) => add(0, 'TEXT', 8, camada, 10, f(p[0]), 20, f(p[1]), 30, 0, 40, f(h), 1, t, ...(girado ? [50, 90] : []));

  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'TABLES');
  add(0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0, 0, 'ENDTAB');
  const camadas: [string, number][] = [['0', 7], ['CORTE', 5], ['MARCAS', 3], ['DOBRA', 3], ['TEXTO', 7]];
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
      linha('MARCAS', P([x1, y1]), P([x1 + u[0], y1 + u[1]]));
      linha('MARCAS', P([x2 - u[0], y2 - u[1]]), P([x2, y2]));
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

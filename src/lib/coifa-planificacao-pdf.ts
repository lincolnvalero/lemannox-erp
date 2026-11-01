// PDF cotado da planificação (Levi, 01/11): resumo, desenho de cada chapa e uma
// página por peça com todas as cotas — para conferir e imprimir. Vetorial
// (jsPDF), A4 paisagem, tudo em mm. As linhas tracejadas são só referência: no
// DXF cada dobra tem apenas os piques de 1mm.

import { jsPDF } from 'jspdf';
import { pontoNaChapa, type ChapaEncaixada, type Peca } from './coifa-planificacao';
import type { ParametrosDesenho } from './coifa-desenho';

export interface DadosPdfPlanificacao {
  titulo: string;
  /** Linhas de resumo da coifa (medidas, aplicação, frisos…). */
  linhas: string[];
  pecas: Peca[];
  chapas: ChapaEncaixada[];
  avisos: string[];
  desenho: ParametrosDesenho;
  comprimentoChapa: number;
}

const PG_W = 297, PG_H = 210, MARGEM = 10;
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const espessura = (b: 22 | 24, p: ParametrosDesenho) => (b === 22 ? p.espessura22 : p.espessura24);

/** Valores ordenados e sem repetições (tolerância de 0,05 mm). */
function unicos(v: number[]): number[] {
  const o = [...v].sort((a, b) => a - b);
  return o.filter((x, i) => i === 0 || Math.abs(x - o[i - 1]) > 0.05);
}

function cabecalho(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(titulo, MARGEM, 14);
  if (subtitulo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(subtitulo, MARGEM, 19.5); }
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(MARGEM, 22, PG_W - MARGEM, 22);
}

// ── Cotas ───────────────────────────────────────────────────────────────────

interface Cena { X: (x: number) => number; Y: (y: number) => number; s: number }

function setaH(doc: jsPDF, x1: number, x2: number, y: number) {
  doc.line(x1, y, x2, y);
  [x1, x2].forEach((x) => doc.line(x, y - 1, x, y + 1));
}
function setaV(doc: jsPDF, y1: number, y2: number, x: number) {
  doc.line(x, y1, x, y2);
  [y1, y2].forEach((y) => doc.line(x - 1, y, x + 1, y));
}

/** Cadeia de cotas horizontal: `xs` em mm da peça, linha de cota em `yLinha` (mm da página). Rótulo só se couber. */
function cadeiaH(doc: jsPDF, c: Cena, xs: number[], yLinha: number, yPeca: number) {
  const v = unicos(xs);
  doc.setLineWidth(0.1); doc.setDrawColor(90);
  v.forEach((x) => doc.line(c.X(x), yPeca, c.X(x), yLinha + (yLinha > yPeca ? 1.2 : -1.2)));
  doc.setFontSize(6.5); doc.setTextColor(0);
  for (let i = 1; i < v.length; i++) {
    const a = c.X(v[i - 1]), b = c.X(v[i]);
    setaH(doc, a, b, yLinha);
    const txt = fmt(v[i] - v[i - 1]);
    if (b - a >= doc.getTextWidth(txt) + 0.8) doc.text(txt, (a + b) / 2, yLinha - 0.8, { align: 'center' });
    else doc.text(txt, (a + b) / 2, yLinha - 0.8 - (i % 2) * 2.4, { align: 'center' });
  }
}
/** Cadeia vertical: `ys` em mm da peça (y para cima), linha de cota em `xLinha`. */
function cadeiaV(doc: jsPDF, c: Cena, ys: number[], xLinha: number, xPeca: number) {
  const v = unicos(ys);
  doc.setLineWidth(0.1); doc.setDrawColor(90);
  v.forEach((y) => doc.line(xPeca, c.Y(y), xLinha + (xLinha > xPeca ? 1.2 : -1.2), c.Y(y)));
  doc.setFontSize(6.5); doc.setTextColor(0);
  for (let i = 1; i < v.length; i++) {
    const a = c.Y(v[i]), b = c.Y(v[i - 1]); // y cresce para cima → coordenada da página diminui
    setaV(doc, a, b, xLinha);
    const txt = fmt(v[i] - v[i - 1]);
    const lado = xLinha > xPeca ? 1 : -1;
    if (b - a >= 2.4) doc.text(txt, xLinha + lado * 0.9, (a + b) / 2 + 0.8, { align: lado > 0 ? 'left' : 'right' });
    else doc.text(txt, xLinha + lado * (0.9 + (i % 2) * 7), (a + b) / 2 + 0.8, { align: lado > 0 ? 'left' : 'right' });
  }
}

// ── Páginas ─────────────────────────────────────────────────────────────────

function paginaResumo(doc: jsPDF, d: DadosPdfPlanificacao) {
  cabecalho(doc, d.titulo, 'Planificação para corte - resumo');
  let y = 30;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  d.linhas.forEach((l) => { doc.text(l, MARGEM, y); y += 5; });
  y += 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  const col = [MARGEM, 95, 125, 160, 215];
  ['Peça', 'Chapa', 'Espessura', 'Medida aberta (L × A, mm)', 'Furos'].forEach((t, i) => doc.text(t, col[i], y));
  doc.setLineWidth(0.2); doc.line(MARGEM, y + 1.5, PG_W - MARGEM, y + 1.5);
  y += 6; doc.setFont('helvetica', 'normal');
  d.pecas.forEach((p) => {
    if (y > PG_H - 40) { doc.addPage(); cabecalho(doc, d.titulo, 'Planificação para corte - resumo (cont.)'); y = 30; }
    const furos = p.furos.length ? `${p.furos.length} (Ø${unicos(p.furos.map((f) => f.d)).map(fmt).join(' / Ø')})` : '-';
    [p.nome, String(p.bitola), `${fmt(espessura(p.bitola, d.desenho))} mm`, `${fmt(p.w)} × ${fmt(p.h)}`, furos].forEach((t, i) => doc.text(t, col[i], y));
    y += 5;
  });
  y += 4;
  doc.setFontSize(8);
  const notas = [
    `Chapas de ${d.comprimentoChapa} × ${d.desenho.larguraChapa} mm, margem ${fmt(d.desenho.margemChapa)} mm e ${fmt(d.desenho.espacoPecas)} mm entre peças. ${d.chapas.length} chapa(s).`,
    `Cada dobra tem apenas um pique de 1 mm em cada ponta (guia da dobradeira); as linhas tracejadas deste PDF são só referência.`,
    `A dobradeira acrescenta ${fmt(d.desenho.acrescimoDobra)} mm por dobra: peça aberta = medida acabada - dobras × ${fmt(d.desenho.acrescimoDobra)} mm.`,
    `Peças desenhadas sempre em pé (sentido do escovado). Chapa 22 = ${fmt(d.desenho.espessura22)} mm; chapa 24 = ${fmt(d.desenho.espessura24)} mm.`,
  ];
  notas.forEach((n) => { if (y > PG_H - 14) return; doc.text(n, MARGEM, y); y += 4.5; });
  d.avisos.forEach((a) => { if (y > PG_H - 10) return; doc.setTextColor(180, 0, 0); doc.text(`Aviso: ${a}`, MARGEM, y); y += 4.5; });
  doc.setTextColor(0);
}

function paginaChapa(doc: jsPDF, d: DadosPdfPlanificacao, ch: ChapaEncaixada) {
  cabecalho(
    doc, d.titulo,
    `Chapa ${ch.indice} - bitola ${ch.bitola} (${fmt(espessura(ch.bitola, d.desenho))} mm) - ${ch.comprimento} × ${ch.largura} mm - aproveitamento ${fmt(ch.aproveitamento)}%`,
  );
  const areaW = PG_W - 2 * MARGEM, areaH = PG_H - 30 - MARGEM;
  const s = Math.min(areaW / ch.comprimento, areaH / ch.largura);
  const x0 = MARGEM + (areaW - ch.comprimento * s) / 2, y0 = 26;
  const X = (x: number) => x0 + x * s, Y = (y: number) => y0 + (ch.largura - y) * s;
  doc.setLineWidth(0.4); doc.setDrawColor(120); doc.rect(X(0), Y(ch.largura), ch.comprimento * s, ch.largura * s);
  ch.pecas.forEach((pp) => {
    doc.setLineWidth(0.25); doc.setDrawColor(0);
    const pts = pp.peca.contorno.map((pt) => pontoNaChapa(pp, pt));
    for (let i = 0; i < pts.length - 1; i++) doc.line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]));
    pp.peca.furos.forEach((f) => { const [cx, cy] = pontoNaChapa(pp, [f.x, f.y]); doc.circle(X(cx), Y(cy), (f.d / 2) * s, 'S'); });
    const [cx, cy] = pontoNaChapa(pp, [pp.peca.w / 2, pp.peca.h / 2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0);
    doc.text(pp.peca.nome, X(cx), Y(cy) - 0.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.text(`${fmt(pp.peca.w)} × ${fmt(pp.peca.h)}`, X(cx), Y(cy) + 2.5, { align: 'center' });
  });
  // Cotas da chapa.
  doc.setFontSize(7);
  doc.text(`${ch.comprimento}`, X(ch.comprimento / 2), Y(0) + 4, { align: 'center' });
  doc.text(`${ch.largura}`, X(0) - 2, Y(ch.largura / 2), { align: 'right', angle: 90 });
}

function paginaPeca(doc: jsPDF, d: DadosPdfPlanificacao, p: Peca) {
  cabecalho(doc, d.titulo, `${p.nome} - ${fmt(p.w)} × ${fmt(p.h)} mm - chapa ${p.bitola} (${fmt(espessura(p.bitola, d.desenho))} mm) - medidas em mm, peça aberta`);
  // Área do desenho, deixando espaço para as cotas.
  const aL = 32, aR = 32, aT = 16, aB = 26;
  const areaW = PG_W - 2 * MARGEM - aL - aR, areaH = PG_H - 26 - MARGEM - aT - aB;
  const s = Math.min(areaW / p.w, areaH / p.h, 1);
  const x0 = MARGEM + aL + (areaW - p.w * s) / 2, y0 = 26 + aT + (areaH - p.h * s) / 2;
  const c: Cena = { s, X: (x) => x0 + x * s, Y: (y) => y0 + (p.h - y) * s };

  // Dobras (referência, tracejadas).
  doc.setLineWidth(0.15); doc.setDrawColor(0, 120, 0); doc.setLineDashPattern([2, 1.2], 0);
  p.dobras.forEach(([x1, y1, x2, y2]) => doc.line(c.X(x1), c.Y(y1), c.X(x2), c.Y(y2)));
  doc.setLineDashPattern([], 0);
  // Contorno e furos.
  doc.setLineWidth(0.45); doc.setDrawColor(0);
  for (let i = 0; i < p.contorno.length - 1; i++) doc.line(c.X(p.contorno[i][0]), c.Y(p.contorno[i][1]), c.X(p.contorno[i + 1][0]), c.Y(p.contorno[i + 1][1]));
  doc.setLineWidth(0.3);
  p.furos.forEach((f) => {
    doc.circle(c.X(f.x), c.Y(f.y), (f.d / 2) * s, 'S');
    doc.setLineWidth(0.1); const r = Math.max(1, (f.d / 2) * s + 1);
    doc.line(c.X(f.x) - r, c.Y(f.y), c.X(f.x) + r, c.Y(f.y)); doc.line(c.X(f.x), c.Y(f.y) - r, c.X(f.x), c.Y(f.y) + r);
    doc.setLineWidth(0.3);
  });

  const vx = p.contorno.map(([x]) => x), vy = p.contorno.map(([, y]) => y);
  const dobrasV = p.dobras.filter(([x1, , x2]) => Math.abs(x1 - x2) < 0.01).map(([x1]) => x1);
  const dobrasH = p.dobras.filter(([, y1, , y2]) => Math.abs(y1 - y2) < 0.01).map(([, y1]) => y1);
  const topo = c.Y(p.h), base = c.Y(0), esq = c.X(0), dir = c.X(p.w);

  // Embaixo: vértices + dobras verticais; depois a largura total.
  const xsBase = [0, p.w, ...vx, ...dobrasV];
  cadeiaH(doc, c, xsBase, base + 7, base);
  if (unicos(xsBase).length > 2) cadeiaH(doc, c, [0, p.w], base + 14, base);
  // À esquerda: vértices + dobras horizontais; depois a altura total.
  const ysEsq = [0, p.h, ...vy, ...dobrasH];
  cadeiaV(doc, c, ysEsq, esq - 8, esq);
  if (unicos(ysEsq).length > 2) cadeiaV(doc, c, [0, p.h], esq - 17, esq);
  // Furos: centros em cima (a partir da esquerda) e à direita (a partir da base).
  if (p.furos.length) {
    cadeiaH(doc, c, [0, ...p.furos.map((f) => f.x), p.w], topo - 7, topo);
    cadeiaV(doc, c, [0, ...p.furos.map((f) => f.y), p.h], dir + 8, dir);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0);
    const dias = unicos(p.furos.map((f) => f.d));
    dias.forEach((dia) => {
      const f = p.furos.find((q) => Math.abs(q.d - dia) < 0.01)!;
      doc.text(`Ø${fmt(dia)}`, c.X(f.x) + (dia / 2) * s + 1.5, c.Y(f.y) - (dia / 2) * s - 1, { align: 'left' });
    });
  }
  doc.setFontSize(7); doc.setTextColor(0, 120, 0);
  doc.text('--- dobra (referência)', PG_W - MARGEM, PG_H - 6, { align: 'right' });
  doc.setTextColor(0);
}

export function pdfDaPlanificacao(d: DadosPdfPlanificacao): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  paginaResumo(doc, d);
  d.chapas.forEach((ch) => { doc.addPage(); paginaChapa(doc, d, ch); });
  d.pecas.forEach((p) => { doc.addPage(); paginaPeca(doc, d, p); });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120);
    doc.text(`Página ${i}/${n}`, MARGEM, PG_H - 6);
  }
  return doc;
}

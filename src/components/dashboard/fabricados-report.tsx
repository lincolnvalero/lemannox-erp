'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FileDown, Filter, Package } from 'lucide-react';
import { getManufacturedItems } from '@/app/(dashboard)/production/actions';
import type { FabricadoItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Estrutura de agrupamento ──────────────────────────────────
type CategoryGroup = {
  categoria: string;
  items: FabricadoItem[];
  qty: number;    // soma das quantidades
  total: number;
};

type ClientGroup = {
  cliente: string;
  categories: CategoryGroup[];
  qty: number;
  total: number;
};

type CategorySummary = {
  categoria: string;
  qty: number;
  total: number;
};

// Resumo geral por categoria, somando todos os clientes do período — maior valor primeiro.
function summarizeByCategory(items: FabricadoItem[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const it of items) {
    const key = it.categoria || 'Sem categoria';
    const cur = map.get(key) ?? { categoria: key, qty: 0, total: 0 };
    cur.qty += Number(it.quantidade) || 1;
    cur.total += it.valor;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function groupData(items: FabricadoItem[]): ClientGroup[] {
  const clientMap = new Map<string, Map<string, FabricadoItem[]>>();

  for (const item of items) {
    if (!clientMap.has(item.cliente)) clientMap.set(item.cliente, new Map());
    const catMap = clientMap.get(item.cliente)!;
    if (!catMap.has(item.categoria)) catMap.set(item.categoria, []);
    catMap.get(item.categoria)!.push(item);
  }

  return Array.from(clientMap.entries()).map(([cliente, catMap]) => {
    const categories = Array.from(catMap.entries())
      .map(([categoria, its]) => {
        // Ordena itens de cada categoria por nº OS
        const sorted = [...its].sort((a, b) => {
          const aOs = a.osNumber ?? Infinity;
          const bOs = b.osNumber ?? Infinity;
          if (aOs !== bOs) return aOs - bOs;
          return a.pedido - b.pedido;
        });
        return {
          categoria,
          items: sorted,
          qty: sorted.reduce((s, i) => s + (Number(i.quantidade) || 1), 0),
          total: sorted.reduce((s, i) => s + i.valor, 0),
        };
      })
      // Ordena categorias pelo menor nº OS que contém
      .sort((a, b) => {
        const aMin = Math.min(...a.items.map(i => i.osNumber ?? Infinity));
        const bMin = Math.min(...b.items.map(i => i.osNumber ?? Infinity));
        return aMin - bMin;
      });

    return {
      cliente,
      categories,
      qty: categories.reduce((s, c) => s + c.qty, 0),
      total: categories.reduce((s, c) => s + c.total, 0),
    };
  });
}

function fmtDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}
function fmtDateBR(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

// ─── HTML de impressão ─────────────────────────────────────────
function generatePrintHtml(
  groups: ClientGroup[],
  categorySummary: CategorySummary[],
  grand: { qty: number; total: number },
  startDate: string,
  endDate: string
): string {
  const rows = groups
    .map((g) => {
      const catRows = g.categories
        .map((cat) => {
          const itemRows = cat.items
            .map(
              (it) => `
            <tr class="item">
              <td class="mono center">${it.osNumber ? `#${it.osNumber}` : '—'}</td>
              <td class="mono center">#${it.pedido}</td>
              <td>${it.obra || '—'}</td>
              <td class="right mono">${it.quantidade}</td>
              <td>${it.produto}</td>
              <td class="right mono">${fmtDate(it.dataConclusao)}</td>
              <td class="right mono">${formatCurrency(it.valor)}</td>
            </tr>`
            )
            .join('');
          return `
          <tr class="cat-hdr">
            <td colspan="7">${cat.categoria} — ${cat.qty} un. — ${formatCurrency(cat.total)}</td>
          </tr>
          ${itemRows}`;
        })
        .join('');

      return `
      <tr class="client-hdr">
        <td colspan="7">${g.cliente}</td>
      </tr>
      ${catRows}
      <tr class="subtotal">
        <td colspan="4">${g.qty} unidade${g.qty !== 1 ? 's' : ''}</td>
        <td class="right">Subtotal</td>
        <td></td>
        <td class="right mono">${formatCurrency(g.total)}</td>
      </tr>`;
    })
    .join('');

  const summaryRows = categorySummary
    .map(
      (c) => `
    <tr class="subtotal">
      <td colspan="4">${c.categoria} — ${c.qty} unidade${c.qty !== 1 ? 's' : ''}</td>
      <td class="right">Total</td>
      <td></td>
      <td class="right mono">${formatCurrency(c.total)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Produtos Fabricados — Lemannox</title>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; }

  .report-header { display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 10mm; border-bottom: 2px solid #1e3a5f; padding-bottom: 4mm; }
  .company { font-size: 18pt; font-weight: 700; color: #1e3a5f; letter-spacing: -0.5px; }
  .report-title { font-size: 11pt; color: #555; margin-top: 1mm; }
  .report-meta { text-align: right; color: #555; font-size: 8.5pt; line-height: 1.6; }

  table { width: 100%; border-collapse: collapse; }
  thead th { background: #1e3a5f; color: #fff; padding: 5px 7px;
    text-align: left; font-size: 8.5pt; font-weight: 600; }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }

  tr.client-hdr td { background: #dde7f5; color: #1e3a5f; font-weight: 700;
    font-size: 9.5pt; padding: 5px 7px;
    border-top: 1.5px solid #1e3a5f; border-bottom: 1px solid #b8cde8; }
  tr.cat-hdr td { background: #f0f4fa; color: #3a5a8f; font-weight: 600;
    font-size: 8.5pt; padding: 3.5px 7px 3.5px 14px;
    border-bottom: 1px solid #d0daea; font-style: italic; }
  tr.item td { padding: 3.5px 7px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }
  tr.item:nth-child(even) { background: #fafafa; }
  tr.subtotal td { background: #f0f0f0; font-weight: 600; font-size: 8.5pt;
    padding: 4px 7px; border-top: 1px solid #ccc; border-bottom: 2px solid #ccc; color: #333; }
  tr.grand td { background: #1e3a5f; color: #fff; font-weight: 700;
    font-size: 10pt; padding: 6px 7px; border-top: 2px solid #1e3a5f; }

  .mono { font-family: 'Courier New', Courier, monospace; }
  .right { text-align: right; }
  .center { text-align: center; }

  @media print { tr.client-hdr { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="report-header">
  <div>
    <div class="company">LEMANNOX</div>
    <div class="report-title">Relatório de Produtos Fabricados</div>
  </div>
  <div class="report-meta">
    Período: ${fmtDateBR(startDate)} a ${fmtDateBR(endDate)}<br>
    Gerado em: ${new Date().toLocaleDateString('pt-BR')}<br>
    Total: ${grand.qty} unidade${grand.qty !== 1 ? 's' : ''}
  </div>
</div>
<table>
  <thead>
    <tr>
      <th class="center" style="width:60px">Nº OS</th>
      <th class="center" style="width:66px">Pedido</th>
      <th style="width:90px">Obra</th>
      <th class="right" style="width:46px">Qtd.</th>
      <th>Produto</th>
      <th class="right" style="width:92px">Conclusão</th>
      <th class="right" style="width:110px">Valor</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand">
      <td colspan="4">Total Geral — ${grand.qty} unidade${grand.qty !== 1 ? 's' : ''}</td>
      <td class="right">Total</td>
      <td></td>
      <td class="right mono">${formatCurrency(grand.total)}</td>
    </tr>
  </tbody>
</table>

<div style="margin-top:10mm">
  <div style="font-size:11pt;font-weight:700;color:#1e3a5f;margin-bottom:2mm;">Resumo Geral por Categoria</div>
  <table>
    <tbody>
      ${summaryRows}
      <tr class="grand">
        <td colspan="4">Total Geral — ${grand.qty} unidade${grand.qty !== 1 ? 's' : ''}</td>
        <td class="right">Total</td>
        <td></td>
        <td class="right mono">${formatCurrency(grand.total)}</td>
      </tr>
    </tbody>
  </table>
</div>
</body>
</html>`;
}

// ─── Componente principal ──────────────────────────────────────
export function FabricadosReport() {
  const { toast } = useToast();

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const defaultEnd = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [items, setItems] = useState<FabricadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const groups = useMemo(() => groupData(items), [items]);
  const categorySummary = useMemo(() => summarizeByCategory(items), [items]);
  const grand = useMemo(
    () => ({
      qty: items.reduce((s, i) => s + (Number(i.quantidade) || 1), 0),
      total: items.reduce((s, i) => s + i.valor, 0),
    }),
    [items]
  );

  const handleFilter = async () => {
    setLoading(true);
    const result = await getManufacturedItems(startDate, endDate);
    if (result.success) {
      setItems(result.items ?? []);
      setLoaded(true);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao buscar dados', description: result.error });
    }
    setLoading(false);
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();

      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, W, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('LEMANNOX', 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório de Produtos Fabricados', 14, 16);
      doc.text(
        `Período: ${fmtDateBR(startDate)} a ${fmtDateBR(endDate)}   |   Gerado: ${new Date().toLocaleDateString('pt-BR')}`,
        W - 14, 16, { align: 'right' }
      );

      type AutoRow = (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[];
      const body: AutoRow[] = [];

      for (const g of groups) {
        body.push([{
          content: g.cliente,
          colSpan: 7,
          styles: { fillColor: [221, 231, 245], textColor: [30, 58, 95], fontStyle: 'bold', fontSize: 9 },
        }]);

        for (const cat of g.categories) {
          body.push([{
            content: `  ${cat.categoria} — ${cat.qty} un. — ${formatCurrency(cat.total)}`,
            colSpan: 7,
            styles: { fillColor: [240, 244, 250], textColor: [60, 90, 143], fontStyle: 'italic', fontSize: 8 },
          }]);

          for (const it of cat.items) {
            body.push([
              it.osNumber ? `#${it.osNumber}` : '—',
              `#${it.pedido}`,
              it.obra || '—',
              String(it.quantidade),
              it.produto,
              fmtDate(it.dataConclusao),
              formatCurrency(it.valor),
            ]);
          }
        }

        body.push([
          {
            content: `${g.qty} unidade${g.qty !== 1 ? 's' : ''}`,
            colSpan: 4,
            styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] },
          },
          {
            content: 'Subtotal',
            styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 8, halign: 'right', textColor: [80, 80, 80] },
          },
          { content: '', styles: { fillColor: [240, 240, 240] } },
          {
            content: formatCurrency(g.total),
            styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 8, halign: 'right' },
          },
        ]);
      }

      body.push([
        {
          content: `Total Geral — ${grand.qty} unidade${grand.qty !== 1 ? 's' : ''}`,
          colSpan: 4,
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        },
        {
          content: 'Total',
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'right' },
        },
        { content: '', styles: { fillColor: [30, 58, 95] } },
        {
          content: formatCurrency(grand.total),
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'right' },
        },
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Nº OS', 'Pedido', 'Obra', 'Qtd.', 'Produto', 'Conclusão', 'Valor']],
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center', font: 'courier' },
          1: { cellWidth: 20, halign: 'center', font: 'courier' },
          2: { cellWidth: 28 },
          3: { cellWidth: 14, halign: 'right', font: 'courier' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 32, halign: 'right', font: 'courier' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index % 2 === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = data.cell.styles as any;
            if (!s.fillColor) s.fillColor = [250, 250, 250];
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mainTableEndY = (doc as any).lastAutoTable.finalY as number;
      const pageHeight = doc.internal.pageSize.getHeight();
      let summaryY = mainTableEndY + 12;
      if (summaryY > pageHeight - 40) {
        doc.addPage();
        summaryY = 20;
      }

      doc.setTextColor(30, 58, 95);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Geral por Categoria', 14, summaryY);

      const summaryBody: AutoRow[] = categorySummary.map((c) => [
        { content: `${c.categoria} — ${c.qty} unidade${c.qty !== 1 ? 's' : ''}`, colSpan: 4 },
        { content: 'Total', styles: { halign: 'right' } },
        { content: '' },
        { content: formatCurrency(c.total), styles: { halign: 'right' } },
      ]);
      summaryBody.push([
        {
          content: `Total Geral — ${grand.qty} unidade${grand.qty !== 1 ? 's' : ''}`,
          colSpan: 4,
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        },
        {
          content: 'Total',
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'right' },
        },
        { content: '', styles: { fillColor: [30, 58, 95] } },
        {
          content: formatCurrency(grand.total),
          styles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'right' },
        },
      ]);

      autoTable(doc, {
        startY: summaryY + 4,
        body: summaryBody,
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 3: { cellWidth: 32, font: 'courier' } },
        didParseCell: (data) => {
          if (data.row.index % 2 === 0 && data.row.index !== categorySummary.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = data.cell.styles as any;
            if (!s.fillColor) s.fillColor = [250, 250, 250];
          } else if (data.row.index !== categorySummary.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = data.cell.styles as any;
            if (!s.fillColor) s.fillColor = [240, 240, 240];
          }
        },
      });

      doc.save(`fabricados-${startDate}-${endDate}.pdf`);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro ao gerar PDF' });
    }
    setPdfLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            className="h-9 w-40 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            className="h-9 w-40 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={handleFilter} disabled={loading} className="h-9">
          <Filter className="mr-2 h-4 w-4" />
          {loading ? 'Buscando…' : 'Filtrar'}
        </Button>

        {loaded && items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 ml-auto"
            onClick={handleExportPdf}
            disabled={pdfLoading}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {pdfLoading ? 'Gerando…' : 'Exportar PDF'}
          </Button>
        )}
      </div>

      {/* Estados */}
      {!loaded ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm">Selecione o período e clique em Filtrar para gerar o relatório.</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum produto fabricado no período selecionado.</p>
        </div>
      ) : (
        <>
          {/* Sumário */}
          <div className="flex items-center gap-6 rounded-lg border bg-primary/5 px-5 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Total de unidades</p>
              <p className="text-xl font-bold">{grand.qty}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Valor total fabricado</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(grand.total)}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-xl font-bold">{groups.length}</p>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="py-3 px-3 text-center font-medium w-[72px]">Nº OS</th>
                    <th className="py-3 px-3 text-center font-medium w-[80px]">Pedido</th>
                    <th className="py-3 px-3 text-left font-medium w-[100px]">Obra</th>
                    <th className="py-3 px-3 text-center font-medium w-[60px]">Qtd.</th>
                    <th className="py-3 px-3 text-left font-medium">Produto</th>
                    <th className="py-3 px-3 text-left font-medium w-[110px]">Conclusão</th>
                    <th className="py-3 px-3 text-right font-medium w-[120px]">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <React.Fragment key={g.cliente}>
                      {/* Cabeçalho do cliente */}
                      <tr className="border-t-2 border-primary/30 bg-primary/10">
                        <td colSpan={6} className="py-2.5 px-3 font-semibold text-primary text-[13px] tracking-wide">
                          {g.cliente}
                        </td>
                      </tr>

                      {g.categories.map((cat) => (
                        <React.Fragment key={`${g.cliente}-${cat.categoria}`}>
                          {/* Sub-cabeçalho da categoria */}
                          <tr className="bg-muted/20 border-b border-border/30">
                            <td colSpan={3} className="py-1.5 px-3 pl-6 text-xs font-medium text-muted-foreground italic">
                              {cat.categoria}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-center font-semibold text-muted-foreground">
                              {cat.qty}
                            </td>
                            <td colSpan={2} className="py-1.5 px-3 text-xs text-muted-foreground italic"></td>
                            <td className="py-1.5 px-3 text-xs text-right font-semibold text-muted-foreground font-mono">
                              {formatCurrency(cat.total)}
                            </td>
                          </tr>

                          {/* Itens da categoria */}
                          {cat.items.map((it, idx) => (
                            <tr
                              key={`${it.quoteId}-${idx}`}
                              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                            >
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground text-center">
                                {it.osNumber ? `#${it.osNumber}` : '—'}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground text-center">
                                #{it.pedido}
                              </td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">
                                {it.obra || '—'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-sm font-medium">
                                {it.quantidade}
                              </td>
                              <td className="py-2 px-3 leading-snug">{it.produto}</td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">
                                {fmtDate(it.dataConclusao)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-sm">
                                {formatCurrency(it.valor)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}

                      {/* Subtotal do cliente */}
                      <tr className="bg-muted/30 border-b-2 border-border/60">
                        <td colSpan={4} className="py-2 px-3 text-xs text-muted-foreground italic">
                          {g.qty} unidade{g.qty !== 1 ? 's' : ''}
                        </td>
                        <td className="py-2 px-3 text-xs text-right text-muted-foreground font-medium">
                          Subtotal
                        </td>
                        <td></td>
                        <td className="py-2 px-3 text-right font-semibold font-mono text-sm">
                          {formatCurrency(g.total)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}

                  {/* Total geral */}
                  <tr className="bg-primary/10 border-t-2 border-primary/30">
                    <td colSpan={4} className="py-3 px-3 font-bold text-sm">
                      Total Geral — {grand.qty} unidade{grand.qty !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sm">Total</td>
                    <td></td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-base">
                      {formatCurrency(grand.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumo geral por categoria */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Resumo Geral por Categoria</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="py-2.5 px-3 text-left font-medium">Categoria</th>
                    <th className="py-2.5 px-3 text-center font-medium w-[100px]">Qtd.</th>
                    <th className="py-2.5 px-3 text-right font-medium w-[140px]">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.map((c) => (
                    <tr key={c.categoria} className="border-b border-border/30">
                      <td className="py-2 px-3">{c.categoria}</td>
                      <td className="py-2 px-3 text-center font-mono">{c.qty}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10 border-t-2 border-primary/30">
                    <td className="py-3 px-3 font-bold text-sm">Total Geral</td>
                    <td className="py-3 px-3 text-center font-bold font-mono text-sm">{grand.qty}</td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-base">
                      {formatCurrency(grand.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

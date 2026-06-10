'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import type { ScheduleItem } from '@/lib/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleItem[];
};

// Parse date-only strings (YYYY-MM-DD) sem conversão de fuso
function fmtDateOnly(s: string): string {
  if (!s) return '—';
  const part = s.split('T')[0];
  const [y, m, d] = part.split('-');
  return `${d}/${m}/${y}`;
}

// Parse ISO timestamp para data local (evita UTC shift)
function fmtIsoLocal(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ExportSchedulePdfDialog({ open, onOpenChange, schedule }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Lemannox ERP — Programação de Produção', 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

      autoTable(doc, {
        startY: 35,
        head: [['Pedido', 'OS', 'Cliente', 'Obra', 'Produto', 'Material', 'Previsão', 'Concluído', 'Entregue']],
        body: schedule.map(s => [
          `#${s.pedido}`,
          s.osNumber ? String(s.osNumber) : '—',
          s.cliente,
          s.obra || '—',
          s.produto,
          s.material || '—',
          fmtDateOnly(s.previsao),
          fmtIsoLocal(s.concluidoEm),
          fmtIsoLocal(s.entregueEm),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [45, 55, 90] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 14 },
          6: { cellWidth: 22 },
          7: { cellWidth: 22 },
          8: { cellWidth: 22 },
        },
      });
      doc.save(`programacao-producao-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Programação</DialogTitle>
          <DialogDescription>{schedule.length} itens na programação atual</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading || schedule.length === 0}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

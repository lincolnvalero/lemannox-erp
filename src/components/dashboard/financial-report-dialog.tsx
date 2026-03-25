'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2 } from 'lucide-react';
import type { FinancialTransaction, ChartOfAccount } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: FinancialTransaction[];
  accounts?: ChartOfAccount[];
};

export function FinancialReportDialog({ open, onOpenChange, transactions }: Props) {
  const [loading, setLoading] = useState(false);

  const paid = transactions.filter(t => t.status === 'pago');
  const entradas = paid.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = paid.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Lemannox ERP — Relatório Financeiro', 14, 20);
      doc.setFontSize(11);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
      doc.setFontSize(12);
      doc.text(`Total de Receitas: ${formatCurrency(entradas)}`, 14, 42);
      doc.text(`Total de Despesas: ${formatCurrency(saidas)}`, 14, 50);
      doc.text(`Saldo: ${formatCurrency(entradas - saidas)}`, 14, 58);
      autoTable(doc, {
        startY: 68,
        head: [['Nº', 'Descrição', 'Categoria', 'Data', 'Tipo', 'Valor']],
        body: paid.map(t => [t.idLanc || '-', t.description, t.category, formatDate(t.transactionDate), t.type === 'entrada' ? 'Receita' : 'Despesa', formatCurrency(t.amount)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [45, 55, 90] },
      });
      doc.save(`relatorio-financeiro-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Relatório Financeiro</DialogTitle>
          <DialogDescription>Resumo das transações pagas</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Receitas:</span><span className="text-green-400 font-mono">{formatCurrency(entradas)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Despesas:</span><span className="text-destructive font-mono">{formatCurrency(saidas)}</span></div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2"><span>Saldo:</span><span className={`font-mono ${entradas - saidas >= 0 ? 'text-green-400' : 'text-destructive'}`}>{formatCurrency(entradas - saidas)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Loader2 } from 'lucide-react';
import type { FinancialTransaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: FinancialTransaction[];
};

export function ExportTransactionsPdfDialog({ open, onOpenChange, transactions }: Props) {
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const handleExport = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Lemannox ERP — Extrato de Transações', 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

      const filtered = typeFilter === 'all' ? transactions : transactions.filter(t => t.type === typeFilter);

      autoTable(doc, {
        startY: 35,
        head: [['Nº', 'Descrição', 'Categoria', 'Data', 'Vencimento', 'Tipo', 'Status', 'Valor']],
        body: filtered.map(t => [
          t.idLanc || '-',
          t.description,
          t.category,
          formatDate(t.transactionDate),
          formatDate(t.dueDate),
          t.type === 'entrada' ? 'Receita' : 'Despesa',
          t.status === 'pago' ? 'Pago' : 'Pendente',
          formatCurrency(t.amount),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [45, 55, 90] },
      });

      doc.save(`transacoes-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Transações</DialogTitle>
          <DialogDescription>Configure e baixe o PDF do extrato</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Filtrar por tipo</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="entrada">Apenas Receitas</SelectItem>
                <SelectItem value="saida">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

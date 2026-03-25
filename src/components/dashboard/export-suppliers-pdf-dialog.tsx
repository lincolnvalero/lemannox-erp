'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
};

export function ExportSuppliersPdfDialog({ open, onOpenChange, suppliers }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Lemannox ERP — Lista de Fornecedores', 14, 20);
      autoTable(doc, {
        startY: 30,
        head: [['Nome', 'Categoria', 'Contato', 'Telefone', 'E-mail', 'Avaliação', 'Total Gasto']],
        body: suppliers.map(s => [s.name, s.category, s.contactName, s.phone, s.email || '-', s.rating?.toFixed(1) || '-', formatCurrency(s.totalSpent)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [45, 55, 90] },
      });
      doc.save(`fornecedores-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Fornecedores</DialogTitle>
          <DialogDescription>{suppliers.length} fornecedores cadastrados</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading || suppliers.length === 0}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

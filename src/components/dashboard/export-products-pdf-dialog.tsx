"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Product } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: string[];
  materials: string[];
}

export function ExportProductsPdfDialog({
  open,
  onOpenChange,
  products,
  categories,
  materials,
}: Props) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(categories)
  );
  const [loading, setLoading] = useState(false);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedCategories(new Set(categories));
  }

  function clearAll() {
    setSelectedCategories(new Set());
  }

  async function handleExport() {
    setLoading(true);

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("LEMANNOX — Tabela de Produtos", 14, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      14,
      22
    );

    const filteredProducts = products.filter((p) =>
      selectedCategories.has(p.category)
    );

    const matColumns = materials.map((mat) => ({ header: mat, dataKey: mat }));

    const columns = [
      { header: "Categoria", dataKey: "category" },
      { header: "Modelo", dataKey: "model" },
      { header: "Medida", dataKey: "measurement" },
      ...matColumns,
    ];

    const rows = filteredProducts.map((p) => {
      const row: Record<string, string> = {
        category: p.category,
        model: p.model,
        measurement: p.measurement,
      };

      for (const mat of materials) {
        const variation = p.variations.find((v) => v.material === mat);
        row[mat] = variation
          ? variation.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "—";
      }

      return row;
    });

    autoTable(doc, {
      startY: 28,
      columns,
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [30, 30, 40],
        textColor: [220, 220, 220],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 248],
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`lemannox-produtos-${Date.now()}.pdf`);
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Exportar Tabela de Produtos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-zinc-400 text-xs h-7 px-2"
              onClick={selectAll}
            >
              Selecionar todas
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-zinc-400 text-xs h-7 px-2"
              onClick={clearAll}
            >
              Limpar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <Checkbox
                  id={`cat-${cat}`}
                  checked={selectedCategories.has(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                  className="border-zinc-600"
                />
                <Label
                  htmlFor={`cat-${cat}`}
                  className="text-sm text-zinc-300 cursor-pointer leading-none"
                >
                  {cat}
                </Label>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-500">
            {selectedCategories.size} de {categories.length} categorias selecionadas &middot;{" "}
            {products.filter((p) => selectedCategories.has(p.category)).length} produtos
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || selectedCategories.size === 0}
          >
            {loading ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

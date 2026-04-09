'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStockMovements } from '@/app/(dashboard)/materials/stock-actions';
import type { StockMovement } from '@/lib/types';

export default function HistoricoComprasPage() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const result = await getStockMovements();
      if (result.success) {
        setMovements((result.movements ?? []).filter(m => m.movementType === 'entrada'));
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
      setLoading(false);
    })();
  }, [toast]);

  const filtered = movements.filter(m =>
    !search ||
    m.materialName?.toLowerCase().includes(search.toLowerCase()) ||
    m.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
    m.reference?.toLowerCase().includes(search.toLowerCase())
  );

  // Resumo por fornecedor
  const supplierSummary = filtered.reduce<Record<string, { total: number; count: number }>>((acc, m) => {
    const key = m.supplierName || 'Sem fornecedor';
    const prev = acc[key] ?? { total: 0, count: 0 };
    acc[key] = { total: prev.total + (m.totalCost ?? 0), count: prev.count + 1 };
    return acc;
  }, {});

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 max-w-sm"
          placeholder="Buscar por material, fornecedor ou referência..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {Object.keys(supplierSummary).length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Object.entries(supplierSummary)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 4)
            .map(([name, v]) => (
              <Card key={name}>
                <CardHeader className="pb-1"><CardDescription className="truncate">{name}</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{fmt(v.total)}</p>
                  <p className="text-xs text-muted-foreground">{v.count} compras</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Compras por Fornecedor</CardTitle>
          <CardDescription>
            Todas as entradas de estoque com preço pago. Registradas em Materiais → ícone de movimentação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {movements.length === 0
                      ? 'Nenhuma compra registrada ainda. Registre entradas de estoque na página de Materiais.'
                      : 'Nenhum resultado para a busca.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{m.supplierName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{m.materialName}</TableCell>
                  <TableCell className="text-center font-mono">{m.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{m.unitCost ? fmt(m.unitCost) : '—'}</TableCell>
                  <TableCell className="text-right font-mono">{m.totalCost ? fmt(m.totalCost) : '—'}</TableCell>
                  <TableCell>
                    {m.reference ? <Badge variant="outline">{m.reference}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

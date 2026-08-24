'use client';

import { useState, useEffect, useMemo } from 'react';
import { HardHat, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getMaoDeObra, updateMaoDeObraValor } from '@/app/(dashboard)/calculator/actions';
import type { MaoDeObraRow } from '@/lib/types';

const MODELOS: MaoDeObraRow['modelo'][] = ['Box', 'Piramidal', 'Linea', 'Tube', 'Ilha'];

const LABELS: Record<MaoDeObraRow['modelo'], string> = {
  Box: 'Box',
  Piramidal: 'Piramidal',
  Linea: 'Línea',
  Tube: 'Tube',
  Ilha: 'Acréscimo — Instalação Ilha',
};

export default function MaoDeObraPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [rows, setRows] = useState<MaoDeObraRow[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const result = await getMaoDeObra();
    if (result.success && result.rows) {
      setRows(result.rows);
      setValues(Object.fromEntries(result.rows.map(r => [r.id, r.valor])));
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar mão de obra', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const porModelo = useMemo(() => {
    const map: Record<string, MaoDeObraRow[]> = {};
    for (const modelo of MODELOS) {
      map[modelo] = rows.filter(r => r.modelo === modelo).sort((a, b) => a.medida - b.medida);
    }
    return map;
  }, [rows]);

  const handleSave = async (row: MaoDeObraRow) => {
    setSaving(row.id);
    const result = await updateMaoDeObraValor(row.id, values[row.id] ?? row.valor);
    if (result.success) {
      toast({ title: 'Valor salvo!', description: `${LABELS[row.modelo]} — ${row.medida}mm atualizado.` });
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
    setSaving(null);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HardHat className="h-6 w-6" />
          Tabela de Mão de Obra — Coifas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Valor de mão de obra por modelo e medida (largura). &quot;Ilha&quot; não é um modelo — é o
          acréscimo somado quando a instalação é em Ilha, independente do modelo escolhido.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="Box">
          <TabsList>
            {MODELOS.map(modelo => <TabsTrigger key={modelo} value={modelo}>{LABELS[modelo]}</TabsTrigger>)}
          </TabsList>
          {MODELOS.map(modelo => (
            <TabsContent key={modelo} value={modelo}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{LABELS[modelo]}</CardTitle>
                  <CardDescription>Valor de mão de obra (R$) por medida (mm).</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {porModelo[modelo]?.map(row => (
                    <div key={row.id} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs text-muted-foreground">{row.medida}mm</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={values[row.id] ?? row.valor}
                          onChange={(e) => setValues(v => ({ ...v, [row.id]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <Button size="icon" variant="outline" disabled={saving === row.id} onClick={() => handleSave(row)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(!porModelo[modelo] || porModelo[modelo].length === 0) && (
                    <p className="text-sm text-muted-foreground col-span-full">Nenhuma medida cadastrada para este modelo.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

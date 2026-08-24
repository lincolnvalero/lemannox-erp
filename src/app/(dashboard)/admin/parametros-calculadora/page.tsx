'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getCalculatorReferenceData, updateParametroGlobal } from '@/app/(dashboard)/calculator/actions';

// Agrupamento apenas para organizar a tela — a chave real é o que é salvo.
// Os preços de iluminação (lâmpada, fonte, botoeira, botão, chicote) saíram
// daqui — agora vêm do Estoque (materials, categoria "Elétrico Coifa"),
// para ficar no mesmo lugar onde as chapas já são reajustadas.
const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: 'Margem e Pintura', chaves: ['margem_lucro_padrao', 'pintura_padrao'] },
  { titulo: 'Friso decorativo', chaves: ['preco_friso_por_cm'] },
  { titulo: 'Filtro inercial (fórmula: constante ÷ 0,7 × L×P ÷ 1.000.000)', chaves: ['filtro_constante_430', 'filtro_constante_304', 'filtro_constante_aluminio', 'filtro_coletor_gordura_por_cm'] },
];

const LABELS: Record<string, string> = {
  margem_lucro_padrao: 'Margem de lucro padrão (%)',
  pintura_padrao: 'Pintura — valor padrão sugerido (R$)',
  preco_friso_por_cm: 'Friso — preço por cm (R$)',
  filtro_constante_430: 'Constante — Filtro Inercial 430',
  filtro_constante_304: 'Constante — Filtro Inercial 304',
  filtro_constante_aluminio: 'Constante — Filtro Alumínio',
  filtro_coletor_gordura_por_cm: 'Coletor de gordura — acréscimo por cm de largura (R$)',
};

export default function ParametrosCalculadoraPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const result = await getCalculatorReferenceData();
    if (result.success && result.data) {
      setValues(result.data.parametros);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar parâmetros', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (chave: string) => {
    setSaving(chave);
    const result = await updateParametroGlobal(chave, values[chave] ?? 0);
    if (result.success) {
      toast({ title: 'Parâmetro salvo!', description: `${LABELS[chave] ?? chave} atualizado.` });
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
    setSaving(null);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" />
          Parâmetros da Calculadora de Coifas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alterar aqui atualiza o cálculo em todo o sistema — sem precisar mexer em código.
          Os valores marcados como &quot;a confirmar&quot; vieram da especificação técnica e ainda não foram validados pelo Levi.
        </p>
        <p className="text-sm text-muted-foreground">
          Os preços de lâmpada, fonte, botoeira, botão e chicote agora ficam no{' '}
          <a href="/materials" className="underline">Estoque</a> (categoria &quot;Elétrico Coifa&quot;), junto com o preço das chapas.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        GRUPOS.map(grupo => (
          <Card key={grupo.titulo}>
            <CardHeader>
              <CardTitle className="text-base">{grupo.titulo}</CardTitle>
              {grupo.titulo.includes('Filtro') && (
                <CardDescription className="text-amber-500">
                  Valores de constante ainda não confirmados com o Levi — ver &quot;Decisões pendentes&quot; no Roteiro Lemannox.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {grupo.chaves.map(chave => (
                <div key={chave} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">{LABELS[chave] ?? chave}</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={values[chave] ?? 0}
                      onChange={(e) => setValues(v => ({ ...v, [chave]: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <Button size="icon" variant="outline" disabled={saving === chave} onClick={() => handleSave(chave)}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

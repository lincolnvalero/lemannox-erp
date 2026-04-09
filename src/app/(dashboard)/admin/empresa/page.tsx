'use client';

import { useState, useEffect } from 'react';
import { Building2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getNfeSettings, saveNfeSettings } from '@/app/actions/nfe';
import { getCUF } from '@/lib/nfe/cfop-detector';
import type { NfeSettings } from '@/lib/types';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

// Códigos IBGE dos estados
const UF_CODE: Record<string, number> = {
  AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,
  MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,
  RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17,
};

type FormState = Omit<NfeSettings, 'id'>;

const EMPTY: FormState = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  ie: '',
  crt: 1,
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  cMun: '',
  uf: 'SP',
  cUF: 35,
  cep: '',
  telefone: '',
  proximaNf: 1,
  serie: 1,
  ambiente: '1',
  naturezaOp: 'VENDA DE PRODUTO INDUSTRIALIZADO',
};

export default function AdminEmpresaPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    (async () => {
      const s = await getNfeSettings();
      if (s) {
        setForm({
          cnpj: s.cnpj,
          razaoSocial: s.razaoSocial,
          nomeFantasia: s.nomeFantasia,
          ie: s.ie,
          crt: s.crt,
          logradouro: s.logradouro,
          numero: s.numero,
          complemento: s.complemento,
          bairro: s.bairro,
          municipio: s.municipio,
          cMun: s.cMun,
          uf: s.uf,
          cUF: s.cUF,
          cep: s.cep,
          telefone: s.telefone,
          proximaNf: s.proximaNf,
          serie: s.serie,
          ambiente: s.ambiente,
          naturezaOp: s.naturezaOp,
        });
      }
      setLoading(false);
    })();
  }, []);

  function set(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleUFChange(uf: string) {
    set({ uf, cUF: UF_CODE[uf] ?? 35 });
  }

  async function handleSave() {
    if (!form.cnpj || !form.razaoSocial) {
      toast({ variant: 'destructive', title: 'CNPJ e Razão Social são obrigatórios' });
      return;
    }
    setSaving(true);
    const res = await saveNfeSettings({ ...form, id: 'default' });
    setSaving(false);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: res.error });
    } else {
      toast({ title: 'Configurações salvas com sucesso' });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-6 backdrop-blur-sm">
          <Building2 className="mr-2 h-5 w-5" />
          <h1 className="text-lg font-semibold">Dados da Empresa</h1>
        </header>
        <main className="flex-1 p-6 space-y-4 max-w-3xl">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Dados da Empresa</h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-6">

          {/* Alerta NF-e */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Dados do Emitente NF-e</p>
              <p className="text-xs text-blue-400/80 mt-0.5">
                Estas informações são usadas na geração do XML NF-e 4.00 para importar no Emissor Sebrae.
                O CNPJ e endereço devem ser exatamente os cadastrados na Receita Federal.
              </p>
            </div>
          </div>

          {/* Identificação da empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação</CardTitle>
              <CardDescription>Dados cadastrais do emitente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CNPJ <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => set({ cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={form.ie}
                    onChange={(e) => set({ ie: e.target.value })}
                    placeholder="000.000.000.000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Razão Social <span className="text-destructive">*</span></Label>
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => set({ razaoSocial: e.target.value })}
                  placeholder="LEMANNOX INDUSTRIA LTDA"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome Fantasia</Label>
                <Input
                  value={form.nomeFantasia}
                  onChange={(e) => set({ nomeFantasia: e.target.value })}
                  placeholder="Lemannox"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Regime Tributário</Label>
                  <Select value={String(form.crt)} onValueChange={(v) => set({ crt: Number(v) as 1 | 3 })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 – Simples Nacional</SelectItem>
                      <SelectItem value="3">3 – Lucro Presumido / Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => set({ telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endereço do Estabelecimento</CardTitle>
              <CardDescription>Deve coincidir com o cadastro na SEFAZ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Logradouro</Label>
                  <Input
                    value={form.logradouro}
                    onChange={(e) => set({ logradouro: e.target.value })}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input
                    value={form.numero}
                    onChange={(e) => set({ numero: e.target.value })}
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input
                    value={form.complemento}
                    onChange={(e) => set({ complemento: e.target.value })}
                    placeholder="Galpão B, Sala 10..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => set({ bairro: e.target.value })}
                    placeholder="Distrito Industrial"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Município</Label>
                  <Input
                    value={form.municipio}
                    onChange={(e) => set({ municipio: e.target.value })}
                    placeholder="São Paulo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Código IBGE Mun. <span className="text-xs text-muted-foreground">(7 dig.)</span></Label>
                  <Input
                    value={form.cMun}
                    onChange={(e) => set({ cMun: e.target.value })}
                    placeholder="3550308"
                    maxLength={7}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => set({ cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Select value={form.uf} onValueChange={handleUFChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cód. IBGE Estado</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                    {form.cUF}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações NF-e */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações NF-e</CardTitle>
              <CardDescription>Sequência numérica e ambiente de emissão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-xs text-yellow-400/90">
                  ⚠ A <strong>Próxima NF</strong> é apenas uma sugestão. Sempre confirme o número correto diretamente no Emissor Sebrae antes de gerar o XML.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Próxima NF (sugestão)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.proximaNf}
                    onChange={(e) => set({ proximaNf: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Série</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.serie}
                    onChange={(e) => set({ serie: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Ambiente de Emissão</Label>
                  <Select value={form.ambiente} onValueChange={(v) => set({ ambiente: v as '1' | '2' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 – Produção (NF com validade fiscal)</SelectItem>
                      <SelectItem value="2">2 – Homologação (testes, sem validade)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <Label>Natureza da Operação Padrão</Label>
                  <Input
                    value={form.naturezaOp}
                    onChange={(e) => set({ naturezaOp: e.target.value.toUpperCase() })}
                    placeholder="VENDA DE PRODUTO INDUSTRIALIZADO"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="text-xs text-emerald-400/90">
                  <p className="font-medium">Regime: Simples Nacional (CRT=1)</p>
                  <p>ICMS: CSOSN 102 · IPI: CST 53 (não tributado) · PIS/COFINS: CST 07 (isento)</p>
                  <p>NCM padrão: 8414.60.00 — Coifas aspirantes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

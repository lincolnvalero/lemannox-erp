'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Plus, Trash2, Download, AlertTriangle, CheckCircle2,
  Clock, XCircle, ChevronDown, FileText, RefreshCw, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase';
import {
  gerarNFe, listNotasFiscais, getNfeSettings, confirmarEmissao, cancelarNF,
} from '@/app/actions/nfe';
import { detectCfop, FORMAS_PAGAMENTO, MODALIDADES_FRETE, NATUREZAS_OP } from '@/lib/nfe/cfop-detector';
import { getCityCode } from '@/lib/nfe/city-codes';
import { formatNcm, NCM_DEFAULT, NCM_TABLE } from '@/lib/nfe/ncm-lookup';
import type { NotaFiscal, NfeSettings, NotaFiscalItem, Quote } from '@/lib/types';

// ─── Tipos locais ─────────────────────────────────────────────

type ItemForm = {
  id: string;
  cProd: string;
  xProd: string;
  ncm: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  ipiCst: string;
};

type NfForm = {
  nfNumber: number;
  serie: number;
  natOp: string;
  tpAmb: '1' | '2';
  indFinal: '0' | '1';
  modFrete: '0' | '1' | '2' | '3' | '4' | '9';
  tpPagamento: string;
  observacoes: string;
  // Destinatário
  destNome: string;
  destDoc: string;
  destTipDoc: 'CNPJ' | 'CPF';
  destIndIE: '1' | '2' | '9';
  destIE: string;
  destEmail: string;
  destUF: string;
  destCMun: string;
  destMunicipio: string;
  destLogradouro: string;
  destBairro: string;
  destCEP: string;
  // Items
  items: ItemForm[];
  totalFrete: number;
  quoteId?: string;
};

const EMPTY_ITEM = (): ItemForm => ({
  id: crypto.randomUUID(),
  cProd: '',
  xProd: '',
  ncm: NCM_DEFAULT,
  uCom: 'UN',
  qCom: 1,
  vUnCom: 0,
  vProd: 0,
  ipiCst: '53',
});

const DEFAULT_FORM = (settings: NfeSettings | null): NfForm => ({
  nfNumber: settings?.proximaNf ?? 1,
  serie: settings?.serie ?? 1,
  natOp: settings?.naturezaOp ?? 'VENDA DE PRODUTO INDUSTRIALIZADO',
  tpAmb: settings?.ambiente ?? '1',
  indFinal: '0',
  modFrete: '9',
  tpPagamento: '01',
  observacoes: '',
  destNome: '',
  destDoc: '',
  destTipDoc: 'CNPJ',
  destIndIE: '9',
  destIE: '',
  destEmail: '',
  destUF: '',
  destCMun: '',
  destMunicipio: '',
  destLogradouro: '',
  destBairro: '',
  destCEP: '',
  items: [EMPTY_ITEM()],
  totalFrete: 0,
});

// ─── Helpers de status ────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  rascunho: { label: 'Rascunho', icon: Clock, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  xml_gerado: { label: 'XML Gerado', icon: Download, cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  emitida: { label: 'Emitida', icon: CheckCircle2, cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelada: { label: 'Cancelada', icon: XCircle, cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Componente principal ─────────────────────────────────────

export default function InvoicingPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NfeSettings | null>(null);
  const [historico, setHistorico] = useState<NotaFiscal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<NfForm>(() => DEFAULT_FORM(null));

  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ nfId: string; nfNumber: number } | null>(null);
  const [confirmData, setConfirmData] = useState({ chave: '', protocolo: '' });
  const [xmlPreview, setXmlPreview] = useState<{ xml: string; filename: string } | null>(null);

  // ── Load inicial ────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sett, nfs] = await Promise.all([
        getNfeSettings(),
        listNotasFiscais(30),
      ]);
      setSettings(sett);
      setHistorico(nfs);
      setForm(DEFAULT_FORM(sett));

      const supabase = createClient();
      const { data } = await supabase
        .from('quotes')
        .select('id,quote_number,customer_id,customer_name,customer_details,items,total,freight,status')
        .in('status', ['aprovado', 'faturado'])
        .order('quote_number', { ascending: false })
        .limit(100);
      setQuotes(((data ?? []) as Record<string, unknown>[]).map((q) => ({
        id: q.id as string,
        quoteNumber: q.quote_number as number,
        customerId: (q.customer_id as string | null) ?? '',
        customerName: q.customer_name as string,
        customerDetails: q.customer_details as Record<string, string> | undefined,
        status: q.status as Quote['status'],
        items: (q.items as Quote['items']) ?? [],
        subtotal: 0,
        total: (q.total as number) ?? 0,
        freight: (q.freight as number) ?? 0,
        date: '',
      })));
    } catch (err) {
      console.error('[InvoicingPage] load error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar faturamento',
        description: err instanceof Error ? err.message : 'Tente recarregar a página.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Atualização de item ─────────────────────────────────────
  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setForm((f) => {
      const items = [...f.items];
      const updated = { ...items[idx], ...patch };
      updated.vProd = Math.round(updated.qCom * updated.vUnCom * 100) / 100;
      items[idx] = updated;
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, EMPTY_ITEM()] }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  // ── Import de orçamento ─────────────────────────────────────
  async function importFromQuote(quote: Quote) {
    const supabase = createClient();

    // Busca cadastro completo do cliente (tem endereço, IE, etc.)
    let customer: Record<string, string | null> | null = null;
    if (quote.customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('name,cnpj,ie,email,state,city,address_street,address_number,neighborhood,zip_code')
        .eq('id', quote.customerId)
        .single();
      customer = cust as Record<string, string | null> | null;
    }

    // Fallback para o snapshot do orçamento caso o cliente não seja encontrado
    const snap = quote.customerDetails ?? {};
    const cnpj  = customer?.cnpj  ?? (snap as Record<string,string>).cnpj  ?? '';
    const ie     = customer?.ie    ?? '';
    const email  = customer?.email ?? (snap as Record<string,string>).email ?? '';
    const uf     = customer?.state ?? '';
    const city   = customer?.city  ?? '';
    const street = customer?.address_street ?? '';
    const neighborhood = customer?.neighborhood ?? '';
    const zipCode      = (customer?.zip_code ?? '').replace(/\D/g, '');
    const cMun         = getCityCode(city, uf);

    const items: ItemForm[] = (quote.items ?? []).map((qi) => ({
      id: crypto.randomUUID(),
      cProd: '',
      xProd: qi.name,
      ncm: NCM_DEFAULT,
      uCom: 'UN',
      qCom: qi.quantity,
      vUnCom: qi.unitPrice,
      vProd: qi.total,
      ipiCst: '53',
    }));

    setForm((f) => ({
      ...f,
      quoteId:      quote.id,
      // Destinatário — dados completos do cadastro
      destNome:     customer?.name ?? quote.customerName,
      destDoc:      cnpj,
      destTipDoc:   cnpj ? 'CNPJ' : 'CPF',
      destIndIE:    ie ? '1' : '9',
      destIE:       ie,
      destEmail:    email,
      destUF:       uf,
      destMunicipio: city,
      destCMun:     cMun,
      destLogradouro: street,
      destBairro:   neighborhood,
      destCEP:      zipCode,
      // Itens e frete
      totalFrete:   quote.freight ?? 0,
      items:        items.length ? items : [EMPTY_ITEM()],
      natOp:        f.natOp,
    }));

    setShowImportDialog(false);
    const fonte = customer ? 'cadastro do cliente' : 'dados do orçamento';
    toast({ title: `Orçamento #${quote.quoteNumber} importado`, description: `Dados preenchidos do ${fonte}.` });
  }

  // ── Totais ──────────────────────────────────────────────────
  const totalProd = form.items.reduce((s, i) => s + i.vProd, 0);
  const totalNF = totalProd + form.totalFrete;

  // ── Gerar XML ────────────────────────────────────────────────
  async function handleGerar() {
    if (!settings?.cnpj) {
      toast({ variant: 'destructive', title: 'Configure o emitente', description: 'Acesse Admin → Empresa e preencha os dados antes de emitir.' });
      return;
    }
    if (!form.destNome || !form.destDoc) {
      toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Preencha nome e documento do destinatário.' });
      return;
    }
    if (form.items.some((i) => !i.xProd || i.vProd <= 0)) {
      toast({ variant: 'destructive', title: 'Itens incompletos', description: 'Todos os itens precisam de descrição e valor.' });
      return;
    }

    setGenerating(true);
    const nfeItems: NotaFiscalItem[] = form.items.map((i) => ({
      id: i.id,
      cProd: i.cProd,
      xProd: i.xProd,
      ncm: i.ncm.replace(/\D/g, '').padStart(8, '0'),
      cfop: detectCfop(settings.uf, form.destUF),
      uCom: i.uCom,
      qCom: i.qCom,
      vUnCom: i.vUnCom,
      vProd: i.vProd,
      ipiCst: i.ipiCst,
    }));

    const result = await gerarNFe({
      nfNumber: form.nfNumber,
      serie: form.serie,
      quoteId: form.quoteId,
      natOp: form.natOp,
      tpAmb: form.tpAmb,
      indFinal: form.indFinal,
      indPres: '1',
      modFrete: form.modFrete,
      tpPagamento: form.tpPagamento,
      observacoes: form.observacoes,
      dest: {
        xNome: form.destNome,
        doc: form.destDoc.replace(/\D/g, ''),
        tipDoc: form.destTipDoc,
        indIEDest: form.destIndIE,
        ie: form.destIE || undefined,
        email: form.destEmail || undefined,
        logradouro: form.destLogradouro || undefined,
        bairro: form.destBairro || undefined,
        municipio: form.destMunicipio || undefined,
        cMun: form.destCMun || undefined,
        uf: form.destUF || undefined,
        cep: form.destCEP || undefined,
      },
      items: nfeItems,
      totalFrete: form.totalFrete,
    });

    setGenerating(false);

    if (result.error && !result.xml) {
      toast({ variant: 'destructive', title: 'Erro ao gerar NF-e', description: result.error });
      return;
    }
    if (result.xml) {
      const filename = `NF_${form.nfNumber}_${form.destNome.substring(0, 20).replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.xml`;
      setXmlPreview({ xml: result.xml, filename });
      downloadXml(result.xml, filename);
      toast({ title: `NF #${form.nfNumber} gerada!`, description: 'XML baixado. Importe no Emissor Sebrae para assinar e transmitir.' });
      load();
    }
  }

  function downloadXml(xml: string, filename: string) {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadNfXml(nf: NotaFiscal) {
    if (!nf.xmlGerado) return;
    const filename = `NF_${nf.nfNumber}_${nf.customerName.substring(0, 20).replace(/\s+/g, '_')}.xml`;
    downloadXml(nf.xmlGerado, filename);
  }

  // ── Confirmar emissão no Sebrae ──────────────────────────────
  async function handleConfirmar() {
    if (!showConfirmDialog || !confirmData.chave) return;
    const res = await confirmarEmissao(showConfirmDialog.nfId, confirmData.chave, confirmData.protocolo);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
      return;
    }
    toast({ title: `NF #${showConfirmDialog.nfNumber} marcada como emitida` });
    setShowConfirmDialog(null);
    setConfirmData({ chave: '', protocolo: '' });
    load();
  }

  // ── Cancelar NF ─────────────────────────────────────────────
  async function handleCancelar(nf: NotaFiscal) {
    const ok = confirm(`Cancelar NF #${nf.nfNumber}? Esta ação não cancela a NF no SEFAZ — apenas marca no sistema.`);
    if (!ok) return;
    await cancelarNF(nf.id);
    toast({ title: `NF #${nf.nfNumber} marcada como cancelada` });
    load();
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-6 backdrop-blur-sm">
          <Receipt className="mr-2 h-5 w-5" />
          <h1 className="text-lg font-semibold">Faturamento / NF-e</h1>
        </header>
        <main className="flex-1 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Faturamento / NF-e</h1>
          {settings?.ambiente === '2' && (
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
              HOMOLOGAÇÃO
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-0 min-h-0 overflow-hidden">

        {/* ── Coluna esquerda: formulário ── */}
        <div className="overflow-y-auto border-r p-6 space-y-6">

          {!settings?.cnpj && (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Configure os dados do emitente em <strong>Admin → Empresa</strong> antes de emitir NFs.</span>
            </div>
          )}

          {/* Número e série */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Número da NF</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={form.nfNumber}
                    onChange={(e) => setForm((f) => ({ ...f, nfNumber: Number(e.target.value) }))}
                    className="pr-9"
                  />
                  <AlertTriangle className="absolute right-3 top-2.5 h-4 w-4 text-yellow-400" />
                </div>
                <p className="text-[11px] text-yellow-500/80">⚠ Verifique o próximo número no Sebrae</p>
              </div>
              <div className="space-y-1.5">
                <Label>Série</Label>
                <Input
                  type="number"
                  value={form.serie}
                  onChange={(e) => setForm((f) => ({ ...f, serie: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select value={form.tpAmb} onValueChange={(v) => setForm((f) => ({ ...f, tpAmb: v as '1' | '2' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Produção</SelectItem>
                    <SelectItem value="2">Homologação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-4 space-y-1.5">
                <Label>Natureza da Operação</Label>
                <Select value={form.natOp} onValueChange={(v) => setForm((f) => ({ ...f, natOp: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NATUREZAS_OP.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Destinatário */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Destinatário</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setShowImportDialog(true)}>
                <FileText className="h-3.5 w-3.5" />
                Importar Orçamento
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Nome / Razão Social</Label>
                  <Input
                    value={form.destNome}
                    onChange={(e) => setForm((f) => ({ ...f, destNome: e.target.value }))}
                    placeholder="Nome ou razão social"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.destTipDoc} onValueChange={(v) => setForm((f) => ({ ...f, destTipDoc: v as 'CNPJ' | 'CPF' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="CPF">CPF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>{form.destTipDoc}</Label>
                  <Input
                    value={form.destDoc}
                    onChange={(e) => setForm((f) => ({ ...f, destDoc: e.target.value }))}
                    placeholder={form.destTipDoc === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Indicador IE</Label>
                  <Select value={form.destIndIE} onValueChange={(v) => setForm((f) => ({ ...f, destIndIE: v as '1' | '2' | '9' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 – Contribuinte</SelectItem>
                      <SelectItem value="2">2 – Isento</SelectItem>
                      <SelectItem value="9">9 – Não contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.destIndIE === '1' && (
                  <div className="space-y-1.5">
                    <Label>IE do Destinatário</Label>
                    <Input value={form.destIE} onChange={(e) => setForm((f) => ({ ...f, destIE: e.target.value }))} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.destEmail} onChange={(e) => setForm((f) => ({ ...f, destEmail: e.target.value }))} type="email" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Município</Label>
                  <Input value={form.destMunicipio} onChange={(e) => setForm((f) => ({ ...f, destMunicipio: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input value={form.destUF} onChange={(e) => setForm((f) => ({ ...f, destUF: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" maxLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cód. IBGE Mun.</Label>
                  <Input value={form.destCMun} onChange={(e) => setForm((f) => ({ ...f, destCMun: e.target.value }))} placeholder="0000000" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Logradouro</Label>
                  <Input value={form.destLogradouro} onChange={(e) => setForm((f) => ({ ...f, destLogradouro: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={form.destBairro} onChange={(e) => setForm((f) => ({ ...f, destBairro: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={form.destCEP} onChange={(e) => setForm((f) => ({ ...f, destCEP: e.target.value }))} placeholder="00000-000" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Itens da Nota</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.items.map((item, idx) => (
                <div key={item.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                    {form.items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-xs">Descrição do Produto</Label>
                      <Input
                        value={item.xProd}
                        onChange={(e) => updateItem(idx, { xProd: e.target.value })}
                        placeholder="Ex: COIFA INDUSTRIAL ACO INOX 1M"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">NCM</Label>
                      <Select
                        value={item.ncm}
                        onValueChange={(v) => updateItem(idx, { ncm: v })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="NCM" />
                        </SelectTrigger>
                        <SelectContent>
                          {NCM_TABLE.map((n) => (
                            <SelectItem key={n.ncm} value={n.ncm}>
                              {formatNcm(n.ncm)} — {n.descricao.substring(0, 35)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Un.</Label>
                      <Select value={item.uCom} onValueChange={(v) => updateItem(idx, { uCom: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['UN', 'M2', 'M', 'KG', 'CX', 'PC'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qtd.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={item.qCom}
                        onChange={(e) => updateItem(idx, { qCom: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Unit. (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.vUnCom}
                        onChange={(e) => updateItem(idx, { vUnCom: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Total Item</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
                        {fmtBRL(item.vProd)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">IPI CST</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
                        CST {item.ipiCst} – Não trib.
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">ICMS</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
                        CSOSN 102
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">PIS/COFINS</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
                        CST 07 – Isento
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Frete, Pagamento e Totais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transporte, Pagamento e Totais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Modalidade Frete</Label>
                  <Select value={form.modFrete} onValueChange={(v) => setForm((f) => ({ ...f, modFrete: v as NfForm['modFrete'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES_FRETE.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor Frete (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.totalFrete}
                    onChange={(e) => setForm((f) => ({ ...f, totalFrete: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.tpPagamento} onValueChange={(v) => setForm((f) => ({ ...f, tpPagamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Consumidor Final</Label>
                  <Select value={form.indFinal} onValueChange={(v) => setForm((f) => ({ ...f, indFinal: v as '0' | '1' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 – Normal (B2B)</SelectItem>
                      <SelectItem value="1">1 – Consumidor Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Informações Adicionais</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Informações complementares que aparecerão no DANFE..."
                  rows={2}
                />
              </div>
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Produtos</span>
                  <span className="font-medium">{fmtBRL(totalProd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="font-medium">{fmtBRL(form.totalFrete)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total NF</span>
                  <span className="text-primary">{fmtBRL(totalNF)}</span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  size="lg"
                  className="gap-2"
                  disabled={generating || !form.destNome}
                  onClick={handleGerar}
                >
                  <Download className="h-4 w-4" />
                  {generating ? 'Gerando XML...' : 'Gerar e Baixar XML'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna direita: histórico ── */}
        <div className="overflow-y-auto bg-muted/20">
          <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Notas Emitidas</h2>
            <p className="text-xs text-muted-foreground">{historico.length} registros</p>
          </div>
          <div className="p-3 space-y-2">
            {historico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma NF emitida ainda.
              </div>
            ) : (
              historico.map((nf) => (
                <div
                  key={nf.id}
                  className="rounded-lg border bg-background p-3 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-bold text-primary shrink-0">#{nf.nfNumber}</span>
                      <span className="text-sm truncate">{nf.customerName}</span>
                    </div>
                    <StatusBadge status={nf.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(nf.dataEmissao).toLocaleDateString('pt-BR')}</span>
                    <span className="font-medium text-foreground">{fmtBRL(nf.totalNf)}</span>
                  </div>
                  {nf.chaveAcesso && (
                    <p className="text-[10px] font-mono text-muted-foreground break-all">{nf.chaveAcesso}</p>
                  )}
                  <div className="flex gap-1 pt-1">
                    {nf.xmlGerado && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => downloadNfXml(nf)}
                      >
                        <Download className="h-3 w-3" />
                        XML
                      </Button>
                    )}
                    {nf.status === 'xml_gerado' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 text-emerald-400"
                        onClick={() => { setShowConfirmDialog({ nfId: nf.id, nfNumber: nf.nfNumber }); setConfirmData({ chave: '', protocolo: '' }); }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Confirmar
                      </Button>
                    )}
                    {(nf.status === 'xml_gerado' || nf.status === 'rascunho') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 text-destructive/70 hover:text-destructive"
                        onClick={() => handleCancelar(nf)}
                      >
                        <XCircle className="h-3 w-3" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ── Dialog: Importar Orçamento ── */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Orçamento</DialogTitle>
            <DialogDescription>Selecione um orçamento aprovado para pré-preencher os dados da NF.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {quotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum orçamento aprovado encontrado.</p>
            ) : (
              quotes.map((q) => (
                <button
                  key={q.id}
                  className="w-full text-left rounded-lg border p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => importFromQuote(q)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-primary text-sm">#{q.quoteNumber}</span>
                      <span className="ml-2 text-sm">{q.customerName}</span>
                    </div>
                    <span className="text-sm font-medium">{fmtBRL(q.total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{q.status}</div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar emissão no Sebrae ── */}
      <Dialog open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Emissão NF #{showConfirmDialog?.nfNumber}</DialogTitle>
            <DialogDescription>
              Cole a chave de acesso e o número do protocolo gerados pelo Emissor Sebrae após a autorização da SEFAZ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Chave de Acesso (44 dígitos)</Label>
              <Input
                value={confirmData.chave}
                onChange={(e) => setConfirmData((d) => ({ ...d, chave: e.target.value }))}
                placeholder="35260412345678000100550010000001580..."
                className="font-mono text-xs"
                maxLength={44}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número do Protocolo (opcional)</Label>
              <Input
                value={confirmData.protocolo}
                onChange={(e) => setConfirmData((d) => ({ ...d, protocolo: e.target.value }))}
                placeholder="135260000000000"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(null)}>Cancelar</Button>
            <Button onClick={handleConfirmar} disabled={confirmData.chave.length < 44} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar Emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

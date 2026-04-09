'use server';

import { createClient as createServerClient } from '@/lib/supabase-server';
import { generateNFeXML } from '@/lib/nfe/xml-generator';
import { detectCfop } from '@/lib/nfe/cfop-detector';
import { cleanNcm } from '@/lib/nfe/ncm-lookup';
import type { NfeData, NfeSettings as NfeSettingsLib, NfeItem } from '@/lib/nfe/types';
import type { NfeSettings, NotaFiscal, NotaFiscalItem } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────

function rowToSettings(row: Record<string, unknown>): NfeSettings {
  return {
    id: String(row.id ?? 'default'),
    cnpj: String(row.cnpj ?? ''),
    razaoSocial: String(row.razao_social ?? ''),
    nomeFantasia: String(row.nome_fantasia ?? ''),
    ie: String(row.ie ?? ''),
    crt: (Number(row.crt) === 3 ? 3 : 1) as 1 | 3,
    logradouro: String(row.logradouro ?? ''),
    numero: String(row.numero ?? ''),
    complemento: String(row.complemento ?? ''),
    bairro: String(row.bairro ?? ''),
    municipio: String(row.municipio ?? ''),
    cMun: String(row.c_mun ?? ''),
    uf: String(row.uf ?? 'SP'),
    cUF: Number(row.c_uf ?? 35),
    cep: String(row.cep ?? ''),
    telefone: String(row.telefone ?? ''),
    proximaNf: Number(row.proxima_nf ?? 1),
    serie: Number(row.serie ?? 1),
    ambiente: String(row.ambiente ?? '1') as '1' | '2',
    naturezaOp: String(row.natureza_op ?? 'VENDA DE PRODUTO INDUSTRIALIZADO'),
  };
}

function rowToNF(row: Record<string, unknown>): NotaFiscal {
  return {
    id: String(row.id),
    nfNumber: Number(row.nf_number),
    serie: Number(row.serie ?? 1),
    quoteId: row.quote_id ? String(row.quote_id) : undefined,
    customerName: String(row.customer_name ?? ''),
    customerDoc: String(row.customer_doc ?? ''),
    naturezaOp: String(row.natureza_op ?? ''),
    cfop: String(row.cfop ?? ''),
    items: (row.items as NotaFiscalItem[]) ?? [],
    totalProdutos: Number(row.total_produtos ?? 0),
    totalFrete: Number(row.total_frete ?? 0),
    totalNf: Number(row.total_nf ?? 0),
    regimeTrib: (Number(row.regime_trib) === 3 ? 3 : 1) as 1 | 3,
    modFrete: Number(row.mod_frete ?? 9),
    tpPagamento: String(row.tp_pagamento ?? '01'),
    status: String(row.status ?? 'rascunho') as NotaFiscal['status'],
    xmlGerado: row.xml_gerado ? String(row.xml_gerado) : undefined,
    chaveAcesso: row.chave_acesso ? String(row.chave_acesso) : undefined,
    protocolo: row.protocolo ? String(row.protocolo) : undefined,
    dataEmissao: String(row.data_emissao ?? ''),
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

// ─── Ações públicas ───────────────────────────────────────────

/** Retorna as configurações NF-e da empresa */
export async function getNfeSettings(): Promise<NfeSettings | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('nfe_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  if (error || !data) return null;
  return rowToSettings(data as Record<string, unknown>);
}

/** Salva/atualiza configurações NF-e */
export async function saveNfeSettings(settings: Partial<NfeSettings>): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const payload: Record<string, unknown> = {
    id: 'default',
    cnpj: settings.cnpj,
    razao_social: settings.razaoSocial,
    nome_fantasia: settings.nomeFantasia,
    ie: settings.ie,
    crt: settings.crt,
    logradouro: settings.logradouro,
    numero: settings.numero,
    complemento: settings.complemento,
    bairro: settings.bairro,
    municipio: settings.municipio,
    c_mun: settings.cMun,
    uf: settings.uf,
    c_uf: settings.cUF,
    cep: settings.cep,
    telefone: settings.telefone,
    proxima_nf: settings.proximaNf,
    serie: settings.serie,
    ambiente: settings.ambiente,
    natureza_op: settings.naturezaOp,
  };
  // Remove undefined keys
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { error } = await supabase
    .from('nfe_settings')
    .upsert(payload, { onConflict: 'id' });
  if (error) return { error: error.message };
  return {};
}

/** Lista NFs emitidas (mais recentes primeiro) */
export async function listNotasFiscais(limit = 50): Promise<NotaFiscal[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('*')
    .order('nf_number', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToNF);
}

/** Gera o XML da NF-e, salva no banco e retorna o XML */
export async function gerarNFe(params: {
  nfNumber: number;
  serie: number;
  quoteId?: string;
  natOp: string;
  tpAmb: '1' | '2';
  indFinal: '0' | '1';
  indPres: '1' | '2' | '3' | '4' | '9';
  modFrete: '0' | '1' | '2' | '3' | '4' | '9';
  tpPagamento: string;
  observacoes?: string;
  dest: {
    xNome: string;
    doc: string;
    tipDoc: 'CNPJ' | 'CPF';
    indIEDest: '1' | '2' | '9';
    ie?: string;
    email?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    cMun?: string;
    uf?: string;
    cep?: string;
  };
  items: NotaFiscalItem[];
  totalFrete: number;
}): Promise<{ xml?: string; nfId?: string; error?: string }> {
  const supabase = await createServerClient();

  // Carrega settings do emitente
  const settingsRow = await getNfeSettings();
  if (!settingsRow) return { error: 'Configure os dados do emitente em Admin → Empresa antes de gerar NF-e.' };
  if (!settingsRow.cnpj) return { error: 'CNPJ do emitente não configurado.' };

  const totalProd = params.items.reduce((s, i) => s + i.vProd, 0);
  const totalNF = totalProd + (params.totalFrete ?? 0);

  // Monta data para o gerador
  const emitSettings: NfeSettingsLib = {
    ...settingsRow,
    crt: settingsRow.crt,
    ambiente: settingsRow.ambiente,
  };

  const cfop = detectCfop(settingsRow.uf, params.dest.uf || settingsRow.uf);

  const nfeItems: NfeItem[] = params.items.map((item, idx) => ({
    id: item.id || String(idx),
    cProd: item.cProd || String(idx + 1).padStart(3, '0'),
    xProd: item.xProd,
    ncm: cleanNcm(item.ncm || '84146000'),
    cfop,
    uCom: item.uCom || 'UN',
    qCom: item.qCom,
    vUnCom: item.vUnCom,
    vProd: item.vProd,
    ipiCst: item.ipiCst || '53',
    ipiAliq: 0,
  }));

  const now = new Date();
  const offset = '-03:00';
  const dhEmi = now.toISOString().substring(0, 19) + offset;

  const nfeData: NfeData = {
    nNF: params.nfNumber,
    serie: params.serie,
    dhEmi,
    natOp: params.natOp,
    tpNF: '1',
    indFinal: params.indFinal,
    indPres: params.indPres,
    tpAmb: params.tpAmb,
    emit: emitSettings,
    dest: params.dest,
    items: nfeItems,
    totalProd,
    totalFrete: params.totalFrete ?? 0,
    totalNF,
    modFrete: params.modFrete,
    tpPagamento: params.tpPagamento,
    infCpl: params.observacoes,
  };

  let xml: string;
  try {
    xml = generateNFeXML(nfeData);
  } catch (e) {
    return { error: `Erro ao gerar XML: ${(e as Error).message}` };
  }

  // Salva no banco
  const { data: saved, error: dbErr } = await supabase
    .from('notas_fiscais')
    .insert({
      nf_number: params.nfNumber,
      serie: params.serie,
      quote_id: params.quoteId ?? null,
      customer_name: params.dest.xNome,
      customer_doc: params.dest.doc.replace(/\D/g, ''),
      ind_ie_dest: params.dest.indIEDest,
      dest_ie: params.dest.ie ?? null,
      dest_email: params.dest.email ?? null,
      dest_address: params.dest.logradouro ?? null,
      dest_city: params.dest.municipio ?? null,
      dest_uf: params.dest.uf ?? null,
      dest_cmun: params.dest.cMun ?? null,
      dest_cep: params.dest.cep ?? null,
      natureza_op: params.natOp,
      cfop,
      ind_final: Number(params.indFinal),
      items: params.items,
      total_produtos: Math.round(totalProd * 100) / 100,
      total_frete: Math.round((params.totalFrete ?? 0) * 100) / 100,
      total_nf: Math.round(totalNF * 100) / 100,
      regime_trib: settingsRow.crt,
      mod_frete: Number(params.modFrete),
      tp_pagamento: params.tpPagamento,
      status: 'xml_gerado',
      xml_gerado: xml,
      data_emissao: now.toISOString().substring(0, 10),
      observacoes: params.observacoes ?? null,
    })
    .select('id')
    .single();

  if (dbErr) return { error: `XML gerado mas erro ao salvar: ${dbErr.message}`, xml };

  // Incrementa proxima_nf nas settings
  await supabase
    .from('nfe_settings')
    .update({ proxima_nf: params.nfNumber + 1 })
    .eq('id', 'default');

  return { xml, nfId: (saved as { id: string }).id };
}

/** Atualiza chave de acesso e protocolo após autorização no Sebrae */
export async function confirmarEmissao(
  nfId: string,
  chaveAcesso: string,
  protocolo?: string
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('notas_fiscais')
    .update({
      chave_acesso: chaveAcesso.replace(/\s/g, ''),
      protocolo: protocolo ?? null,
      status: 'emitida',
    })
    .eq('id', nfId);
  if (error) return { error: error.message };
  return {};
}

/** Cancela uma NF (status=cancelada) */
export async function cancelarNF(nfId: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('notas_fiscais')
    .update({ status: 'cancelada' })
    .eq('id', nfId);
  if (error) return { error: error.message };
  return {};
}

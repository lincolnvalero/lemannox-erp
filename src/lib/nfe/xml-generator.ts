// ============================================================
// NF-e 4.00 XML Generator — Simples Nacional
// Ordem de tags conforme schema SEFAZ nfe_v4.00.xsd
// Gera XML para importar no Emissor Sebrae (sem assinar/transmitir)
// ============================================================

import { create } from 'xmlbuilder2';
import type { NfeData } from './types';
import { calcTaxesSimplesNacional, calcTotais, fmt2, fmt4 } from './tax-calculator';
import { getIdDest, getCUF } from './cfop-detector';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// ─── Chave de Acesso ─────────────────────────────────────────

function pad(n: number | string, len: number): string {
  return String(n).padStart(len, '0');
}

function randomCNF(): string {
  return pad(Math.floor(Math.random() * 99999999), 8);
}

function calcDV(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += parseInt(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function buildChaveAcesso(data: NfeData): string {
  const emit = data.emit;
  const cUF = pad(getCUF(emit.uf), 2);
  // AAMM: dois últimos dígitos do ano + mês
  const aamm = data.dhEmi.substring(2, 4) + data.dhEmi.substring(5, 7);
  const cnpj = emit.cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod = '55';
  const serie = pad(data.serie, 3);
  const nNF = pad(data.nNF, 9);
  const tpEmis = '1';
  const cNF = randomCNF();

  const chave43 = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const dv = calcDV(chave43);
  return `${chave43}${dv}`;
}

// ─── Gerador principal ────────────────────────────────────────

export function generateNFeXML(data: NfeData): string {
  const chave = buildChaveAcesso(data);
  const emit = data.emit;
  const dest = data.dest;
  const idDest = getIdDest(emit.uf, dest.uf || '');
  const cUF = getCUF(emit.uf);
  const totais = calcTotais(data.items, data.totalFrete);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const nfe = doc.ele(NFE_NS, 'NFe');
  const inf = nfe.ele('infNFe', { versao: '4.00', Id: `NFe${chave}` });

  // ── ide ────────────────────────────────────────────────────
  const ide = inf.ele('ide');
  ide.ele('cUF').txt(String(cUF));
  ide.ele('cNF').txt(chave.substring(35, 43));
  ide.ele('natOp').txt(data.natOp);
  ide.ele('mod').txt('55');
  ide.ele('serie').txt(String(data.serie));
  ide.ele('nNF').txt(String(data.nNF));
  ide.ele('dhEmi').txt(data.dhEmi);
  ide.ele('tpNF').txt(data.tpNF);
  ide.ele('idDest').txt(idDest);
  ide.ele('cMunFG').txt(emit.cMun || '');
  ide.ele('tpImp').txt('1');
  ide.ele('tpEmis').txt('1');
  ide.ele('cDV').txt(chave.substring(43, 44));
  ide.ele('tpAmb').txt(data.tpAmb);
  ide.ele('finNFe').txt('1');
  ide.ele('indFinal').txt(data.indFinal);
  ide.ele('indPres').txt(data.indPres);
  ide.ele('procEmi').txt('0');
  ide.ele('verProc').txt('Lemannox ERP 1.0');

  // ── emit ───────────────────────────────────────────────────
  const emitEl = inf.ele('emit');
  emitEl.ele('CNPJ').txt(emit.cnpj.replace(/\D/g, ''));
  emitEl.ele('xNome').txt(emit.razaoSocial.toUpperCase());
  if (emit.nomeFantasia) emitEl.ele('xFant').txt(emit.nomeFantasia.toUpperCase());
  const enderEmit = emitEl.ele('enderEmit');
  enderEmit.ele('xLgr').txt(emit.logradouro || '');
  enderEmit.ele('nro').txt(emit.numero || 'S/N');
  if (emit.complemento) enderEmit.ele('xCpl').txt(emit.complemento);
  enderEmit.ele('xBairro').txt(emit.bairro || '');
  enderEmit.ele('cMun').txt(emit.cMun || '');
  enderEmit.ele('xMun').txt(emit.municipio || '');
  enderEmit.ele('UF').txt(emit.uf || '');
  enderEmit.ele('CEP').txt((emit.cep || '').replace(/\D/g, ''));
  enderEmit.ele('cPais').txt('1058');
  enderEmit.ele('xPais').txt('Brasil');
  if (emit.telefone) enderEmit.ele('fone').txt(emit.telefone.replace(/\D/g, ''));
  emitEl.ele('IE').txt((emit.ie || '').replace(/\D/g, ''));
  emitEl.ele('CRT').txt(String(emit.crt));

  // ── dest ───────────────────────────────────────────────────
  const destEl = inf.ele('dest');
  destEl.ele(dest.tipDoc).txt(dest.doc.replace(/\D/g, ''));
  destEl.ele('xNome').txt(dest.xNome.toUpperCase());
  const enderDest = destEl.ele('enderDest');
  enderDest.ele('xLgr').txt(dest.logradouro || 'NAO INFORMADO');
  enderDest.ele('nro').txt('S/N');
  enderDest.ele('xBairro').txt(dest.bairro || 'NAO INFORMADO');
  enderDest.ele('cMun').txt(dest.cMun || '0000000');
  enderDest.ele('xMun').txt(dest.municipio || '');
  enderDest.ele('UF').txt(dest.uf || '');
  enderDest.ele('CEP').txt((dest.cep || '').replace(/\D/g, '') || '00000000');
  enderDest.ele('cPais').txt('1058');
  enderDest.ele('xPais').txt('Brasil');
  destEl.ele('indIEDest').txt(dest.indIEDest);
  if (dest.ie && dest.indIEDest === '1') destEl.ele('IE').txt(dest.ie.replace(/\D/g, ''));
  if (dest.email) destEl.ele('email').txt(dest.email);

  // ── det (itens) ────────────────────────────────────────────
  data.items.forEach((item, idx) => {
    const tax = calcTaxesSimplesNacional(item);
    const det = inf.ele('det', { nItem: String(idx + 1) });

    const prod = det.ele('prod');
    prod.ele('cProd').txt(item.cProd || pad(idx + 1, 3));
    prod.ele('cEAN').txt('SEM GTIN');
    prod.ele('xProd').txt(item.xProd.toUpperCase().substring(0, 120));
    prod.ele('NCM').txt(item.ncm.replace(/\D/g, '').padStart(8, '0'));
    prod.ele('CFOP').txt(item.cfop);
    prod.ele('uCom').txt(item.uCom || 'UN');
    prod.ele('qCom').txt(fmt4(item.qCom));
    prod.ele('vUnCom').txt(fmt4(item.vUnCom));
    prod.ele('vProd').txt(fmt2(item.vProd));
    prod.ele('cEANTrib').txt('SEM GTIN');
    prod.ele('uTrib').txt(item.uCom || 'UN');
    prod.ele('qTrib').txt(fmt4(item.qCom));
    prod.ele('vUnTrib').txt(fmt4(item.vUnCom));
    prod.ele('indTot').txt('1');

    const imposto = det.ele('imposto');

    // ICMS — Simples Nacional CSOSN 102
    const icmssn = imposto.ele('ICMS').ele('ICMSSN102');
    icmssn.ele('orig').txt('0');
    icmssn.ele('CSOSN').txt(tax.csosn);

    // IPI — IPINT CST 53 (não tributado)
    const ipiEl = imposto.ele('IPI');
    ipiEl.ele('cEnq').txt('999');
    ipiEl.ele('IPINT').ele('CST').txt(tax.ipiCst);

    // PIS — PISNT CST 07
    imposto.ele('PIS').ele('PISNT').ele('CST').txt(tax.pisCst);

    // COFINS — COFINSNT CST 07
    imposto.ele('COFINS').ele('COFINSNT').ele('CST').txt(tax.cofinsCst);
  });

  // ── total ──────────────────────────────────────────────────
  const icmsTot = inf.ele('total').ele('ICMSTot');
  icmsTot.ele('vBC').txt(fmt2(totais.vBC));
  icmsTot.ele('vICMS').txt(fmt2(totais.vICMS));
  icmsTot.ele('vICMSDeson').txt(fmt2(totais.vICMSDeson));
  icmsTot.ele('vFCP').txt(fmt2(totais.vFCP));
  icmsTot.ele('vBCST').txt(fmt2(totais.vBCST));
  icmsTot.ele('vST').txt(fmt2(totais.vST));
  icmsTot.ele('vFCPST').txt(fmt2(totais.vFCPST));
  icmsTot.ele('vFCPSTRet').txt(fmt2(totais.vFCPSTRet));
  icmsTot.ele('vProd').txt(fmt2(totais.vProd));
  icmsTot.ele('vFrete').txt(fmt2(totais.vFrete));
  icmsTot.ele('vSeg').txt(fmt2(totais.vSeg));
  icmsTot.ele('vDesc').txt(fmt2(totais.vDesc));
  icmsTot.ele('vII').txt(fmt2(totais.vII));
  icmsTot.ele('vIPI').txt(fmt2(totais.vIPI));
  icmsTot.ele('vIPIDevol').txt(fmt2(totais.vIPIDevol));
  icmsTot.ele('vPIS').txt(fmt2(totais.vPIS));
  icmsTot.ele('vCOFINS').txt(fmt2(totais.vCOFINS));
  icmsTot.ele('vOutro').txt(fmt2(totais.vOutro));
  icmsTot.ele('vNF').txt(fmt2(totais.vNF));

  // ── transp ─────────────────────────────────────────────────
  inf.ele('transp').ele('modFrete').txt(String(data.modFrete));

  // ── pag ────────────────────────────────────────────────────
  const detPag = inf.ele('pag').ele('detPag');
  detPag.ele('tPag').txt(data.tpPagamento);
  detPag.ele('vPag').txt(fmt2(totais.vNF));

  // ── infAdic ────────────────────────────────────────────────
  const base = 'SIMPLES NACIONAL - LC 123/2006. DOCUMENTO GERADO POR LEMANNOX ERP.';
  inf.ele('infAdic').ele('infCpl').txt(data.infCpl ? `${base} ${data.infCpl}` : base);

  return doc.end({ prettyPrint: true });
}

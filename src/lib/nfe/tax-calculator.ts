// Calculadora de impostos NF-e para Simples Nacional (CRT=1)
// Coifas e produtos metálicos — NCM 8414.60.00

import type { NfeItem } from './types';
import { getNcmInfo } from './ncm-lookup';

export type TaxResult = {
  // ICMS — Simples Nacional
  csosn: string;           // '102' = tributada sem permissão de crédito
  vBC: number;
  vICMS: number;

  // IPI
  ipiCst: string;          // '53' = IPINT (não tributado)
  ipiAliq: number;
  vIPI: number;

  // PIS — Simples Nacional
  pisCst: string;          // '07' = operação isenta
  vBCPis: number;
  pPis: number;
  vPIS: number;

  // COFINS — Simples Nacional
  cofinsCst: string;       // '07' = operação isenta
  vBCCofins: number;
  pCofins: number;
  vCOFINS: number;
};

/**
 * Calcula impostos para Simples Nacional (CRT=1).
 * Para o NCM 8414.60.00 (coifas):
 * - ICMS: CSOSN 102 (sem crédito, sem retenção) — valores zerados
 * - IPI: CST 53 (saída não tributada) — valores zerados
 * - PIS: CST 07 (operação isenta dentro do Simples) — valores zerados
 * - COFINS: CST 07 — valores zerados
 */
export function calcTaxesSimplesNacional(item: NfeItem): TaxResult {
  const ncmInfo = getNcmInfo(item.ncm);

  return {
    // ICMS — CSOSN 102: tributada pelo Simples sem permissão de crédito
    csosn: '102',
    vBC: 0,
    vICMS: 0,

    // IPI — CST 53: saída não tributada
    ipiCst: ncmInfo.ipiCst,
    ipiAliq: ncmInfo.ipiAliq,
    vIPI: 0,

    // PIS — CST 07: operação isenta (empresa optante pelo Simples)
    pisCst: '07',
    vBCPis: 0,
    pPis: 0,
    vPIS: 0,

    // COFINS — CST 07
    cofinsCst: '07',
    vBCCofins: 0,
    pCofins: 0,
    vCOFINS: 0,
  };
}

export type TotaisNFe = {
  vBC: number;
  vICMS: number;
  vICMSDeson: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vFCPST: number;
  vFCPSTRet: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vII: number;
  vIPI: number;
  vIPIDevol: number;
  vPIS: number;
  vCOFINS: number;
  vOutro: number;
  vNF: number;
};

export function calcTotais(items: NfeItem[], totalFrete: number): TotaisNFe {
  const vProd = items.reduce((s, i) => s + i.vProd, 0);

  return {
    vBC: 0,
    vICMS: 0,
    vICMSDeson: 0,
    vFCP: 0,
    vBCST: 0,
    vST: 0,
    vFCPST: 0,
    vFCPSTRet: 0,
    vProd: round2(vProd),
    vFrete: round2(totalFrete),
    vSeg: 0,
    vDesc: 0,
    vII: 0,
    vIPI: 0,
    vIPIDevol: 0,
    vPIS: 0,
    vCOFINS: 0,
    vOutro: 0,
    vNF: round2(vProd + totalFrete),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formata número com 2 casas decimais no padrão XML (ponto, sem milhar) */
export function fmt2(n: number): string {
  return n.toFixed(2);
}

/** Formata número com 4 casas decimais */
export function fmt4(n: number): string {
  return n.toFixed(4);
}

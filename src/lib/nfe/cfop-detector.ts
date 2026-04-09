// Detecta CFOP automaticamente com base nas UFs do emitente e destinatário

const UF_CODES: Record<string, number> = {
  AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53,
  ES: 32, GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15,
  PB: 25, PR: 41, PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43,
  RO: 11, RR: 14, SC: 42, SP: 35, SE: 28, TO: 17,
};

/**
 * Retorna o CFOP correto para venda de produto industrializado.
 * 5101 = venda intraestadual
 * 6101 = venda interestadual
 */
export function detectCfop(ufEmitente: string, ufDestinatario: string): string {
  const ufE = (ufEmitente || '').trim().toUpperCase();
  const ufD = (ufDestinatario || '').trim().toUpperCase();
  if (!ufD || ufE === ufD) return '5101';
  return '6101';
}

/** Retorna código IBGE do estado pela sigla */
export function getCUF(uf: string): number {
  return UF_CODES[(uf || '').trim().toUpperCase()] ?? 35;
}

/** Retorna idDest com base nas UFs: 1=interna, 2=interestadual, 3=exterior */
export function getIdDest(ufEmitente: string, ufDestinatario: string): '1' | '2' {
  const ufE = (ufEmitente || '').trim().toUpperCase();
  const ufD = (ufDestinatario || '').trim().toUpperCase();
  if (!ufD || ufE === ufD) return '1';
  return '2';
}

export const FORMAS_PAGAMENTO = [
  { value: '01', label: 'Dinheiro' },
  { value: '02', label: 'Cheque' },
  { value: '03', label: 'Cartão de Crédito' },
  { value: '04', label: 'Cartão de Débito' },
  { value: '05', label: 'Crédito Loja' },
  { value: '10', label: 'Vale Alimentação' },
  { value: '11', label: 'Vale Refeição' },
  { value: '15', label: 'Boleto Bancário' },
  { value: '16', label: 'Depósito Bancário' },
  { value: '17', label: 'PIX' },
  { value: '90', label: 'Sem Pagamento' },
  { value: '99', label: 'Outros' },
];

export const MODALIDADES_FRETE = [
  { value: '0', label: '0 – Emitente' },
  { value: '1', label: '1 – Destinatário' },
  { value: '2', label: '2 – Terceiros' },
  { value: '9', label: '9 – Sem Ocorrência de Transporte' },
];

export const NATUREZAS_OP = [
  'VENDA DE PRODUTO INDUSTRIALIZADO',
  'VENDA DE MERCADORIA',
  'REMESSA PARA CONSERTO',
  'DEVOLUÇÃO DE COMPRA',
  'TRANSFERÊNCIA DE MERCADORIA',
  'REMESSA PARA DEMONSTRAÇÃO',
];

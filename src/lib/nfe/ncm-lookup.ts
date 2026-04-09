// NCMs dos produtos da Lemannox — alíquotas na TIPI vigente
// NCM sem pontos (8 dígitos)

export type NcmInfo = {
  ncm: string;
  descricao: string;
  ipiAliq: number;     // 0 = isento/não tributado
  ipiCst: string;      // '53' = IPINT (não tributado), '50' = tributado
  obs?: string;
};

export const NCM_TABLE: NcmInfo[] = [
  {
    ncm: '84146000',
    descricao: 'Coifas aspirantes (dim. horizontal ≤ 120 cm)',
    ipiAliq: 0,
    ipiCst: '53',
    obs: 'Coifas domésticas e comerciais — alíquota 0% TIPI',
  },
  {
    ncm: '84145190',
    descricao: 'Ventiladores de teto com motor elétrico',
    ipiAliq: 0,
    ipiCst: '53',
  },
  {
    ncm: '84149090',
    descricao: 'Partes de coifas e ventiladores',
    ipiAliq: 0,
    ipiCst: '53',
  },
  {
    ncm: '73211110',
    descricao: 'Churrasqueiras de uso doméstico — ferro fundido',
    ipiAliq: 0,
    ipiCst: '53',
  },
  {
    ncm: '73211900',
    descricao: 'Churrasqueiras de aço inoxidável',
    ipiAliq: 0,
    ipiCst: '53',
  },
  {
    ncm: '73239990',
    descricao: 'Artigos para uso doméstico de aço inoxidável',
    ipiAliq: 0,
    ipiCst: '53',
  },
];

export const NCM_DEFAULT = '84146000';

export function getNcmInfo(ncm: string): NcmInfo {
  const clean = ncm.replace(/\D/g, '').padStart(8, '0');
  return (
    NCM_TABLE.find((n) => n.ncm === clean) ?? {
      ncm: clean,
      descricao: 'Produto',
      ipiAliq: 0,
      ipiCst: '53',
    }
  );
}

/** Formata NCM com pontos: 84146000 → 8414.60.00 */
export function formatNcm(ncm: string): string {
  const c = ncm.replace(/\D/g, '').padStart(8, '0');
  return `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}`;
}

/** Remove pontos do NCM: 8414.60.00 → 84146000 */
export function cleanNcm(ncm: string): string {
  return ncm.replace(/\D/g, '').padStart(8, '0');
}

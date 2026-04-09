/**
 * Tabela de códigos IBGE de municípios brasileiros.
 * Focada em SP/ABC Paulista e principais capitais.
 * Usada para preencher cMun no XML da NF-e 4.00.
 */

// Normalize: lowercase, sem acento
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const CITY_CODES: Record<string, string> = {
  // ── SP – ABC Paulista ─────────────────────────────────────
  'santo andre':              '3547809',
  'maua':                     '3529401',
  'diadema':                  '3513801',
  'sao bernardo do campo':    '3548708',
  'sao caetano do sul':       '3548906',
  'ribeirao pires':           '3543303',
  'rio grande da serra':      '3544509',
  // ── SP – Grande São Paulo ─────────────────────────────────
  'sao paulo':                '3550308',
  'guarulhos':                '3518800',
  'campinas':                 '3509502',
  'osasco':                   '3534401',
  'sorocaba':                 '3552205',
  'mogi das cruzes':          '3530706',
  'suzano':                   '3552502',
  'itaquaquecetuba':          '3523602',
  'taboao da serra':          '3552601',
  'barueri':                  '3505708',
  'carapicuiba':              '3510609',
  'cotia':                    '3513108',
  'embu das artes':           '3515004',
  'ferraz de vasconcelos':    '3516408',
  'franco da rocha':          '3516903',
  'itapecerica da serra':     '3522505',
  'jandira':                  '3524600',
  'poa':                      '3539806',
  'poá':                      '3539806',
  'santana de parnaiba':      '3546801',
  'santos':                   '3548500',
  'sao jose dos campos':      '3549904',
  'sao jose do rio preto':    '3549805',
  'piracicaba':               '3538709',
  'sao vicente':              '3551702',
  'praia grande':             '3541000',
  'jundiai':                  '3525904',
  'americana':                '3501608',
  'limeira':                  '3527108',
  'marilia':                  '3529005',
  'presidente prudente':      '3541406',
  'ribeirao preto':           '3543402',
  // ── Outros estados – capitais e cidades relevantes ────────
  'rio de janeiro':           '3304557',
  'niteroi':                  '3303302',
  'duque de caxias':          '3301702',
  'nova iguacu':              '3303500',
  'belo horizonte':           '3106200',
  'uberlandia':               '3170206',
  'contagem':                 '3118601',
  'curitiba':                 '4106902',
  'londrina':                 '4113700',
  'maringa':                  '4115200',
  'porto alegre':             '4314902',
  'caxias do sul':            '4305108',
  'recife':                   '2611606',
  'salvador':                 '2927408',
  'fortaleza':                '2304400',
  'manaus':                   '1302603',
  'belem':                    '1501402',
  'goiania':                  '5208707',
  'brasilia':                 '5300108',
  'florianopolis':            '4205407',
  'natal':                    '2408102',
  'campo grande':             '5002704',
  'cuiaba':                   '5103403',
  'porto velho':              '1100205',
  'macapa':                   '1600303',
  'boa vista':                '1400100',
  'palmas':                   '1721000',
  'macei':                    '2704302',
  'aracaju':                  '2800308',
  'joao pessoa':              '2507507',
  'teresina':                 '2211001',
  'sao luis':                 '2111300',
};

/**
 * Retorna o código IBGE do município a partir do nome e UF.
 * Normaliza o nome (remove acentos, lowercase) antes de buscar.
 * Retorna '' se não encontrado — o usuário deverá preencher manualmente.
 */
export function getCityCode(city: string, _uf?: string): string {
  if (!city) return '';
  const key = norm(city);
  return CITY_CODES[key] ?? '';
}

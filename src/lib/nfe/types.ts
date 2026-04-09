// ============================================================
// NF-e 4.00 — Tipos TypeScript
// Simples Nacional (CRT=1) — fábrica de coifas
// ============================================================

export type RegimeTributario = 1 | 3; // 1=Simples Nacional, 3=Lucro Presumido

export type NfeSettings = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  ie: string;
  crt: RegimeTributario;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  cMun: string;           // Código IBGE município (7 dígitos)
  uf: string;             // UF sigla, ex: 'SP'
  cUF: number;            // Código IBGE estado, ex: 35
  cep: string;            // Sem máscara
  telefone: string;
  proximaNf: number;
  serie: number;
  ambiente: '1' | '2';   // '1'=produção, '2'=homologação
  naturezaOp: string;
};

export type NfeItem = {
  id: string;
  cProd: string;          // Código interno do produto
  xProd: string;          // Descrição
  ncm: string;            // 8 dígitos sem ponto
  cfop: string;           // 4 dígitos
  uCom: string;           // Unidade comercial: UN, M2, KG, etc.
  qCom: number;           // Quantidade
  vUnCom: number;         // Valor unitário
  vProd: number;          // Total do item
  ipiCst: string;         // CST IPI: '53'=não tributado, '50'=tributado
  ipiAliq: number;        // 0 para CST 53
};

export type NfeDestinatario = {
  xNome: string;
  doc: string;            // CNPJ (14 dígitos) ou CPF (11 dígitos), sem máscara
  tipDoc: 'CNPJ' | 'CPF';
  indIEDest: '1' | '2' | '9'; // 1=contribuinte, 2=isento, 9=não contribuinte
  ie?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  cMun?: string;          // Código IBGE
  uf?: string;
  cep?: string;           // Sem máscara
};

export type NfeData = {
  // Identificação
  nNF: number;            // Número da NF
  serie: number;
  dhEmi: string;          // ISO 8601 com fuso: '2026-04-08T10:00:00-03:00'
  natOp: string;
  tpNF: '0' | '1';       // 0=entrada, 1=saída
  indFinal: '0' | '1';   // 0=normal, 1=consumidor final
  indPres: '1' | '2' | '3' | '4' | '9'; // 1=presencial, 9=operação não presencial
  tpAmb: '1' | '2';      // 1=produção, 2=homologação
  // Emitente (vem do nfe_settings)
  emit: NfeSettings;
  // Destinatário
  dest: NfeDestinatario;
  // Itens
  items: NfeItem[];
  // Totais calculados
  totalProd: number;
  totalFrete: number;
  totalNF: number;
  // Transporte
  modFrete: '0' | '1' | '2' | '3' | '4' | '9';
  // Pagamento
  tpPagamento: string;    // '01'=dinheiro, '02'=cheque, '03'=CC, '15'=boleto, '90'=sem pagamento
  // Informações adicionais
  infCpl?: string;
};

export type NotaFiscal = {
  id: string;
  nfNumber: number;
  serie: number;
  quoteId?: string;
  customerName: string;
  customerDoc: string;
  naturezaOp: string;
  cfop: string;
  totalProdutos: number;
  totalFrete: number;
  totalNf: number;
  regimeTrib: RegimeTributario;
  modFrete: number;
  tpPagamento: string;
  status: 'rascunho' | 'xml_gerado' | 'emitida' | 'cancelada';
  xmlGerado?: string;
  chaveAcesso?: string;
  protocolo?: string;
  dataEmissao: string;
  observacoes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

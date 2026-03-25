// Stub — AI invoice generator (future integration with Claude API)

export type InvoiceGeneratorInput = {
  quoteId: string;
  customerId: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  total: number;
};

export type InvoiceGeneratorOutput = {
  invoiceText: string;
  suggestedPaymentTerms: string;
};

// Type used by the invoicing page (fiscal details)
export type InvoiceInput = {
  customerLocation: string;
  productType: string;
  productDetails: string;
};

export type InvoiceOutput = {
  ncm: string;
  cfop: string;
  icms: string;
  ipi: string;
  pisCofins: string;
};

export async function generateIntelligentInvoice(
  input: InvoiceGeneratorInput
): Promise<InvoiceGeneratorOutput> {
  return {
    invoiceText: `Nota Fiscal referente ao orçamento ${input.quoteId}.\nTotal: R$ ${input.total.toFixed(2)}`,
    suggestedPaymentTerms: '30/60/90 dias',
  };
}

// Used by invoicing page — returns fiscal classification stub
export async function generateInvoice(_input: InvoiceInput): Promise<InvoiceOutput> {
  return {
    ncm: '8414.60.00',
    cfop: '5.102',
    icms: '12%',
    ipi: 'Isento',
    pisCofins: 'Regime cumulativo',
  };
}

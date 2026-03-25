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

export async function generateIntelligentInvoice(
  input: InvoiceGeneratorInput
): Promise<InvoiceGeneratorOutput> {
  // Future: integrate with Claude API for smart invoice generation
  return {
    invoiceText: `Nota Fiscal referente ao orçamento ${input.quoteId}.\nTotal: R$ ${input.total.toFixed(2)}`,
    suggestedPaymentTerms: '30/60/90 dias',
  };
}

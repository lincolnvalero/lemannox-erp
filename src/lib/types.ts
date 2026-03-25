export type ProductVariation = {
  id: string;
  material: string;
  price: number;
};

export type Product = {
  id: string;
  category: string;
  model: string;
  measurement: string;
  variations: ProductVariation[];
};

export type Customer = {
  id: string;
  name: string;
  cnpj?: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  category?: string;
  rating?: number;
  totalSpent?: number;
  joinDate?: string;
  company?: string;
  financialStatus?: 'Pago' | 'Em dia' | 'Vencido';
  productionStatus?: 'Em orçamento' | 'Aprovado' | 'Produção' | 'Entrega' | 'Concluído' | 'Devolução para ajuste' | 'Pausado';
};

export type ProductionStatus = {
  concluidoEm: string | null;
  entregueEm: string | null;
};

export type QuoteItem = {
  id: string;
  name: string;
  category?: string;
  material: string;
  measurement: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tax?: number;
  notes?: string;
  productionStatus?: ProductionStatus;
};

export type Quote = {
  id: string;
  quoteNumber: number;
  customerId: string;
  customerName: string;
  customerDetails?: {
    cnpj?: string;
    contactName?: string;
    contactPhone?: string;
    email?: string;
  };
  obra?: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado' | 'faturado' | 'produzindo' | 'entregue';
  items: QuoteItem[];
  subtotal: number;
  total: number;
  freight?: number;
  discount?: number;
  date: string;
  expiryDate?: string;
  deliveryTime?: string;
  manufacturingDeadline?: string;
  actualDeliveryDate?: string;
  osNumber?: number;
  notes?: string;
  paymentTerms?: string;
  warranty?: string;
};

export type FinancialTransaction = {
  id: string;
  idLanc?: number;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  category: string;
  transactionDate: string;
  dueDate?: string;
  status: 'pago' | 'pendente';
  relatedType?: string;
  relatedId?: string;
};

export type ChartOfAccount = {
  id: string;
  name: string;
  type: 'entrada' | 'saida';
};

export type SupplierPerformance = {
  price: number;
  quality: number;
  delivery: number;
};

export type Supplier = {
  id: string;
  name: string;
  cnpj?: string;
  category: string;
  contactName: string;
  phone: string;
  email?: string;
  rating?: number;
  totalSpent?: number;
  joinDate?: string;
  performance?: SupplierPerformance;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  supplierId?: string;
  supplierName?: string;
  category?: string;
};

export type ScheduleItem = {
  quoteId: string;
  itemIndex: number;
  pedido: number;
  osNumber?: number;
  data: string;
  cliente: string;
  obra: string;
  produto: string;
  previsao: string;
  concluidoEm: string | null;
  entregueEm: string | null;
};

export type OrdemServico = {
  id: string;
  osNumber: number;
  quoteId?: string;
  quoteNumber?: number;
  customerName?: string;
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt?: string;
};

// Extended type for calculator page (sheet metal with dimensions)
export type RawMaterial = Material & {
  width?: number;
  height?: number;
  thickness?: number;
  density?: number;
  price: number;
};

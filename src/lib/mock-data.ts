import type { Product, Customer, FinancialTransaction, ChartOfAccount, Supplier, Material } from './types';

export const mockProducts: Product[] = [
  { id: 'p1', category: 'Coifa de Cozinha', model: 'Slim', measurement: '60x50cm', variations: [{ id: 'v1', material: 'Inox 430', price: 850 }, { id: 'v2', material: 'Inox 304', price: 1100 }] },
  { id: 'p2', category: 'Coifa de Cozinha', model: 'Slim', measurement: '80x50cm', variations: [{ id: 'v3', material: 'Inox 430', price: 980 }, { id: 'v4', material: 'Inox 304', price: 1250 }] },
  { id: 'p3', category: 'Coifa de Churrasqueira', model: 'Gourmet', measurement: '90x70cm', variations: [{ id: 'v5', material: 'Inox 430', price: 1200 }, { id: 'v6', material: 'Inox 304', price: 1600 }, { id: 'v7', material: 'Aço Carbono', price: 950 }] },
  { id: 'p4', category: 'Grill', model: 'Pro', measurement: '60x40cm', variations: [{ id: 'v8', material: 'Inox 430', price: 450 }, { id: 'v9', material: 'Inox 304', price: 620 }] },
  { id: 'p5', category: 'Grelha', model: 'Standard', measurement: '50x35cm', variations: [{ id: 'v10', material: 'Inox 430', price: 280 }, { id: 'v11', material: 'Aço Carbono', price: 180 }] },
];

export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'Construtora Silva & Filhos', cnpj: '12.345.678/0001-90', contactName: 'Roberto Silva', contactPhone: '(11) 99123-4567', email: 'roberto@silvafilhos.com.br', city: 'São Paulo', state: 'SP', category: 'construtora' },
  { id: 'c2', name: 'Cozinhas Modernas Ltda', cnpj: '98.765.432/0001-10', contactName: 'Ana Souza', contactPhone: '(11) 98765-4321', email: 'ana@cozinhasmodernas.com.br', city: 'Campinas', state: 'SP', category: 'revendedor' },
  { id: 'c3', name: 'Carlos Menezes', cnpj: '', contactName: 'Carlos Menezes', contactPhone: '(21) 97654-3210', email: 'carlos@email.com', city: 'Rio de Janeiro', state: 'RJ', category: 'pessoa_fisica' },
];

export const mockSuppliers: Supplier[] = [
  { id: 's1', name: 'Inox Distribuidora Nacional', cnpj: '11.222.333/0001-44', category: 'materiais', contactName: 'Marcos Lima', phone: '(11) 3456-7890', email: 'marcos@inoxnacional.com.br', rating: 4.5, totalSpent: 85000, joinDate: '2023-01-15', performance: { price: 4, quality: 5, delivery: 4 } },
  { id: 's2', name: 'Aço & Cia', cnpj: '55.666.777/0001-88', category: 'materiais', contactName: 'Fernanda Costa', phone: '(11) 2345-6789', email: 'fernanda@acoecialtda.com.br', rating: 3.8, totalSpent: 42000, joinDate: '2023-06-20', performance: { price: 5, quality: 3, delivery: 3 } },
];

export const mockFinancialTransactions: FinancialTransaction[] = [
  { id: 'ft1', idLanc: 1, description: 'Venda Orçamento #1500', amount: 3500, type: 'entrada', category: 'Vendas', transactionDate: '2026-01-10', status: 'pago' },
  { id: 'ft2', idLanc: 2, description: 'Compra Inox 304', amount: 1200, type: 'saida', category: 'Matéria Prima', transactionDate: '2026-01-12', status: 'pago' },
  { id: 'ft3', idLanc: 3, description: 'Venda Orçamento #1501', amount: 5800, type: 'entrada', category: 'Vendas', transactionDate: '2026-01-18', status: 'pago' },
  { id: 'ft4', idLanc: 4, description: 'Conta de Energia', amount: 680, type: 'saida', category: 'Energia Elétrica', transactionDate: '2026-02-05', status: 'pago' },
  { id: 'ft5', idLanc: 5, description: 'Venda Orçamento #1502', amount: 2900, type: 'entrada', category: 'Vendas', transactionDate: '2026-02-10', dueDate: '2026-03-10', status: 'pendente' },
];

export const initialAccounts: Omit<ChartOfAccount, 'id'>[] = [
  { name: 'Vendas', type: 'entrada' },
  { name: 'Serviços', type: 'entrada' },
  { name: 'Outras Receitas', type: 'entrada' },
  { name: 'Matéria Prima', type: 'saida' },
  { name: 'Mão de Obra', type: 'saida' },
  { name: 'Energia Elétrica', type: 'saida' },
  { name: 'Aluguel', type: 'saida' },
  { name: 'Transporte / Frete', type: 'saida' },
  { name: 'Impostos', type: 'saida' },
  { name: 'Manutenção', type: 'saida' },
  { name: 'Administrativo', type: 'saida' },
  { name: 'Marketing', type: 'saida' },
];

export const mockMaterials: Material[] = [
  { id: 'm1', name: 'Chapa Inox 430 1.2mm', unit: 'kg', quantity: 320, minQuantity: 100, unitCost: 18.5, supplierId: 's1', supplierName: 'Inox Distribuidora Nacional', category: 'Inox' },
  { id: 'm2', name: 'Chapa Inox 304 1.5mm', unit: 'kg', quantity: 180, minQuantity: 80, unitCost: 26.0, supplierId: 's1', supplierName: 'Inox Distribuidora Nacional', category: 'Inox' },
  { id: 'm3', name: 'Chapa Aço Carbono 2mm', unit: 'kg', quantity: 75, minQuantity: 100, unitCost: 9.5, supplierId: 's2', supplierName: 'Aço & Cia', category: 'Aço' },
  { id: 'm4', name: 'Motor Exaustor 127V', unit: 'un', quantity: 12, minQuantity: 5, unitCost: 185.0, category: 'Elétrico' },
  { id: 'm5', name: 'Filtro de Alumínio 45x25cm', unit: 'un', quantity: 48, minQuantity: 20, unitCost: 28.0, category: 'Filtros' },
];

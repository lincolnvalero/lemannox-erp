export const PRODUCT_GROUPS = [
  { value: 'coifas', label: 'Coifas' },
  { value: 'grills', label: 'Grills' },
  { value: 'grelhas', label: 'Grelhas' },
  { value: 'caixas', label: 'Caixas Refratárias' },
  { value: 'complementos', label: 'Complementos' },
  { value: 'outros', label: 'Outros' },
] as const;

// Produtos cadastrados antes do campo Grupo existir não têm esse valor salvo.
// Esse mapa por categoria mantém esses produtos visíveis até serem reeditados.
const LEGACY_CATEGORY_TO_GROUP: Record<string, string> = {
  'Coifa de Cozinha': 'coifas',
  'Coifa de Churrasqueira': 'coifas',
  Grill: 'grills',
  Grelha: 'grelhas',
  'Caixa Refratária': 'caixas',
  Outros: 'outros',
};

export function resolveProductGroup(product: { group?: string; category: string }): string {
  return product.group || LEGACY_CATEGORY_TO_GROUP[product.category] || 'complementos';
}

export function getGroupLabel(value: string): string {
  return PRODUCT_GROUPS.find((g) => g.value === value)?.label || value;
}

// Grupos criados livremente pelo usuário (não fazem parte da lista fixa acima).
export function collectCustomGroups(products: { group?: string; category: string }[]): string[] {
  const known = new Set<string>(PRODUCT_GROUPS.map((g) => g.value));
  const custom = new Set<string>();
  for (const p of products) {
    const g = resolveProductGroup(p);
    if (!known.has(g)) custom.add(g);
  }
  return Array.from(custom).sort();
}

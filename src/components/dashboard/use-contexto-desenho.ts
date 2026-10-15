'use client';

// Dados de apoio para decidir se um item de orçamento tem imagem (ver
// lib/coifa-viewer-from-item.ts): os produtos do catálogo (para conferir o
// código do produto) e os padrões da Tabela de Preços. Só busca quando o
// orçamento tem algum item que pode ser uma coifa do catálogo.

import { useEffect, useMemo, useState } from 'react';
import type { QuoteItem } from '@/lib/types';
import { getProducts } from '@/app/(dashboard)/products/actions';
import { getPadroesTabela } from '@/app/(dashboard)/calculator/actions';
import type { PadroesTabela } from '@/lib/coifa-padroes';
import type { ContextoDesenho, ProdutoCatalogo } from '@/lib/coifa-viewer-from-item';

const PARECE_COIFA = /coifa|\btube\b|l[ií]nea|piramidal|\bbox\b/i;

/** `pronto` = os dados de apoio já chegaram (antes disso, não dá para afirmar que um item está sem imagem). */
export function useContextoDesenho(items: QuoteItem[]): ContextoDesenho & { pronto: boolean } {
  const precisa = useMemo(
    () => items.some((i) => !i.coifaParams && !i.semDesenho && i.productId && PARECE_COIFA.test(i.name ?? '')),
    [items],
  );
  const [produtos, setProdutos] = useState<Map<string, ProdutoCatalogo> | null>(null);
  const [padroes, setPadroes] = useState<PadroesTabela | null>(null);
  useEffect(() => {
    if (!precisa) return;
    getProducts().then((r) => {
      if (r.success && r.products) {
        setProdutos(new Map(r.products.map((p) => [p.id, { category: p.category, model: p.model, measurement: p.measurement }])));
      }
    });
    getPadroesTabela().then(setPadroes);
  }, [precisa]);
  const pronto = !precisa || (produtos !== null && padroes !== null);
  return useMemo(() => ({ produtos, padroes, pronto }), [produtos, padroes, pronto]);
}

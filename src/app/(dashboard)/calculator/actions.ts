'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { CalculatorReferenceData, IluminacaoRow, MaoDeObraRow, ParametrosGlobais, RawMaterial } from '@/lib/types';
import { getMaterials } from '@/app/(dashboard)/materials/actions';

export async function getCalculatorReferenceData(): Promise<{
  success: boolean;
  data?: CalculatorReferenceData;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const [materiaisRes, iluminacaoRes, maoDeObraRes, parametrosRes] = await Promise.all([
      getMaterials(),
      supabase.from('tabela_iluminacao').select('*'),
      supabase.from('mao_de_obra').select('*'),
      supabase.from('parametros_globais').select('*'),
    ]);

    if (!materiaisRes.success) throw new Error(materiaisRes.error);
    if (iluminacaoRes.error) throw iluminacaoRes.error;
    if (maoDeObraRes.error) throw maoDeObraRes.error;
    if (parametrosRes.error) throw parametrosRes.error;

    // Preços de chapa vêm do Estoque (materials, categoria "Chapa") — a
    // mesma tela onde os preços são reajustados quando o fornecedor muda.
    const materiaisEstoque: RawMaterial[] = (materiaisRes.materials ?? [])
      .filter(m => m.category === 'Chapa')
      .map(m => ({ ...m, price: m.unitCost }));

    // Idem para os componentes elétricos (lâmpada, fonte, botoeira, botão,
    // chicote) — antes viviam em parametros_globais, agora ficam no Estoque
    // como qualquer outro insumo.
    const eletricosEstoque: RawMaterial[] = (materiaisRes.materials ?? [])
      .filter(m => m.category === 'Elétrico Coifa')
      .map(m => ({ ...m, price: m.unitCost }));

    const tabelaIluminacao: IluminacaoRow[] = (iluminacaoRes.data ?? []).map(r => ({
      id: r.id, tipoCoifa: r.tipo_coifa, tipoInstalacao: r.tipo_instalacao, medida: r.medida,
      qtdLampadas: r.qtd_lampadas, qtdFonte: r.qtd_fonte, qtdBotoeira: r.qtd_botoeira, qtdBotao: r.qtd_botao, qtdChicote: r.qtd_chicote,
    }));

    const maoDeObra: MaoDeObraRow[] = (maoDeObraRes.data ?? []).map(r => ({
      id: r.id, medida: r.medida, modelo: r.modelo, valor: r.valor,
    }));

    const parametros: ParametrosGlobais = {};
    for (const row of parametrosRes.data ?? []) {
      parametros[row.chave] = row.valor;
    }

    return { success: true, data: { materiaisEstoque, eletricosEstoque, tabelaIluminacao, maoDeObra, parametros } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar dados de referência da calculadora';
    return { success: false, error: message };
  }
}

// ── Fase 3: emissão em lote da Tabela de Preços (Coifas de Cozinha) ────────
// Gera um produto por combinação de Modelo/Instalação/Medida, com uma
// variação de preço por material (430/304/Carbono) — mesmo formato que a
// tela de Produtos já usa. Roda em modo "upsert": se já existir um produto
// com a mesma Categoria/Modelo/Medida, atualiza; senão, cria. Nunca apaga
// produtos existentes.

const MEDIDAS = Array.from({ length: 21 }, (_, i) => 1000 + i * 100); // 1000..3000
const MATERIAIS: string[] = ['Inox 430', 'Inox 304', 'Aço Carbono'];

type LinhaTabela = { modelo: 'Box' | 'Piramidal' | 'Linea' | 'Tube'; instalacao: 'Parede' | 'Ilha'; modelLabel: string };

// Ordem descrita pelo Levi: Box de Parede, Box Ilha, Piramidal de Parede,
// Línea, Tube — todos dentro de "Coifas de Cozinha".
const LINHAS: LinhaTabela[] = [
  { modelo: 'Box', instalacao: 'Parede', modelLabel: 'Box de Parede' },
  { modelo: 'Box', instalacao: 'Ilha', modelLabel: 'Box Ilha' },
  { modelo: 'Piramidal', instalacao: 'Parede', modelLabel: 'Piramidal de Parede' },
  { modelo: 'Linea', instalacao: 'Parede', modelLabel: 'Línea' },
  { modelo: 'Tube', instalacao: 'Parede', modelLabel: 'Tube' },
];

// Só usada para a emissão em lote (a calculadora interativa agora deixa a
// escolha da chapa padrão para o usuário, por pedido explícito).
function chapaPadraoParaLote(width: number): number {
  return width <= 1900 ? 2000 : 3000;
}

export async function generatePriceTableCoifasCozinha(): Promise<{
  success: boolean;
  created?: number;
  updated?: number;
  errors?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const refResult = await getCalculatorReferenceData();
    if (!refResult.success || !refResult.data) {
      return { success: false, error: refResult.error || 'Não foi possível carregar os dados de referência.' };
    }
    const ref = refResult.data;

    const { calculateCoifa } = await import('@/lib/coifa-calculator');

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const category = 'Coifa de Cozinha';

    for (const linha of LINHAS) {
      for (const medida of MEDIDAS) {
        const measurement = `${medida}mm`;
        const variations: { id: string; material: string; price: number }[] = [];

        for (const material of MATERIAIS) {
          try {
            // Profundidade/altura padrão (não a mesma medida da largura — uma
            // coifa de 3000mm de largura não tem 3000mm de profundidade). Para
            // a Línea, usa a mesma altura padrão também como altura da
            // carenagem, para o preço em lote já incluir esse custo. Para a
            // Tube, o diâmetro é sempre fixo (500mm) — "medida" aqui vira a
            // ALTURA, que é o que realmente varia o preço desse modelo.
            const chapaPadrao = chapaPadraoParaLote(medida);
            const result = calculateCoifa({
              width: medida, depth: 700, height: linha.modelo === 'Tube' ? medida : 600,
              modelo: linha.modelo,
              carenagemHeight: linha.modelo === 'Linea' ? 600 : undefined,
              material,
              larguraPadrao: chapaPadrao,
              larguraPadraoCarenagem: chapaPadrao,
              tipoAplicacao: 'Cozinha', tipoInstalacao: linha.instalacao,
              filtro: 'nenhum', coletor: 'nenhum',
              frisoFrente: false, frisoLD: false, frisoLE: false, frisoLinhas: 1,
              outros: 0, paintingCost: ref.parametros['pintura_padrao'] ?? 0,
            }, ref);
            variations.push({ id: crypto.randomUUID(), material, price: Math.round(result.finalPrice * 100) / 100 });
          } catch (err) {
            errors.push(`${linha.modelLabel} ${medida}mm (${material}): ${err instanceof Error ? err.message : 'erro no cálculo'}`);
          }
        }

        if (variations.length === 0) continue;

        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('category', category)
          .eq('model', linha.modelLabel)
          .eq('measurement', measurement)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('products')
            .update({ variations, product_group: 'coifas' })
            .eq('id', existing.id);
          if (error) errors.push(`${linha.modelLabel} ${measurement}: ${error.message}`);
          else updated++;
        } else {
          const { error } = await supabase
            .from('products')
            .insert({ category, model: linha.modelLabel, measurement, variations, product_group: 'coifas' });
          if (error) errors.push(`${linha.modelLabel} ${measurement}: ${error.message}`);
          else created++;
        }
      }
    }

    revalidatePath('/products');
    return { success: true, created, updated, errors: errors.length > 0 ? errors : undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar tabela de preços';
    return { success: false, error: message };
  }
}

export async function updateParametroGlobal(chave: string, valor: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('parametros_globais').update({ valor }).eq('chave', chave);
    if (error) throw error;
    revalidatePath('/admin/parametros-calculadora');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar parâmetro';
    return { success: false, error: message };
  }
}

// ── Tabela de Mão de Obra — edição ─────────────────────────────────────────

export async function getMaoDeObra(): Promise<{ success: boolean; rows?: MaoDeObraRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mao_de_obra')
      .select('*')
      .order('modelo', { ascending: true })
      .order('medida', { ascending: true });
    if (error) throw error;
    const rows: MaoDeObraRow[] = (data ?? []).map(r => ({ id: r.id, medida: r.medida, modelo: r.modelo, valor: r.valor }));
    return { success: true, rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar mão de obra';
    return { success: false, error: message };
  }
}

export async function updateMaoDeObraValor(id: string, valor: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('mao_de_obra').update({ valor }).eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/mao-de-obra');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar mão de obra';
    return { success: false, error: message };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { CalculatorReferenceData, IluminacaoRow, MaoDeObraRow, ParametrosGlobais, RawMaterial } from '@/lib/types';
import { getMaterials } from '@/app/(dashboard)/materials/actions';
import {
  LOTE_PROFUNDIDADE, LOTE_ALTURA, LOTE_ALTURA_CORPO_LINEA, LOTE_ALTURA_CARENAGEM,
  CHAVE_TETO_LARGURA, CHAVE_TETO_PROFUNDIDADE, TETO_MIN, TETO_MAX, tetoPadraoDefinido,
} from '@/lib/coifa-padroes';

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

// ── Fase 3: emissão em lote da Tabela de Preços (Coifas) ───────────────────
// Gera um produto por combinação de Modelo/Instalação/Medida, com uma
// variação de preço por material (430/304/Carbono) — mesmo formato que a
// tela de Produtos já usa — para Coifas de Cozinha E de Churrasqueira.
//
// Pedido do Levi (16/9): os preços antigos das coifas não devem ser mantidos.
// Então, ao gerar: (1) os itens de Cozinha em formato LxPxA (ex: 1000x700x1000),
// que ficaram duplicados, são removidos; (2) a lista de Churrasqueira é
// refeita do zero; (3) a lista de Cozinha em formato "1000mm" é atualizada
// (mesma Categoria/Modelo/Medida = atualiza; senão cria). Só mexe nas
// categorias de coifa — nenhum outro produto é tocado.

const MEDIDAS = Array.from({ length: 21 }, (_, i) => 1000 + i * 100); // 1000..3000
const MATERIAIS: string[] = ['Inox 430', 'Inox 304', 'Aço Carbono'];

type LinhaTabela = { modelo: 'Box' | 'Piramidal' | 'Linea' | 'Tube'; instalacao: 'Parede' | 'Ilha'; modelLabel: string };

// Box de Parede, Box Ilha, Piramidal de Parede (3 águas), Piramidal Ilha
// (4 águas), Línea e Tube — dentro de cada categoria.
const LINHAS: LinhaTabela[] = [
  { modelo: 'Box', instalacao: 'Parede', modelLabel: 'Box de Parede' },
  { modelo: 'Box', instalacao: 'Ilha', modelLabel: 'Box Ilha' },
  { modelo: 'Piramidal', instalacao: 'Parede', modelLabel: 'Piramidal de Parede' },
  { modelo: 'Piramidal', instalacao: 'Ilha', modelLabel: 'Piramidal Ilha' },
  { modelo: 'Linea', instalacao: 'Parede', modelLabel: 'Línea' },
  { modelo: 'Tube', instalacao: 'Parede', modelLabel: 'Tube' },
];

const APLICACOES = [
  { tipoAplicacao: 'Cozinha', category: 'Coifa de Cozinha' },
  { tipoAplicacao: 'Churrasqueira', category: 'Coifa de Churrasqueira' },
] as const;

// Só usada para a emissão em lote (a calculadora interativa agora deixa a
// escolha da chapa padrão para o usuário, por pedido explícito).
function chapaPadraoParaLote(width: number): number {
  return width <= 1900 ? 2000 : 3000;
}

// Medida no formato antigo "LxPxA" (ex: 1000x700x1000).
const MEDIDA_LXPXA = /^\s*\d+\s*[x×]\s*\d+\s*[x×]\s*\d+/i;

export async function generatePriceTableCoifas(): Promise<{
  success: boolean;
  created?: number;
  updated?: number;
  removed?: number;
  errors?: string[];
  error?: string;
  /** true quando falta definir o teto padrão da Piramidal antes de gerar. */
  precisaTetoPadrao?: boolean;
}> {
  try {
    const supabase = await createClient();
    const refResult = await getCalculatorReferenceData();
    if (!refResult.success || !refResult.data) {
      return { success: false, error: refResult.error || 'Não foi possível carregar os dados de referência.' };
    }
    const ref = refResult.data;

    // Sem teto, o custo do teto da Piramidal entraria como zero e a tabela
    // sairia com preço abaixo do real — por isso é obrigatório (checado aqui
    // também, não só na tela).
    const teto = tetoPadraoDefinido(ref.parametros);
    if (!teto) {
      return { success: false, precisaTetoPadrao: true, error: 'Defina o teto padrão da Piramidal antes de gerar a tabela.' };
    }

    const { calculateCoifa } = await import('@/lib/coifa-calculator');

    const errors: string[] = [];
    type NovoProduto = { category: string; model: string; measurement: string; variations: { id: string; material: string; price: number }[] };
    const novos: NovoProduto[] = [];

    // 1) Calcula tudo em memória primeiro: se algo estiver errado no
    //    Estoque/tabelas, nada é apagado.
    for (const { tipoAplicacao, category } of APLICACOES) {
      for (const linha of LINHAS) {
        for (const medida of MEDIDAS) {
          const variations: NovoProduto['variations'] = [];
          for (const material of MATERIAIS) {
            try {
              // Profundidade/altura padrão (não a mesma medida da largura — uma
              // coifa de 3000mm de largura não tem 3000mm de profundidade). Para
              // a Línea, o corpo é baixo (100mm) e a carenagem tem altura própria
              // — só ela entra no preço. Para a Tube, o diâmetro é sempre fixo
              // (500mm) — "medida" aqui vira a ALTURA. A Piramidal usa o teto
              // padrão e, por ora, não leva carenagem na tabela.
              const chapaPadrao = chapaPadraoParaLote(medida);
              const result = calculateCoifa({
                width: medida,
                depth: LOTE_PROFUNDIDADE,
                height: linha.modelo === 'Tube' ? medida : linha.modelo === 'Linea' ? LOTE_ALTURA_CORPO_LINEA : LOTE_ALTURA,
                modelo: linha.modelo,
                tetoWidth: linha.modelo === 'Piramidal' ? teto.largura : undefined,
                tetoDepth: linha.modelo === 'Piramidal' ? teto.profundidade : undefined,
                carenagemHeight: linha.modelo === 'Linea' ? LOTE_ALTURA_CARENAGEM : undefined,
                material,
                larguraPadrao: chapaPadrao,
                larguraPadraoCarenagem: chapaPadrao,
                tipoAplicacao, tipoInstalacao: linha.instalacao,
                filtro: 'nenhum', coletor: 'nenhum',
                frisoFrente: false, frisoLD: false, frisoLE: false, frisoLinhas: 1,
                outros: 0, paintingCost: ref.parametros['pintura_padrao'] ?? 0,
              }, ref);
              variations.push({ id: crypto.randomUUID(), material, price: Math.round(result.finalPrice * 100) / 100 });
            } catch (err) {
              errors.push(`${category} — ${linha.modelLabel} ${medida}mm (${material}): ${err instanceof Error ? err.message : 'erro no cálculo'}`);
            }
          }
          if (variations.length > 0) novos.push({ category, model: linha.modelLabel, measurement: `${medida}mm`, variations });
        }
      }
    }
    if (novos.length === 0) {
      return { success: false, error: 'Nenhum preço foi calculado — verifique o Estoque (chapas e elétricos) e as tabelas da Memória de Cálculos.', errors };
    }

    // 2) Limpeza dos lançamentos antigos (só categorias de coifa).
    let removed = 0;
    const idsParaApagar: string[] = [];
    const { data: antigos, error: erroAntigos } = await supabase
      .from('products')
      .select('id, category, measurement')
      .in('category', APLICACOES.map(a => a.category));
    if (erroAntigos) throw erroAntigos;
    for (const p of antigos ?? []) {
      const churrasqueira = p.category === 'Coifa de Churrasqueira';
      if (churrasqueira || MEDIDA_LXPXA.test(String(p.measurement ?? ''))) idsParaApagar.push(p.id as string);
    }
    // Em lotes pequenos para não estourar o tamanho da URL do PostgREST.
    for (let i = 0; i < idsParaApagar.length; i += 100) {
      const lote = idsParaApagar.slice(i, i + 100);
      const { error } = await supabase.from('products').delete().in('id', lote);
      if (error) throw error;
      removed += lote.length;
    }

    // 3) Grava: o que já existe na Cozinha é atualizado; o resto é criado.
    let created = 0;
    let updated = 0;
    const { data: existentes, error: erroExistentes } = await supabase
      .from('products')
      .select('id, category, model, measurement')
      .in('category', APLICACOES.map(a => a.category));
    if (erroExistentes) throw erroExistentes;
    const chave = (c: string, m: string, med: string) => `${c}|${m}|${med}`;
    const idPorChave = new Map<string, string>((existentes ?? []).map(p => [chave(p.category, p.model, p.measurement), p.id as string]));

    const paraCriar: (NovoProduto & { product_group: string })[] = [];
    for (const n of novos) {
      const id = idPorChave.get(chave(n.category, n.model, n.measurement));
      if (id) {
        const { error } = await supabase.from('products').update({ variations: n.variations, product_group: 'coifas' }).eq('id', id);
        if (error) errors.push(`${n.category} — ${n.model} ${n.measurement}: ${error.message}`);
        else updated++;
      } else {
        paraCriar.push({ ...n, product_group: 'coifas' });
      }
    }
    // Criação em lotes (centenas de linhas): uma ida ao banco por 100 produtos.
    for (let i = 0; i < paraCriar.length; i += 100) {
      const lote = paraCriar.slice(i, i + 100);
      const { error } = await supabase.from('products').insert(lote);
      if (error) errors.push(`Falha ao criar ${lote.length} produto(s) (a partir de ${lote[0].category} — ${lote[0].model} ${lote[0].measurement}): ${error.message}`);
      else created += lote.length;
    }

    revalidatePath('/products');
    return { success: true, created, updated, removed, errors: errors.length > 0 ? errors : undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar tabela de preços';
    return { success: false, error: message };
  }
}

// Teto padrão da Piramidal (só leitura) — usado pra desenhar no orçamento as
// Piramidais de catálogo com o mesmo teto usado no preço delas.
export async function getTetoPadraoPiramidal(): Promise<{ largura: number; profundidade: number } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('parametros_globais')
      .select('chave, valor')
      .in('chave', [CHAVE_TETO_LARGURA, CHAVE_TETO_PROFUNDIDADE]);
    if (error) throw error;
    const params: Record<string, number> = {};
    for (const r of data ?? []) params[r.chave] = Number(r.valor);
    return tetoPadraoDefinido(params);
  } catch {
    return null;
  }
}

// Teto padrão da Piramidal usado na geração da Tabela de Preços.
export async function salvarTetoPadraoPiramidal(largura: number, profundidade: number): Promise<{ success: boolean; error?: string }> {
  try {
    const valido = (v: number) => Number.isFinite(v) && v >= TETO_MIN && v <= TETO_MAX;
    if (!valido(largura) || !valido(profundidade)) {
      return { success: false, error: `Informe largura e profundidade entre ${TETO_MIN} e ${TETO_MAX} mm.` };
    }
    const supabase = await createClient();
    const { error } = await supabase.from('parametros_globais').upsert([
      { chave: CHAVE_TETO_LARGURA, valor: Math.round(largura), descricao: 'Piramidal — largura do teto usada na Tabela de Preços (mm)' },
      { chave: CHAVE_TETO_PROFUNDIDADE, valor: Math.round(profundidade), descricao: 'Piramidal — profundidade do teto usada na Tabela de Preços (mm)' },
    ], { onConflict: 'chave' });
    if (error) throw error;
    revalidatePath('/admin/memoria');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar o teto padrão';
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

// Salva várias linhas de uma vez (a tela de Memória edita a tabela inteira
// e salva tudo com um único clique, em vez de um botão por célula).
export async function updateMaoDeObraRows(rows: { id: string; valor: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    for (const row of rows) {
      const { error } = await supabase.from('mao_de_obra').update({ valor: row.valor }).eq('id', row.id);
      if (error) throw error;
    }
    revalidatePath('/admin/memoria');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar mão de obra';
    return { success: false, error: message };
  }
}

// ── Tabela de Iluminação — edição ──────────────────────────────────────────

export async function getIluminacao(): Promise<{ success: boolean; rows?: IluminacaoRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tabela_iluminacao')
      .select('*')
      .order('tipo_coifa', { ascending: true })
      .order('tipo_instalacao', { ascending: true })
      .order('medida', { ascending: true });
    if (error) throw error;
    const rows: IluminacaoRow[] = (data ?? []).map(r => ({
      id: r.id, tipoCoifa: r.tipo_coifa, tipoInstalacao: r.tipo_instalacao, medida: r.medida,
      qtdLampadas: r.qtd_lampadas, qtdFonte: r.qtd_fonte, qtdBotoeira: r.qtd_botoeira, qtdBotao: r.qtd_botao, qtdChicote: r.qtd_chicote,
    }));
    return { success: true, rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar tabela de iluminação';
    return { success: false, error: message };
  }
}

export type IluminacaoRowUpdate = {
  id: string;
  qtdLampadas: number;
  qtdFonte: number;
  qtdBotoeira: number;
  qtdBotao: number;
  qtdChicote: number;
};

export async function updateIluminacaoRows(rows: IluminacaoRowUpdate[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    for (const row of rows) {
      const { error } = await supabase
        .from('tabela_iluminacao')
        .update({
          qtd_lampadas: row.qtdLampadas,
          qtd_fonte: row.qtdFonte,
          qtd_botoeira: row.qtdBotoeira,
          qtd_botao: row.qtdBotao,
          qtd_chicote: row.qtdChicote,
        })
        .eq('id', row.id);
      if (error) throw error;
    }
    revalidatePath('/admin/memoria');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar tabela de iluminação';
    return { success: false, error: message };
  }
}

// Salva vários parâmetros globais de uma vez (mesmo padrão de "Salvar
// alterações" único usado no resto da tela de Memória).
export async function updateParametrosGlobaisRows(rows: { chave: string; valor: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const tetoInvalido = rows.find(r =>
      (r.chave === CHAVE_TETO_LARGURA || r.chave === CHAVE_TETO_PROFUNDIDADE) && !(r.valor >= TETO_MIN && r.valor <= TETO_MAX));
    if (tetoInvalido) {
      return { success: false, error: `O teto padrão da Piramidal deve ficar entre ${TETO_MIN} e ${TETO_MAX} mm.` };
    }
    const supabase = await createClient();
    // upsert (não update): parâmetro que ainda não existe no banco — como o
    // teto padrão da Piramidal — passa a ser criado em vez de ignorado.
    const { error } = await supabase.from('parametros_globais').upsert(
      rows.map(r => ({ chave: r.chave, valor: r.valor })),
      { onConflict: 'chave' },
    );
    if (error) throw error;
    revalidatePath('/admin/memoria');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar parâmetros';
    return { success: false, error: message };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import type { CalculatorReferenceData, IluminacaoRow, MaoDeObraRow, ParametrosGlobais, RawMaterial } from '@/lib/types';
import { getMaterials } from '@/app/(dashboard)/materials/actions';
import { GRUPO_ARQUIVO } from '@/lib/product-groups';
import {
  LINHAS_TABELA, arredondarPrecoTabela,
  CHAVE_LOTE_PROFUNDIDADE, CHAVE_LOTE_ALTURA, CHAVE_LOTE_ALTURA_CORPO_LINEA,
  LOTE_PROFUNDIDADE_MIN, LOTE_PROFUNDIDADE_MAX, LOTE_ALTURA_MIN, LOTE_ALTURA_MAX, LOTE_CORPO_LINEA_MIN, LOTE_CORPO_LINEA_MAX,
  CATEGORIA_COIFA_COZINHA, CATEGORIA_COIFA_CHURRASQUEIRA,
  CHAVES_CARENAGEM_ATE_1300, CHAVES_CARENAGEM_ACIMA_1300, CARENAGEM_MIN, CARENAGEM_MAX,
  padroesTabelaDefinidos, carenagemParaTabela, tetoParaTabela, type PadroesTabela, type MedidasCarenagem,
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
// Itens antigos de coifa (tabela anterior: formato LxPxA, lista antiga de
// Churrasqueira, nomes longos etc.) NÃO são apagados: se o usuário confirmar,
// eles são ARQUIVADOS (grupo "arquivo"). Continuam existindo, então orçamentos
// já emitidos seguem editáveis e a Produção continua achando a categoria deles;
// só saem do seletor de novos orçamentos — assim não há duplicidade na tabela.
// Mesma Categoria/Modelo/Medida = atualiza; senão cria. Só mexe nas categorias
// de coifa.

const MEDIDAS = Array.from({ length: 21 }, (_, i) => 1000 + i * 100); // 1000..3000
const MATERIAIS: string[] = ['Inox 430', 'Inox 304', 'Aço Carbono'];

const APLICACOES = [
  { tipoAplicacao: 'Cozinha', category: CATEGORIA_COIFA_COZINHA },
  { tipoAplicacao: 'Churrasqueira', category: CATEGORIA_COIFA_CHURRASQUEIRA },
] as const;

// Só usada para a emissão em lote (a calculadora interativa agora deixa a
// escolha da chapa padrão para o usuário, por pedido explícito).
function chapaPadraoParaLote(width: number): number {
  return width <= 1900 ? 2000 : 3000;
}

// Chaves (categoria|modelo|medida) de TUDO o que a tabela nova gera. Qualquer
// outro produto de coifa é "antigo": formato LxPxA, nomes longos, Línea/Tube
// Churrasqueira (que deixaram de existir), nomes sem "de Parede" etc.
const chavePT = (categoria: string, modelo: string, medida: string) => `${categoria}|${modelo}|${medida}`;
const CHAVES_TABELA_NOVA = new Set(
  APLICACOES.flatMap(a => LINHAS_TABELA.filter(l => l.aplicacoes.includes(a.tipoAplicacao))
    .flatMap(l => MEDIDAS.map(m => chavePT(a.category, l.modelLabel, `${m}mm`)))),
);

// Quem exatamente é "antigo": produto de coifa que a tabela nova não gera e
// que ainda não foi arquivado.
async function idsAntigosCoifas(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, category, model, measurement, product_group')
    .in('category', APLICACOES.map(a => a.category));
  if (error) throw error;
  return (data ?? [])
    .filter(p => p.product_group !== GRUPO_ARQUIVO)
    .filter(p => !CHAVES_TABELA_NOVA.has(chavePT(String(p.category), String(p.model), String(p.measurement ?? '').trim())))
    .map(p => p.id as string);
}

// Só para mostrar na tela quantos itens antigos existem.
export async function contarAntigosCoifas(): Promise<number> {
  try {
    const supabase = await createClient();
    return (await idsAntigosCoifas(supabase)).length;
  } catch {
    return 0;
  }
}

// Só administradores emitem a tabela (decisão do Levi, 15/10: restringir).
async function usuarioEhAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

export async function generatePriceTableCoifas(opcoes: { arquivarAntigos?: boolean } = {}): Promise<{
  success: boolean;
  created?: number;
  updated?: number;
  archived?: number;
  errors?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!(await usuarioEhAdmin(supabase))) {
      return { success: false, error: 'Somente administradores podem emitir a Tabela de Preços.' };
    }
    const refResult = await getCalculatorReferenceData();
    if (!refResult.success || !refResult.data) {
      return { success: false, error: refResult.error || 'Não foi possível carregar os dados de referência.' };
    }
    const ref = refResult.data;

    const padroes = padroesTabelaDefinidos(ref.parametros);
    const { lote } = padroes;

    const { calculateCoifa } = await import('@/lib/coifa-calculator');

    const errors: string[] = [];
    type NovoProduto = { category: string; model: string; measurement: string; variations: { id: string; material: string; price: number }[] };
    const novos: NovoProduto[] = [];

    // 1) Calcula tudo em memória primeiro: se algo estiver errado no
    //    Estoque/tabelas, nada é apagado.
    for (const { tipoAplicacao, category } of APLICACOES) {
      for (const linha of LINHAS_TABELA.filter(l => l.aplicacoes.includes(tipoAplicacao))) {
        for (const medida of MEDIDAS) {
          const variations: NovoProduto['variations'] = [];
          for (const material of MATERIAIS) {
            try {
              // Profundidade/altura padrão (não a mesma medida da largura — uma
              // coifa de 3000mm de largura não tem 3000mm de profundidade). Para
              // a Línea, o corpo é baixo (100mm) e a carenagem usa a medida padrão
              // informada pelo usuário — só a altura dela entra no preço. Para a
              // Tube, o diâmetro é sempre fixo (500mm) — "medida" aqui vira a
              // ALTURA. A Piramidal usa o teto padrão e não leva carenagem na
              // tabela (na Calculadora, tudo é digitado).
              const chapaPadrao = chapaPadraoParaLote(medida);
              const teto = linha.modelo === 'Piramidal' ? tetoParaTabela(medida) : null;
              // Línea e Piramidal levem carenagem na tabela (mesma regra por faixa de largura).
              const carenagem = linha.modelo === 'Linea' || linha.modelo === 'Piramidal' ? carenagemParaTabela(medida, padroes) : null;
              const result = calculateCoifa({
                width: medida,
                depth: lote.profundidade,
                height: linha.modelo === 'Tube' ? medida : linha.modelo === 'Linea' ? lote.alturaCorpoLinea : lote.altura,
                modelo: linha.modelo,
                tetoWidth: teto?.largura,
                tetoDepth: teto?.profundidade,
                carenagemWidth: carenagem?.largura,
                carenagemDepth: carenagem?.profundidade,
                carenagemHeight: carenagem?.altura,
                material,
                larguraPadrao: chapaPadrao,
                larguraPadraoCarenagem: chapaPadrao,
                tipoAplicacao, tipoInstalacao: linha.instalacao,
                filtro: 'nenhum', coletor: 'nenhum',
                frisoFrente: false, frisoLD: false, frisoLE: false, frisoLinhas: 1,
                outros: 0, paintingCost: ref.parametros['pintura_padrao'] ?? 0,
              }, ref);
              // Cálculo com aviso (ex: chapa não encontrada no Estoque) = custo
              // faltando. Não grava preço incompleto: registra o aviso e pula.
              if (result.warnings.length > 0) {
                errors.push(`${category} — ${linha.modelLabel} ${medida}mm (${material}): ${result.warnings.join(' ')}`);
                continue;
              }
              // Preço de tabela: zera a unidade (2.354,90 → 2.350,00).
              variations.push({ id: crypto.randomUUID(), material, price: arredondarPrecoTabela(result.finalPrice) });
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

    // 2) Arquivamento opcional dos lançamentos antigos (nunca apaga).
    let archived = 0;
    if (opcoes.arquivarAntigos) {
      const idsParaArquivar = await idsAntigosCoifas(supabase);
      // Em lotes pequenos para não estourar o tamanho da URL do PostgREST.
      for (let i = 0; i < idsParaArquivar.length; i += 100) {
        const lote100 = idsParaArquivar.slice(i, i + 100);
        const { error } = await supabase.from('products').update({ product_group: GRUPO_ARQUIVO }).in('id', lote100);
        if (error) throw error;
        archived += lote100.length;
      }
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
    return { success: true, created, updated, archived, errors: errors.length > 0 ? errors : undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar tabela de preços';
    return { success: false, error: message };
  }
}

// Padrões da Tabela de Preços (teto, carenagem e corpo) — só
// leitura. Usado pra desenhar no orçamento os produtos de catálogo com as
// mesmas medidas usadas no preço deles.
export async function getPadroesTabela(): Promise<PadroesTabela> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('parametros_globais')
      .select('chave, valor')
      .in('chave', [
        ...Object.values(CHAVES_CARENAGEM_ATE_1300), ...Object.values(CHAVES_CARENAGEM_ACIMA_1300),
        CHAVE_LOTE_PROFUNDIDADE, CHAVE_LOTE_ALTURA, CHAVE_LOTE_ALTURA_CORPO_LINEA,
      ]);
    if (error) throw error;
    const params: Record<string, number> = {};
    for (const r of data ?? []) params[r.chave] = Number(r.valor);
    return padroesTabelaDefinidos(params);
  } catch {
    return padroesTabelaDefinidos({});
  }
}

// Salva os padrões usados na geração da Tabela de Preços.
export async function salvarPadroesTabela(
  carenagemAte1300: MedidasCarenagem,
  carenagemAcima1300: MedidasCarenagem,
  lote: { profundidade: number; altura: number; alturaCorpoLinea: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    if (!(await usuarioEhAdmin(supabase))) return { success: false, error: 'Somente administradores podem alterar os padrões da tabela.' };
    const dentro = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
    for (const c of [carenagemAte1300, carenagemAcima1300]) {
      if (!dentro(c.largura, CARENAGEM_MIN, CARENAGEM_MAX) || !dentro(c.profundidade, CARENAGEM_MIN, CARENAGEM_MAX) || !dentro(c.altura, CARENAGEM_MIN, CARENAGEM_MAX)) {
        return { success: false, error: `Carenagem: informe largura, profundidade e altura entre ${CARENAGEM_MIN} e ${CARENAGEM_MAX} mm.` };
      }
    }
    if (!dentro(lote.profundidade, LOTE_PROFUNDIDADE_MIN, LOTE_PROFUNDIDADE_MAX) || !dentro(lote.altura, LOTE_ALTURA_MIN, LOTE_ALTURA_MAX) || !dentro(lote.alturaCorpoLinea, LOTE_CORPO_LINEA_MIN, LOTE_CORPO_LINEA_MAX)) {
      return { success: false, error: `Corpo: profundidade ${LOTE_PROFUNDIDADE_MIN}–${LOTE_PROFUNDIDADE_MAX}, altura ${LOTE_ALTURA_MIN}–${LOTE_ALTURA_MAX} e corpo da Línea ${LOTE_CORPO_LINEA_MIN}–${LOTE_CORPO_LINEA_MAX} mm.` };
    }
    const car = (faixa: string, chaves: typeof CHAVES_CARENAGEM_ATE_1300, c: MedidasCarenagem) => [
      { chave: chaves.largura, valor: Math.round(c.largura), descricao: `Carenagem ${faixa} — largura usada na Tabela de Preços (mm)` },
      { chave: chaves.profundidade, valor: Math.round(c.profundidade), descricao: `Carenagem ${faixa} — profundidade usada na Tabela de Preços (mm)` },
      { chave: chaves.altura, valor: Math.round(c.altura), descricao: `Carenagem ${faixa} — altura usada na Tabela de Preços (mm)` },
    ];
    const { error } = await supabase.from('parametros_globais').upsert([
      { chave: CHAVE_LOTE_PROFUNDIDADE, valor: Math.round(lote.profundidade), descricao: 'Tabela de Preços — profundidade padrão das coifas (mm)' },
      { chave: CHAVE_LOTE_ALTURA, valor: Math.round(lote.altura), descricao: 'Tabela de Preços — altura padrão de Box e Piramidal (mm)' },
      { chave: CHAVE_LOTE_ALTURA_CORPO_LINEA, valor: Math.round(lote.alturaCorpoLinea), descricao: 'Tabela de Preços — altura do corpo da Línea (mm)' },
      ...car('até 1300', CHAVES_CARENAGEM_ATE_1300, carenagemAte1300),
      ...car('acima de 1300', CHAVES_CARENAGEM_ACIMA_1300, carenagemAcima1300),
    ], { onConflict: 'chave' });
    if (error) throw error;
    revalidatePath('/admin/memoria');
    revalidatePath('/calculator');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar os padrões da tabela';
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
    const chavesCarenagem: string[] = [...Object.values(CHAVES_CARENAGEM_ATE_1300), ...Object.values(CHAVES_CARENAGEM_ACIMA_1300)];
    const faixasLote: Record<string, [number, number]> = {
      [CHAVE_LOTE_PROFUNDIDADE]: [LOTE_PROFUNDIDADE_MIN, LOTE_PROFUNDIDADE_MAX],
      [CHAVE_LOTE_ALTURA]: [LOTE_ALTURA_MIN, LOTE_ALTURA_MAX],
      [CHAVE_LOTE_ALTURA_CORPO_LINEA]: [LOTE_CORPO_LINEA_MIN, LOTE_CORPO_LINEA_MAX],
    };
    const loteInvalido = rows.find(r => faixasLote[r.chave] && !(r.valor >= faixasLote[r.chave][0] && r.valor <= faixasLote[r.chave][1]));
    if (loteInvalido) {
      const [min, max] = faixasLote[loteInvalido.chave];
      return { success: false, error: `Valor fora da faixa permitida (${min} a ${max} mm).` };
    }
    if (rows.some(r => chavesCarenagem.includes(r.chave) && !(r.valor >= CARENAGEM_MIN && r.valor <= CARENAGEM_MAX))) {
      return { success: false, error: `A carenagem padrão da Línea deve ficar entre ${CARENAGEM_MIN} e ${CARENAGEM_MAX} mm.` };
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

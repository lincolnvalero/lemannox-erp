// Dados fixos do DESENHO de fabricação (furos, dobras, chapa e regras de
// oficina), informados pelo Levi/Adriano em 20/10/26. Ficam em
// parametros_globais (editáveis na Memória de Cálculos); os valores abaixo são
// os iniciais. Módulo puro: usado pelo 3D, pelos furos e pela planificação.

export type ParametrosDesenho = {
  // ── Furos ──
  /** Diâmetro dos 5 furos da botoeira (mm). */
  furoBotoeira: number;
  /** Distância entre os furos da botoeira, de centro a centro (mm) — e espaço (borda a borda) entre os botões. */
  espacoBotoeira: number;
  /** Diâmetro dos furos dos botões (mm) — churrasqueira usa 2 botões. */
  furoBotao: number;
  /** Diâmetro dos furos das lâmpadas (mm). */
  furoLampadaCozinha: number;
  furoLampadaChurrasqueira: number;
  /** Distância da lateral da coifa à 1ª lâmpada: até `lampLimite` de largura, `lampPercentual`% da largura; acima, `lampFixa` mm. */
  lampPercentual: number;
  lampLimite: number;
  lampFixa: number;
  // ── Dobras e chapa ──
  /** A dobradeira "aumenta" 1mm a cada dobra: peça aberta = medida final − dobras × este valor. */
  acrescimoDobra: number;
  /** Espessura das chapas (mm): 22 = frente e laterais; 24 = costas, teto e carenagens (Línea, Piramidal e Tube). */
  espessura22: number;
  espessura24: number;
  /** Margem da borda da chapa e espaço entre peças no encaixe (mm). */
  margemChapa: number;
  espacoPecas: number;
  /** Largura da chapa (mm) — o comprimento é a "chapa padrão" (2000 ou 3000). */
  larguraChapa: number;
  // ── Regras de oficina da Box (do exemplo "Coifa Israel", 900 × 650 × 880) ──
  abaTopo: number;           // aba de cima de frente/costas/laterais (20)
  frenteRetorno: number;     // frente: trecho antes do painel de baixo (35)
  frentePainel: number;      // frente: painel de baixo, onde ficam as lâmpadas (90)
  frenteAba: number;         // frente: aba depois do painel (40)
  frenteBainha: number;      // frente: bainha final (10)
  frentePainelRecuo: number; // frente: o painel de baixo é mais estreito, recuo de cada lado (51)
  costaRetorno: number;      // costas: retorno de baixo (100)
  costaDegrau: number;       // costas: degrau (15)
  costaAba: number;          // costas: aba (45)
  costaBainha: number;       // costas: bainha final (10)
  costaDobraExtra: number;   // costas: outra dobra de 10, antes da bainha final (Levi, 22/10)
  costaRecuo: number;        // costas: recuo lateral da parte de baixo (30)
  lateralAba: number;        // aba lateral das laterais (20)
  tampaFolga: number;        // tampa = (L − x) × (P − x) (20)
  alivioLargura: number;     // recorte de canto (8,7)
  alivioAltura: number;      // recorte de canto (15)
};

export const DESENHO_INICIAL: ParametrosDesenho = {
  furoBotoeira: 8.3, espacoBotoeira: 20, furoBotao: 19,
  furoLampadaCozinha: 56, furoLampadaChurrasqueira: 60,
  lampPercentual: 20, lampLimite: 1000, lampFixa: 200,
  acrescimoDobra: 1, espessura22: 0.8, espessura24: 0.6,
  margemChapa: 5, espacoPecas: 5, larguraChapa: 1250,
  abaTopo: 20, frenteRetorno: 35, frentePainel: 90, frenteAba: 40, frenteBainha: 10, frentePainelRecuo: 51,
  costaRetorno: 100, costaDegrau: 15, costaAba: 45, costaBainha: 10, costaDobraExtra: 10, costaRecuo: 30,
  lateralAba: 20, tampaFolga: 20, alivioLargura: 8.7, alivioAltura: 15,
};

/** Chave em parametros_globais de cada campo. */
export const CHAVE_DESENHO: Record<keyof ParametrosDesenho, string> = {
  furoBotoeira: 'desenho_furo_botoeira', espacoBotoeira: 'desenho_espaco_botoeira', furoBotao: 'desenho_furo_botao',
  furoLampadaCozinha: 'desenho_furo_lampada_cozinha', furoLampadaChurrasqueira: 'desenho_furo_lampada_churrasqueira',
  lampPercentual: 'desenho_lamp_percentual', lampLimite: 'desenho_lamp_limite', lampFixa: 'desenho_lamp_fixa',
  acrescimoDobra: 'desenho_acrescimo_dobra', espessura22: 'desenho_espessura_22', espessura24: 'desenho_espessura_24',
  margemChapa: 'desenho_margem_chapa', espacoPecas: 'desenho_espaco_pecas', larguraChapa: 'desenho_largura_chapa',
  abaTopo: 'desenho_box_aba_topo', frenteRetorno: 'desenho_box_frente_retorno', frentePainel: 'desenho_box_frente_painel',
  frenteAba: 'desenho_box_frente_aba', frenteBainha: 'desenho_box_frente_bainha', frentePainelRecuo: 'desenho_box_frente_painel_recuo',
  costaRetorno: 'desenho_box_costa_retorno', costaDegrau: 'desenho_box_costa_degrau', costaAba: 'desenho_box_costa_aba',
  costaBainha: 'desenho_box_costa_bainha', costaDobraExtra: 'desenho_box_costa_dobra_extra', costaRecuo: 'desenho_box_costa_recuo',
  lateralAba: 'desenho_box_lateral_aba', tampaFolga: 'desenho_box_tampa_folga',
  alivioLargura: 'desenho_box_alivio_largura', alivioAltura: 'desenho_box_alivio_altura',
};

/** Lê os dados de desenho de parametros_globais; o que não existir (ou for inválido) usa o valor inicial. */
export function desenhoDefinido(parametros: Record<string, number | undefined> | undefined): ParametrosDesenho {
  const out = { ...DESENHO_INICIAL };
  if (!parametros) return out;
  (Object.keys(CHAVE_DESENHO) as (keyof ParametrosDesenho)[]).forEach((k) => {
    const v = Number(parametros[CHAVE_DESENHO[k]]);
    if (Number.isFinite(v) && v >= 0 && parametros[CHAVE_DESENHO[k]] !== undefined) out[k] = v;
  });
  return out;
}

/**
 * Distância da lateral da coifa à BORDA do furo da 1ª (e da última) lâmpada:
 * 20% da largura até 1000mm, 200mm acima (Levi, 22/10: vale até a borda do furo).
 */
export const distanciaLampadaBorda = (largura: number, p: ParametrosDesenho) =>
  largura <= p.lampLimite ? (p.lampPercentual / 100) * largura : p.lampFixa;

/**
 * Centros (x, a partir do centro da coifa) das `n` lâmpadas de diâmetro
 * `diametro` numa fileira de largura `largura`. A 1ª e a última têm a borda do
 * furo a `distanciaLampadaBorda` da lateral; as demais, a distâncias iguais.
 */
export function posicoesLampadasX(n: number, largura: number, p: ParametrosDesenho, diametro: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const d = distanciaLampadaBorda(largura, p) + diametro / 2;
  const x0 = -largura / 2 + d;
  const x1 = largura / 2 - d;
  return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
}

export const diametroFuroLampada = (aplicacao: 'Cozinha' | 'Churrasqueira' | undefined, p: ParametrosDesenho) =>
  aplicacao === 'Churrasqueira' ? p.furoLampadaChurrasqueira : p.furoLampadaCozinha;

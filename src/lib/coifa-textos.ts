// Textos de apresentação da coifa no orçamento (abaixo da imagem). Só dizem o
// que está nos dados do item — nada é inventado.

import type { CoifaItemParams } from './coifa-viewer-from-item';
import { rotuloPosicaoComando } from './coifa-furos';

/** "Aço inox 304 escovado", "Aço carbono com pintura eletrostática"… (a fábrica só faz inox escovado). */
export function textoAcabamento(material: string | undefined): string | null {
  const m = (material ?? '').toLowerCase();
  if (/carbono/.test(m)) return 'Aço carbono com pintura eletrostática';
  if (/inox/.test(m)) {
    const liga = /(\d{3})/.exec(m)?.[1];
    return `Aço inox${liga ? ` ${liga}` : ''} escovado`;
  }
  return null;
}

const mm = (n: number) => String(Math.round(n));

/** Linhas curtas de especificação, na ordem em que o cliente quer ler. */
export function especificacoesDaCoifa(p: CoifaItemParams, qtd: { lampadas: number; botoes: number }): string[] {
  const linhas: string[] = [];
  const acab = textoAcabamento(p.material);
  if (acab) linhas.push(acab);

  linhas.push(
    p.modelo === 'Tube'
      ? `Medidas: Ø ${mm(p.width)} × ${mm(p.height)} mm de altura`
      : `Medidas: ${mm(p.width)} × ${mm(p.depth)} × ${mm(p.height)} mm`,
  );
  if (p.modelo === 'Piramidal' && p.tetoWidth && p.tetoDepth) linhas.push(`Teto: ${mm(p.tetoWidth)} × ${mm(p.tetoDepth)} mm`);
  if ((p.modelo === 'Piramidal' || p.modelo === 'Linea') && p.carenagemHeight) {
    const cw = p.carenagemWidth ? `${mm(p.carenagemWidth)} × ` : '';
    const cd = p.carenagemDepth ? `${mm(p.carenagemDepth)} × ` : '';
    linhas.push(`Carenagem: ${cw}${cd}${mm(p.carenagemHeight)} mm`);
  }
  linhas.push(`Instalação em ${p.mount === 'Ilha' ? 'ilha' : 'parede'}`);

  const partes: string[] = [];
  if (qtd.lampadas > 0) partes.push(`${qtd.lampadas} lâmpada${qtd.lampadas !== 1 ? 's' : ''}`);
  if (qtd.botoes > 0) {
    partes.push(p.controle === 'botoes'
      ? (qtd.botoes !== 1 ? `${qtd.botoes} botões` : '1 botão')
      : `${qtd.botoes} botoeira${qtd.botoes !== 1 ? 's' : ''}`);
  }
  if (partes.length > 0) linhas.push(`Iluminação e comando: ${partes.join(' e ')}`);
  if (qtd.botoes > 0 && p.modelo !== 'Tube') linhas.push(`Posição do comando: ${rotuloPosicaoComando(p.posicaoComando).toLowerCase().replace(' — ', ', ')}`);

  if (p.filtro && p.filtro !== 'nenhum') {
    const nome = p.filtro === 'aluminio' ? 'Filtro de alumínio' : `Filtro inercial ${p.filtro === 'inercial_304' ? '304' : '430'}`;
    const coletor = p.coletor && p.coletor !== 'nenhum' ? ` com coletor de gordura${p.coletor === 'duplo' ? ' duplo' : ''}` : '';
    linhas.push(nome + coletor);
  }
  if (p.frisoFrente || p.frisoLD || p.frisoLE) {
    const onde = [p.frisoFrente && 'frente', p.frisoLD && 'lateral direita', p.frisoLE && 'lateral esquerda'].filter(Boolean).join(', ');
    const n = p.frisoLinhas ?? 1;
    linhas.push(`Friso brilhante (${n} linha${n !== 1 ? 's' : ''}) — ${onde}`);
  }
  return linhas;
}

'use client';

// Planificação da coifa (peças abertas, encaixe nas chapas e DXF para o corte).
// Dados fixos vêm da Memória de Cálculos (pedido do Levi em 20/10/26); aqui só
// entram os dados variáveis do pedido. Hoje cobre a Box — os outros modelos
// precisam de um exemplo (DXF + PDF) do Adriano.

import { useMemo, useState } from 'react';
import { Download, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dxfDaChapa, encaixarNasChapas, planificarBox, pontoNaChapa, type ChapaEncaixada, type EntradaPlanificacao } from '@/lib/coifa-planificacao';
import type { ParametrosDesenho } from '@/lib/coifa-desenho';

interface Props {
  entrada: EntradaPlanificacao | null;
  modelo: string;
  desenho: ParametrosDesenho;
  /** Nome base dos arquivos (ex.: "Box 900x650x880"). */
  nomeArquivo: string;
}

function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/dxf' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function ChapaSvg({ chapa }: { chapa: ChapaEncaixada }) {
  const { comprimento: W, largura: H } = chapa;
  return (
    <svg viewBox={`-10 -10 ${W + 20} ${H + 20}`} className="w-full border rounded bg-white">
      <g transform={`translate(0 ${H}) scale(1 -1)`}>
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="#94a3b8" strokeWidth={3} />
        {chapa.pecas.map((pp) => {
          const pts = pp.peca.contorno.map((pt) => pontoNaChapa(pp, pt).join(',')).join(' ');
          const c = pontoNaChapa(pp, [pp.peca.w / 2, pp.peca.h / 2]);
          return (
            <g key={pp.peca.id}>
              <polygon points={pts} fill="#e0f2fe" stroke="#0369a1" strokeWidth={3} />
              {pp.peca.furos.map((f, i) => {
                const [cx, cy] = pontoNaChapa(pp, [f.x, f.y]);
                return <circle key={i} cx={cx} cy={cy} r={f.d / 2} fill="#fff" stroke="#0369a1" strokeWidth={3} />;
              })}
              <g transform={`translate(${c[0]} ${c[1]}) scale(1 -1)`}>
                <text textAnchor="middle" fontSize={44} fill="#0c4a6e">{pp.peca.nome}</text>
                <text textAnchor="middle" y={52} fontSize={34} fill="#475569">{pp.peca.w} × {pp.peca.h}</text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function PlanificacaoCoifa({ entrada, modelo, desenho, nomeArquivo }: Props) {
  const [aberto, setAberto] = useState(false);
  const [comprimento, setComprimento] = useState(2000);
    const ehBox = modelo === 'Box';

  const resultado = useMemo(() => {
    if (!aberto || !entrada || !ehBox) return null;
    const pecas = planificarBox(entrada, desenho);
    const enc = encaixarNasChapas(pecas.pecas, comprimento, desenho);
    return { pecas: pecas.pecas, chapas: enc.chapas, avisos: [...pecas.avisos, ...enc.avisos] };
  }, [aberto, entrada, ehBox, comprimento, desenho]);

  const nomeChapa = (c: ChapaEncaixada) => `${nomeArquivo} - chapa ${c.indice} (${c.bitola}).dxf`;
  const baixarTodas = () => resultado?.chapas.forEach((c) => baixar(nomeChapa(c), dxfDaChapa(c)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Ruler className="h-4 w-4" />3. Desenho para corte (planificação)</CardTitle>
        <CardDescription>
          Abre as peças da coifa, encaixa nas chapas e gera o DXF. Usa as medidas e escolhas acima (posição da botoeira,
          posição das lâmpadas, filtros) e os dados fixos da Memória de Cálculos: furos, dobras, bitolas e margens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
          <li>Dobra: +{desenho.acrescimoDobra} mm por dobra</li>
          <li>Chapa 22 (frente/laterais): {desenho.espessura22} mm</li>
          <li>Chapa 24 (costas/teto/carenagem): {desenho.espessura24} mm</li>
          <li>Lâmpada: Ø{desenho.furoLampadaCozinha} cozinha / Ø{desenho.furoLampadaChurrasqueira} churrasqueira</li>
          <li>Botoeira: Ø{desenho.furoBotoeira}, {desenho.espacoBotoeira} mm de centro a centro</li>
          <li>Botão: Ø{desenho.furoBotao}</li>
          <li className="col-span-2">
            Lâmpadas: até {desenho.lampLimite} mm de largura → {desenho.lampPercentual}% da largura da lateral ao 1º furo; acima → {desenho.lampFixa} mm.
          </li>
        </ul>
        {!ehBox && (
          <p className="text-xs rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
            A planificação ainda só existe para a Box. Piramidal, Línea e Tube precisam de um exemplo (DXF + PDF) do Adriano
            para que as dobras, abas e o teto saiam certos — sem isso o ERP não inventa medida de corte.
          </p>
        )}
        <Button type="button" variant="outline" disabled={!entrada || !ehBox} onClick={() => setAberto(true)}>
          <Ruler className="mr-2 h-4 w-4" />Planificar e gerar DXF
        </Button>
        {!entrada && ehBox && <p className="text-xs text-muted-foreground">Preencha largura, profundidade e altura.</p>}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Planificação — {nomeArquivo}</DialogTitle>
            <DialogDescription>
              Chapas de {desenho.larguraChapa} mm de largura, margem {desenho.margemChapa} mm e {desenho.espacoPecas} mm entre peças.
              Chapa 22 e chapa 24 não se misturam na mesma chapa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Comprimento da chapa</Label>
              <Select value={String(comprimento)} onValueChange={(v) => setComprimento(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">2 m</SelectItem>
                  <SelectItem value="3000">3 m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" onClick={baixarTodas} disabled={!resultado?.chapas.length}>
              <Download className="mr-2 h-4 w-4" />Baixar todas
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 pr-3">
            {resultado && (
              <div className="space-y-4">
                {resultado.avisos.map((a, i) => <p key={i} className="text-xs text-destructive">{a}</p>)}
                <div className="text-xs">
                  <p className="font-medium mb-1">Peças abertas</p>
                  <ul className="grid grid-cols-2 gap-x-4">
                    {resultado.pecas.map((p) => (
                      <li key={p.id}>{p.nome} — {p.w} × {p.h} mm, chapa {p.bitola}{p.furos.length ? `, ${p.furos.length} furo(s)` : ''}</li>
                    ))}
                  </ul>
                </div>
                {resultado.chapas.map((c) => (
                  <div key={c.indice} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Chapa {c.indice} — {c.bitola} ({c.bitola === 22 ? desenho.espessura22 : desenho.espessura24} mm), {c.comprimento} × {c.largura} · aproveitamento {c.aproveitamento}%
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={() => baixar(nomeChapa(c), dxfDaChapa(c))}>
                        <Download className="mr-2 h-4 w-4" />DXF
                      </Button>
                    </div>
                    <ChapaSvg chapa={c} />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  DXF no formato R12 (ASCII) — o mais aceito por programas de corte. Contornos, furos e piques de dobra (1 mm nas duas pontas
                  de cada dobra) na camada CORTE. Confira a primeira chapa no programa da Franciele antes de cortar.
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

'use client';

// Emissão da Tabela de Preços de Coifas (Cozinha e Churrasqueira): padrões da
// tabela, confirmação obrigatória, arquivamento opcional dos itens antigos e
// restrição a administradores (pedido do Levi em 15/10/26).

import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/lib/role-context';
import { generatePriceTableCoifas, salvarPadroesTabela, contarAntigosCoifas } from '@/app/(dashboard)/calculator/actions';
import {
  CHAVES_CARENAGEM_ATE_1300, CHAVES_CARENAGEM_ACIMA_1300, CARENAGEM_MIN, CARENAGEM_MAX,
  CHAVE_LOTE_PROFUNDIDADE, CHAVE_LOTE_ALTURA, CHAVE_LOTE_ALTURA_CORPO_LINEA, CHAVE_LOTE_PAINEL_PIRAMIDAL,
  LIMITE_FAIXA_TABELA, TETO_ATE_1300, padroesTabelaDefinidos,
} from '@/lib/coifa-padroes';

type Campos = {
  loteP: string; loteA: string; loteC: string; loteN: string;
  c1L: string; c1P: string; c1A: string;
  c2L: string; c2P: string; c2A: string;
};

interface Props {
  parametros: Record<string, number | undefined>;
  /** Atualiza o cache local dos parâmetros depois de salvar. */
  onParametrosSalvos: (novos: Record<string, number>) => void;
}

export function EmissaoTabelaCoifas({ parametros, onParametrosSalvos }: Props) {
  const role = useRole();
  const { toast } = useToast();
  const padroes = padroesTabelaDefinidos(parametros);

  const [dialogo, setDialogo] = useState<boolean>(false);
  const [c, setC] = useState<Campos>({ loteP: '', loteA: '', loteC: '', loteN: '', c1L: '', c1P: '', c1A: '', c2L: '', c2P: '', c2A: '' });
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [arquivar, setArquivar] = useState(true);
  const [antigos, setAntigos] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  useEffect(() => { if (role === 'admin') contarAntigosCoifas().then(setAntigos); }, [role]);

  if (role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Emissão da Tabela de Preços</CardTitle>
          <CardDescription>Somente administradores podem emitir a Tabela de Preços.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const abrirDialogo = () => {
    setC({
      loteP: String(padroes.lote.profundidade), loteA: String(padroes.lote.altura), loteC: String(padroes.lote.alturaCorpoLinea), loteN: String(padroes.lote.alturaPainelPiramidal),
      c1L: String(padroes.carenagemAte1300.largura), c1P: String(padroes.carenagemAte1300.profundidade), c1A: String(padroes.carenagemAte1300.altura),
      c2L: String(padroes.carenagemAcima1300.largura), c2P: String(padroes.carenagemAcima1300.profundidade), c2A: String(padroes.carenagemAcima1300.altura),
    });
    setDialogo(true);
  };

  const pedirConfirmacao = () => setConfirmar(true);

  const gerar = async () => {
    setConfirmar(false);
    setGerando(true);
    setResumo(null);
    setAvisos([]);
    const r = await generatePriceTableCoifas({ arquivarAntigos: arquivar && (antigos ?? 0) > 0 });
    setGerando(false);
    if (r.success) {
      const texto = `${r.created ?? 0} produto(s) criado(s), ${r.updated ?? 0} atualizado(s)${r.archived ? `, ${r.archived} antigo(s) arquivado(s)` : ''}.`;
      setResumo(r.errors ? `${texto} ${r.errors.length} preço(s) NÃO gravado(s) — veja a lista abaixo.` : texto);
      if (r.errors) { setAvisos(r.errors); console.error('Erros na geração da tabela de preços:', r.errors); }
      toast({ title: 'Tabela de Preços gerada!', description: texto });
      contarAntigosCoifas().then(setAntigos);
    } else {
      if (r.errors) setAvisos(r.errors);
      toast({ variant: 'destructive', title: 'Erro ao gerar tabela', description: r.error });
    }
  };


  const salvar = async () => {
    const n = Number;
    const car1 = { largura: n(c.c1L), profundidade: n(c.c1P), altura: n(c.c1A) };
    const car2 = { largura: n(c.c2L), profundidade: n(c.c2P), altura: n(c.c2A) };
    const lote = { profundidade: n(c.loteP), altura: n(c.loteA), alturaCorpoLinea: n(c.loteC), alturaPainelPiramidal: n(c.loteN) };
    setSalvando(true);
    const r = await salvarPadroesTabela(car1, car2, lote);
    setSalvando(false);
    if (!r.success) {
      toast({ variant: 'destructive', title: 'Padrões não salvos', description: r.error });
      return;
    }
    const k = Math.round;
    onParametrosSalvos({
      [CHAVES_CARENAGEM_ATE_1300.largura]: k(car1.largura), [CHAVES_CARENAGEM_ATE_1300.profundidade]: k(car1.profundidade), [CHAVES_CARENAGEM_ATE_1300.altura]: k(car1.altura),
      [CHAVES_CARENAGEM_ACIMA_1300.largura]: k(car2.largura), [CHAVES_CARENAGEM_ACIMA_1300.profundidade]: k(car2.profundidade), [CHAVES_CARENAGEM_ACIMA_1300.altura]: k(car2.altura),
      [CHAVE_LOTE_PROFUNDIDADE]: k(lote.profundidade), [CHAVE_LOTE_ALTURA]: k(lote.altura), [CHAVE_LOTE_ALTURA_CORPO_LINEA]: k(lote.alturaCorpoLinea), [CHAVE_LOTE_PAINEL_PIRAMIDAL]: k(lote.alturaPainelPiramidal),
    });
    setDialogo(false);
    toast({ title: 'Padrões da tabela salvos' });
  };

  const campo = (rotulo: string, k: keyof Campos, min?: number, max?: number) => (
    <div className="space-y-1">
      <Label className="text-xs">{rotulo}</Label>
      <Input type="number" min={min} max={max} value={c[k]} onChange={(e) => setC((o) => ({ ...o, [k]: e.target.value }))} />
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Emissão da Tabela de Preços</CardTitle>
          <CardDescription>
            Gera os produtos de Coifas de Cozinha (Box, Piramidal, Línea e Tube, cada um de Parede e Ilha) e de Churrasqueira (Box e Piramidal, de Parede e Ilha) — 1000 a 3000mm, Inox 430/304/Carbono — a partir deste motor de cálculo. Línea e Tube são só de cozinha. Os preços saem com a unidade zerada (ex: 2.354,90 → 2.350,00).
            Produtos com a mesma categoria, modelo e medida são atualizados; os demais são criados. Pede confirmação antes de gerar.
          </CardDescription>
          <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
            <p>Corpo: profundidade {padroes.lote.profundidade}, altura {padroes.lote.altura} mm (Línea: corpo de {padroes.lote.alturaCorpoLinea} mm; Piramidal: painel vertical de {padroes.lote.alturaPainelPiramidal} mm).</p>
            <p>Carenagem (Línea e Piramidal): até {LIMITE_FAIXA_TABELA} → {padroes.carenagemAte1300.largura}×{padroes.carenagemAte1300.profundidade}×{padroes.carenagemAte1300.altura}; acima → {padroes.carenagemAcima1300.largura}×{padroes.carenagemAcima1300.profundidade}×{padroes.carenagemAcima1300.altura} mm.</p>
            <p>Teto da Piramidal: até {LIMITE_FAIXA_TABELA} → {TETO_ATE_1300.largura}×{TETO_ATE_1300.profundidade}; acima → 1/3 da largura × 350 mm (regra fixa).</p>
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={abrirDialogo}>alterar padrões</Button>
            <p>Valem só para a tabela e para o desenho dos produtos dela nos orçamentos — na Calculadora você digita todas as medidas.</p>
          </div>
        </CardHeader>
        <CardContent className="hidden" />
        <CardFooter className="flex flex-col items-stretch gap-2">
          <Button type="button" variant="secondary" disabled={gerando} onClick={pedirConfirmacao}>
            {gerando ? 'Gerando...' : 'Gerar Tabela de Preços — Coifas'}
          </Button>
          {resumo && <p className="text-xs text-muted-foreground text-center">{resumo}</p>}
          {avisos.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-500 space-y-0.5 max-h-40 overflow-y-auto">
              <p className="font-medium">Preços não gravados (custo incompleto — ex: chapa não encontrada no Estoque):</p>
              {avisos.slice(0, 12).map((a) => <p key={a}>• {a}</p>)}
              {avisos.length > 12 && <p>… e mais {avisos.length - 12}.</p>}
            </div>
          )}
        </CardFooter>
      </Card>

      <Dialog open={dialogo} onOpenChange={(o) => { if (!o && !salvando) setDialogo(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Medidas padrão da Tabela de Preços</DialogTitle>
            <DialogDescription>
              Valem para todas as medidas da tabela (1000 a 3000). Ficam salvos — dá pra mudar depois aqui ou na Memória de Cálculos.
              Na Calculadora, você continua digitando tudo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Corpo das coifas (mm)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{campo('Profundidade', 'loteP')}{campo('Altura Box/Piramidal', 'loteA')}{campo('Corpo da Línea', 'loteC')}{campo('Painel da Piramidal', 'loteN')}</div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Carenagem (Línea e Piramidal) — largura × profundidade × altura (mm)</p>
              <p className="text-xs text-muted-foreground">Coifas até {LIMITE_FAIXA_TABELA} de largura</p>
              <div className="grid grid-cols-3 gap-3">{campo('Largura', 'c1L', CARENAGEM_MIN, CARENAGEM_MAX)}{campo('Profundidade', 'c1P', CARENAGEM_MIN, CARENAGEM_MAX)}{campo('Altura', 'c1A', CARENAGEM_MIN, CARENAGEM_MAX)}</div>
              <p className="text-xs text-muted-foreground">Coifas a partir de {LIMITE_FAIXA_TABELA + 100} de largura</p>
              <div className="grid grid-cols-3 gap-3">{campo('Largura', 'c2L', CARENAGEM_MIN, CARENAGEM_MAX)}{campo('Profundidade', 'c2P', CARENAGEM_MIN, CARENAGEM_MAX)}{campo('Altura', 'c2A', CARENAGEM_MIN, CARENAGEM_MAX)}</div>
              <p className="text-xs text-muted-foreground">Só a altura muda o preço; largura e profundidade são do desenho.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvando} onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button type="button" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir a Tabela de Preços das coifas?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão calculados e gravados os preços de Coifas de Cozinha (Box, Piramidal, Línea e Tube — Parede e Ilha) e de Churrasqueira (Box e Piramidal — Parede e Ilha), de 1000 a 3000 mm
              (Inox 430, Inox 304 e Carbono). Produtos já existentes com a mesma categoria, modelo e medida terão o preço atualizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(antigos ?? 0) > 0 && (
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer">
              <Checkbox checked={arquivar} onCheckedChange={(v) => setArquivar(v === true)} className="mt-0.5" />
              <span>
                Arquivar os {antigos} item(ns) antigo(s) de coifa (tabela anterior), para não haver duplicidade.
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Nada é apagado: os orçamentos já emitidos continuam existindo e podem ser alterados. Os itens arquivados só deixam de aparecer na escolha de novos orçamentos (ficam no grupo &quot;Arquivo&quot; em Produtos).
                </span>
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={gerar}>Emitir tabela</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

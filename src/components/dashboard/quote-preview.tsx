"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Quote, IluminacaoRow } from "@/lib/types";
import { getProducts } from "@/app/(dashboard)/products/actions";
import { getNfeSettings } from "@/app/actions/nfe";
import { getIluminacao, getPadroesTabela } from "@/app/(dashboard)/calculator/actions";
import dynamic from "next/dynamic";
import type { CoifaViewer3DHandle } from "@/components/dashboard/coifa-viewer-3d";

// Carregado sob demanda: o Three.js só baixa quando o orçamento tem coifa —
// as telas de lista de orçamentos/produção não pagam esse peso à toa.
const CoifaViewer3D = dynamic(
  () => import("@/components/dashboard/coifa-viewer-3d").then((m) => m.CoifaViewer3D),
  { ssr: false, loading: () => <div className="h-[280px] rounded bg-gray-100 animate-pulse" /> },
);
import { coifaParamsFromQuoteItem, type CoifaItemParams, type ProdutoCatalogo } from "@/lib/coifa-viewer-from-item";
import { LINHAS_TABELA, type PadroesTabela } from "@/lib/coifa-padroes";
import { kitIluminacaoPadrao } from "@/lib/coifa-calculator";

interface Props {
  quote: Quote;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  // Parse como data local para evitar desvio de fuso (UTC-3 voltaria 1 dia)
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

const TAX_RATE = 0.045;

export function QuotePreview({ quote }: Props) {
  const [companyName, setCompanyName] = useState("LEMANNOX");
  const [companyTagline, setCompanyTagline] = useState("Produtos em Inox e Aço");

  useEffect(() => {
    getNfeSettings().then((s) => {
      if (s) {
        setCompanyName(s.nomeFantasia || s.razaoSocial || "LEMANNOX");
        if (s.razaoSocial && s.nomeFantasia && s.nomeFantasia !== s.razaoSocial) {
          setCompanyTagline(s.razaoSocial);
        }
      }
    });
  }, []);

  // Itens de catálogo só são desenhados se o produto ainda existir e bater com
  // o item (modelo e medida) — essa é a verificação que impede um desenho
  // diferente do que está escrito no orçamento. Por isso buscamos os produtos
  // e os padrões da tabela, mas só quando o orçamento tem algum item que pode
  // ser de coifa da tabela.
  const temCandidatoCatalogo = useMemo(
    () => quote.items.some((i) => !i.coifaParams && i.productId && LINHAS_TABELA.some((l) => l.modelLabel === (i.name ?? "").trim())),
    [quote.items],
  );
  const [produtos, setProdutos] = useState<Map<string, ProdutoCatalogo> | null>(null);
  const [padroes, setPadroes] = useState<PadroesTabela | null>(null);
  useEffect(() => {
    if (!temCandidatoCatalogo) return;
    getProducts().then((r) => {
      if (r.success && r.products) {
        setProdutos(new Map(r.products.map((p) => [p.id, { category: p.category, model: p.model, measurement: p.measurement }])));
      }
    });
    getPadroesTabela().then(setPadroes);
  }, [temCandidatoCatalogo]);

  // Coifas do orçamento que dá pra desenhar em 3D (uma por item distinto, sem
  // repetir — cada visualizador abre um contexto WebGL, que o navegador limita).
  // Item que não passa na verificação fica sem desenho (melhor nada que errado).
  const coifas = useMemo(() => {
    const unicos = new Map<string, { key: string; label: string; params: CoifaItemParams }>();
    quote.items.forEach((item) => {
      const params = coifaParamsFromQuoteItem(item, { produtos, padroes });
      if (!params) return;
      // Item da Calculadora: chave pelas medidas exatas (dois itens com o
      // mesmo nome podem ter tetos/carenagens diferentes).
      const key = params.exato ? JSON.stringify(item.coifaParams) : `${item.productId}|${item.name}|${item.measurement}`;
      if (!unicos.has(key)) {
        unicos.set(key, { key, label: [item.name, item.measurement].filter(Boolean).join(" – "), params });
      }
    });
    return Array.from(unicos.values());
  }, [quote.items, produtos, padroes]);
  // Cada desenho abre um contexto WebGL e o navegador limita (~16). Acima do
  // limite, os demais itens continuam no orçamento, só sem o desenho.
  const MAX_DESENHOS = 8;
  const coifasDesenhadas = coifas.slice(0, MAX_DESENHOS);

  // Itens de catálogo não guardam o kit: buscamos a tabela de iluminação para
  // saber a quantidade padrão de lâmpadas. Itens da Calculadora já trazem tudo.
  const [iluminacao, setIluminacao] = useState<IluminacaoRow[]>([]);
  const precisaReferencia = coifas.some((c) => !c.params.exato);
  useEffect(() => {
    if (!precisaReferencia) return;
    getIluminacao().then((r) => { if (r.success && r.rows) setIluminacao(r.rows); });
  }, [precisaReferencia]);

  // Na impressão (botão do sistema ou Ctrl+P), o canvas 3D é trocado por uma
  // imagem tirada do ângulo atual — canvas WebGL não sai confiável no PDF.
  // A imagem é atualizada logo depois de cada giro/zoom (não no momento de
  // imprimir): o navegador decodifica imagem de forma assíncrona, e trocar o
  // src dentro do "beforeprint" pode fazer a figura sair em branco no PDF.
  const viewerRefs = useRef<Record<string, CoifaViewer3DHandle | null>>({});
  const imgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const atualizarImagem = (key: string) => {
    const url = viewerRefs.current[key]?.capturePng();
    const img = imgRefs.current[key];
    if (url && img && img.src !== url) img.src = url;
  };
  useEffect(() => {
    if (coifas.length === 0) return;
    // Rede de segurança: se por algum motivo a imagem ainda não existir.
    const capturarFaltantes = () => {
      coifas.forEach((c) => { if (!imgRefs.current[c.key]?.getAttribute("src")) atualizarImagem(c.key); });
    };
    window.addEventListener("beforeprint", capturarFaltantes);
    return () => window.removeEventListener("beforeprint", capturarFaltantes);
  }, [coifas]);

  const discount = quote.discount ?? 0;
  const freight = quote.freight ?? 0;

  // Valor da mercadoria (sem imposto)
  const merchandise = quote.items.reduce((sum, item) => sum + (item.total ?? 0), 0);

  // Imposto total (4,5% sobre a mercadoria)
  const taxTotal = quote.items.reduce((sum, item) => sum + (item.tax != null ? item.tax : item.total * TAX_RATE), 0);

  // Total final
  const grandTotal = merchandise + taxTotal + freight - discount;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-this, .print-this * { visibility: visible; }
          .print-this { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-only:not([src]) { display: none !important; }
          .coifa-figure { break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="print-this bg-white text-gray-900 p-10 min-h-screen font-sans">
        {/* Cabeçalho */}
        <header className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">{companyName}</h1>
            <p className="text-xs text-gray-500 mt-1">{companyTagline}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">
              Orçamento #{String(quote.quoteNumber).padStart(4, "0")}
            </p>
            <p className="text-xs text-gray-500 mt-1">Data: {formatDate(quote.date)}</p>
            {quote.expiryDate && (
              <p className="text-xs text-gray-500">Validade: {formatDate(quote.expiryDate)}</p>
            )}
          </div>
        </header>

        {/* Cliente */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Cliente</h2>
          <div className="bg-gray-50 rounded p-4 text-sm">
            <p className="font-semibold text-base">{quote.customerName}</p>
            {quote.customerDetails?.cnpj && (
              <p className="text-gray-600">CNPJ: {quote.customerDetails.cnpj}</p>
            )}
            {quote.customerDetails?.contactName && (
              <p className="text-gray-600">Contato: {quote.customerDetails.contactName}</p>
            )}
            {quote.customerDetails?.contactPhone && (
              <p className="text-gray-600">Tel: {quote.customerDetails.contactPhone}</p>
            )}
            {quote.customerDetails?.email && (
              <p className="text-gray-600">E-mail: {quote.customerDetails.email}</p>
            )}
            {quote.obra && (
              <p className="text-gray-600 mt-1">Obra: {quote.obra}</p>
            )}
          </div>
        </section>

        {/* Itens */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Itens</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2 font-semibold w-[50%]">Produto</th>
                <th className="text-center px-3 py-2 font-semibold w-[6%]">Qtd</th>
                <th className="text-right px-3 py-2 font-semibold w-[14%]">Vlr. Unit.</th>
                <th className="text-right px-3 py-2 font-semibold w-[14%]">Imposto (4,5%)</th>
                <th className="text-right px-3 py-2 font-semibold w-[16%]">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, idx) => {
                const itemTax = item.tax ?? item.total * TAX_RATE;
                const itemTotal = item.total + itemTax;
                // Concatena: Descrição – Medida – Material
                const parts = [item.name, item.measurement, item.material].filter(Boolean);
                const productDesc = parts.join(' – ');
                return (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 leading-snug">{productDesc}</td>
                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right text-orange-700">{formatCurrency(itemTax)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(itemTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Visualização 3D das coifas */}
        {coifas.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Visualização</h2>
            <p className="text-xs text-gray-500 mb-2 no-print">
              Gire e posicione cada coifa — ao imprimir ou salvar em PDF, sai a imagem no ângulo em que ela estiver.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {coifasDesenhadas.map((c) => {
                const { exato, tipoAplicacao, ...viewerParams } = c.params;
                // Kit salvo pela Calculadora (pode ter sido ajustado à mão) tem
                // prioridade; item de catálogo usa o padrão da tabela.
                const kit = viewerParams.qtdLampadas !== undefined
                  ? { qtdLampadas: viewerParams.qtdLampadas, qtdBotoes: viewerParams.qtdBotoes ?? 0 }
                  : kitIluminacaoPadrao(
                      { modelo: viewerParams.modelo, width: viewerParams.width, tipoAplicacao, tipoInstalacao: viewerParams.mount, controle: viewerParams.controle },
                      { tabelaIluminacao: iluminacao },
                    );
                return (
                  <figure key={c.key} className="coifa-figure border border-gray-200 rounded p-2">
                    <div className="no-print">
                      <CoifaViewer3D
                        ref={(el) => { viewerRefs.current[c.key] = el; }}
                        className="h-[280px]"
                        embedded
                        onViewChange={() => atualizarImagem(c.key)}
                        {...viewerParams}
                        qtdLampadas={kit?.qtdLampadas}
                        qtdBotoes={kit?.qtdBotoes}
                      />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={(el) => { imgRefs.current[c.key] = el; }}
                      alt={c.label}
                      className="print-only w-full rounded"
                    />
                    <figcaption className="text-xs text-gray-600 mt-1 text-center">{c.label}</figcaption>
                  </figure>
                );
              })}
            </div>
            {coifas.length > MAX_DESENHOS && (
              <p className="text-xs text-gray-500 mt-2 no-print">
                Mostrando {MAX_DESENHOS} de {coifas.length} modelos — os demais aparecem só na lista de itens.
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-2">Imagem ilustrativa. Medidas e acabamento conforme a descrição de cada item.</p>
          </section>
        )}

        {/* Totais */}
        <div className="flex justify-end mb-6">
          <div className="w-72 text-sm space-y-1">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">Valor da Mercadoria</span>
              <span>{formatCurrency(merchandise)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-orange-700 font-medium">Impostos (4,5% Simples Nacional)</span>
              <span className="text-orange-700">{formatCurrency(taxTotal)}</span>
            </div>
            {freight > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-600">Frete</span>
                <span>{formatCurrency(freight)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-600">Desconto</span>
                <span className="text-red-600">- {formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 font-bold text-base border-t-2 border-gray-800">
              <span>TOTAL</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Condições */}
        {(quote.paymentTerms || quote.deliveryTime || quote.expiryDate || quote.notes) && (
          <section className="border-t border-gray-200 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Condições</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {quote.paymentTerms && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Pagamento</p>
                  <p className="text-gray-800">{quote.paymentTerms}</p>
                </div>
              )}
              {quote.deliveryTime && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Prazo de entrega</p>
                  <p className="text-gray-800">{formatDate(quote.deliveryTime)}</p>
                </div>
              )}
              {quote.expiryDate && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Validade</p>
                  <p className="text-gray-800">{formatDate(quote.expiryDate)}</p>
                </div>
              )}
            </div>
            {quote.notes && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 font-semibold mb-1">Observações</p>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>{companyName} — Obrigado pela preferência.</p>
        </footer>
      </div>
    </>
  );
}

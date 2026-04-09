"use client";

import { useEffect, useState } from "react";
import { Quote, OrdemServico } from "@/lib/types";
import { getNfeSettings } from "@/app/actions/nfe";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface Props {
  os: OrdemServico;
  quote: Quote;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function OsPreview({ os, quote }: Props) {
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

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .os-print, .os-print * { visibility: visible; }
          .os-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / Exportar PDF
        </Button>
      </div>

      <div className="os-print bg-white text-gray-900 p-10 font-sans border border-gray-200 rounded">
        {/* Cabeçalho */}
        <header className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">{companyName}</h1>
            <p className="text-xs text-gray-500 mt-1">{companyTagline}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-800">
              ORDEM DE SERVIÇO #{String(os.osNumber).padStart(4, "0")}
            </p>
            {quote.quoteNumber && (
              <p className="text-xs text-gray-500 mt-1">
                Orçamento: #{String(quote.quoteNumber).padStart(4, "0")}
              </p>
            )}
            <p className="text-xs text-gray-500">Data: {formatDate(os.createdAt)}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
              os.status === "aberta" ? "bg-blue-100 text-blue-700" :
              os.status === "em_andamento" ? "bg-yellow-100 text-yellow-700" :
              os.status === "concluida" ? "bg-green-100 text-green-700" :
              "bg-red-100 text-red-700"
            }`}>
              {STATUS_LABEL[os.status] ?? os.status}
            </span>
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
            {quote.obra && (
              <p className="text-gray-600 mt-1">Obra: {quote.obra}</p>
            )}
          </div>
        </section>

        {/* Itens a produzir */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Itens a Produzir</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                <th className="text-left px-3 py-2 font-semibold">Material</th>
                <th className="text-left px-3 py-2 font-semibold">Medida</th>
                <th className="text-center px-3 py-2 font-semibold">Qtd</th>
                <th className="text-left px-3 py-2 font-semibold">Obs. do Item</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, idx) => (
                <tr key={item.id ?? idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-gray-600">{item.material}</td>
                  <td className="px-3 py-2 text-gray-600">{item.measurement}</td>
                  <td className="px-3 py-2 text-center font-semibold">{item.quantity}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Prazos */}
        {(quote.deliveryTime || quote.manufacturingDeadline) && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Prazos</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {quote.manufacturingDeadline && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Prazo de fabricação</p>
                  <p className="text-gray-800">{formatDate(quote.manufacturingDeadline)}</p>
                </div>
              )}
              {quote.deliveryTime && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Prazo de entrega</p>
                  <p className="text-gray-800">{formatDate(quote.deliveryTime)}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Observações */}
        {(os.notes || quote.notes) && (
          <section className="border-t border-gray-200 pt-4 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Observações</h2>
            {os.notes && (
              <p className="text-gray-700 text-sm whitespace-pre-wrap mb-2">{os.notes}</p>
            )}
            {quote.notes && quote.notes !== os.notes && (
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{quote.notes}</p>
            )}
          </section>
        )}

        {/* Assinaturas */}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500 text-center">Responsável pela Produção</p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500 text-center">Recebimento / Conferência</p>
            </div>
          </div>
        </div>

        <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>{companyName} — OS #{String(os.osNumber).padStart(4, "0")} emitida em {formatDate(os.createdAt)}</p>
        </footer>
      </div>
    </>
  );
}

"use client";

import { Quote } from "@/lib/types";

interface Props {
  quote: Quote;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export function QuotePreview({ quote }: Props) {
  const discount = quote.discount ?? 0;
  const freight = quote.freight ?? 0;
  const total = quote.subtotal - discount + freight;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-this, .print-this * { visibility: visible; }
          .print-this { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @media screen {
          .print-this { display: none; }
        }
      `}</style>

      <div className="print-this bg-white text-gray-900 p-10 min-h-screen font-sans">
        <header className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">LEMANNOX</h1>
            <p className="text-xs text-gray-500 mt-1">Produtos em Inox e Aço</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">
              Orçamento #{String(quote.quoteNumber).padStart(4, "0")}
            </p>
            <p className="text-xs text-gray-500 mt-1">Data: {formatDate(quote.date)}</p>
            {quote.expiryDate && (
              <p className="text-xs text-gray-500">
                Validade: {formatDate(quote.expiryDate)}
              </p>
            )}
          </div>
        </header>

        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Cliente
          </h2>
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

        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Itens
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                <th className="text-left px-3 py-2 font-semibold">Material</th>
                <th className="text-left px-3 py-2 font-semibold">Medida</th>
                <th className="text-center px-3 py-2 font-semibold">Qtd</th>
                <th className="text-right px-3 py-2 font-semibold">Preço Unit.</th>
                <th className="text-right px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-gray-600">{item.material}</td>
                  <td className="px-3 py-2 text-gray-600">{item.measurement}</td>
                  <td className="px-3 py-2 text-center">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex justify-end mb-6">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
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
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {(quote.paymentTerms || quote.deliveryTime || quote.expiryDate || quote.notes) && (
          <section className="border-t border-gray-200 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Condições
            </h2>
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
                  <p className="text-gray-800">{quote.deliveryTime}</p>
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
          <p>LEMANNOX — Obrigado pela preferência.</p>
        </footer>
      </div>
    </>
  );
}

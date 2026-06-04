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
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  aberta:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  em_andamento: { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  concluida:    { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  cancelada:    { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

// Injetado na janela de impressão — apenas fontes e reset
const PRINT_HEAD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #ffffff !important; color: #0D1117 !important; }
  @page { margin: 1.2cm; }
`;

// ── Sub-componentes auxiliares (todos inline styles) ────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 3, height: 18, background: "#E85D04", borderRadius: 2, flexShrink: 0 }} />
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#374151",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        {children}
      </span>
    </div>
  );
}

function ClientField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, lineHeight: 1.6 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: "#9CA3AF",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        flexShrink: 0,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        {label}:
      </span>
      <span style={{ fontSize: 13, color: "#374151", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {value}
      </span>
    </div>
  );
}

function DeadlineCard({ label, date }: { label: string; date: string }) {
  return (
    <div style={{
      border: "1px solid #E2E8F0",
      borderRadius: 8,
      padding: "14px 18px",
      background: "#FAFAFA",
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: "#94A3B8",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 8,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 18,
        fontWeight: 600,
        color: "#0D1117",
      }}>
        {date}
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export function OsPreview({ os, quote }: Props) {
  const [companyName, setCompanyName]       = useState("LEMANNOX");
  const [companyTagline, setCompanyTagline] = useState("LEMANNOX SOLUÇÕES GOURMET LTDA.");

  useEffect(() => {
    getNfeSettings().then((s) => {
      if (s) {
        setCompanyName(s.nomeFantasia || s.razaoSocial || "LEMANNOX");
        if (s.razaoSocial) setCompanyTagline(s.razaoSocial.toUpperCase());
      }
    });
  }, []);

  const handlePrint = () => {
    const printEl = document.querySelector<HTMLElement>(".os-print");
    if (!printEl) return;

    const pw = window.open("", "_blank", "width=960,height=780");
    if (!pw) { alert("Permita popups para imprimir."); return; }

    pw.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OS #${String(os.osNumber).padStart(4, "0")} — ${companyName}</title>
  <style>${PRINT_HEAD_STYLES}</style>
</head>
<body>${printEl.outerHTML}</body>
</html>`);
    pw.document.close();
    pw.onload = () => { pw.focus(); pw.print(); };
  };

  const statusSt = STATUS_STYLE[os.status] ?? STATUS_STYLE.aberta;
  const items    = os.customItems && os.customItems.length > 0 ? os.customItems : quote.items;
  const osNum    = String(os.osNumber).padStart(4, "0");
  const quoteNum = quote.quoteNumber ? String(quote.quoteNumber).padStart(4, "0") : null;

  return (
    <>
      {/* Botão de impressão — não aparece no print */}
      <div className="no-print" style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / Exportar PDF
        </Button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          DOCUMENTO — todos os estilos são inline para garantir
          que a versão de exibição e a versão impressa sejam idênticas.
      ──────────────────────────────────────────────────────────────────── */}
      <div
        className="os-print"
        style={{
          fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
          background: "#FFFFFF",
          color: "#0D1117",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* ── Cabeçalho ── */}
        <div style={{
          background: "#0D1117",
          padding: "28px 32px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
        }}>
          {/* Empresa */}
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#FFFFFF",
              lineHeight: 1,
            }}>
              {companyName.toUpperCase()}
            </div>
            <div style={{
              marginTop: 7,
              fontSize: 10,
              fontWeight: 400,
              color: "#6B7280",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}>
              {companyTagline}
            </div>
          </div>

          {/* OS info */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              color: "#6B7280",
              letterSpacing: "0.16em",
              marginBottom: 4,
              textTransform: "uppercase",
            }}>
              Ordem de Serviço
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 34,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}>
              #{osNum}
            </div>
            {quoteNum && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "#4B5563",
                marginTop: 7,
                letterSpacing: "0.1em",
              }}>
                Orçamento #{quoteNum}
              </div>
            )}
            <div style={{
              fontSize: 11,
              color: "#9CA3AF",
              marginTop: 4,
              letterSpacing: "0.04em",
            }}>
              {formatDate(os.createdAt)}
            </div>
          </div>
        </div>

        {/* ── Barra de acento ── */}
        <div style={{ height: 4, background: "#E85D04" }} />

        {/* ── Faixa de status ── */}
        <div style={{
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          padding: "9px 32px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#94A3B8",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Status
          </span>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            background: statusSt.bg,
            color: statusSt.color,
            border: `1px solid ${statusSt.border}`,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            {STATUS_LABEL[os.status] ?? os.status}
          </span>
        </div>

        {/* ── Corpo ── */}
        <div style={{ padding: "28px 32px" }}>

          {/* Cliente */}
          <section style={{ marginBottom: 26 }}>
            <SectionLabel>Cliente</SectionLabel>
            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              padding: "16px 20px",
              background: "#FAFAFA",
            }}>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0D1117",
                letterSpacing: "-0.01em",
                marginBottom: 10,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
                {quote.customerName}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 28px",
              }}>
                {quote.customerDetails?.cnpj        && <ClientField label="CNPJ"     value={quote.customerDetails.cnpj} />}
                {quote.customerDetails?.contactName && <ClientField label="Contato"  value={quote.customerDetails.contactName} />}
                {quote.customerDetails?.contactPhone && <ClientField label="Telefone" value={quote.customerDetails.contactPhone} />}
                {quote.obra                          && <ClientField label="Obra"     value={quote.obra} />}
              </div>
            </div>
          </section>

          {/* Itens */}
          <section style={{ marginBottom: 26 }}>
            <SectionLabel>
              Itens a Produzir
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "#9CA3AF",
                marginLeft: 6,
                fontWeight: 400,
                letterSpacing: "0.08em",
              }}>
                ({items.length} {items.length === 1 ? "item" : "itens"})
              </span>
            </SectionLabel>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0D1117" }}>
                    {[
                      { label: "Descrição",   align: "left"   },
                      { label: "Material",    align: "left"   },
                      { label: "Medida",      align: "left"   },
                      { label: "Qtd",         align: "center" },
                      { label: "Obs. do Item", align: "left"  },
                    ].map(({ label, align }) => (
                      <th key={label} style={{
                        textAlign: align as "left" | "center",
                        padding: "10px 14px",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#9CA3AF",
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        whiteSpace: "nowrap",
                        borderBottom: "2px solid #E85D04",
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{
                      background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                      borderBottom: idx < items.length - 1 ? "1px solid #E2E8F0" : "none",
                    }}>
                      <td style={{
                        padding: "11px 14px",
                        fontWeight: 600,
                        color: "#0D1117",
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}>
                        {item.name}
                      </td>
                      <td style={{
                        padding: "11px 14px",
                        color: "#4B5563",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}>
                        {item.material || "—"}
                      </td>
                      <td style={{
                        padding: "11px 14px",
                        color: "#4B5563",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}>
                        {item.measurement || "—"}
                      </td>
                      <td style={{
                        padding: "11px 14px",
                        textAlign: "center",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700,
                        fontSize: 16,
                        color: "#0D1117",
                      }}>
                        {item.quantity}
                      </td>
                      <td style={{
                        padding: "11px 14px",
                        color: "#6B7280",
                        fontSize: 12,
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}>
                        {item.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Prazos */}
          {(quote.deliveryTime || quote.manufacturingDeadline) && (
            <section style={{ marginBottom: 26 }}>
              <SectionLabel>Prazos</SectionLabel>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
              }}>
                {quote.manufacturingDeadline && (
                  <DeadlineCard label="Prazo de Fabricação" date={formatDate(quote.manufacturingDeadline)} />
                )}
                {quote.deliveryTime && (
                  <DeadlineCard label="Prazo de Entrega" date={formatDate(quote.deliveryTime)} />
                )}
              </div>
            </section>
          )}

          {/* Observações */}
          {(os.notes || quote.notes) && (
            <section style={{ marginBottom: 26 }}>
              <SectionLabel>Observações</SectionLabel>
              <div style={{
                borderLeft: "3px solid #E85D04",
                borderRadius: "0 8px 8px 0",
                border: "1px solid #FED7AA",
                borderLeftColor: "#E85D04",
                padding: "14px 18px",
                background: "#FFFBF5",
              }}>
                {os.notes && (
                  <p style={{
                    fontSize: 13,
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.65,
                    marginBottom: (quote.notes && quote.notes !== os.notes) ? 10 : 0,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}>
                    {os.notes}
                  </p>
                )}
                {quote.notes && quote.notes !== os.notes && (
                  <p style={{
                    fontSize: 13,
                    color: "#6B7280",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.65,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}>
                    {quote.notes}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Assinaturas */}
          <section style={{ marginTop: 48 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
              {["Responsável pela Produção", "Recebimento / Conferência"].map((label) => (
                <div key={label}>
                  <div style={{ borderTop: "1.5px solid #CBD5E1", paddingTop: 10, marginTop: 48 }}>
                    <p style={{
                      fontSize: 10,
                      color: "#94A3B8",
                      textAlign: "center",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "'IBM Plex Sans', sans-serif",
                    }}>
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Rodapé ── */}
        <div style={{
          borderTop: "1px solid #E2E8F0",
          padding: "10px 32px",
          background: "#F8FAFC",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "#9CA3AF",
            letterSpacing: "0.07em",
          }}>
            {companyName} · OS #{osNum} · Emitida em {formatDate(os.createdAt)}
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "#D1D5DB",
            letterSpacing: "0.05em",
          }}>
            lemannox-erp.vercel.app
          </span>
        </div>
      </div>
    </>
  );
}

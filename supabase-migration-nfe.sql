-- ============================================================
-- LEMANNOX ERP — Migration: NF-e
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================

-- ============================================================
-- TABELA: notas_fiscais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_number     INTEGER NOT NULL,
  serie         SMALLINT NOT NULL DEFAULT 1,
  quote_id      UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_doc  TEXT NOT NULL,                   -- CNPJ ou CPF sem máscara
  ind_ie_dest   TEXT NOT NULL DEFAULT '9',        -- 1=contribuinte, 2=isento, 9=não contribuinte
  dest_ie       TEXT,
  dest_email    TEXT,
  dest_address  TEXT,
  dest_city     TEXT,
  dest_uf       TEXT,
  dest_cmun     TEXT,
  dest_cep      TEXT,
  natureza_op   TEXT NOT NULL DEFAULT 'VENDA DE PRODUTO INDUSTRIALIZADO',
  cfop          TEXT NOT NULL DEFAULT '5101',
  ind_final     SMALLINT NOT NULL DEFAULT 0,      -- 0=normal, 1=consumidor final
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_produtos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_frete   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_nf      NUMERIC(14,2) NOT NULL DEFAULT 0,
  regime_trib   SMALLINT NOT NULL DEFAULT 1,      -- 1=Simples, 3=Presumido
  mod_frete     SMALLINT NOT NULL DEFAULT 9,      -- 9=sem frete, 0=emitente, 1=destinatário
  tp_pagamento  TEXT NOT NULL DEFAULT '01',
  status        TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','xml_gerado','emitida','cancelada')),
  xml_gerado    TEXT,
  chave_acesso  TEXT,
  protocolo     TEXT,
  data_emissao  DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes   TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nf_number, serie)
);

-- ============================================================
-- TABELA: nfe_settings (linha única — dados do emitente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nfe_settings (
  id               TEXT PRIMARY KEY DEFAULT 'default',
  -- Emitente
  cnpj             TEXT DEFAULT '',
  razao_social     TEXT DEFAULT '',
  nome_fantasia    TEXT DEFAULT '',
  ie               TEXT DEFAULT '',
  crt              SMALLINT DEFAULT 1,            -- 1=Simples, 3=Presumido
  -- Endereço do emitente
  logradouro       TEXT DEFAULT '',
  numero           TEXT DEFAULT '',
  complemento      TEXT DEFAULT '',
  bairro           TEXT DEFAULT '',
  municipio        TEXT DEFAULT '',
  c_mun            TEXT DEFAULT '',               -- Código IBGE do município
  uf               TEXT DEFAULT 'SP',
  c_uf             SMALLINT DEFAULT 35,           -- Código IBGE do estado
  cep              TEXT DEFAULT '',
  telefone         TEXT DEFAULT '',
  -- NF-e config
  proxima_nf       INTEGER DEFAULT 1,
  serie            SMALLINT DEFAULT 1,
  ambiente         TEXT DEFAULT '1',              -- '1'=produção, '2'=homologação
  natureza_op      TEXT DEFAULT 'VENDA DE PRODUTO INDUSTRIALIZADO',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.nfe_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- ============================================================
-- TRIGGER: updated_at para as novas tabelas
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['notas_fiscais','nfe_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl);
  END LOOP;
END;
$$;

-- ============================================================
-- RLS: notas_fiscais e nfe_settings
-- ============================================================
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read" ON public.notas_fiscais;
DROP POLICY IF EXISTS "Authenticated users can write" ON public.notas_fiscais;
CREATE POLICY "Authenticated users can read" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write" ON public.notas_fiscais FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read" ON public.nfe_settings;
DROP POLICY IF EXISTS "Authenticated users can write" ON public.nfe_settings;
CREATE POLICY "Authenticated users can read" ON public.nfe_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write" ON public.nfe_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================

-- ============================================================
-- LEMANNOX ERP — Tabelas NF-e
-- Execute no SQL Editor do Supabase Dashboard:
-- https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABELA: nfe_settings (configurações da empresa emitente)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nfe_settings (
  id                TEXT      PRIMARY KEY DEFAULT 'default',
  cnpj              TEXT      NOT NULL DEFAULT '',
  razao_social      TEXT      NOT NULL DEFAULT '',
  nome_fantasia     TEXT               DEFAULT '',
  ie                TEXT               DEFAULT '',
  crt               SMALLINT  NOT NULL DEFAULT 1 CHECK (crt IN (1, 3)),
  logradouro        TEXT               DEFAULT '',
  numero            TEXT               DEFAULT '',
  complemento       TEXT               DEFAULT '',
  bairro            TEXT               DEFAULT '',
  municipio         TEXT               DEFAULT '',
  c_mun             TEXT               DEFAULT '',
  uf                CHAR(2)            DEFAULT 'SP',
  c_uf              SMALLINT           DEFAULT 35,
  cep               TEXT               DEFAULT '',
  telefone          TEXT               DEFAULT '',
  proxima_nf        INTEGER   NOT NULL DEFAULT 1,
  serie             INTEGER   NOT NULL DEFAULT 1,
  ambiente          CHAR(1)   NOT NULL DEFAULT '2' CHECK (ambiente IN ('1','2')),
  natureza_op       TEXT               DEFAULT 'VENDA DE PRODUTO INDUSTRIALIZADO',
  created_at        TIMESTAMPTZ        DEFAULT NOW(),
  updated_at        TIMESTAMPTZ        DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TABELA: notas_fiscais (histórico de NFs emitidas)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_number       INTEGER     NOT NULL,
  serie           INTEGER     NOT NULL DEFAULT 1,
  quote_id        UUID        REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_name   TEXT        NOT NULL,
  customer_doc    TEXT        NOT NULL DEFAULT '',
  ind_ie_dest     CHAR(1)              DEFAULT '9',
  dest_ie         TEXT,
  dest_email      TEXT,
  dest_address    TEXT,
  dest_city       TEXT,
  dest_uf         CHAR(2),
  dest_cmun       TEXT,
  dest_cep        TEXT,
  natureza_op     TEXT        NOT NULL DEFAULT 'VENDA DE PRODUTO INDUSTRIALIZADO',
  cfop            TEXT        NOT NULL DEFAULT '5101',
  ind_final       SMALLINT             DEFAULT 0,
  items           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  total_produtos  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_frete     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_nf        NUMERIC(14,2) NOT NULL DEFAULT 0,
  regime_trib     SMALLINT    NOT NULL DEFAULT 1,
  mod_frete       SMALLINT    NOT NULL DEFAULT 9,
  tp_pagamento    TEXT        NOT NULL DEFAULT '01',
  status          TEXT        NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','xml_gerado','emitida','cancelada')),
  xml_gerado      TEXT,
  chave_acesso    TEXT,
  protocolo       TEXT,
  data_emissao    DATE        NOT NULL DEFAULT CURRENT_DATE,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ          DEFAULT NOW(),
  updated_at      TIMESTAMPTZ          DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Trigger updated_at para as novas tabelas
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['nfe_settings','notas_fiscais']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.nfe_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read nfe_settings"   ON public.nfe_settings;
DROP POLICY IF EXISTS "Authenticated write nfe_settings"  ON public.nfe_settings;
DROP POLICY IF EXISTS "Authenticated read notas_fiscais"  ON public.notas_fiscais;
DROP POLICY IF EXISTS "Authenticated write notas_fiscais" ON public.notas_fiscais;

CREATE POLICY "Authenticated read nfe_settings"   ON public.nfe_settings  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write nfe_settings"  ON public.nfe_settings  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read notas_fiscais"  ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write notas_fiscais" ON public.notas_fiscais FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- Colunas faltando na tabela customers (endereço completo + IE)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ie               TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address_street   TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address_number   TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS neighborhood     TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS zip_code         TEXT;

-- ============================================================
-- FIM
-- ============================================================

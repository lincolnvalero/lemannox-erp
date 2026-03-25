-- ============================================================
-- LEMANNOX ERP — Supabase Schema
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/wlxemvvynvzfscebkpeh/sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: profiles (extensão do auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  category TEXT DEFAULT 'cliente',
  rating NUMERIC(3,1) DEFAULT 0,
  total_spent NUMERIC(14,2) DEFAULT 0,
  join_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  model TEXT NOT NULL,
  measurement TEXT NOT NULL,
  variations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  category TEXT NOT NULL DEFAULT 'materiais',
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  rating NUMERIC(3,1) DEFAULT 4.0,
  total_spent NUMERIC(14,2) DEFAULT 0,
  join_date TEXT,
  performance JSONB DEFAULT '{"price": 3, "quality": 3, "delivery": 3}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: materials
-- ============================================================
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  category TEXT,
  quantity NUMERIC(14,3) DEFAULT 0,
  min_quantity NUMERIC(14,3) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: quotes
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START 1500;

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number INTEGER DEFAULT nextval('public.quote_number_seq') NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_details JSONB DEFAULT '{}'::jsonb,
  obra TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','rejeitado','faturado','produzindo','entregue')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  freight NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  delivery_time DATE,
  manufacturing_deadline DATE,
  actual_delivery_date DATE,
  os_number INTEGER,
  notes TEXT,
  payment_terms TEXT,
  warranty TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: chart_of_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: financial_transactions
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.id_lanc_seq START 1;

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_lanc INTEGER DEFAULT nextval('public.id_lanc_seq') NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  category TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente')),
  related_type TEXT DEFAULT 'manual',
  related_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: ordens_servico
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.os_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_number INTEGER DEFAULT nextval('public.os_number_seq') NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','concluida','cancelada')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','customers','products','suppliers','materials','quotes','financial_transactions','ordens_servico']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl);
  END LOOP;
END;
$$;

-- ============================================================
-- TRIGGER: auto-cria profile ao criar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS: Row Level Security
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- Políticas: todos os usuários autenticados podem ler/escrever
-- (ajuste para produção conforme necessidade)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['customers','products','suppliers','materials','quotes','chart_of_accounts','financial_transactions','ordens_servico']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can write" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Authenticated users can read" ON public.%I FOR SELECT TO authenticated USING (true)', tbl);
    EXECUTE format('CREATE POLICY "Authenticated users can write" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END;
$$;

-- Profiles: usuário vê apenas o próprio perfil; admins veem todos
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============================================================
-- DADOS INICIAIS: Plano de Contas
-- ============================================================
INSERT INTO public.chart_of_accounts (name, type) VALUES
  ('Vendas', 'entrada'),
  ('Serviços', 'entrada'),
  ('Outras Receitas', 'entrada'),
  ('Matéria Prima', 'saida'),
  ('Mão de Obra', 'saida'),
  ('Energia Elétrica', 'saida'),
  ('Aluguel', 'saida'),
  ('Transporte / Frete', 'saida'),
  ('Impostos', 'saida'),
  ('Manutenção', 'saida'),
  ('Administrativo', 'saida'),
  ('Marketing', 'saida')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================

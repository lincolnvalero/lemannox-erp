-- ============================================================
-- LEMANNOX ERP — Migration: Motor de Cálculo de Coifas (Fase 2)
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- Substitui as fórmulas da planilha por consultas relacionais. Os valores
-- abaixo vêm de "Planilha_de_Cálculos.pdf" enviada pelo Levi. Os campos
-- marcados "A CONFIRMAR" em parametros_globais usam a fórmula que o Gemini
-- generalizou a partir do exemplo original (C=860 para Inox 430); ver a
-- pergunta 3 do Roteiro Lemannox antes de fechar preços de produção com eles.

-- ============================================================
-- TABELA: materiais_chapas — preço de chapa por material/bitola/largura
-- ============================================================
CREATE TABLE IF NOT EXISTS public.materiais_chapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,          -- '430' | '304' | 'Carbono'
  bitola INTEGER NOT NULL,         -- 20 | 22 | 24 | 26
  largura_padrao INTEGER NOT NULL, -- 2000 | 3000
  valor_chapa NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (material, bitola, largura_padrao)
);

-- ============================================================
-- TABELA: tabela_iluminacao — kit elétrico por tipo/instalação/medida
-- Cozinha não usa "Fonte"; Churrasqueira não usa "Botoeira" (usa "Botão").
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tabela_iluminacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_coifa TEXT NOT NULL,        -- 'Churrasqueira' | 'Cozinha'
  tipo_instalacao TEXT NOT NULL,   -- 'Parede' | 'Ilha'
  medida INTEGER NOT NULL,         -- 1000..3000, passo 100
  qtd_lampadas INTEGER NOT NULL DEFAULT 0,
  qtd_fonte INTEGER NOT NULL DEFAULT 0,
  qtd_botoeira INTEGER NOT NULL DEFAULT 0,
  qtd_botao INTEGER NOT NULL DEFAULT 0,
  qtd_chicote INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tipo_coifa, tipo_instalacao, medida)
);

-- ============================================================
-- TABELA: mao_de_obra — custo de mão de obra por modelo/medida
-- (Tabela_Mão_de_Obra da planilha)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mao_de_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medida INTEGER NOT NULL,
  modelo TEXT NOT NULL,   -- 'Box' | 'Piramidal' | 'Linea' | 'Tube' | 'Ilha'
  valor NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (medida, modelo)
);

-- ============================================================
-- TABELA: parametros_globais — parâmetros configuráveis (chave/valor)
-- Tela de edição: /admin/parametros-calculadora
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametros_globais (
  chave TEXT PRIMARY KEY,
  valor NUMERIC(14,4) NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de updated_at, seguindo o padrão já usado nas demais tabelas
-- (function public.update_updated_at() já existe — criada em supabase-schema.sql).
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['materiais_chapas','tabela_iluminacao','mao_de_obra','parametros_globais']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl);
  END LOOP;
END $$;

-- ============================================================
-- DADOS — apagar e regravar do zero é seguro aqui: são tabelas de
-- referência (preços/parâmetros), não dados de clientes ou orçamentos.
-- ============================================================
TRUNCATE public.materiais_chapas, public.tabela_iluminacao, public.mao_de_obra, public.parametros_globais;

INSERT INTO public.materiais_chapas (material, bitola, largura_padrao, valor_chapa) VALUES
  ('430', 20, 2000, 436.00),
  ('430', 22, 2000, 371.20),
  ('430', 24, 2000, 280.32),
  ('430', 26, 2000, 227.20),
  ('430', 20, 3000, 654.00),
  ('430', 22, 3000, 556.80),
  ('430', 24, 3000, 420.48),
  ('430', 26, 3000, 340.80),
  ('304', 20, 2000, 627.00),
  ('304', 22, 2000, 530.56),
  ('304', 24, 2000, 398.40),
  ('304', 26, 2000, 334.60),
  ('304', 20, 3000, 969.60),
  ('304', 22, 3000, 782.40),
  ('304', 24, 3000, 597.60),
  ('304', 26, 3000, 501.90),
  ('Carbono', 20, 2000, 175.00),
  ('Carbono', 22, 2000, 165.00),
  ('Carbono', 24, 2000, 135.00),
  ('Carbono', 26, 2000, 132.00),
  ('Carbono', 20, 3000, 265.00),
  ('Carbono', 22, 3000, 250.00),
  ('Carbono', 24, 3000, 205.00),
  ('Carbono', 26, 3000, 200.00);

INSERT INTO public.tabela_iluminacao (tipo_coifa, tipo_instalacao, medida, qtd_lampadas, qtd_fonte, qtd_botoeira, qtd_botao, qtd_chicote) VALUES
  ('Churrasqueira', 'Parede', 1000, 2, 1, 0, 2, 1),
  ('Churrasqueira', 'Ilha', 1000, 4, 1, 0, 2, 1),
  ('Churrasqueira', 'Parede', 1100, 2, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1100, 4, 1, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1200, 3, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1200, 6, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1300, 3, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1300, 6, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1400, 3, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1400, 6, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1500, 4, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1500, 8, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1600, 4, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1600, 8, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1700, 4, 1, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1700, 8, 2, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1800, 5, 2, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1800, 10, 3, 0, 2, 2),
  ('Churrasqueira', 'Parede', 1900, 5, 2, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 1900, 10, 3, 0, 2, 2),
  ('Churrasqueira', 'Parede', 2000, 5, 2, 0, 2, 2),
  ('Churrasqueira', 'Ilha', 2000, 10, 3, 0, 2, 2),
  ('Churrasqueira', 'Parede', 2100, 6, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2100, 12, 3, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2200, 6, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2200, 12, 3, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2300, 6, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2300, 12, 3, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2400, 7, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2400, 14, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2500, 7, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2500, 14, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2600, 7, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2600, 14, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2700, 8, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2700, 16, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2800, 8, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2800, 16, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 2900, 8, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 2900, 16, 4, 0, 2, 3),
  ('Churrasqueira', 'Parede', 3000, 8, 2, 0, 2, 3),
  ('Churrasqueira', 'Ilha', 3000, 16, 4, 0, 2, 3),
  ('Cozinha', 'Parede', 1000, 2, 0, 1, 0, 1),
  ('Cozinha', 'Ilha', 1000, 4, 0, 1, 0, 1),
  ('Cozinha', 'Parede', 1100, 2, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1100, 4, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1200, 3, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1200, 6, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1300, 3, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1300, 6, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1400, 3, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1400, 6, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1500, 4, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1500, 8, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1600, 4, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1600, 8, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1700, 4, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1700, 8, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1800, 5, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1800, 10, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 1900, 5, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 1900, 10, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 2000, 5, 0, 1, 0, 2),
  ('Cozinha', 'Ilha', 2000, 10, 0, 1, 0, 2),
  ('Cozinha', 'Parede', 2100, 6, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2100, 12, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2200, 6, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2200, 12, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2300, 6, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2300, 12, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2400, 7, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2400, 14, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2500, 7, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2500, 14, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2600, 7, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2600, 14, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2700, 8, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2700, 16, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2800, 8, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2800, 16, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 2900, 8, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 2900, 16, 0, 1, 0, 3),
  ('Cozinha', 'Parede', 3000, 8, 0, 1, 0, 3),
  ('Cozinha', 'Ilha', 3000, 16, 0, 1, 0, 3);

INSERT INTO public.mao_de_obra (medida, modelo, valor) VALUES
  (1000, 'Box', 350.00), (1000, 'Piramidal', 450.00), (1000, 'Linea', 400.00), (1000, 'Tube', 700.00), (1000, 'Ilha', 100.00),
  (1100, 'Box', 395.00), (1100, 'Piramidal', 485.00), (1100, 'Linea', 435.00), (1100, 'Tube', 735.00), (1100, 'Ilha', 110.00),
  (1200, 'Box', 440.00), (1200, 'Piramidal', 520.00), (1200, 'Linea', 470.00), (1200, 'Tube', 770.00), (1200, 'Ilha', 120.00),
  (1300, 'Box', 485.00), (1300, 'Piramidal', 560.00), (1300, 'Linea', 505.00), (1300, 'Tube', 805.00), (1300, 'Ilha', 130.00),
  (1400, 'Box', 530.00), (1400, 'Piramidal', 600.00), (1400, 'Linea', 540.00), (1400, 'Tube', 840.00), (1400, 'Ilha', 140.00),
  (1500, 'Box', 575.00), (1500, 'Piramidal', 635.00), (1500, 'Linea', 575.00), (1500, 'Tube', 875.00), (1500, 'Ilha', 150.00),
  (1600, 'Box', 620.00), (1600, 'Piramidal', 675.00), (1600, 'Linea', 610.00), (1600, 'Tube', 910.00), (1600, 'Ilha', 160.00),
  (1700, 'Box', 665.00), (1700, 'Piramidal', 710.00), (1700, 'Linea', 645.00), (1700, 'Tube', 945.00), (1700, 'Ilha', 170.00),
  (1800, 'Box', 710.00), (1800, 'Piramidal', 750.00), (1800, 'Linea', 680.00), (1800, 'Tube', 980.00), (1800, 'Ilha', 180.00),
  (1900, 'Box', 755.00), (1900, 'Piramidal', 785.00), (1900, 'Linea', 715.00), (1900, 'Tube', 1015.00), (1900, 'Ilha', 190.00),
  (2000, 'Box', 850.00), (2000, 'Piramidal', 825.00), (2000, 'Linea', 750.00), (2000, 'Tube', 1050.00), (2000, 'Ilha', 200.00),
  (2100, 'Box', 845.00), (2100, 'Piramidal', 860.00), (2100, 'Linea', 785.00), (2100, 'Tube', 1085.00), (2100, 'Ilha', 210.00),
  (2200, 'Box', 890.00), (2200, 'Piramidal', 900.00), (2200, 'Linea', 820.00), (2200, 'Tube', 1120.00), (2200, 'Ilha', 220.00),
  (2300, 'Box', 935.00), (2300, 'Piramidal', 935.00), (2300, 'Linea', 855.00), (2300, 'Tube', 1155.00), (2300, 'Ilha', 230.00),
  (2400, 'Box', 980.00), (2400, 'Piramidal', 975.00), (2400, 'Linea', 890.00), (2400, 'Tube', 1190.00), (2400, 'Ilha', 240.00),
  (2500, 'Box', 1025.00), (2500, 'Piramidal', 1010.00), (2500, 'Linea', 925.00), (2500, 'Tube', 1225.00), (2500, 'Ilha', 250.00),
  (2600, 'Box', 1070.00), (2600, 'Piramidal', 1050.00), (2600, 'Linea', 960.00), (2600, 'Tube', 1260.00), (2600, 'Ilha', 260.00),
  (2700, 'Box', 1115.00), (2700, 'Piramidal', 1085.00), (2700, 'Linea', 995.00), (2700, 'Tube', 1295.00), (2700, 'Ilha', 270.00),
  (2800, 'Box', 1160.00), (2800, 'Piramidal', 1125.00), (2800, 'Linea', 1030.00), (2800, 'Tube', 1330.00), (2800, 'Ilha', 280.00),
  (2900, 'Box', 1205.00), (2900, 'Piramidal', 1160.00), (2900, 'Linea', 1065.00), (2900, 'Tube', 1365.00), (2900, 'Ilha', 290.00),
  (3000, 'Box', 1250.00), (3000, 'Piramidal', 1200.00), (3000, 'Linea', 1100.00), (3000, 'Tube', 1400.00), (3000, 'Ilha', 300.00);

INSERT INTO public.parametros_globais (chave, valor, descricao) VALUES
  ('margem_lucro_padrao', 55, 'Margem de lucro padrão aplicada sobre o custo total (%)'),
  ('preco_lampada_cozinha', 26.0, 'Preço unitário — Lâmpada para Coifa de Cozinha'),
  ('preco_lampada_churrasqueira', 32.0, 'Preço unitário — Lâmpada para Coifa de Churrasqueira'),
  ('preco_fonte', 20.0, 'Preço unitário — Fonte de alimentação'),
  ('preco_botoeira', 26.0, 'Preço unitário — Botoeira (usada em Coifas de Cozinha)'),
  ('preco_botao', 25.0, 'Preço unitário — Botão (usado em Coifas de Churrasqueira)'),
  ('preco_chicote', 10.0, 'Preço unitário — Chicote elétrico'),
  ('preco_friso_por_cm', 0.4167, 'Preço do friso decorativo, por centímetro de extensão'),
  ('filtro_constante_430', 600, 'Constante (dividida por 0,7) da fórmula do Filtro Inercial 430 — A CONFIRMAR'),
  ('filtro_constante_304', 700, 'Constante (dividida por 0,7) da fórmula do Filtro Inercial 304 — A CONFIRMAR'),
  ('filtro_constante_aluminio', 300, 'Constante (dividida por 0,7) da fórmula do Filtro Alumínio — A CONFIRMAR'),
  ('filtro_coletor_gordura_por_cm', 1.0, 'Acréscimo do coletor de gordura simples, por cm de largura'),
  ('pintura_padrao', 0, 'Valor padrão sugerido para custo de pintura (editável por cálculo)');

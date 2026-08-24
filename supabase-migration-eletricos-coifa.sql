-- ============================================================
-- LEMANNOX ERP — Migration: Componentes elétricos da calculadora no Estoque
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- Até agora os preços de lâmpada/fonte/botoeira/botão/chicote ficavam em
-- parametros_globais. O Levi pediu para virem do Estoque (materials), no
-- mesmo lugar onde já se reajusta o preço das chapas — assim tudo o que
-- entra no cálculo da coifa fica editável num único lugar. Os valores
-- abaixo são os mesmos que já estavam em parametros_globais (vindos da
-- planilha original), só que agora como itens de Estoque, categoria
-- "Elétrico Coifa". Roda em modo idempotente: se já existir um item com o
-- mesmo nome e categoria, não duplica.

INSERT INTO public.materials (name, unit, category, quantity, min_quantity, unit_cost)
SELECT v.name, 'un', 'Elétrico Coifa', 0, 0, v.unit_cost
FROM (VALUES
  ('Lâmpada Cozinha', 26.00),
  ('Lâmpada Churrasqueira', 32.00),
  ('Fonte', 20.00),
  ('Botoeira', 26.00),
  ('Botão', 25.00),
  ('Chicote', 10.00)
) AS v(name, unit_cost)
WHERE NOT EXISTS (
  SELECT 1 FROM public.materials m
  WHERE m.category = 'Elétrico Coifa' AND m.name = v.name
);

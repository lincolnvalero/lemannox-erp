-- ============================================================
-- LEMANNOX ERP — Migration: remove a tabela materiais_chapas (não usada)
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- Essa tabela foi criada na primeira versão da calculadora de coifas,
-- mas o preço de chapa passou a vir direto do Estoque (materials,
-- categoria "Chapa") pouco depois. Ela ficou no banco sem uso desde
-- então. O Levi confirmou (16/9/26) que pode ser eliminada.

DROP TABLE IF EXISTS public.materiais_chapas;

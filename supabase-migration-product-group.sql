-- ============================================================
-- LEMANNOX ERP — Migration: Grupo do Produto
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================

-- "group" é palavra reservada em SQL, por isso a coluna se chama product_group.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_group TEXT;

-- ============================================================
-- LEMANNOX ERP — Migration: coluna Bitola em Materiais + correção de dados
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- width/height já existiam na tabela materials (parecem ter sido
-- adicionados manualmente), mas o código nunca lia nem gravava esses
-- campos — daí o "undefinedxundefinedmm" e a impossibilidade de editar.
-- Esta migration adiciona a coluna que faltava (bitola) e a preenche a
-- partir do padrão de nome já usado ("Chapa ... #22 (...) 2000").

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS bitola INTEGER;

UPDATE public.materials
SET bitola = substring(name from '#(\d+)')::int
WHERE category = 'Chapa' AND bitola IS NULL AND name ~ '#\d+';

-- Correções de digitação encontradas nos dados reais (o sufixo de largura
-- no nome não batia com a coluna width, ou o valor destoava muito da
-- referência original da planilha):
UPDATE public.materials SET width = 3000 WHERE name = 'Chapa Aço Carbono #24 (0,6mm) 3000' AND width = 2000;
UPDATE public.materials SET unit_cost = 200.00 WHERE name = 'Chapa Aço Carbono #26 (0,5mm) 3000' AND unit_cost = 2000.00;
UPDATE public.materials SET width = 2000 WHERE name = 'Chapa Inox 430 #22 (0,8mm) 2000' AND width = 3000;
UPDATE public.materials SET width = 3000 WHERE name = 'Chapa Inox 430 #22 (0,8mm) 3000' AND width = 2000;

-- ============================================================
-- LEMANNOX ERP — Migration: RLS nas tabelas da calculadora (CORREÇÃO DE SEGURANÇA)
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- As 4 tabelas criadas para a calculadora de coifas (materiais_chapas,
-- tabela_iluminacao, mao_de_obra, parametros_globais) foram esquecidas na
-- hora de habilitar RLS, ao contrário de todas as outras tabelas do
-- sistema. Isso significava que QUALQUER PESSOA, sem estar logada,
-- conseguia ler e ALTERAR esses dados usando só a chave pública do
-- projeto — inclusive a margem de lucro e as constantes de preço.
-- Confirmado com um teste real (leitura e escrita anônimas funcionaram).
-- Esta migration aplica a mesma política já usada no resto do sistema:
-- só usuário autenticado (logado) pode ler ou escrever.

ALTER TABLE public.materiais_chapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabela_iluminacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mao_de_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_globais ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['materiais_chapas','tabela_iluminacao','mao_de_obra','parametros_globais']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can write" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Authenticated users can read" ON public.%I FOR SELECT TO authenticated USING (true)', tbl);
    EXECUTE format('CREATE POLICY "Authenticated users can write" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END;
$$;

-- ============================================================
-- LEMANNOX ERP — Migration: corrige constraint de status de orçamentos
-- Execute no SQL Editor: https://supabase.com/dashboard/project/stwsvwkiufupjzigmkwl/sql
-- ============================================================
-- O status "aguardando" já existe no código (formulário, validação, UI)
-- desde o commit que introduziu essa aba, mas a constraint CHECK da coluna
-- quotes.status em produção nunca foi atualizada — supabase-schema.sql usa
-- CREATE TABLE IF NOT EXISTS, então essa alteração nunca rodou de fato
-- contra a tabela já existente. Isso causa "Erro ao Salvar" ao reverter
-- um orçamento de Aprovado para Aguardando.

-- Remove a constraint CHECK antiga (nome pode variar; localiza dinamicamente
-- em vez de assumir "quotes_status_check", já que a tabela foi criada antes
-- desta migration existir).
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT con.conname INTO c_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.quotes'::regclass
    AND con.contype = 'c'
    AND att.attname = 'status';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('rascunho','enviado','aprovado','rejeitado','faturado','produzindo','entregue','aguardando'));

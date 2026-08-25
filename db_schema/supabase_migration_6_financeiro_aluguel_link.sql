-- Migration 6: Link financeiro (Caderno de Fechamento) and alugueis (Empréstimos/Aluguéis de Equipamento)
-- Path: db_schema/supabase_migration_6_financeiro_aluguel_link.sql

ALTER TABLE public.financeiro 
ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.alugueis(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mes_referencia text;

-- Create an index to optimize filtering by contrato_id and mes_referencia
CREATE INDEX IF NOT EXISTS idx_financeiro_contrato_ref 
ON public.financeiro(contrato_id, mes_referencia);

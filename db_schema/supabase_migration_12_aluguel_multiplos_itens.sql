-- Migration 12: Suporte a múltiplos itens no aluguel / empréstimo de equipamentos
-- Path: db_schema/supabase_migration_12_aluguel_multiplos_itens.sql

-- Adiciona a coluna itens (JSONB) para armazenar múltiplos itens por contrato de aluguel/empréstimo
ALTER TABLE public.alugueis 
ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN public.alugueis.itens IS 'Lista de itens/equipamentos emprestados neste contrato com quantidade, número de série, valor unitário e descrição';

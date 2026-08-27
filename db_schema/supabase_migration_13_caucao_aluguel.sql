-- Migration 13: Suporte a Caução no aluguel/empréstimo de equipamentos
-- Path: db_schema/supabase_migration_13_caucao_aluguel.sql

-- Adiciona campos de caução na tabela public.alugueis
ALTER TABLE public.alugueis 
ADD COLUMN IF NOT EXISTS valor_caucao numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS caucao_pago boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS forma_pagamento_caucao text DEFAULT 'PIX',
ADD COLUMN IF NOT EXISTS data_caucao date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS caucao_observacoes text;

-- Comentários descritivos
COMMENT ON COLUMN public.alugueis.valor_caucao IS 'Valor do caução / garantia exigido no aluguel do equipamento';
COMMENT ON COLUMN public.alugueis.caucao_pago IS 'Indica se o caução foi quitado no ato da retirada do equipamento';
COMMENT ON COLUMN public.alugueis.forma_pagamento_caucao IS 'Forma de pagamento utilizada para quitar o caução (PIX, Dinheiro, Transferência, etc.)';
COMMENT ON COLUMN public.alugueis.data_caucao IS 'Data em que o caução foi pago';
COMMENT ON COLUMN public.alugueis.caucao_observacoes IS 'Observações específicas do caução e termos de restituição';

-- Índice para otimização de consultas por caução pago
CREATE INDEX IF NOT EXISTS idx_alugueis_caucao_pago ON public.alugueis(caucao_pago);

-- Migration 14: Melhorias no Cadastro e Controle de Estoque de Equipamentos
-- Path: db_schema/supabase_migration_14_estoque_melhorias.sql

ALTER TABLE public.estoque_equipamentos
ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Cadeira de Rodas',
ADD COLUMN IF NOT EXISTS estado_conservacao text DEFAULT 'Bom estado',
ADD COLUMN IF NOT EXISTS localizacao text DEFAULT 'Depósito Central',
ADD COLUMN IF NOT EXISTS valor_caucao_sugerido numeric(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS valor_aluguel_sugerido numeric(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS observacoes text;

-- Indexes para agilidade em buscas e relatórios
CREATE INDEX IF NOT EXISTS idx_estoque_equipamentos_categoria ON public.estoque_equipamentos(categoria);
CREATE INDEX IF NOT EXISTS idx_estoque_equipamentos_status ON public.estoque_equipamentos(status);

COMMENT ON COLUMN public.estoque_equipamentos.categoria IS 'Categoria do equipamento (ex: Cadeira de Rodas, Cadeira de Banho, Andador, Muletas, Cama Hospitalar)';
COMMENT ON COLUMN public.estoque_equipamentos.estado_conservacao IS 'Estado de conservação (ex: Excelente, Bom estado, Usado, Em Manutenção)';
COMMENT ON COLUMN public.estoque_equipamentos.localizacao IS 'Local físico de armazenamento na pastoral';
COMMENT ON COLUMN public.estoque_equipamentos.valor_caucao_sugerido IS 'Valor sugerido de caução para preenchimento ágil no aluguel';
COMMENT ON COLUMN public.estoque_equipamentos.valor_aluguel_sugerido IS 'Taxa de contribuição ou aluguel sugerida por período';

-- Migration 15: Suporte a Destinatário / Beneficiário Final do Equipamento no Aluguel
-- Path: db_schema/supabase_migration_15_destinatario_aluguel.sql

-- Adiciona colunas para identificar para quem o equipamento está sendo alugado
ALTER TABLE public.alugueis 
ADD COLUMN IF NOT EXISTS destinatario_tipo text DEFAULT 'proprio',
ADD COLUMN IF NOT EXISTS destinatario_nome text,
ADD COLUMN IF NOT EXISTS destinatario_cpf text,
ADD COLUMN IF NOT EXISTS destinatario_telefone text,
ADD COLUMN IF NOT EXISTS destinatario_parentesco text,
ADD COLUMN IF NOT EXISTS destinatario_observacoes text;

-- Comentários descritivos
COMMENT ON COLUMN public.alugueis.destinatario_tipo IS 'Indica se o equipamento é para o próprio locatário (proprio) ou para outra pessoa (outro)';
COMMENT ON COLUMN public.alugueis.destinatario_nome IS 'Nome completo do usuário/paciente final que utilizará o equipamento';
COMMENT ON COLUMN public.alugueis.destinatario_cpf IS 'CPF do usuário/paciente final (opcional)';
COMMENT ON COLUMN public.alugueis.destinatario_telefone IS 'Telefone de contato do usuário/paciente final (opcional)';
COMMENT ON COLUMN public.alugueis.destinatario_parentesco IS 'Grau de parentesco ou relação com o locatário (ex: Filho(a), Pai/Mãe, Cônjuge, etc.)';
COMMENT ON COLUMN public.alugueis.destinatario_observacoes IS 'Observações sobre o estado de saúde, condição ou necessidades do paciente';

-- Índice para acelerar buscas pelo nome do destinatário
CREATE INDEX IF NOT EXISTS idx_alugueis_destinatario_nome ON public.alugueis(destinatario_nome);

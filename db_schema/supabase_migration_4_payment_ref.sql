-- Migration 4: Ensure pagamentos_aluguel structure and enforce YYYY-MM format for mes_referencia
-- Path: db_schema/supabase_migration_4_payment_ref.sql

CREATE TABLE IF NOT EXISTS public.pagamentos_aluguel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aluguel_id uuid REFERENCES public.alugueis(id) ON DELETE CASCADE,
    mes_referencia text NOT NULL,
    data_pagamento date,
    valor_pago numeric NOT NULL,
    status text DEFAULT 'Pago',
    criado_em timestamptz DEFAULT now()
);

-- Enforce YYYY-MM format constraint (e.g. '2026-07') to avoid arbitrary text entries.
ALTER TABLE public.pagamentos_aluguel
DROP CONSTRAINT IF EXISTS chk_mes_referencia_format;

ALTER TABLE public.pagamentos_aluguel
ADD CONSTRAINT chk_mes_referencia_format
CHECK (mes_referencia ~ '^[0-9]{4}-[0-9]{2}$');

-- Create index for faster querying and relationship lookup
CREATE INDEX IF NOT EXISTS idx_pagamentos_aluguel_query 
ON public.pagamentos_aluguel(aluguel_id, mes_referencia);

-- Comment on column for team clarity
COMMENT ON COLUMN public.pagamentos_aluguel.mes_referencia IS 'Mês de referência do pagamento no formato YYYY-MM (ex: 2026-07)';

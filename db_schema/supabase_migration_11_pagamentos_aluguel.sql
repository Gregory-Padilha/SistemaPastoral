-- Migration 11: Controle Recorrente de Pagamentos Mensais de Aluguel
-- Path: db_schema/supabase_migration_11_pagamentos_aluguel.sql

CREATE TABLE IF NOT EXISTS public.historico_pagamentos_aluguel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id uuid NOT NULL REFERENCES public.alugueis(id) ON DELETE CASCADE,
    mes_referencia integer NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
    ano_referencia integer NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    observacoes text,
    UNIQUE(contrato_id, mes_referencia, ano_referencia)
);

-- Enable RLS
ALTER TABLE public.historico_pagamentos_aluguel ENABLE ROW LEVEL SECURITY;

-- Create permissive policy
CREATE POLICY "Allow all on historico_pagamentos_aluguel" ON public.historico_pagamentos_aluguel
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';

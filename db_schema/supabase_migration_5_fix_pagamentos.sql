-- Migration 5: Fix pagamentos_equipamento and pagamentos_aluguel schema alignment
-- Path: db_schema/supabase_migration_5_fix_pagamentos.sql

-- 1. Adjust public.pagamentos_equipamento
CREATE TABLE IF NOT EXISTS public.pagamentos_equipamento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aluguel_id uuid REFERENCES public.alugueis(id) ON DELETE CASCADE,
    mes_referencia text NOT NULL,
    data_pagamento date,
    valor_pago numeric NOT NULL,
    valor_cobrado numeric, -- Made optional / NULL allowed
    status text DEFAULT 'Pago',
    criado_em timestamptz DEFAULT now()
);

-- If the table already exists, alter columns to ensure compatibility
ALTER TABLE public.pagamentos_equipamento ALTER COLUMN valor_cobrado DROP NOT NULL;
ALTER TABLE public.pagamentos_equipamento ALTER COLUMN valor_pago SET NOT NULL;
ALTER TABLE public.pagamentos_equipamento ALTER COLUMN mes_referencia SET NOT NULL;

-- Enforce YYYY-MM format on mes_referencia for pagamentos_equipamento
ALTER TABLE public.pagamentos_equipamento DROP CONSTRAINT IF EXISTS chk_mes_referencia_format_equip;
ALTER TABLE public.pagamentos_equipamento ADD CONSTRAINT chk_mes_referencia_format_equip 
CHECK (mes_referencia ~ '^[0-9]{4}-[0-9]{2}$');

-- Ensure index exists for fast querying
CREATE INDEX IF NOT EXISTS idx_pagamentos_equipamento_query 
ON public.pagamentos_equipamento(aluguel_id, mes_referencia);


-- 2. Adjust public.pagamentos_aluguel (Ensuring alignment for whichever table is hit by queries)
CREATE TABLE IF NOT EXISTS public.pagamentos_aluguel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aluguel_id uuid REFERENCES public.alugueis(id) ON DELETE CASCADE,
    mes_referencia text NOT NULL,
    data_pagamento date,
    valor_pago numeric NOT NULL,
    valor_cobrado numeric, -- Made optional / NULL allowed
    status text DEFAULT 'Pago',
    criado_em timestamptz DEFAULT now()
);

-- If the table already exists, alter columns to ensure compatibility
ALTER TABLE public.pagamentos_aluguel ALTER COLUMN valor_cobrado DROP NOT NULL;
ALTER TABLE public.pagamentos_aluguel ALTER COLUMN valor_pago SET NOT NULL;
ALTER TABLE public.pagamentos_aluguel ALTER COLUMN mes_referencia SET NOT NULL;

-- Enforce YYYY-MM format on mes_referencia for pagamentos_aluguel
ALTER TABLE public.pagamentos_aluguel DROP CONSTRAINT IF EXISTS chk_mes_referencia_format_aluguel;
ALTER TABLE public.pagamentos_aluguel ADD CONSTRAINT chk_mes_referencia_format_aluguel 
CHECK (mes_referencia ~ '^[0-9]{4}-[0-9]{2}$');

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_pagamentos_aluguel_query_fix 
ON public.pagamentos_aluguel(aluguel_id, mes_referencia);

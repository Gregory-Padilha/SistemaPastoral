-- Create table for recurrent basket recipients
CREATE TABLE IF NOT EXISTS public.beneficiarios_cestas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid NOT NULL REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    criado_em timestamp with time zone DEFAULT now(),
    UNIQUE(beneficiario_id)
);

-- Create table for basket delivery history recurrence
CREATE TABLE IF NOT EXISTS public.historico_entregas_cestas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid NOT NULL REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    mes_referencia integer NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
    ano_referencia integer NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    observacoes text,
    UNIQUE(beneficiario_id, mes_referencia, ano_referencia)
);

-- Enable RLS for the tables
ALTER TABLE public.beneficiarios_cestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_entregas_cestas ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies
CREATE POLICY "Allow all on beneficiarios_cestas" ON public.beneficiarios_cestas
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on historico_entregas_cestas" ON public.historico_entregas_cestas
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

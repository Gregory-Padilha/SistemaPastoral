-- Migration 7: Módulo de Anotações de Retirada
-- Path: db_schema/supabase_migration_7_retiradas.sql

CREATE TABLE IF NOT EXISTS public.itens_retirada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    unidade_medida text DEFAULT 'UN',
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anotacoes_retirada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    data_retirada date NOT NULL DEFAULT CURRENT_DATE,
    observacoes text,
    criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anotacoes_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anotacao_id uuid REFERENCES public.anotacoes_retirada(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.itens_retirada(id) ON DELETE RESTRICT,
    quantidade integer NOT NULL CHECK (quantidade > 0)
);

-- Enable RLS
ALTER TABLE public.itens_retirada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_retirada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_itens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Full access to authenticated" ON public.itens_retirada;
DROP POLICY IF EXISTS "Full access to authenticated" ON public.anotacoes_retirada;
DROP POLICY IF EXISTS "Full access to authenticated" ON public.anotacoes_itens;

-- Create policies for authenticated users
CREATE POLICY "Full access to authenticated" ON public.itens_retirada 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Full access to authenticated" ON public.anotacoes_retirada 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Full access to authenticated" ON public.anotacoes_itens 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

-- Pre-populate some default items
INSERT INTO public.itens_retirada (nome, unidade_medida) VALUES
('Cesta Básica', 'UN'),
('Cobertor', 'UN'),
('Fralda P', 'UN'),
('Fralda M', 'UN'),
('Fralda G', 'UN'),
('Fralda GG', 'UN'),
('Roupa Adulto', 'UN'),
('Roupa Infantil', 'UN'),
('Calçado', 'PAR')
ON CONFLICT DO NOTHING;

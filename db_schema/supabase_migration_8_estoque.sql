-- Migration 8: Controle de Estoque de Equipamentos
-- Path: db_schema/supabase_migration_8_estoque.sql

CREATE TABLE IF NOT EXISTS public.estoque_equipamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_equipamento text NOT NULL,
    numero_serie text,
    quantidade_total integer NOT NULL DEFAULT 1 CHECK (quantidade_total >= 0),
    quantidade_disponivel integer NOT NULL DEFAULT 1 CHECK (quantidade_disponivel >= 0),
    status text DEFAULT 'Disponível', -- 'Disponível', 'Esgotado'
    deletado_em timestamptz DEFAULT NULL,
    criado_em timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estoque_equipamentos ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for authenticated users
DROP POLICY IF EXISTS "Full access to authenticated" ON public.estoque_equipamentos;
CREATE POLICY "Full access to authenticated" ON public.estoque_equipamentos 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add ForeignKey column 'equipamento_id' to alugueis table
ALTER TABLE public.alugueis 
ADD COLUMN IF NOT EXISTS equipamento_id uuid REFERENCES public.estoque_equipamentos(id) ON DELETE SET NULL;

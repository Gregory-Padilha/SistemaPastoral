-- 1. Criar a tabela de estoque se não existir
CREATE TABLE IF NOT EXISTS public.estoque_equipamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_equipamento text NOT NULL,
    numero_serie text,
    quantidade_total integer NOT NULL DEFAULT 0,
    quantidade_disponivel integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'Disponível',
    criado_em timestamptz DEFAULT now(),
    atualizado_em timestamptz DEFAULT now(),
    deletado_em timestamptz DEFAULT null
);

-- 2. Migrar dados existentes da tabela antiga 'equipamentos' para 'estoque_equipamentos'
-- Preservando os IDs originais para evitar quebra de chaves estrangeiras
INSERT INTO public.estoque_equipamentos (id, nome_equipamento, numero_serie, quantidade_total, quantidade_disponivel, status, criado_em, atualizado_em, deletado_em)
SELECT id, nome, numero_serie, 1, 1, 'Disponível', criado_em, atualizado_em, deletado_em
FROM public.equipamentos
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS
ALTER TABLE public.estoque_equipamentos ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso
DROP POLICY IF EXISTS "Full access to authenticated" ON public.estoque_equipamentos;
CREATE POLICY "Full access to authenticated" ON public.estoque_equipamentos 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Atualizar FK de contratos_equipamento para apontar para a tabela de estoque
ALTER TABLE public.contratos_equipamento DROP CONSTRAINT IF EXISTS contratos_equipamento_equipamento_id_fkey;
ALTER TABLE public.contratos_equipamento ADD CONSTRAINT contratos_equipamento_equipamento_id_fkey FOREIGN KEY (equipamento_id) REFERENCES public.estoque_equipamentos(id) ON DELETE SET NULL;

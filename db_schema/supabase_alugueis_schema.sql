-- Create public.alugueis Table
CREATE TABLE IF NOT EXISTS public.alugueis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    locatario_nome text NOT NULL,
    locatario_cpf text,
    locatario_rg text,
    locatario_telefone text,
    locatario_whatsapp text,
    locatario_email text,
    imovel_endereco text NOT NULL,
    imovel_tipo text DEFAULT 'Casa',
    imovel_descricao text,
    valor_aluguel numeric NOT NULL,
    data_inicio date,
    data_fim date,
    dia_vencimento integer NOT NULL,
    forma_pagamento text DEFAULT 'PIX',
    clausulas_especiais text,
    observacoes text,
    status text DEFAULT 'Ativo',
    deletado_em timestamptz DEFAULT NULL,
    criado_em timestamptz DEFAULT now()
);

-- Create public.pagamentos_aluguel Table
CREATE TABLE IF NOT EXISTS public.pagamentos_aluguel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aluguel_id uuid REFERENCES public.alugueis(id) ON DELETE CASCADE,
    mes_referencia text NOT NULL,
    data_pagamento date,
    valor_pago numeric NOT NULL,
    status text DEFAULT 'Pago',
    criado_em timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.alugueis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_aluguel ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Full access to authenticated" ON public.alugueis;
DROP POLICY IF EXISTS "Full access to authenticated" ON public.pagamentos_aluguel;

-- Create policies for authenticated users
CREATE POLICY "Full access to authenticated" ON public.alugueis 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Full access to authenticated" ON public.pagamentos_aluguel 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

-- Audit System Trigger Integration for alugueis
-- (Assumes the processar_auditoria trigger function from migration 2 exists)
DROP TRIGGER IF EXISTS trg_auditoria_alugueis ON public.alugueis;
CREATE TRIGGER trg_auditoria_alugueis
AFTER INSERT OR UPDATE ON public.alugueis
FOR EACH ROW EXECUTE FUNCTION public.processar_auditoria();

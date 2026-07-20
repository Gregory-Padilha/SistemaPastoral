-- 1. Tabela de itens disponíveis para retirada
CREATE TABLE IF NOT EXISTS public.itens_retirada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    unidade_medida text DEFAULT 'Unidade',
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- 2. Tabela cabeçalho das anotações de retirada
CREATE TABLE IF NOT EXISTS public.anotacoes_retirada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    data_retirada date DEFAULT CURRENT_DATE,
    observacoes text,
    criado_em timestamptz DEFAULT now()
);

-- 3. Tabela pivô de itens em cada anotação de retirada
CREATE TABLE IF NOT EXISTS public.anotacoes_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anotacao_id uuid REFERENCES public.anotacoes_retirada(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.itens_retirada(id) ON DELETE CASCADE,
    quantidade integer NOT NULL CHECK (quantidade > 0)
);

-- RLS (Row Level Security)
ALTER TABLE public.itens_retirada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_retirada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Full access to authenticated" ON public.itens_retirada FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.anotacoes_retirada FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.anotacoes_itens FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Inserir alguns itens padrão iniciais
INSERT INTO public.itens_retirada (nome, unidade_medida) VALUES
('Calça', 'Unidade'),
('Blusa', 'Unidade'),
('Cobertor', 'Unidade'),
('Sapato', 'Par'),
('Meia', 'Par')
ON CONFLICT DO NOTHING;

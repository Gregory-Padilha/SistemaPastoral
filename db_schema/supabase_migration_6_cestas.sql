-- 1. Remove tabelas anteriores se existirem para evitar conflito de colunas/estruturas antigas
DROP TABLE IF EXISTS public.entregas_cesta CASCADE;
DROP TABLE IF EXISTS public.beneficiarios_cesta CASCADE;

-- 2. Criar a tabela 'beneficiarios_cesta' com todos os campos estruturais do formulário original
CREATE TABLE IF NOT EXISTS public.beneficiarios_cesta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE SET NULL, -- Vínculo opcional com beneficiário base
    nome text NOT NULL,
    cpf text UNIQUE,
    data_nascimento date,
    sexo text DEFAULT 'Masculino',
    foto_url text,
    telefone text,
    whatsapp text,
    email text,
    cep text,
    rua text,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    estado text,
    patologias text[], -- Array de patologias
    patologia_outro text,
    historico_saude text,
    observacoes_medicas text,
    motivo_recebimento text,
    renda_familiar numeric,
    num_pessoas_residencia integer DEFAULT 1,
    situacao_moradia text DEFAULT 'Alugada',
    responsavel_nome text,
    responsavel_parentesco text,
    responsavel_cpf text,
    responsavel_telefone text,
    responsavel_whatsapp text,
    responsavel_email text,
    responsavel_cep text,
    responsavel_rua text,
    responsavel_numero text,
    responsavel_complemento text,
    responsavel_bairro text,
    responsavel_cidade text,
    responsavel_estado text,
    status text DEFAULT 'Ativo',
    deletado_em timestamptz DEFAULT NULL,
    criado_em timestamptz DEFAULT now(),
    atualizado_em timestamptz DEFAULT now()
);

-- 3. Criar a tabela 'entregas_cesta' para registrar o histórico mensal de entregas
CREATE TABLE IF NOT EXISTS public.entregas_cesta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios_cesta(id) ON DELETE CASCADE,
    mes_referencia varchar(7) NOT NULL, -- Formato: YYYY-MM (ex: "2026-07")
    data_entrega timestamptz DEFAULT now(),
    responsavel_entrega text,
    observacoes text
);

-- 4. Criar índice único composto para impedir que a mesma pessoa receba duas cestas no mesmo mês
CREATE UNIQUE INDEX IF NOT EXISTS idx_entregas_cesta_beneficiario_mes 
ON public.entregas_cesta(beneficiario_id, mes_referencia);

-- 5. Habilitar RLS (Row Level Security) nas novas tabelas
ALTER TABLE public.beneficiarios_cesta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_cesta ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de acesso completo para usuários autenticados
DROP POLICY IF EXISTS "Full access to authenticated" ON public.beneficiarios_cesta;
CREATE POLICY "Full access to authenticated" ON public.beneficiarios_cesta 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Full access to authenticated" ON public.entregas_cesta;
CREATE POLICY "Full access to authenticated" ON public.entregas_cesta 
    FOR ALL TO authenticated 
    USING (auth.uid() IS NOT NULL) 
    WITH CHECK (auth.uid() IS NOT NULL);

-- 1. Soft Delete setup
ALTER TABLE public.beneficiarios ADD COLUMN IF NOT EXISTS deletado_em timestamptz DEFAULT NULL;
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS deletado_em timestamptz DEFAULT NULL;
ALTER TABLE public.alugueis ADD COLUMN IF NOT EXISTS deletado_em timestamptz DEFAULT NULL;
ALTER TABLE public.modelos_mensagem ADD COLUMN IF NOT EXISTS deletado_em timestamptz DEFAULT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contratos_aluguel') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contratos_aluguel' AND column_name='deletado_em') THEN
            ALTER TABLE public.contratos_aluguel ADD COLUMN deletado_em timestamptz DEFAULT NULL;
        END IF;
    END IF;
END $$;

-- 2. Audit Table
CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
    tabela_afetada text NOT NULL,
    registro_id uuid NOT NULL,
    acao text NOT NULL, -- 'INSERT', 'UPDATE', 'SOFT_DELETE'
    dados_antigos jsonb DEFAULT null,
    dados_novos jsonb DEFAULT null,
    criado_em timestamptz DEFAULT now()
);

-- Enable RLS for logs_sistema
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow read access to admin users
DROP POLICY IF EXISTS "Admin read only" ON public.logs_sistema;
CREATE POLICY "Admin read only" ON public.logs_sistema
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND perfil = 'admin'
  )
);

-- 3. Trigger for audit processing
CREATE OR REPLACE FUNCTION public.processar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
    v_perfil_id UUID;
    v_acao TEXT;
    v_dados_antigos JSONB := NULL;
    v_dados_novos JSONB := NULL;
BEGIN
    -- Get current authenticated user
    BEGIN
        v_perfil_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_perfil_id := NULL;
    END;

    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_acao := 'INSERT';
        v_dados_novos := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_dados_antigos := to_jsonb(OLD);
        v_dados_novos := to_jsonb(NEW);
        
        -- Check if it is a soft delete
        IF OLD.deletado_em IS NULL AND NEW.deletado_em IS NOT NULL THEN
            v_acao := 'SOFT_DELETE';
        ELSE
            v_acao := 'UPDATE';
        END IF;
    END IF;

    -- Insert into logs_sistema
    INSERT INTO public.logs_sistema (
        perfil_id,
        tabela_afetada,
        registro_id,
        acao,
        dados_antigos,
        dados_novos
    ) VALUES (
        v_perfil_id,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_acao,
        v_dados_antigos,
        v_dados_novos
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for public.beneficiarios
DROP TRIGGER IF EXISTS trg_auditoria_beneficiarios ON public.beneficiarios;
CREATE TRIGGER trg_auditoria_beneficiarios
AFTER INSERT OR UPDATE ON public.beneficiarios
FOR EACH ROW EXECUTE FUNCTION public.processar_auditoria();

-- Triggers for public.financeiro
DROP TRIGGER IF EXISTS trg_auditoria_financeiro ON public.financeiro;
CREATE TRIGGER trg_auditoria_financeiro
AFTER INSERT OR UPDATE ON public.financeiro
FOR EACH ROW EXECUTE FUNCTION public.processar_auditoria();

-- Triggers for public.alugueis
DROP TRIGGER IF EXISTS trg_auditoria_alugueis ON public.alugueis;
CREATE TRIGGER trg_auditoria_alugueis
AFTER INSERT OR UPDATE ON public.alugueis
FOR EACH ROW EXECUTE FUNCTION public.processar_auditoria();

-- Triggers for public.contratos_aluguel (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contratos_aluguel') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auditoria_contratos_aluguel ON public.contratos_aluguel;';
        EXECUTE 'CREATE TRIGGER trg_auditoria_contratos_aluguel AFTER INSERT OR UPDATE ON public.contratos_aluguel FOR EACH ROW EXECUTE FUNCTION public.processar_auditoria();';
    END IF;
END $$;

-- 4. Basket stock config updates
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS estoque_cestas integer DEFAULT 0;

-- 5. WhatsApp Module architecture
CREATE TABLE IF NOT EXISTS public.modelos_mensagem (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text NOT NULL,
    categoria text,
    texto text NOT NULL,
    sistema_padrao boolean DEFAULT false,
    ativo boolean DEFAULT true,
    deletado_em timestamptz DEFAULT NULL,
    criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.modelos_mensagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access to authenticated" ON public.modelos_mensagem;
CREATE POLICY "Full access to authenticated" ON public.modelos_mensagem FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.historico_mensagens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
    destinatario_id uuid NOT NULL,
    destinatario_tipo text NOT NULL, -- 'geral', 'cesta', 'aluguel'
    modelo_id uuid REFERENCES public.modelos_mensagem(id) ON DELETE SET NULL,
    enviado_em timestamptz DEFAULT now()
);

ALTER TABLE public.historico_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access to authenticated" ON public.historico_mensagens;
CREATE POLICY "Access to authenticated" ON public.historico_mensagens FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Insert templates if needed
INSERT INTO public.modelos_mensagem (titulo, categoria, texto, sistema_padrao)
SELECT 'Cobrança de Aluguel', 'Financeiro', 'Olá, {nome}! Tudo bem? Passando para lembrar que o aluguel referente ao mês de {mes} está disponível para pagamento. O valor é de {valor}. Qualquer dúvida estamos à disposição. Deus abençoe! Equipe {instituicao}.', true
WHERE NOT EXISTS (SELECT 1 FROM public.modelos_mensagem WHERE titulo = 'Cobrança de Aluguel');

INSERT INTO public.modelos_mensagem (titulo, categoria, texto, sistema_padrao)
SELECT 'Como Você Está', 'Acompanhamento', 'Olá, {nome}! A equipe da {instituicao} está entrando em contato para saber como você está. Caso precise de algum apoio ou tenha alguma necessidade, não hesite em nos contatar. Estamos aqui para ajudar. Deus abençoe você e sua família!', true
WHERE NOT EXISTS (SELECT 1 FROM public.modelos_mensagem WHERE titulo = 'Como Você Está');

INSERT INTO public.modelos_mensagem (titulo, categoria, texto, sistema_padrao)
SELECT 'Confirmação de Cesta Básica', 'Cesta Básica', 'Olá, {nome}! Gostaríamos de confirmar que a cesta básica do mês de {mes} está disponível para retirada. Por favor, entre em contato para agendar a retirada ou aguarde nosso aviso. Deus abençoe! Equipe {instituicao}.', true
WHERE NOT EXISTS (SELECT 1 FROM public.modelos_mensagem WHERE titulo = 'Confirmação de Cesta Básica');

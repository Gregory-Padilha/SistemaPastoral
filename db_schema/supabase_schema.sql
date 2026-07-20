-- Schema definitions for Sistema Pastoral Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. perfis table
CREATE TABLE IF NOT EXISTS public.perfis (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text,
    email text,
    perfil text CHECK (perfil IN ('admin', 'gestor', 'voluntario')),
    foto_url text,
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- 2. beneficiarios table
CREATE TABLE IF NOT EXISTS public.beneficiarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT null,
    cpf text UNIQUE,
    rg text,
    data_nascimento date,
    sexo text,
    estado_civil text,
    escolaridade text,
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
    renda_familiar numeric,
    tipo_moradia text,
    outros_beneficios boolean DEFAULT false,
    quais_beneficios text,
    observacoes text,
    status text DEFAULT 'ativo',
    criado_em timestamptz DEFAULT now(),
    atualizado_em timestamptz DEFAULT now()
);

-- 3. membros_familia table
CREATE TABLE IF NOT EXISTS public.membros_familia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    nome text,
    parentesco text,
    idade integer
);

-- 4. beneficios_recebidos table
CREATE TABLE IF NOT EXISTS public.beneficios_recebidos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    tipo text
);

-- 5. documentos table
CREATE TABLE IF NOT EXISTS public.documentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    nome text,
    url text,
    criado_em timestamptz DEFAULT now()
);

-- 6. financeiro table
CREATE TABLE IF NOT EXISTS public.financeiro (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo text NOT null CHECK (tipo IN ('entrada', 'saida')),
    data date NOT null,
    descricao text NOT null,
    categoria text,
    valor numeric NOT null,
    forma_pagamento text,
    responsavel_id uuid REFERENCES public.perfis(id),
    observacoes text,
    criado_em timestamptz DEFAULT now()
);

-- 7. atendimentos table
CREATE TABLE IF NOT EXISTS public.atendimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    data date NOT null,
    tipo text NOT null,
    responsavel_id uuid REFERENCES public.perfis(id),
    observacoes text,
    criado_em timestamptz DEFAULT now()
);

-- 8. categorias table
CREATE TABLE IF NOT EXISTS public.categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT null,
    tipo text CHECK (tipo IN ('financeiro', 'beneficio')),
    criado_em timestamptz DEFAULT now()
);

-- 9. configuracoes table
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_instituicao text,
    cnpj text,
    endereco text,
    telefone text,
    logo_url text
);

-- ----------------------------------------------------
-- TRIGGER FOR USER SIGN UP
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, perfil, ativo)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email,
    coalesce(new.raw_user_meta_data->>'perfil', 'voluntario'),
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_familia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficios_recebidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- General policy for authenticated users (Allows full access except custom rule for perfis update)
CREATE POLICY "Full access to authenticated" ON public.beneficiarios FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.membros_familia FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.beneficios_recebidos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.documentos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.financeiro FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.atendimentos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.categorias FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Full access to authenticated" ON public.configuracoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Custom RLS policies for perfis (authenticated users can read all, insert new, but only update their own)
CREATE POLICY "Allow select for authenticated" ON public.perfis FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert for authenticated" ON public.perfis FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow update own profile" ON public.perfis FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow delete for authenticated" ON public.perfis FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------
-- STORAGE BUCKETS CONFIGURATION
-- ----------------------------------------------------

INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-beneficiarios', 'fotos-beneficiarios', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-beneficiarios', 'documentos-beneficiarios', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

-- Storage object policies for authenticated users
CREATE POLICY "Allow select objects to authenticated" ON storage.objects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert objects to authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow update objects to authenticated" ON storage.objects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow delete objects to authenticated" ON storage.objects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

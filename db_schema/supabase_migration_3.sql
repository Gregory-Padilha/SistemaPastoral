-- 1. Add beneficiario_id column to beneficiarios table
ALTER TABLE public.beneficiarios ADD COLUMN IF NOT EXISTS beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE SET NULL;

-- 2. Drop rg column from beneficiarios table
ALTER TABLE public.beneficiarios DROP COLUMN IF EXISTS rg;

-- 3. Drop rg column from beneficiarios_cesta table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'beneficiarios_cesta') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='beneficiarios_cesta' AND column_name='rg') THEN
            ALTER TABLE public.beneficiarios_cesta DROP COLUMN rg;
        END IF;
    END IF;
END $$;

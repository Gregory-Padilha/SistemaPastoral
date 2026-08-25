-- Migration to add quantity column to basket delivery history
ALTER TABLE public.cestas_entregas ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 1;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ========================================================================================
-- SCRIPT 22: AÑADIR AUTORIZACIÓN PERSISTENTE DE DEUDA EN PEDIDOS
-- ========================================================================================

-- Añadir columna is_authorized a la tabla orders si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='orders' AND column_name='is_authorized') THEN
        ALTER TABLE public.orders ADD COLUMN is_authorized BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- Opcional: Asegurar que el RLS permita a los admins actualizar esta columna
-- (El RLS de update en orders debería estar ya cubriendo a admins)
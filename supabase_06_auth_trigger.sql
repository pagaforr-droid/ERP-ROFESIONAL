-- ========================================================================================
-- SCRIPT 06: AUTOMATIZACIÓN DE IDENTIDAD (SUPABASE AUTH -> ERP_USERS)
-- ========================================================================================
-- Conecta el sistema central de autenticación de Supabase (auth.users) con la
-- tabla de perfiles del ERP (public.erp_users).
-- ========================================================================================

-- Eliminar la columna temporal (por si fue agregada durante pruebas de Option B)
ALTER TABLE public.erp_users DROP COLUMN IF EXISTS password;

-- Habilitar seguridad férrea (RLS) en todas las tablas importantes (revierte Script 05)
ALTER TABLE public.erp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

-- 1. Crear el Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insertamos la equivalencia en erp_users. 
  -- Por defecto, todo usuario creado tendrá rol SELLER (Vendedor).
  -- El administrador deberá cambiarlo a ADMIN manualmente en la tabla si corresponde.
  INSERT INTO public.erp_users (auth_id, username, name, role, is_active, permissions)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)), -- Extrae username del email
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    'SELLER', 
    true,
    '["dashboard", "sales", "clients", "products"]'::jsonb -- Permisos básicos
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpiar triggers viejos por si existen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Adjuntar el Trigger a auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- IMPORTANTE: Para habilitar el primer Administrador, crea un usuario con tu email en 
-- Supabase Dashboard -> Authentication. El trigger creará su registro en erp_users.
-- Luego, ve al "Table Editor" -> "erp_users", busca tu registro y cámbiale el "role"
-- de 'SELLER' a 'ADMIN', y agrégale todos los permissions necesarios en el JSON.

-- ========================================================================================
-- SCRIPT 05: DESHABILITAR RLS TEMPORALMENTE (PARA OPCIÓN B)
-- ========================================================================================
-- Dado que elegimos la "Opción B" (Login por Software en lugar de Supabase Auth Nativo),
-- el motor de la base de datos no puede verificar de forma segura los permisos de inserción.
-- Al intentar insertar un Producto, el RLS (Row Level Security) bloqueaba silenciosamente
-- la acción porque detectaba que "nadie" (ningún usuario en Supabase Auth) estaba insertándolo.
-- 
-- Ejecuta este script en Supabase SQL Editor para apagar temporalmente el RLS y permitir
-- que el sistema grabe datos con total libertad mientras estás en esta fase de pruebas.

ALTER TABLE erp_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE combos DISABLE ROW LEVEL SECURITY;

-- Nota: Para cuando quieras pasar a producción real masiva, 
-- cambiaremos a la Opción A y volveremos a activar la seguridad con:
-- ALTER TABLE tu_tabla ENABLE ROW LEVEL SECURITY;

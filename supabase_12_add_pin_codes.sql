-- Migración para añadir soporte de contraseña/PIN a Vendedores y Choferes

-- 1. Añadir columna pin_code a la tabla sellers (App Vendedores)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pin_code TEXT;

-- 2. Añadir columna pin_code a la tabla drivers (App Reparto)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pin_code TEXT;

-- Nota: Esta migración permite la autenticación en campo para las aplicaciones móviles.

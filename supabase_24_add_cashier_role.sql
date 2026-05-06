-- ========================================================================================
-- SCRIPT 24: AÑADIR ROL CAJERO (CASHIER) AL ENUM Y ACTUALIZAR PERMISOS
-- ========================================================================================

-- 1. Agregar el nuevo rol al tipo ENUM existente
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CASHIER';

-- 2. Actualizar las Políticas RLS para que el Cajero pueda leer las ventas y lotes
DROP POLICY IF EXISTS "Acceso a Ventas Global (Empleados)" ON sales;
CREATE POLICY "Acceso a Ventas Global (Empleados)" ON sales
    FOR SELECT USING (
        get_current_user_role() IN ('ADMIN', 'SELLER', 'LOGISTICS', 'WAREHOUSE', 'CASHIER')
    );

DROP POLICY IF EXISTS "Lectura global de Lotes" ON batches;
CREATE POLICY "Lectura global de Lotes" ON batches
    FOR SELECT USING (
        get_current_user_role() IN ('ADMIN', 'SELLER', 'WAREHOUSE', 'LOGISTICS', 'CASHIER')
    );

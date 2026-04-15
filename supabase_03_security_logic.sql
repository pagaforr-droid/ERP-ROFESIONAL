-- ========================================================================================
-- SCRIPT 03: LÓGICA DE NEGOCIO Y SEGURIDAD (RLS + TRIGGERS)
-- ========================================================================================
-- Este script define funciones automáticas manejadas en la Base de Datos (Triggers)
-- y políticas de Row Level Security (RLS) que determinan qué puede ver o modificar 
-- cada usuario de manera nativa sin recargar el back-end.
-- ========================================================================================

-- ----------------------------------------------------------------------------------------
-- PARTE 1: FUNCIONES ÚTILES PARA TRIGGERS
-- ----------------------------------------------------------------------------------------

-- 1.1 Función para auto-actualizar el campo `updated_at`
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignar el trigger a todas las tablas importantes (Ejemplo abreviado)
CREATE TRIGGER tr_erp_users_updated_at BEFORE UPDATE ON erp_users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE set_updated_at();


-- 1.2 FUNCIONES Y TRIGGERS PARA EL INVENTARIO (KARDEX)
-- Esta es la lógica core en DB para reducir o aumentar el stock asegurando consistencia.

-- A: Cuando se asigna un lote a una venta, REDUCIR STOCK
CREATE OR REPLACE FUNCTION reduce_batch_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE batches 
    SET quantity_current = quantity_current - NEW.quantity
    WHERE id = NEW.batch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lote con ID % no encontrado', NEW.batch_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_after_insert_batch_allocation
AFTER INSERT ON batch_allocations
FOR EACH ROW EXECUTE PROCEDURE reduce_batch_stock();

-- B: Cuando se anula una venta o se elimina una asignación, RESTITUIR STOCK
CREATE OR REPLACE FUNCTION restore_batch_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE batches 
    SET quantity_current = quantity_current + OLD.quantity
    WHERE id = OLD.batch_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_after_delete_batch_allocation
AFTER DELETE ON batch_allocations
FOR EACH ROW EXECUTE PROCEDURE restore_batch_stock();


-- ----------------------------------------------------------------------------------------
-- PARTE 2: ROW LEVEL SECURITY (RLS) - SEGURIDAD POR ROL Y FILA
-- ----------------------------------------------------------------------------------------

-- 2.1 Habilitación de RLS en todas las tablas transaccionales y maestras
ALTER TABLE erp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;

-- 2.2 Función Helper para obtener el ROL del usuario actual de manera segura
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.erp_users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2.3 POLÍTICAS

-- USUARIOS (ERP_USERS)
CREATE POLICY "Usuarios pueden ver su propio perfil" ON erp_users
    FOR SELECT USING (auth_id = auth.uid() OR get_current_user_role() = 'ADMIN');

-- CATÁLOGO: PRODUCTOS Y PROMOCIONES (Público de lectura, Solo Admin edita)
CREATE POLICY "Lectura global de productos activos" ON products
    FOR SELECT USING (is_active = true OR get_current_user_role() = 'ADMIN');

CREATE POLICY "Admins gestionan productos" ON products
    FOR ALL USING (get_current_user_role() = 'ADMIN');

CREATE POLICY "Lectura global de combos" ON combos
    FOR SELECT USING (is_active = true OR get_current_user_role() = 'ADMIN');

CREATE POLICY "Admins gestionan combos" ON combos
    FOR ALL USING (get_current_user_role() = 'ADMIN');

-- CLIENTES
-- Los Vendedores solo ven clientes asignados a su zona o listado público (Depende de negocio)
-- Admins lo ven y editan todo.
CREATE POLICY "Vendedores ven todos los clientes y Admins gestionan" ON clients
    FOR SELECT USING (true); -- Asumimos lectura pública para todos los empleados

CREATE POLICY "Solo Administradores pueden borrar clientes" ON clients
    FOR DELETE USING (get_current_user_role() = 'ADMIN');

CREATE POLICY "Admins y Vendedores pueden crear clientes" ON clients
    FOR INSERT WITH CHECK (get_current_user_role() IN ('ADMIN', 'SELLER'));

CREATE POLICY "Admins y Vendedores pueden editar clientes" ON clients
    FOR UPDATE USING (get_current_user_role() IN ('ADMIN', 'SELLER'));

-- VENTA Y PEDIDOS (ÓRDENES)
-- Los Vendedores solo ven y crean sus propios pedidos. Admins y Logistica ven todo.
CREATE POLICY "Vendedores leen sus pedidos" ON orders
    FOR SELECT USING (
        seller_id = (SELECT id FROM erp_users WHERE auth_id = auth.uid()) 
        OR get_current_user_role() IN ('ADMIN', 'LOGISTICS')
    );

CREATE POLICY "Vendedores insertan sus pedidos" ON orders
    FOR INSERT WITH CHECK (
        seller_id = (SELECT id FROM erp_users WHERE auth_id = auth.uid()) 
        OR get_current_user_role() = 'ADMIN'
    );

-- Ventas Finales (Dashboard & Liquidaciones)
CREATE POLICY "Acceso a Ventas Global (Empleados)" ON sales
    FOR SELECT USING (
        get_current_user_role() IN ('ADMIN', 'SELLER', 'LOGISTICS', 'WAREHOUSE')
    );

CREATE POLICY "Solo Admins o Automático crean Facturas" ON sales
    FOR INSERT WITH CHECK (get_current_user_role() IN ('ADMIN', 'SELLER')); -- En producción, puede restringirse a Facturación.

-- PROTECCIÓN DE BATCHES (Inventario crítico)
CREATE POLICY "Lectura global de Lotes" ON batches
    FOR SELECT USING (get_current_user_role() IN ('ADMIN', 'SELLER', 'WAREHOUSE', 'LOGISTICS'));

CREATE POLICY "Solo WAREHOUSE y ADMIN gestionan lotes (Compras/Mermas)" ON batches
    FOR ALL USING (get_current_user_role() IN ('ADMIN', 'WAREHOUSE'));

-- FIN DEL SCRIPT.

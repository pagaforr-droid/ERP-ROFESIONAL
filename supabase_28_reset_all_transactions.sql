-- ==============================================================================
-- SCRIPT 28: LIMPIEZA MAESTRA TOTAL (VENTAS Y COMPRAS) PARA PRUEBAS
-- ==============================================================================
-- Este script elimina de forma segura TODAS las transacciones operativas, 
-- dejando el sistema como "recién instalado" pero preservando los catálogos:
-- - Usuarios (erp_users, auth.users)
-- - Clientes (clients)
-- - Productos y Servicios (products)
-- - Proveedores (suppliers)
-- - Zones, Almacenes y Vehículos
-- ==============================================================================

BEGIN;

-- 1. Eliminar datos de auditoría
DELETE FROM audit_logs;

-- 2. Eliminar Cobranzas y Planillas
DELETE FROM collection_records;
DELETE FROM collection_planillas;

-- 3. Eliminar Despachos y Liquidaciones
DELETE FROM liquidation_documents;
DELETE FROM dispatch_liquidations;
DELETE FROM dispatch_sales;
DELETE FROM dispatch_sheets;

-- 4. Eliminar Ventas y Pedidos
DELETE FROM sale_history;
DELETE FROM batch_allocations;
DELETE FROM sale_items;
DELETE FROM sales;
DELETE FROM order_items;
DELETE FROM orders;

-- 5. Eliminar Compras y Lotes (Kardex)
DELETE FROM purchase_payments;
DELETE FROM purchase_items;
DELETE FROM purchases;
-- Como borramos las compras, borramos los lotes que se generaron a partir de ellas.
-- El inventario real de productos quedará en cero esperando nuevas compras.
DELETE FROM batches;

-- 6. Eliminar Flujo de Caja y Sesiones
DELETE FROM cash_movements;
DELETE FROM cash_register_sessions;

-- 7. Eliminar Movimientos de RRHH (Adelantos y Planillas de Sueldo)
DELETE FROM salary_advances;
DELETE FROM payroll_records;
DELETE FROM attendance_records;

COMMIT;

-- Mensaje de éxito
-- El entorno transaccional ha sido limpiado por completo. 
-- Tu inventario está vacío y tu caja está en cero. Listo para empezar desde las compras.

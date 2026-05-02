-- ========================================================================================
-- SCRIPT: RESET DE TRANSACCIONES (LIMPIEZA DE DATOS PARA PRUEBAS DE KARDEX)
-- ========================================================================================
-- ADVERTENCIA: Este script eliminará TODOS los registros transaccionales del sistema.
-- Los maestros (Usuarios, Clientes, Productos, Vendedores, Vehículos, Configuración) se mantendrán intactos.
-- Se utiliza CASCADE para asegurar que todas las tablas dependientes (detalles de pedidos, 
-- detalles de ventas, asignaciones de lotes, documentos de liquidación) también se limpien.

-- 1. Limpieza de tablas transaccionales principales
TRUNCATE TABLE 
    orders,                  -- Pedidos
    sales,                   -- Facturas, Boletas, Notas de Crédito
    dispatch_sheets,         -- Hojas de Despacho
    dispatch_liquidations,   -- Liquidaciones de Despacho
    purchases,               -- Compras (y por cascada, sus items y pagos)
    batches,                 -- Lotes (Kardex, stock actual). Se recomienda limpiar para evitar inconsistencias de stock.
    cash_movements,          -- Movimientos de caja
    cash_register_sessions,  -- Sesiones de caja
    collection_planillas,    -- Planillas de cobranza
    attendance_records       -- Asistencias (opcional, pero ayuda a limpiar todo lo diario)
CASCADE;

-- NOTA: TRUNCATE no dispara triggers. Si no borráramos 'batches' (lotes), 
-- el stock quedaría reducido pero sin historial de ventas que lo justifique. 
-- Al limpiar 'batches' y 'purchases', tu Kardex queda en CERO, listo para 
-- que registres una nueva Compra de prueba y luego hagas las ventas/despachos.

-- 2. (Opcional) Reiniciar la numeración de los documentos (Facturas, Boletas, etc.) a 1
-- Descomenta la siguiente línea si deseas que los correlativos vuelvan a empezar:
-- UPDATE document_series SET current_number = 1;

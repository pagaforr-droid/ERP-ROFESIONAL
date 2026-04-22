-- ========================================================================================
-- SCRIPT 14: NORMALIZACIÓN DE UNIDADES Y CORRECCIÓN DE ACTUALIZACIÓN DE VENTAS
-- ========================================================================================
-- Este script normaliza las presentaciones en toda la base de datos para asegurar el "mismo idioma"
-- y define el procedimiento `update_sale_transaction` con manejo correcto de Kardex.
-- ========================================================================================

BEGIN;

-- 1. Normalizar Maestros de Productos
UPDATE products SET unit_type = 'UND' WHERE unit_type IN ('BOT', 'UNIDAD', 'U', 'und', 'bot', 'BASE');
UPDATE products SET package_type = 'CAJA' WHERE package_type IN ('CJA', 'caja', 'cja', 'PKG', 'pkg');

-- 2. Normalizar Historial de Ventas
UPDATE sale_items SET selected_unit = 'UND' WHERE selected_unit IN ('BOT', 'UNIDAD', 'U', 'und', 'bot', 'BASE');
UPDATE sale_items SET selected_unit = 'CAJA' WHERE selected_unit IN ('CJA', 'caja', 'cja', 'PKG', 'pkg');

-- 3. Normalizar Historial de Pedidos
UPDATE order_items SET unit_type = 'UND' WHERE unit_type IN ('BOT', 'UNIDAD', 'U', 'und', 'bot', 'BASE');
UPDATE order_items SET unit_type = 'CAJA' WHERE unit_type IN ('CJA', 'caja', 'cja', 'PKG', 'pkg');

-- 4. Definir Procedimiento Almacenado update_sale_transaction
CREATE OR REPLACE FUNCTION public.update_sale_transaction(p_sale_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID := (p_sale_data->>'id')::uuid;
    v_item JSONB;
    v_batch JSONB;
    v_sale_item_id UUID;
BEGIN
    -- 1. Actualizar Cabecera
    UPDATE sales SET
        client_name = p_sale_data->>'client_name',
        client_ruc = p_sale_data->>'client_ruc',
        client_address = p_sale_data->>'client_address',
        client_id = NULLIF(p_sale_data->>'client_id', '')::uuid,
        seller_id = NULLIF(p_sale_data->>'seller_id', '')::uuid,
        payment_method = (p_sale_data->>'payment_method')::payment_method,
        payment_status = p_sale_data->>'payment_status',
        balance = (p_sale_data->>'balance')::numeric,
        subtotal = (p_sale_data->>'subtotal')::numeric,
        igv = (p_sale_data->>'igv')::numeric,
        total = (p_sale_data->>'total')::numeric,
        updated_at = NOW()
    WHERE id = v_sale_id;

    -- 2. Borrar detalles antiguos (ESTO ES CRÍTICO: el trigger de batch_allocations ON DELETE restaura el stock automáticamente)
    DELETE FROM sale_items WHERE sale_id = v_sale_id;

    -- 3. Insertar nuevos detalles e inventario usando las asignaciones exactas que manda el frontend
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale_data->'items')
    LOOP
        INSERT INTO sale_items (
            sale_id, product_id, product_sku, product_name, selected_unit,
            quantity_presentation, quantity_base, unit_price, discount_percent, discount_amount,
            total_price, is_bonus, auto_promo_id
        ) VALUES (
            v_sale_id,
            (v_item->>'product_id')::uuid,
            COALESCE(v_item->>'product_sku', ''),
            v_item->>'product_name',
            v_item->>'selected_unit',
            (v_item->>'quantity_presentation')::int,
            (v_item->>'quantity_base')::int,
            (v_item->>'unit_price')::numeric,
            COALESCE((v_item->>'discount_percent')::numeric, 0),
            COALESCE((v_item->>'discount_amount')::numeric, 0),
            (v_item->>'total_price')::numeric,
            COALESCE((v_item->>'is_bonus')::boolean, false),
            NULLIF(v_item->>'auto_promo_id', '')::uuid
        ) RETURNING id INTO v_sale_item_id;

        -- Reserva de lotes provista por el frontend (Kardex)
        IF (v_item->'batch_allocations') IS NOT NULL AND jsonb_typeof(v_item->'batch_allocations') = 'array' THEN
            FOR v_batch IN SELECT * FROM jsonb_array_elements(v_item->'batch_allocations')
            LOOP
                INSERT INTO batch_allocations (
                    sale_item_id, batch_id, batch_code, quantity
                ) VALUES (
                    v_sale_item_id,
                    (v_batch->>'batch_id')::uuid,
                    v_batch->>'batch_code',
                    (v_batch->>'quantity')::int
                );
            END LOOP;
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

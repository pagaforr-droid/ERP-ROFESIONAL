-- ========================================================================================
-- SCRIPT 10: PROCEDIMIENTOS ALMACENADOS TRANSACCIONALES (RPC)
-- ========================================================================================
-- Corrige el error de "función no encontrada" y el conflicto de "best candidate"
-- al eliminar versiones duplicadas y forzar el uso de JSONB.

-- Limpieza de versiones previas para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.process_order_transaction(json);
DROP FUNCTION IF EXISTS public.process_order_transaction(jsonb);
DROP FUNCTION IF EXISTS public.update_order_transaction(json);
DROP FUNCTION IF EXISTS public.update_order_transaction(jsonb);
DROP FUNCTION IF EXISTS public.process_sale_transaction(json);
DROP FUNCTION IF EXISTS public.process_sale_transaction(jsonb);

-- 1. PROCESAR NUEVO PEDIDO VÍA MOBILE ORDERS O ADVANCED ENTRY
CREATE OR REPLACE FUNCTION public.process_order_transaction(p_order_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_current_number INT;
    v_code TEXT;
    v_series TEXT;
BEGIN
    -- Extract series part from the code passed from frontend, or default to P001
    v_series := SPLIT_PART(p_order_data->>'code', '-', 1);
    IF v_series = '' THEN
        v_series := 'P001';
    END IF;

    -- Increment concurrent sequence for PEDIDO
    UPDATE document_series 
    SET current_number = current_number + 1
    WHERE type = 'PEDIDO' AND series = v_series
    RETURNING current_number INTO v_current_number;

    IF v_current_number IS NULL THEN
        -- Fallback to the code sent by the frontend
        v_code := p_order_data->>'code';
    ELSE
        v_code := v_series || '-' || LPAD(v_current_number::text, 8, '0');
    END IF;

    INSERT INTO orders (
        id, code, client_id, client_name, client_doc_type, client_doc_number,
        seller_id, suggested_document_type, payment_method, total, status, delivery_address
    ) VALUES (
        COALESCE(NULLIF(p_order_data->>'id', ''), uuid_generate_v4()::text)::uuid,
        v_code,
        NULLIF(p_order_data->>'client_id', '')::uuid,
        p_order_data->>'client_name',
        (p_order_data->>'client_doc_type')::doc_type,
        p_order_data->>'client_doc_number',
        NULLIF(p_order_data->>'seller_id', '')::uuid,
        p_order_data->>'suggested_document_type',
        (p_order_data->>'payment_method')::payment_method,
        (p_order_data->>'total')::numeric,
        COALESCE(NULLIF(p_order_data->>'status', ''), 'pending')::general_status,
        p_order_data->>'delivery_address'
    ) RETURNING id INTO v_order_id;
    
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
    LOOP
        INSERT INTO order_items (
            order_id, product_id, product_name, unit_type,
            quantity, unit_price, total_price, is_bonus, auto_promo_id,
            discount_percent, discount_amount
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            COALESCE(v_item->>'unit_type', v_item->>'selected_unit'),
            COALESCE((v_item->>'quantity')::int, (v_item->>'quantity_presentation')::int),
            (v_item->>'unit_price')::numeric,
            (v_item->>'total_price')::numeric,
            COALESCE((v_item->>'is_bonus')::boolean, false),
            NULLIF(v_item->>'auto_promo_id', '')::uuid,
            COALESCE((v_item->>'discount_percent')::numeric, 0),
            COALESCE((v_item->>'discount_amount')::numeric, 0)
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'real_code', v_code, 'order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ACTUALIZAR PEDIDO EXISTENTE
CREATE OR REPLACE FUNCTION public.update_order_transaction(p_order_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID := (p_order_data->>'id')::uuid;
    v_item JSONB;
BEGIN
    UPDATE orders SET
        client_id = NULLIF(p_order_data->>'client_id', '')::uuid,
        client_name = p_order_data->>'client_name',
        client_doc_type = (p_order_data->>'client_doc_type')::doc_type,
        client_doc_number = p_order_data->>'client_doc_number',
        suggested_document_type = p_order_data->>'suggested_document_type',
        payment_method = (p_order_data->>'payment_method')::payment_method,
        total = (p_order_data->>'total')::numeric,
        delivery_address = p_order_data->>'delivery_address',
        updated_at = NOW()
    WHERE id = v_order_id;

    -- Borramos hijos antiguos
    DELETE FROM order_items WHERE order_id = v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
    LOOP
        INSERT INTO order_items (
            order_id, product_id, product_name, unit_type,
            quantity, unit_price, total_price, is_bonus, auto_promo_id,
            discount_percent, discount_amount
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            COALESCE(v_item->>'unit_type', v_item->>'selected_unit'),
            COALESCE((v_item->>'quantity')::int, (v_item->>'quantity_presentation')::int),
            (v_item->>'unit_price')::numeric,
            (v_item->>'total_price')::numeric,
            COALESCE((v_item->>'is_bonus')::boolean, false),
            NULLIF(v_item->>'auto_promo_id', '')::uuid,
            COALESCE((v_item->>'discount_percent')::numeric, 0),
            COALESCE((v_item->>'discount_amount')::numeric, 0)
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'real_code', p_order_data->>'code', 'order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. PROCESAR NUEVA VENTA (FACTURA/BOLETA) Y AFECTAR LOTES
CREATE OR REPLACE FUNCTION public.process_sale_transaction(p_sale_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_batch JSONB;
    v_sale_item_id UUID;
    v_current_number INT;
BEGIN
    -- Incremento concurrente del correlativo para Factura/Boleta
    UPDATE document_series 
    SET current_number = current_number + 1
    WHERE type = p_sale_data->>'document_type' AND series = p_sale_data->>'series'
    RETURNING current_number INTO v_current_number;
    
    IF v_current_number IS NULL THEN
        -- Fallback si el documento no tiene serie preconfigurada
        v_current_number := (p_sale_data->>'number')::int;
    END IF;

    -- Inserción Cabecera Venta
    INSERT INTO sales (
        id, document_type, series, number, payment_method, payment_status, balance,
        client_name, client_ruc, client_address, seller_id, client_id, subtotal, igv, total,
        status, dispatch_status, sunat_status
    ) VALUES (
        COALESCE(NULLIF(p_sale_data->>'id', ''), uuid_generate_v4()::text)::uuid,
        p_sale_data->>'document_type',
        p_sale_data->>'series',
        LPAD(v_current_number::text, 8, '0'),
        (p_sale_data->>'payment_method')::payment_method,
        p_sale_data->>'payment_status',
        (p_sale_data->>'balance')::numeric,
        p_sale_data->>'client_name',
        p_sale_data->>'client_ruc',
        p_sale_data->>'client_address',
        NULLIF(p_sale_data->>'seller_id', '')::uuid,
        NULLIF(p_sale_data->>'client_id', '')::uuid,
        (p_sale_data->>'subtotal')::numeric,
        (p_sale_data->>'igv')::numeric,
        (p_sale_data->>'total')::numeric,
        COALESCE(NULLIF(p_sale_data->>'status', ''), 'completed')::general_status,
        COALESCE(NULLIF(p_sale_data->>'dispatch_status', ''), 'pending')::dispatch_status,
        COALESCE(NULLIF(p_sale_data->>'sunat_status', ''), 'PENDING')::sunat_status
    ) RETURNING id INTO v_sale_id;

    -- Detalles e Inventario
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

        -- Reserva automática de lotes (El JSON lo envía "batch_allocations")
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

    RETURN jsonb_build_object('success', true, 'real_number', LPAD(v_current_number::text, 8, '0'), 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

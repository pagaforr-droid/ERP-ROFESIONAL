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
DROP FUNCTION IF EXISTS public.process_dispatch_transaction(jsonb);
DROP FUNCTION IF EXISTS public.process_credit_note_transaction(jsonb);

-- 1. PROCESAR NUEVO PEDIDO VÍA MOBILE ORDERS O ADVANCED ENTRY
CREATE OR REPLACE FUNCTION public.process_order_transaction(p_order_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_order_item_id UUID;
    v_batch RECORD;
    v_qty_needed INT;
    v_qty_allocated INT;
    v_current_number INT;
    v_code TEXT;
    v_series TEXT;
BEGIN
    -- 1. Generar Código Correlativo Concurrente
    v_series := SPLIT_PART(p_order_data->>'code', '-', 1);
    IF v_series = '' OR v_series IS NULL THEN v_series := 'P001'; END IF;

    -- Increment concurrent sequence for PEDIDO
    UPDATE document_series 
    SET current_number = current_number + 1
    WHERE type = 'PEDIDO' AND series = v_series
    RETURNING current_number INTO v_current_number;

    IF v_current_number IS NULL THEN
        -- Si la serie no existe, la creamos inicializada en 1
        INSERT INTO document_series (type, series, current_number, is_active)
        VALUES ('PEDIDO', v_series, 1, true)
        RETURNING current_number INTO v_current_number;
    END IF;

    v_code := v_series || '-' || LPAD(v_current_number::text, 8, '0');

    -- 2. Insertar Cabecera de Pedido
    INSERT INTO orders (
        id, code, client_id, client_name, client_doc_type, client_doc_number,
        seller_id, suggested_document_type, payment_method, total, status, delivery_address, creation_location,
        delivery_mode, delivery_date
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
        p_order_data->>'delivery_address',
        p_order_data->'creation_location',
        NULLIF(p_order_data->>'delivery_mode', '')::delivery_mode,
        (NULLIF(p_order_data->>'delivery_date', ''))::date
    ) RETURNING id INTO v_order_id;
    
    -- 3. Procesar Items y Asignar Lotes (FIFO)
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
        ) RETURNING id INTO v_order_item_id;

        -- Lógica de Descuento de Stock (FIFO)
        v_qty_needed := COALESCE((v_item->>'quantity_base')::int, (v_item->>'quantity')::int);
        
        -- Solo descontar si no es un regalo o si el negocio lo requiere (aquí descontamos todo lo que pide stock)
        FOR v_batch IN 
            SELECT id, code, quantity_current 
            FROM batches 
            WHERE product_id = (v_item->>'product_id')::uuid AND quantity_current > 0
            ORDER BY expiration_date ASC, created_at ASC
            FOR UPDATE
        LOOP
            IF v_qty_needed <= 0 THEN EXIT; END IF;

            v_qty_allocated := LEAST(v_qty_needed, v_batch.quantity_current);

            INSERT INTO batch_allocations (
                order_item_id, batch_id, batch_code, quantity
            ) VALUES (
                v_order_item_id, v_batch.id, v_batch.code, v_qty_allocated
            );

            v_qty_needed := v_qty_needed - v_qty_allocated;
        END LOOP;

        IF v_qty_needed > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto %: faltan % unidades', v_item->>'product_name', v_qty_needed;
        END IF;

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
    v_order_item_id UUID;
    v_batch RECORD;
    v_qty_needed INT;
    v_qty_allocated INT;
BEGIN
    -- 1. Actualizar Cabecera
    UPDATE orders SET
        client_id = NULLIF(p_order_data->>'client_id', '')::uuid,
        client_name = p_order_data->>'client_name',
        client_doc_type = (p_order_data->>'client_doc_type')::doc_type,
        client_doc_number = p_order_data->>'client_doc_number',
        suggested_document_type = p_order_data->>'suggested_document_type',
        payment_method = (p_order_data->>'payment_method')::payment_method,
        total = (p_order_data->>'total')::numeric,
        delivery_address = p_order_data->>'delivery_address',
        creation_location = COALESCE(p_order_data->'creation_location', creation_location),
        delivery_mode = NULLIF(p_order_data->>'delivery_mode', '')::delivery_mode,
        delivery_date = (NULLIF(p_order_data->>'delivery_date', ''))::date,
        updated_at = NOW()
    WHERE id = v_order_id;

    -- 2. Borrar hijos antiguos (Esto restaura stock automáticamente vía ON DELETE CASCADE + Trigger)
    DELETE FROM order_items WHERE order_id = v_order_id;

    -- 3. Insertar nuevos items y re-asignar lotes (FIFO)
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
        ) RETURNING id INTO v_order_item_id;

        -- Lógica de Descuento de Stock (FIFO)
        v_qty_needed := COALESCE((v_item->>'quantity_base')::int, (v_item->>'quantity')::int);
        
        FOR v_batch IN 
            SELECT id, code, quantity_current 
            FROM batches 
            WHERE product_id = (v_item->>'product_id')::uuid AND quantity_current > 0
            ORDER BY expiration_date ASC, created_at ASC
            FOR UPDATE
        LOOP
            IF v_qty_needed <= 0 THEN EXIT; END IF;

            v_qty_allocated := LEAST(v_qty_needed, v_batch.quantity_current);

            INSERT INTO batch_allocations (
                order_item_id, batch_id, batch_code, quantity
            ) VALUES (
                v_order_item_id, v_batch.id, v_batch.code, v_qty_allocated
            );

            v_qty_needed := v_qty_needed - v_qty_allocated;
        END LOOP;

        IF v_qty_needed > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto % en la actualización: faltan % unidades', v_item->>'product_name', v_qty_needed;
        END IF;

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
        status, dispatch_status, sunat_status, origin_order_id
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
        COALESCE(NULLIF(p_sale_data->>'sunat_status', ''), 'PENDING')::sunat_status,
        NULLIF(p_sale_data->>'origin_order_id', '')::uuid
    ) RETURNING id INTO v_sale_id;

    -- Liberar la reserva del pedido original para evitar descuento doble en el Kardex
    IF p_sale_data->>'origin_order_id' IS NOT NULL AND p_sale_data->>'origin_order_id' != '' THEN
        UPDATE orders SET status = 'completed' WHERE id = (p_sale_data->>'origin_order_id')::uuid;
        DELETE FROM batch_allocations WHERE order_item_id IN (
            SELECT id FROM order_items WHERE order_id = (p_sale_data->>'origin_order_id')::uuid
        );
    END IF;

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


-- 4. PROCESAR HOJA DE RUTA (DESPACHO) Y CORRELATIVO GUÍA
CREATE OR REPLACE FUNCTION public.process_dispatch_transaction(p_dispatch_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_dispatch_id UUID;
    v_sale_id TEXT;
    v_current_number INT;
    v_code TEXT;
    v_series TEXT;
BEGIN
    -- 1. Obtener Correlativo de GUÍA
    v_series := COALESCE(p_dispatch_data->>'series', 'G001');
    
    UPDATE document_series 
    SET current_number = current_number + 1
    WHERE type = 'GUIA' AND series = v_series
    RETURNING current_number INTO v_current_number;
    
    IF v_current_number IS NULL THEN
        -- Crear serie si no existe
        INSERT INTO document_series (type, series, current_number, is_active)
        VALUES ('GUIA', v_series, 1, true)
        RETURNING current_number INTO v_current_number;
    END IF;

    v_code := v_series || '-' || LPAD(v_current_number::text, 8, '0');

    -- 2. Insertar Hoja de Ruta
    INSERT INTO dispatch_sheets (
        id, code, vehicle_id, status, date
    ) VALUES (
        COALESCE(NULLIF(p_dispatch_data->>'id', ''), uuid_generate_v4()::text)::uuid,
        v_code,
        (p_dispatch_data->>'vehicle_id')::uuid,
        COALESCE(p_dispatch_data->>'status', 'pending')::dispatch_status,
        (p_dispatch_data->>'date')::date
    ) RETURNING id INTO v_dispatch_id;

    -- 3. Vincular Ventas
    FOR v_sale_id IN SELECT jsonb_array_elements_text(p_dispatch_data->'sale_ids')
    LOOP
        INSERT INTO dispatch_sales (dispatch_sheet_id, sale_id)
        VALUES (v_dispatch_id, v_sale_id::uuid);
        
        -- Actualizar estado de la venta
        UPDATE sales SET dispatch_status = 'assigned' WHERE id = v_sale_id::uuid;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'real_code', v_code, 'dispatch_id', v_dispatch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. PROCESAR NOTA DE CRÉDITO Y RESTITUIR STOCK
CREATE OR REPLACE FUNCTION public.process_credit_note_transaction(p_nc_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_nc_id UUID;
    v_item JSONB;
    v_batch JSONB;
    v_nc_item_id UUID;
    v_current_number INT;
    v_code TEXT;
BEGIN
    -- 1. Correlativo Nota de Crédito
    UPDATE document_series 
    SET current_number = current_number + 1
    WHERE type = 'NOTA_CREDITO' AND series = p_nc_data->>'series'
    RETURNING current_number INTO v_current_number;
    
    IF v_current_number IS NULL THEN
        INSERT INTO document_series (type, series, current_number, is_active)
        VALUES ('NOTA_CREDITO', p_nc_data->>'series', 1, true)
        RETURNING current_number INTO v_current_number;
    END IF;

    v_code := LPAD(v_current_number::text, 8, '0');

    -- 2. Insertar Nota de Crédito (en tabla sales)
    INSERT INTO sales (
        id, document_type, series, number, payment_method, payment_status, 
        client_name, client_ruc, client_address, client_id, subtotal, igv, total,
        status, dispatch_status, sunat_status, observation
    ) VALUES (
        COALESCE(NULLIF(p_nc_data->>'id', ''), uuid_generate_v4()::text)::uuid,
        'NOTA_CREDITO',
        p_nc_data->>'series',
        v_code,
        'CONTADO',
        'PAID',
        p_nc_data->>'client_name',
        p_nc_data->>'client_ruc',
        p_nc_data->>'client_address',
        NULLIF(p_nc_data->>'client_id', '')::uuid,
        (p_nc_data->>'subtotal')::numeric,
        (p_nc_data->>'igv')::numeric,
        (p_nc_data->>'total')::numeric,
        'completed',
        'delivered',
        'PENDING',
        p_nc_data->>'observation'
    ) RETURNING id INTO v_nc_id;

    -- 3. Procesar Items y RESTITUIR STOCK (vía batch_allocations negativo)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_nc_data->'items')
    LOOP
        INSERT INTO sale_items (
            sale_id, product_id, product_sku, product_name, selected_unit,
            quantity_presentation, quantity_base, unit_price, total_price, is_bonus
        ) VALUES (
            v_nc_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_sku',
            v_item->>'product_name',
            v_item->>'selected_unit',
            (v_item->>'quantity_presentation')::int,
            (v_item->>'quantity_base')::int,
            (v_item->>'unit_price')::numeric,
            (v_item->>'total_price')::numeric,
            COALESCE((v_item->>'is_bonus')::boolean, false)
        ) RETURNING id INTO v_nc_item_id;

        -- Restituir stock insertando la misma asignación pero con signo NEGATIVO
        -- El trigger reduce_batch_stock hará: stock = stock - (-qty) => stock + qty
        IF (v_item->'batch_allocations') IS NOT NULL THEN
            FOR v_batch IN SELECT * FROM jsonb_array_elements(v_item->'batch_allocations')
            LOOP
                INSERT INTO batch_allocations (
                    sale_item_id, batch_id, batch_code, quantity
                ) VALUES (
                    v_nc_item_id,
                    (v_batch->>'batch_id')::uuid,
                    v_batch->>'batch_code',
                    -((v_batch->>'quantity')::int) -- NEGATIVO PARA RESTITUIR
                );
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'real_number', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

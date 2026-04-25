-- supabase_18_rpc_dispatch_liquidation.sql

ALTER TABLE dispatch_liquidations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PROCESADO';

-- ========================================================================================
-- FASE 1: PROCESAR LIQUIDACIÓN (NO AFECTA KARDEX)
-- ========================================================================================
CREATE OR REPLACE FUNCTION process_dispatch_liquidation_transaction(
    p_liquidation_data JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dispatch_id UUID;
    v_liquidation_id UUID;
    v_total_cash DECIMAL;
    v_doc JSONB;
    v_sale RECORD;
    v_nc_series TEXT;
    v_nc_number TEXT;
    v_nc_full TEXT;
    v_new_sale_id UUID;
    v_item JSONB;
    v_new_item_id UUID;
    v_cash_movement_id UUID;
    v_dispatch_status dispatch_status;
BEGIN
    v_dispatch_id := (p_liquidation_data->>'dispatch_sheet_id')::UUID;
    v_liquidation_id := (p_liquidation_data->>'id')::UUID;
    
    -- Verificar Hoja de Ruta
    SELECT status INTO v_dispatch_status FROM dispatch_sheets WHERE id = v_dispatch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hoja de ruta no encontrada.';
    END IF;
    IF v_dispatch_status = 'liquidated' THEN
        RAISE EXCEPTION 'La hoja de ruta ya se encuentra liquidada.';
    END IF;

    -- Generar Registro Principal de Liquidación
    INSERT INTO dispatch_liquidations (
        id, dispatch_sheet_id, date, total_cash_collected, total_credit_receivable, total_voided, total_returns_value, status
    ) VALUES (
        v_liquidation_id,
        v_dispatch_id,
        (p_liquidation_data->>'date')::TIMESTAMP,
        (p_liquidation_data->>'total_cash_collected')::DECIMAL,
        (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
        (p_liquidation_data->>'total_voided')::DECIMAL,
        (p_liquidation_data->>'total_returns_value')::DECIMAL,
        'PROCESADO'
    );

    v_total_cash := 0;

    -- Iterar Documentos
    FOR v_doc IN SELECT * FROM jsonb_array_elements(p_liquidation_data->'documents') LOOP
        
        SELECT * INTO v_sale FROM sales WHERE id = (v_doc->>'sale_id')::UUID;
        
        -- Insertar en liquidation_documents
        INSERT INTO liquidation_documents (
            dispatch_liquidation_id, sale_id, action, amount_collected, amount_credit, amount_void, amount_credit_note, reason, balance_payment_method, returned_items
        ) VALUES (
            v_liquidation_id, v_sale.id, v_doc->>'action', (v_doc->>'amount_collected')::DECIMAL, (v_doc->>'amount_credit')::DECIMAL, (v_doc->>'amount_void')::DECIMAL, (v_doc->>'amount_credit_note')::DECIMAL, v_doc->>'reason', (v_doc->>'balance_payment_method')::payment_method, v_doc->'returned_items'
        );

        IF v_doc->>'action' = 'PAID' THEN
            UPDATE sales SET payment_status = 'PAID', balance = 0, collection_status = 'COLLECTED', dispatch_status = 'liquidated' WHERE id = v_sale.id;
            v_total_cash := v_total_cash + v_sale.total;
        
        ELSIF v_doc->>'action' = 'CREDIT' THEN
            UPDATE sales SET payment_status = 'PENDING', collection_status = 'NONE', dispatch_status = 'liquidated' WHERE id = v_sale.id;
        
        ELSIF v_doc->>'action' = 'VOID' THEN
            -- SOLO cambiamos estado, no borramos batch_allocations aqui
            UPDATE sales SET status = 'canceled', payment_status = 'PENDING', collection_status = 'NONE', balance = total, dispatch_status = 'liquidated' WHERE id = v_sale.id;
            
        ELSIF v_doc->>'action' = 'PARTIAL_RETURN' THEN
            -- Generar Serie para NC
            UPDATE document_series SET current_number = current_number + 1 WHERE type = 'NOTA_CREDITO' AND is_active = true RETURNING series, LPAD(current_number::TEXT, 8, '0') INTO v_nc_series, v_nc_number;
            IF v_nc_series IS NULL THEN
                v_nc_series := 'NC01';
                v_nc_number := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 8, '0');
            END IF;
            v_nc_full := v_nc_series || '-' || v_nc_number;

            UPDATE liquidation_documents SET credit_note_series = v_nc_full WHERE dispatch_liquidation_id = v_liquidation_id AND sale_id = v_sale.id;

            v_new_sale_id := uuid_generate_v4();
            
            -- Insertar Venta tipo NOTA_CREDITO
            INSERT INTO sales (
                id, origin_order_id, document_type, series, number, payment_method, payment_status, collection_status, client_id, seller_id, client_name, client_ruc, client_address, subtotal, igv, total, balance, observation, status, dispatch_status, sunat_status
            ) VALUES (
                v_new_sale_id, v_sale.id, 'NOTA_CREDITO', v_nc_series, v_nc_number, 'CONTADO', 'PAID', 'NONE', v_sale.client_id, v_sale.seller_id, v_sale.client_name, v_sale.client_ruc, v_sale.client_address, 
                ((v_doc->>'amount_credit_note')::DECIMAL / 1.18), 
                ((v_doc->>'amount_credit_note')::DECIMAL - ((v_doc->>'amount_credit_note')::DECIMAL / 1.18)), 
                (v_doc->>'amount_credit_note')::DECIMAL, 0, 'Devolución de Liquidación ' || v_liquidation_id || ' - Doc. Org: ' || v_sale.series || '-' || v_sale.number, 'completed', 'liquidated', 'PENDING'
            );

            -- Insertar sale_items
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_doc->'returned_items') LOOP
                INSERT INTO sale_items (
                    id, sale_id, product_id, product_sku, product_name, selected_unit, quantity_presentation, quantity_base, unit_price, total_price, is_bonus
                ) VALUES (
                    uuid_generate_v4(), v_new_sale_id, (v_item->>'product_id')::UUID, '', v_item->>'product_name', 'UND', (v_item->>'quantity_presentation')::INT, (v_item->>'quantity_base')::INT, (v_item->>'unit_price')::DECIMAL, (v_item->>'total_refund')::DECIMAL, false
                );
            END LOOP;

            -- Actualizar documento original
            IF v_doc->>'balance_payment_method' = 'CONTADO' THEN
                UPDATE sales SET balance = 0, payment_status = 'PAID', collection_status = 'COLLECTED', dispatch_status = 'liquidated' WHERE id = v_sale.id;
            ELSE
                UPDATE sales SET balance = (v_sale.total - (v_doc->>'amount_credit_note')::DECIMAL), payment_status = 'PENDING', collection_status = 'NONE', dispatch_status = 'liquidated' WHERE id = v_sale.id;
            END IF;
            
        END IF;
    END LOOP;

    -- Generar Movimiento de Caja (Efectivo Físico)
    IF (p_liquidation_data->>'total_cash_collected')::DECIMAL > 0 THEN
        INSERT INTO cash_movements (type, category_name, description, amount, date, reference_id, user_id)
        VALUES ('INCOME', 'LIQUIDACION RUTA', 'Liquidación ' || v_liquidation_id || ' - Efectivo', (p_liquidation_data->>'total_cash_collected')::DECIMAL, NOW(), v_liquidation_id, p_user_id);
    END IF;

    -- Finalizar Ruta
    UPDATE dispatch_sheets SET status = 'liquidated', updated_at = NOW() WHERE id = v_dispatch_id;

    RETURN jsonb_build_object('success', true, 'msg', 'Liquidación procesada correctamente. Pendiente confirmación de Kardex.', 'liquidation_id', v_liquidation_id);
END;
$$;


-- ========================================================================================
-- FASE 2: CONFIRMAR KARDEX (COMPLETAR LIQUIDACIÓN)
-- ========================================================================================
CREATE OR REPLACE FUNCTION confirm_dispatch_liquidation_kardex(
    p_liquidation_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_doc RECORD;
    v_item JSONB;
    v_batch_id UUID;
BEGIN
    SELECT status INTO v_status FROM dispatch_liquidations WHERE id = p_liquidation_id;
    IF v_status = 'COMPLETADO' THEN
        RETURN jsonb_build_object('success', false, 'msg', 'La liquidación ya ha sido completada en Kardex.');
    END IF;

    FOR v_doc IN SELECT * FROM liquidation_documents WHERE dispatch_liquidation_id = p_liquidation_id LOOP
        
        IF v_doc.action = 'VOID' THEN
            -- Eliminar asignaciones (devuelve stock)
            DELETE FROM batch_allocations WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = v_doc.sale_id);
            
        ELSIF v_doc.action = 'PARTIAL_RETURN' THEN
            -- Devolver stock proporcional al lote más reciente
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_doc.returned_items) LOOP
                SELECT id INTO v_batch_id FROM batches WHERE product_id = (v_item->>'product_id')::UUID ORDER BY created_at DESC LIMIT 1;
                IF v_batch_id IS NOT NULL THEN
                    UPDATE batches SET quantity_current = quantity_current + (v_item->>'quantity_base')::INT WHERE id = v_batch_id;
                END IF;
            END LOOP;
        END IF;
        
    END LOOP;

    UPDATE dispatch_liquidations SET status = 'COMPLETADO', updated_at = NOW() WHERE id = p_liquidation_id;

    RETURN jsonb_build_object('success', true, 'msg', 'Kardex actualizado correctamente. Liquidación COMPLETADA.');
END;
$$;


-- ========================================================================================
-- REVERSIÓN DE LIQUIDACIÓN
-- ========================================================================================
CREATE OR REPLACE FUNCTION revert_dispatch_liquidation_transaction(
    p_liquidation_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dispatch_id UUID;
    v_status TEXT;
    v_doc RECORD;
BEGIN
    SELECT dispatch_sheet_id, status INTO v_dispatch_id, v_status FROM dispatch_liquidations WHERE id = p_liquidation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Liquidación no encontrada.';
    END IF;

    IF v_status = 'COMPLETADO' THEN
        RAISE EXCEPTION 'No se puede revertir porque el Kardex ya fue impactado. Requiere corrección manual.';
    END IF;

    -- 1. Borrar Notas de Crédito generadas
    FOR v_doc IN SELECT sale_id, action FROM liquidation_documents WHERE dispatch_liquidation_id = p_liquidation_id LOOP
        IF v_doc.action = 'PARTIAL_RETURN' THEN
            -- Borramos la venta NC (origin_order_id apunta a la venta original en NC)
            DELETE FROM sales WHERE origin_order_id = v_doc.sale_id AND document_type = 'NOTA_CREDITO';
        END IF;
        
        -- Restaurar documento original
        UPDATE sales SET status = 'completed', payment_status = 'PENDING', collection_status = 'NONE', balance = total, dispatch_status = 'assigned' WHERE id = v_doc.sale_id;
    END LOOP;

    -- 2. Borrar movimiento de caja
    DELETE FROM cash_movements WHERE reference_id = p_liquidation_id AND category_name = 'LIQUIDACION RUTA';

    -- 3. Borrar registros de liquidación
    DELETE FROM liquidation_documents WHERE dispatch_liquidation_id = p_liquidation_id;
    DELETE FROM dispatch_liquidations WHERE id = p_liquidation_id;

    -- 4. Actualizar Hoja de Ruta
    UPDATE dispatch_sheets SET status = 'assigned', updated_at = NOW() WHERE id = v_dispatch_id;

    RETURN jsonb_build_object('success', true, 'msg', 'Liquidación revertida con éxito.');
END;
$$;

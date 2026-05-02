-- ========================================================================================
-- SCRIPT 19: GUARDAR BORRADOR DE LIQUIDACIÓN Y ACTUALIZAR TRANSACCIÓN
-- ========================================================================================

-- 1. GUARDAR BORRADOR DE LIQUIDACIÓN (DRAFT - EN REVISIÓN)
-- Guarda la información en la BD sin afectar caja ni kardex.
CREATE OR REPLACE FUNCTION save_dispatch_liquidation_draft(
    p_liquidation_data JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_liquidation_id UUID;
    v_dispatch_id UUID;
    v_doc JSONB;
BEGIN
    v_dispatch_id := (p_liquidation_data->>'dispatch_sheet_id')::UUID;
    v_liquidation_id := COALESCE((p_liquidation_data->>'id')::UUID, uuid_generate_v4());

    -- Verificar si ya existe el draft
    IF EXISTS (SELECT 1 FROM dispatch_liquidations WHERE id = v_liquidation_id) THEN
        UPDATE dispatch_liquidations SET
            total_cash_collected = (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            total_credit_receivable = (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            total_voided = (p_liquidation_data->>'total_voided')::DECIMAL,
            total_returns_value = (p_liquidation_data->>'total_returns_value')::DECIMAL,
            date = (p_liquidation_data->>'date')::DATE,
            status = 'processed',
            updated_at = NOW()
        WHERE id = v_liquidation_id;

        -- Limpiar documentos anteriores para recrearlos
        DELETE FROM liquidation_documents WHERE dispatch_liquidation_id = v_liquidation_id;
    ELSE
        INSERT INTO dispatch_liquidations (
            id, dispatch_sheet_id, date, total_cash_collected, total_credit_receivable, total_voided, total_returns_value, status
        ) VALUES (
            v_liquidation_id,
            v_dispatch_id,
            (p_liquidation_data->>'date')::DATE,
            (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            (p_liquidation_data->>'total_voided')::DECIMAL,
            (p_liquidation_data->>'total_returns_value')::DECIMAL,
            'processed'
        );
    END IF;

    -- Insertar Detalles (Documentos)
    FOR v_doc IN SELECT * FROM jsonb_array_elements(p_liquidation_data->'documents') LOOP
        INSERT INTO liquidation_documents (
            id, dispatch_liquidation_id, sale_id, action,
            amount_collected, amount_credit, amount_void, amount_credit_note,
            reason, returned_items, balance_payment_method
        ) VALUES (
            uuid_generate_v4(),
            v_liquidation_id,
            (v_doc->>'sale_id')::UUID,
            (v_doc->>'action')::TEXT,
            (v_doc->>'amount_collected')::DECIMAL,
            (v_doc->>'amount_credit')::DECIMAL,
            (v_doc->>'amount_void')::DECIMAL,
            (v_doc->>'amount_credit_note')::DECIMAL,
            v_doc->>'reason',
            COALESCE(v_doc->'returned_items', '[]'::JSONB),
            (v_doc->>'balance_payment_method')::payment_method
        );
    END LOOP;

    -- Cambiar estado del despacho para que ya no salga en "Pendientes"
    UPDATE dispatch_sheets SET status = 'in_transit' WHERE id = v_dispatch_id AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'msg', 'Borrador guardado. La liquidación ha sido enviada a caja para revisión.', 'liquidation_id', v_liquidation_id);
END;
$$;


-- 2. ACTUALIZACIÓN DEL PROCESAMIENTO FINAL DE LA LIQUIDACIÓN
-- Si ya existe un borrador, no lo recrea, solo cambia el estado y ejecuta finanzas.
CREATE OR REPLACE FUNCTION process_dispatch_liquidation_transaction(
    p_liquidation_data JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_liquidation_id UUID;
    v_dispatch_id UUID;
    v_doc JSONB;
    v_item JSONB;
    v_sale RECORD;
    v_new_sale_id UUID;
    v_nc_series TEXT;
    v_nc_number TEXT;
    v_nc_full TEXT;
BEGIN
    v_dispatch_id := (p_liquidation_data->>'dispatch_sheet_id')::UUID;
    v_liquidation_id := COALESCE((p_liquidation_data->>'id')::UUID, uuid_generate_v4());

    -- 1. Insertar o Actualizar Cabecera de Liquidación
    IF EXISTS (SELECT 1 FROM dispatch_liquidations WHERE id = v_liquidation_id) THEN
        UPDATE dispatch_liquidations SET
            total_cash_collected = (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            total_credit_receivable = (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            total_voided = (p_liquidation_data->>'total_voided')::DECIMAL,
            total_returns_value = (p_liquidation_data->>'total_returns_value')::DECIMAL,
            date = (p_liquidation_data->>'date')::DATE,
            status = 'processed', -- Mantenemos temporalmente como processed hasta el commit final
            updated_at = NOW()
        WHERE id = v_liquidation_id;

        -- Limpiar detalles anteriores para evitar duplicidad si el cajero editó
        DELETE FROM liquidation_documents WHERE dispatch_liquidation_id = v_liquidation_id;
    ELSE
        INSERT INTO dispatch_liquidations (
            id, dispatch_sheet_id, date, total_cash_collected, total_credit_receivable, total_voided, total_returns_value, status
        ) VALUES (
            v_liquidation_id,
            v_dispatch_id,
            (p_liquidation_data->>'date')::DATE,
            (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            (p_liquidation_data->>'total_voided')::DECIMAL,
            (p_liquidation_data->>'total_returns_value')::DECIMAL,
            'processed'
        );
    END IF;

    -- 2. Recorrer Documentos
    FOR v_doc IN SELECT * FROM jsonb_array_elements(p_liquidation_data->'documents') LOOP
        
        -- Obtener Venta Original
        SELECT * INTO v_sale FROM sales WHERE id = (v_doc->>'sale_id')::UUID;
        IF NOT FOUND THEN CONTINUE; END IF;

        -- Insertar documento procesado
        INSERT INTO liquidation_documents (
            id, dispatch_liquidation_id, sale_id, action,
            amount_collected, amount_credit, amount_void, amount_credit_note,
            reason, returned_items, balance_payment_method
        ) VALUES (
            uuid_generate_v4(),
            v_liquidation_id,
            v_sale.id,
            (v_doc->>'action')::TEXT,
            (v_doc->>'amount_collected')::DECIMAL,
            (v_doc->>'amount_credit')::DECIMAL,
            (v_doc->>'amount_void')::DECIMAL,
            (v_doc->>'amount_credit_note')::DECIMAL,
            v_doc->>'reason',
            COALESCE(v_doc->'returned_items', '[]'::JSONB),
            (v_doc->>'balance_payment_method')::payment_method
        );

        -- Lógica de Facturación y Cuentas por Cobrar
        IF v_doc->>'action' = 'PAID' THEN
            UPDATE sales SET balance = 0, payment_status = 'PAID', collection_status = 'COLLECTED'::collection_status, dispatch_status = 'liquidated'::dispatch_status WHERE id = v_sale.id;
        
        ELSIF v_doc->>'action' = 'CREDIT' THEN
            -- Update balance to reflect the amount collected if it's a partial credit collection
            -- if amount_collected > 0, we subtract it from balance
            UPDATE sales SET 
                balance = total - (v_doc->>'amount_collected')::DECIMAL,
                payment_status = CASE WHEN (total - (v_doc->>'amount_collected')::DECIMAL) <= 0 THEN 'PAID' ELSE 'PENDING' END,
                collection_status = (CASE WHEN (total - (v_doc->>'amount_collected')::DECIMAL) <= 0 THEN 'COLLECTED' ELSE (CASE WHEN (v_doc->>'amount_collected')::DECIMAL > 0 THEN 'PARTIAL' ELSE 'NONE' END) END)::collection_status,
                dispatch_status = 'liquidated'::dispatch_status 
            WHERE id = v_sale.id;
        
        ELSIF v_doc->>'action' = 'VOID' THEN
            -- SOLO cambiamos estado, no borramos batch_allocations aqui (se hace en confirm_kardex)
            UPDATE sales SET status = 'canceled'::general_status, payment_status = 'PENDING', collection_status = 'NONE'::collection_status, balance = total, dispatch_status = 'liquidated'::dispatch_status WHERE id = v_sale.id;
            
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
                v_new_sale_id, v_sale.origin_order_id, 'NOTA_CREDITO', v_nc_series, v_nc_number, 'CONTADO'::payment_method, 'PAID', 'NONE'::collection_status, v_sale.client_id, v_sale.seller_id, v_sale.client_name, v_sale.client_ruc, v_sale.client_address, 
                ((v_doc->>'amount_credit_note')::DECIMAL / 1.18), 
                ((v_doc->>'amount_credit_note')::DECIMAL - ((v_doc->>'amount_credit_note')::DECIMAL / 1.18)), 
                (v_doc->>'amount_credit_note')::DECIMAL, 0, 'Devolución de Liquidación ' || v_liquidation_id || ' - Doc. Org: ' || v_sale.series || '-' || v_sale.number, 'completed'::general_status, 'liquidated'::dispatch_status, 'PENDING'::sunat_status
            );

            -- Insertar sale_items
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_doc->'returned_items') LOOP
                INSERT INTO sale_items (
                    id, sale_id, product_id, product_sku, product_name, selected_unit, quantity_presentation, quantity_base, unit_price, total_price, is_bonus
                ) VALUES (
                    uuid_generate_v4(), v_new_sale_id, (v_item->>'product_id')::UUID, COALESCE(v_item->>'product_sku', ''), v_item->>'product_name', COALESCE(v_item->>'selected_unit', 'UND'), (v_item->>'quantity_presentation')::INT, (v_item->>'quantity_base')::INT, (v_item->>'unit_price')::DECIMAL, (v_item->>'total_refund')::DECIMAL, false
                );
            END LOOP;

            -- Actualizar documento original
            IF v_doc->>'balance_payment_method' = 'CONTADO' THEN
                UPDATE sales SET balance = 0, payment_status = 'PAID', collection_status = 'COLLECTED', dispatch_status = 'liquidated' WHERE id = v_sale.id;
            ELSE
                UPDATE sales SET balance = (v_sale.total - (v_doc->>'amount_credit_note')::DECIMAL - (v_doc->>'amount_collected')::DECIMAL), payment_status = 'PENDING', collection_status = 'NONE', dispatch_status = 'liquidated' WHERE id = v_sale.id;
            END IF;
            
        END IF;
    END LOOP;

    -- Generar Movimiento de Caja (Efectivo Físico)
    IF (p_liquidation_data->>'total_cash_collected')::DECIMAL > 0 THEN
        INSERT INTO cash_movements (type, category_name, description, amount, date, reference_id, user_id)
        VALUES ('INCOME', 'LIQUIDACION RUTA', 'Liquidación ' || v_liquidation_id || ' - Efectivo', (p_liquidation_data->>'total_cash_collected')::DECIMAL, NOW(), v_liquidation_id, p_user_id);
    END IF;

    -- Finalizar Ruta y Marcar Liquidación como Lista (A la espera del Kardex)
    UPDATE dispatch_sheets SET status = 'liquidated', updated_at = NOW() WHERE id = v_dispatch_id;

    RETURN jsonb_build_object('success', true, 'msg', 'Liquidación procesada correctamente. Pendiente confirmación de Kardex.', 'liquidation_id', v_liquidation_id);
END;
$$;

-- ========================================================================================
-- SCRIPT 36: REGISTRO DE USUARIO EN LIQUIDACIONES DE RUTAS
-- ========================================================================================
-- Este script agrega la columna 'user_id' a la tabla 'dispatch_liquidations' para 
-- mantener un registro auditable de qué usuario específico procesó cada liquidación de ruta.
-- ========================================================================================

-- 1. Agregar columna
ALTER TABLE dispatch_liquidations ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. (Opcional) Si se desea agregar una llave foránea a erp_users (puede dejarse sin fk por flexibilidad)
-- ALTER TABLE dispatch_liquidations ADD CONSTRAINT fk_dl_user FOREIGN KEY (user_id) REFERENCES erp_users(id);

-- NOTA: Las funciones RPC 'save_dispatch_liquidation_draft' y 'process_dispatch_liquidation_transaction'
-- ahora deben enviar el user_id. Para mantener la compatibilidad, no es obligatorio actualizar el SQL de inmediato
-- si el cliente React ya lo pasa en los queries, pero si lo hace a través de RPC, se debe actualizar el RPC.

-- 3. Actualizar la función process_dispatch_liquidation_transaction para que guarde el user_id
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
        id, dispatch_sheet_id, date, total_cash_collected, total_credit_receivable, total_voided, total_returns_value, status, user_id
    ) VALUES (
        v_liquidation_id,
        v_dispatch_id,
        (p_liquidation_data->>'date')::TIMESTAMP,
        (p_liquidation_data->>'total_cash_collected')::DECIMAL,
        (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
        (p_liquidation_data->>'total_voided')::DECIMAL,
        (p_liquidation_data->>'total_returns_value')::DECIMAL,
        'PROCESADO',
        p_user_id
    ) ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        total_cash_collected = EXCLUDED.total_cash_collected,
        total_credit_receivable = EXCLUDED.total_credit_receivable,
        total_voided = EXCLUDED.total_voided,
        total_returns_value = EXCLUDED.total_returns_value,
        status = 'PROCESADO',
        user_id = EXCLUDED.user_id;

    v_total_cash := 0;

    -- Eliminar documentos previos (idempotencia)
    DELETE FROM liquidation_documents WHERE dispatch_liquidation_id = v_liquidation_id;

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
            -- Manejo de cobros parciales a crédito
            UPDATE sales SET 
                balance = total - (v_doc->>'amount_collected')::DECIMAL,
                payment_status = CASE WHEN (total - (v_doc->>'amount_collected')::DECIMAL) <= 0 THEN 'PAID' ELSE 'PENDING' END,
                collection_status = (CASE WHEN (total - (v_doc->>'amount_collected')::DECIMAL) <= 0 THEN 'COLLECTED' ELSE (CASE WHEN (v_doc->>'amount_collected')::DECIMAL > 0 THEN 'PARTIAL' ELSE 'NONE' END) END)::collection_status,
                dispatch_status = 'liquidated'
            WHERE id = v_sale.id;
        
        ELSIF v_doc->>'action' = 'VOID' THEN
            UPDATE sales SET status = 'canceled', payment_status = 'PENDING', collection_status = 'NONE', balance = total, dispatch_status = 'liquidated' WHERE id = v_sale.id;
            
        ELSIF v_doc->>'action' = 'PARTIAL_RETURN' THEN
            UPDATE document_series SET current_number = current_number + 1 WHERE type = 'NOTA_CREDITO' AND is_active = true RETURNING series, LPAD(current_number::TEXT, 8, '0') INTO v_nc_series, v_nc_number;
            IF v_nc_series IS NULL THEN
                v_nc_series := 'NC01';
                v_nc_number := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 8, '0');
            END IF;
            v_nc_full := v_nc_series || '-' || v_nc_number;

            UPDATE liquidation_documents SET credit_note_series = v_nc_full, reason = COALESCE(v_doc->>'sunat_motivo', v_doc->>'reason') WHERE dispatch_liquidation_id = v_liquidation_id AND sale_id = v_sale.id;

            v_new_sale_id := uuid_generate_v4();
            
            INSERT INTO sales (
                id, origin_order_id, document_type, series, number, payment_method, payment_status, collection_status, client_id, seller_id, client_name, client_ruc, client_address, subtotal, igv, total, balance, observation, status, dispatch_status, sunat_status
            ) VALUES (
                v_new_sale_id, v_sale.origin_order_id, 'NOTA_CREDITO', v_nc_series, v_nc_number, 'CONTADO', 'PAID', 'NONE', v_sale.client_id, v_sale.seller_id, v_sale.client_name, v_sale.client_ruc, v_sale.client_address, 
                COALESCE((v_doc->>'subtotal_credit_note')::DECIMAL, ((v_doc->>'amount_credit_note')::DECIMAL / 1.18)), 
                COALESCE((v_doc->>'igv_credit_note')::DECIMAL, ((v_doc->>'amount_credit_note')::DECIMAL - ((v_doc->>'amount_credit_note')::DECIMAL / 1.18))), 
                (v_doc->>'amount_credit_note')::DECIMAL, 0, COALESCE(v_doc->>'sunat_motivo', '07') || ' | Devolución Liq ' || v_liquidation_id || ' - Doc. Org: ' || v_sale.series || '-' || v_sale.number, 'completed', 'liquidated', 'PENDING'
            );

            FOR v_item IN SELECT * FROM jsonb_array_elements(v_doc->'returned_items') LOOP
                INSERT INTO sale_items (
                    id, sale_id, product_id, product_sku, product_name, selected_unit, quantity_presentation, quantity_base, unit_price, total_price, is_bonus
                ) VALUES (
                    uuid_generate_v4(), v_new_sale_id, (v_item->>'product_id')::UUID, COALESCE(v_item->>'product_sku', ''), v_item->>'product_name', COALESCE(v_item->>'selected_unit', 'UND'), (v_item->>'quantity_presentation')::INT, (v_item->>'quantity_base')::INT, (v_item->>'unit_price')::DECIMAL, (v_item->>'total_refund')::DECIMAL, false
                );
            END LOOP;

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

    -- Finalizar Ruta
    UPDATE dispatch_sheets SET status = 'liquidated', updated_at = NOW() WHERE id = v_dispatch_id;

    RETURN jsonb_build_object('success', true, 'msg', 'Liquidación procesada correctamente. Pendiente confirmación de Kardex.', 'liquidation_id', v_liquidation_id);
END;
$$;


-- 4. Actualizar la función save_dispatch_liquidation_draft para que guarde el user_id
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

    IF EXISTS (SELECT 1 FROM dispatch_liquidations WHERE id = v_liquidation_id) THEN
        UPDATE dispatch_liquidations SET
            total_cash_collected = (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            total_credit_receivable = (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            total_voided = (p_liquidation_data->>'total_voided')::DECIMAL,
            total_returns_value = (p_liquidation_data->>'total_returns_value')::DECIMAL,
            date = (p_liquidation_data->>'date')::DATE,
            status = 'processed',
            user_id = p_user_id,
            updated_at = NOW()
        WHERE id = v_liquidation_id;

        DELETE FROM liquidation_documents WHERE dispatch_liquidation_id = v_liquidation_id;
    ELSE
        INSERT INTO dispatch_liquidations (
            id, dispatch_sheet_id, date, total_cash_collected, total_credit_receivable, total_voided, total_returns_value, status, user_id
        ) VALUES (
            v_liquidation_id,
            v_dispatch_id,
            (p_liquidation_data->>'date')::DATE,
            (p_liquidation_data->>'total_cash_collected')::DECIMAL,
            (p_liquidation_data->>'total_credit_receivable')::DECIMAL,
            (p_liquidation_data->>'total_voided')::DECIMAL,
            (p_liquidation_data->>'total_returns_value')::DECIMAL,
            'processed',
            p_user_id
        );
    END IF;

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

    UPDATE dispatch_sheets SET status = 'in_transit' WHERE id = v_dispatch_id AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'msg', 'Borrador guardado. La liquidación ha sido enviada a caja para revisión.', 'liquidation_id', v_liquidation_id);
END;
$$;

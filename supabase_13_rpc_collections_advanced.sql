-- ========================================================================================
-- SCRIPT 13: MÓDULO COBRANZAS (RPCs AVANZADAS)
-- ========================================================================================
-- Este script introduce las funciones para generar liquidaciones manuales, 
-- y operaciones reversibles sobre planillas de cobranza (Anulación, Edición, Extracción).

-- 1. Liquidación Manual (Consolidación Manual)
CREATE OR REPLACE FUNCTION consolidate_manual_collections(
    p_payments JSONB, -- Array of { "saleId": "uuid", "amount": number }
    p_user_id UUID, 
    p_date TIMESTAMP WITH TIME ZONE,
    p_glosa TEXT,
    p_edit_planilla_id UUID DEFAULT NULL,
    p_edit_planilla_code TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_total DECIMAL := 0;
    v_cash_mov_id UUID;
    v_planilla_id UUID;
    v_code TEXT;
    v_max_num INT;
    v_payment JSONB;
    v_sale_id UUID;
    v_amount DECIMAL;
    v_sale_balance DECIMAL;
    v_new_balance DECIMAL;
    v_client_name TEXT;
    v_doc_ref TEXT;
    v_record_id UUID;
    v_category_id UUID;
    v_records UUID[] := '{}';
BEGIN
    -- SEGURIDAD: Verificar turno de caja abierto
    SELECT id INTO v_session_id FROM cash_register_sessions WHERE status = 'OPEN' LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seguridad: No se puede generar una liquidación sin un Turno de Caja Aperturado y activo.';
    END IF;

    -- Obtener la categoría por defecto para Cobranzas
    SELECT id INTO v_category_id FROM expense_categories WHERE name ILIKE '%COBRANZA MANUAL%' AND type = 'INCOME' LIMIT 1;
    IF NOT FOUND THEN
        SELECT id INTO v_category_id FROM expense_categories WHERE name ILIKE '%COBRANZA%' AND type = 'INCOME' LIMIT 1;
    END IF;

    -- Generar Autocódigo PLAN-0001
    IF p_edit_planilla_id IS NOT NULL THEN
        v_planilla_id := p_edit_planilla_id;
        v_code := p_edit_planilla_code;
        
        -- Opcional: Eliminar los records previos manuales que estaban en esta planilla para recrearlos
        DELETE FROM collection_records WHERE planilla_id = v_planilla_id AND seller_id IS NULL;
        DELETE FROM cash_movements WHERE reference_id = v_planilla_id;
        DELETE FROM collection_planillas WHERE id = v_planilla_id;
    ELSE
        SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')), '0')::INT 
        INTO v_max_num 
        FROM collection_planillas WHERE code LIKE 'PLAN-%';
        
        v_code := 'PLAN-' || LPAD((COALESCE(v_max_num, 0) + 1)::TEXT, 4, '0');
        v_planilla_id := gen_random_uuid();
    END IF;

    -- Procesar cada pago
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        v_sale_id := (v_payment->>'saleId')::UUID;
        v_amount := (v_payment->>'amount')::DECIMAL;
        
        SELECT balance, client_name, series || '-' || number 
        INTO v_sale_balance, v_client_name, v_doc_ref
        FROM sales 
        WHERE id = v_sale_id;
        
        IF NOT FOUND THEN RAISE EXCEPTION 'Venta % no encontrada', v_sale_id; END IF;
        
        IF v_amount > COALESCE(v_sale_balance, 0) THEN
            RAISE EXCEPTION 'El monto a pagar (S/ %) supera el saldo actual (S/ %) de la venta %', v_amount, v_sale_balance, v_doc_ref;
        END IF;

        v_new_balance := v_sale_balance - v_amount;

        UPDATE sales 
        SET balance = v_new_balance,
            payment_status = CASE WHEN v_new_balance = 0 THEN 'PAID' ELSE 'PENDING' END,
            collection_status = (CASE WHEN v_new_balance = 0 THEN 'COLLECTED' ELSE 'PARTIAL' END)::collection_status
        WHERE id = v_sale_id;

        INSERT INTO collection_records (sale_id, seller_id, client_name, document_ref, amount_reported, status, date_reported, payment_method, planilla_id)
        VALUES (v_sale_id, NULL, v_client_name, v_doc_ref, v_amount, 'VALIDATED', p_date, 'CASH', NULL)
        RETURNING id INTO v_record_id;
        
        v_records := array_append(v_records, v_record_id);
        v_total := v_total + v_amount;
    END LOOP;

    IF v_total = 0 THEN
        RAISE EXCEPTION 'El monto total consolidado no puede ser cero.';
    END IF;

    -- Inserción en CAJA
    INSERT INTO cash_movements (type, category_id, category_name, description, amount, date, user_id, reference_id)
    VALUES ('INCOME', v_category_id, 'COBRANZA MANUAL', COALESCE(p_glosa, 'Liquidación Manual') || ' ' || v_code, v_total, p_date, p_user_id, v_planilla_id)
    RETURNING id INTO v_cash_mov_id;

    -- Generar Planilla
    INSERT INTO collection_planillas (id, code, date, total_amount, record_count, user_id, cash_movement_id, glosa, status)
    VALUES (v_planilla_id, v_code, p_date, v_total, array_length(v_records, 1), p_user_id, v_cash_mov_id, p_glosa, 'ACTIVE');

    -- Actualizar registros con el ID de la planilla recién creada para evitar fk_collrec_planilla error
    UPDATE collection_records SET planilla_id = v_planilla_id WHERE id = ANY(v_records);

    RETURN v_planilla_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Anular Planilla (Extorno Completo)
CREATE OR REPLACE FUNCTION annul_collection_planilla(p_planilla_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_planilla collection_planillas%ROWTYPE;
    v_record collection_records%ROWTYPE;
BEGIN
    SELECT * INTO v_planilla FROM collection_planillas WHERE id = p_planilla_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Planilla no encontrada'; END IF;
    IF v_planilla.status = 'ANNULLED' THEN RETURN TRUE; END IF;

    -- Restaurar saldos de las ventas
    FOR v_record IN SELECT * FROM collection_records WHERE planilla_id = p_planilla_id
    LOOP
        UPDATE sales 
        SET balance = COALESCE(balance, 0) + v_record.amount_reported,
            payment_status = 'PENDING',
            collection_status = (CASE WHEN COALESCE(balance, 0) + v_record.amount_reported >= total THEN 'NONE' ELSE 'PARTIAL' END)::collection_status
        WHERE id = v_record.sale_id;

        IF v_record.seller_id IS NULL THEN
            -- Eliminar permanentemente los registros de cobro manual
            DELETE FROM collection_records WHERE id = v_record.id;
        ELSE
            -- Devolver a PENDING_VALIDATION los cobros de la app móvil
            UPDATE collection_records SET status = 'PENDING_VALIDATION', planilla_id = NULL WHERE id = v_record.id;
        END IF;
    END LOOP;

    -- Eliminar Movimiento de Caja
    DELETE FROM cash_movements WHERE id = v_planilla.cash_movement_id;

    -- Marcar Planilla como Anulada
    UPDATE collection_planillas SET status = 'ANNULLED', total_amount = 0, record_count = 0 WHERE id = p_planilla_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Extornar Planilla para Edición
CREATE OR REPLACE FUNCTION revert_planilla_for_edit(p_planilla_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_planilla collection_planillas%ROWTYPE;
    v_record collection_records%ROWTYPE;
BEGIN
    SELECT * INTO v_planilla FROM collection_planillas WHERE id = p_planilla_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Planilla no encontrada'; END IF;

    -- Restaurar saldos de las ventas
    FOR v_record IN SELECT * FROM collection_records WHERE planilla_id = p_planilla_id
    LOOP
        UPDATE sales 
        SET balance = COALESCE(balance, 0) + v_record.amount_reported,
            payment_status = 'PENDING',
            collection_status = (CASE WHEN COALESCE(balance, 0) + v_record.amount_reported >= total THEN 'NONE' ELSE 'PARTIAL' END)::collection_status
        WHERE id = v_record.sale_id;

        IF v_record.seller_id IS NOT NULL THEN
            UPDATE collection_records SET status = 'PENDING_VALIDATION', planilla_id = NULL WHERE id = v_record.id;
        END IF;
    END LOOP;

    -- Eliminar records manuales, ya que se regenerarán en el nuevo envío
    DELETE FROM collection_records WHERE planilla_id = p_planilla_id AND seller_id IS NULL;

    -- Eliminar Movimiento de Caja
    DELETE FROM cash_movements WHERE id = v_planilla.cash_movement_id;

    -- Marcar Planilla como Editando
    UPDATE collection_planillas SET status = 'EDITING', cash_movement_id = NULL WHERE id = p_planilla_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Retirar un registro específico de una planilla
CREATE OR REPLACE FUNCTION remove_record_from_planilla(p_planilla_id UUID, p_record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_planilla collection_planillas%ROWTYPE;
    v_record collection_records%ROWTYPE;
BEGIN
    SELECT * INTO v_planilla FROM collection_planillas WHERE id = p_planilla_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Planilla no encontrada'; END IF;
    IF v_planilla.status = 'ANNULLED' THEN RETURN FALSE; END IF;

    SELECT * INTO v_record FROM collection_records WHERE id = p_record_id AND planilla_id = p_planilla_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro no pertenece a la planilla indicada'; END IF;

    -- Restaurar saldo en la venta
    UPDATE sales 
    SET balance = COALESCE(balance, 0) + v_record.amount_reported,
        payment_status = 'PENDING',
        collection_status = (CASE WHEN COALESCE(balance, 0) + v_record.amount_reported >= total THEN 'NONE' ELSE 'PARTIAL' END)::collection_status
    WHERE id = v_record.sale_id;

    -- Actualizar Registro
    UPDATE collection_records SET status = 'PENDING_VALIDATION', planilla_id = NULL WHERE id = p_record_id;

    -- Actualizar totales en Planilla
    UPDATE collection_planillas 
    SET total_amount = total_amount - v_record.amount_reported,
        record_count = record_count - 1
    WHERE id = p_planilla_id;

    -- Si se quedó en cero registros, anularla completamente
    IF v_planilla.record_count <= 1 THEN
        UPDATE collection_planillas SET status = 'ANNULLED' WHERE id = p_planilla_id;
        DELETE FROM cash_movements WHERE id = v_planilla.cash_movement_id;
    ELSE
        UPDATE cash_movements SET amount = amount - v_record.amount_reported WHERE id = v_planilla.cash_movement_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

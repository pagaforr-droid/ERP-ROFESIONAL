-- ========================================================================================
-- SCRIPT 11: MÓDULO COBRANZAS (RPCs TRANSACTIONS)
-- ========================================================================================
-- Este script permite que los pagos "a cuenta" o "totales" de las ventas bajen
-- directamente a la tabla `collection_records` desde el móvil.
-- Y que Tesorería consolide todas las `collection_records` pendientes
-- generando un recibo único (`collection_planillas`) que entra al Flujo de Caja.

CREATE OR REPLACE FUNCTION process_collection(p_sale_id UUID, p_seller_id UUID, p_amount DECIMAL)
RETURNS UUID AS $$
DECLARE
    v_sale_balance DECIMAL;
    v_new_balance DECIMAL;
    v_record_id UUID;
    v_client_name TEXT;
    v_doc_ref TEXT;
BEGIN
    SELECT balance, client_name, series || '-' || number 
    INTO v_sale_balance, v_client_name, v_doc_ref
    FROM sales 
    WHERE id = p_sale_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta % no encontrada', p_sale_id; END IF;
    
    IF v_sale_balance IS NULL THEN
        RAISE EXCEPTION 'El saldo de la venta es nulo. Imposible calcular deducción.';
    END IF;

    IF p_amount > v_sale_balance THEN
        RAISE EXCEPTION 'El monto a pagar (S/ %) supera el saldo actual de la venta (S/ %)', p_amount, v_sale_balance;
    END IF;

    v_new_balance := v_sale_balance - p_amount;

    -- 1. Actualizar el saldo restante en la venta. Si llega a 0, queda como PAID.
    UPDATE sales 
    SET balance = v_new_balance,
        payment_status = CASE WHEN v_new_balance = 0 THEN 'PAID' ELSE 'PENDING' END
    WHERE id = p_sale_id;

    -- 2. Asentar el pago parcial/total a nombre del vendedor.
    INSERT INTO collection_records (sale_id, seller_id, client_name, document_ref, amount_reported, status, date_reported)
    VALUES (p_sale_id, p_seller_id, v_client_name, v_doc_ref, p_amount, 'PENDING_VALIDATION', NOW())
    RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION consolidate_collections(
    p_record_ids UUID[], 
    p_user_id UUID, 
    p_planilla_date TIMESTAMP WITH TIME ZONE,
    p_category_id UUID,
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
BEGIN
    -- SEGURIDAD LÓGICA DE CAJA
    SELECT id INTO v_session_id FROM cash_register_sessions WHERE status = 'OPEN' LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seguridad: No se puede generar la Planilla sin un Turno de Caja Aperturado y activo.';
    END IF;

    -- Validar sumatoria real del dinero que entra
    SELECT SUM(amount_reported) INTO v_total
    FROM collection_records 
    WHERE id = ANY(p_record_ids) AND status = 'PENDING_VALIDATION';
    
    IF v_total IS NULL OR v_total = 0 THEN
        RAISE EXCEPTION 'Ninguno de los registros seleccionados es válido o su suma es 0.';
    END IF;

    -- Manejo de Código e ID (Edición vs Creación)
    IF p_edit_planilla_id IS NOT NULL AND p_edit_planilla_code IS NOT NULL THEN
        v_planilla_id := p_edit_planilla_id;
        v_code := p_edit_planilla_code;
        -- Limpiar rastro de la planilla que estaba en estado EDITING antes de re-consolidar
        DELETE FROM collection_planillas WHERE id = v_planilla_id;
        DELETE FROM cash_movements WHERE reference_id = v_planilla_id::TEXT;
    ELSE
        -- Generar Autocódigo PLAN-0001
        SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')), '0')::INT 
        INTO v_max_num 
        FROM collection_planillas WHERE code LIKE 'PLAN-%';
        
        v_code := 'PLAN-' || LPAD((COALESCE(v_max_num, 0) + 1)::TEXT, 4, '0');
        v_planilla_id := gen_random_uuid();
    END IF;

    -- Inserción directa en CAJA (Flujo de Efectivo) validando Categoría "Cobranza Vendedores"
    INSERT INTO cash_movements (type, category_id, category_name, description, amount, date, user_id, reference_id)
    VALUES ('INCOME', p_category_id, 'COBRANZAS VENDEDORES', COALESCE(p_glosa, 'Planilla de Cobranzas') || ' ' || v_code, v_total, p_planilla_date, p_user_id, v_planilla_id::TEXT)
    RETURNING id INTO v_cash_mov_id;

    -- Generar Recibo de Planilla Único
    INSERT INTO collection_planillas (id, code, date, total_amount, record_count, user_id, cash_movement_id, glosa, status, records)
    VALUES (v_planilla_id, v_code, p_planilla_date, v_total, array_length(p_record_ids, 1), p_user_id, v_cash_mov_id, p_glosa, 'ACTIVE', p_record_ids);

    -- Actualizar estado de records sueltos y amarrarlos
    UPDATE collection_records 
    SET status = 'VALIDATED', planilla_id = v_planilla_id
    WHERE id = ANY(p_record_ids);

    RETURN v_planilla_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

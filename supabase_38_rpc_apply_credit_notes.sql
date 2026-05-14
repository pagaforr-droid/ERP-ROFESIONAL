-- ========================================================================================
-- SCRIPT 38: APLICACIÓN DE NOTAS DE CRÉDITO PENDIENTES
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.apply_credit_note_to_invoice(p_nc_id UUID, p_invoice_id UUID, p_amount NUMERIC, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_nc_balance DECIMAL(12,2);
    v_invoice_balance DECIMAL(12,2);
    v_nc_series TEXT;
    v_nc_number TEXT;
    v_invoice_type TEXT;
    v_invoice_series TEXT;
    v_invoice_number TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto a aplicar debe ser mayor a 0';
    END IF;

    -- Obtener saldos bloqueando las filas para concurrencia
    SELECT balance, series, number INTO v_nc_balance, v_nc_series, v_nc_number 
    FROM sales WHERE id = p_nc_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nota de crédito no encontrada';
    END IF;
    
    SELECT balance, document_type, series, number INTO v_invoice_balance, v_invoice_type, v_invoice_series, v_invoice_number 
    FROM sales WHERE id = p_invoice_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura o Boleta no encontrada';
    END IF;

    -- Validaciones
    IF v_nc_balance < p_amount THEN
        RAISE EXCEPTION 'La Nota de Crédito no tiene saldo suficiente. Saldo actual: S/ %', v_nc_balance;
    END IF;

    IF v_invoice_balance < p_amount THEN
        RAISE EXCEPTION 'La Factura no tiene deuda suficiente. Deuda actual: S/ %', v_invoice_balance;
    END IF;

    -- Aplicar los descuentos a los saldos
    UPDATE sales 
    SET balance = balance - p_amount,
        payment_status = CASE WHEN (balance - p_amount) <= 0 THEN 'PAID' ELSE payment_status END
    WHERE id = p_nc_id;
    
    UPDATE sales 
    SET balance = balance - p_amount,
        payment_status = CASE WHEN (balance - p_amount) <= 0 THEN 'PAID' ELSE payment_status END
    WHERE id = p_invoice_id;

    -- Historial en la factura
    INSERT INTO sale_history (sale_id, action, user_id, details)
    VALUES (
        p_invoice_id,
        'CREDIT_NOTE_APPLIED',
        p_user_id,
        'Nota de Crédito ' || v_nc_series || '-' || v_nc_number || ' aplicada por S/ ' || p_amount
    );

    -- Historial en la nota de crédito
    INSERT INTO sale_history (sale_id, action, user_id, details)
    VALUES (
        p_nc_id,
        'CREDIT_NOTE_APPLIED_OUT',
        p_user_id,
        'Saldo de S/ ' || p_amount || ' aplicado a ' || v_invoice_type || ' ' || v_invoice_series || '-' || v_invoice_number
    );

    -- Insertar como pago validado para que la UI recalcule el saldo "currentBalance" de la factura
    INSERT INTO collection_records (
        sale_id, client_name, document_ref, amount_reported, status, seller_id
    ) VALUES (
        p_invoice_id,
        (SELECT client_name FROM sales WHERE id = p_invoice_id),
        'NC ' || v_nc_series || '-' || v_nc_number,
        p_amount,
        'VALIDATED',
        p_user_id
    );

    RETURN jsonb_build_object('success', true, 'applied_amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

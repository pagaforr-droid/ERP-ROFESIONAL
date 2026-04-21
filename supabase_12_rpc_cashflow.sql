-- ========================================================================================
-- SCRIPT 12: MÓDULO FLUJO DE CAJA (RPCs TRANSACTIONS)
-- ========================================================================================

CREATE OR REPLACE FUNCTION open_cash_session(
    p_amount DECIMAL, 
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_active_id UUID;
    v_new_session_id UUID;
BEGIN
    SELECT id INTO v_active_id FROM cash_register_sessions WHERE status = 'OPEN' LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'ERROR: Ya existe un Turno de Caja Aperturado. Cierre el actual antes de abrir uno nuevo.';
    END IF;

    -- Asentar sesión
    INSERT INTO cash_register_sessions (
        open_time, opened_by, status, system_opening_amount, system_expected_close
    ) VALUES (
        NOW(), p_user_id, 'OPEN', p_amount, p_amount
    ) RETURNING id INTO v_new_session_id;

    -- Registrar movimiento inyectivo de inicio
    INSERT INTO cash_movements (
        type, category_name, description, amount, date, user_id, reference_id
    ) VALUES (
        'INCOME', 'APERTURA DE CAJA', 'Apertura de Caja Sistema (Base Sencillo)', p_amount, NOW(), p_user_id, v_new_session_id::TEXT
    );

    RETURN v_new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION close_cash_session(
    p_session_id UUID,
    p_user_id UUID,
    p_declared_cash DECIMAL,
    p_declared_transfers DECIMAL,
    p_declared_vouchers DECIMAL,
    p_declared_total DECIMAL,
    p_details JSONB
) RETURNS UUID AS $$
DECLARE
    v_session_status cash_session_status;
    v_open_time TIMESTAMP WITH TIME ZONE;
    
    -- Cálculos de cuadre en vivo
    v_system_income DECIMAL := 0;
    v_system_expense DECIMAL := 0;
    v_system_opening DECIMAL := 0;
    v_expected_close DECIMAL := 0;
    v_difference DECIMAL := 0;
BEGIN
    SELECT status, open_time, system_opening_amount 
    INTO v_session_status, v_open_time, v_system_opening 
    FROM cash_register_sessions 
    WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesión de caja % no encontrada.', p_session_id;
    END IF;

    IF v_session_status = 'CLOSED' THEN
        RAISE EXCEPTION 'La sesión de caja seleccionada ya se encuentra CERRADA.';
    END IF;

    -- Calcular Ingresos del turno actual (Ventas Directas + Recaudación Móvil/Planillas)
    -- Asumimos que los movimientos se reflejaron en cash_movements
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0)
    INTO v_system_income, v_system_expense
    FROM cash_movements
    WHERE date >= v_open_time 
      AND reference_id IS DISTINCT FROM p_session_id::TEXT;

    -- Calcular ventas en efectivo (si no se han convertido en cash_movements individualmente)
    -- Dado que es posible que algunas ventas se sumen directamente (dependiendo de la arquitectura),
    -- dejaremos este espacio si es necesario. (Ej: SELECT COALESCE(SUM(total), 0) FROM sales WHERE payment_method = 'CONTADO' AND created_at >= v_open_time ...)
    
    v_expected_close := v_system_opening + v_system_income - v_system_expense;
    v_difference := p_declared_total - v_expected_close;

    UPDATE cash_register_sessions SET 
        close_time = NOW(),
        closed_by = p_user_id,
        status = 'CLOSED',
        system_income = v_system_income,
        system_expense = v_system_expense,
        system_expected_close = v_expected_close,
        declared_cash = p_declared_cash,
        declared_transfers = p_declared_transfers,
        declared_vouchers = p_declared_vouchers,
        declared_total = p_declared_total,
        difference = v_difference,
        closing_details = p_details
    WHERE id = p_session_id;

    RETURN p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

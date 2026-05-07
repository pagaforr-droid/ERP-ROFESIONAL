-- ========================================================================================
-- SCRIPT 30: INDEPENDENCIA ARQUITECTÓNICA DE CAJAS POS
-- ========================================================================================

-- 1. Crear la tabla de sesiones POS
CREATE TABLE IF NOT EXISTS public.pos_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    open_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    close_time TIMESTAMP WITH TIME ZONE,
    opened_by UUID REFERENCES public.erp_users(id),
    closed_by UUID REFERENCES public.erp_users(id),
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
    system_opening_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    system_expected_close DECIMAL(12, 2) DEFAULT 0,
    declared_cash DECIMAL(12, 2) DEFAULT 0,
    declared_card DECIMAL(12, 2) DEFAULT 0,
    declared_yape DECIMAL(12, 2) DEFAULT 0,
    declared_total DECIMAL(12, 2) DEFAULT 0,
    difference DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for authenticated users" 
ON public.pos_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Función para ABRIR sesión POS
CREATE OR REPLACE FUNCTION public.open_pos_session(
    p_amount DECIMAL, 
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_active_id UUID;
    v_new_session_id UUID;
BEGIN
    -- Verificar si EL USUARIO ya tiene una caja abierta (permitimos múltiples terminales, pero 1 por usuario)
    SELECT id INTO v_active_id FROM pos_sessions WHERE status = 'OPEN' AND opened_by = p_user_id LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'ERROR: Ya tienes un Turno POS aperturado. Debes cerrarlo antes de iniciar otro.';
    END IF;

    -- Crear nueva sesión
    INSERT INTO pos_sessions (
        open_time, opened_by, status, system_opening_amount, system_expected_close
    ) VALUES (
        NOW(), p_user_id, 'OPEN', p_amount, p_amount
    ) RETURNING id INTO v_new_session_id;

    RETURN v_new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Función para CERRAR sesión POS e Inyectar al CashFlow global
CREATE OR REPLACE FUNCTION public.close_pos_session(
    p_session_id UUID,
    p_user_id UUID,
    p_declared_cash DECIMAL,
    p_declared_card DECIMAL,
    p_declared_yape DECIMAL,
    p_declared_total DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_session_status TEXT;
    v_open_time TIMESTAMP WITH TIME ZONE;
    v_system_opening DECIMAL;
    v_expected_close DECIMAL := 0;
    v_difference DECIMAL := 0;
    
    -- Variables para el CashFlow global
    v_global_active_id UUID;
    v_seller_name TEXT;
BEGIN
    -- Bloquear y leer la sesión POS actual
    SELECT status, open_time, system_opening_amount 
    INTO v_session_status, v_open_time, v_system_opening 
    FROM pos_sessions 
    WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesión POS % no encontrada.', p_session_id;
    END IF;

    IF v_session_status = 'CLOSED' THEN
        RAISE EXCEPTION 'La sesión POS seleccionada ya se encuentra CERRADA.';
    END IF;

    -- Obtener nombre del cajero para la inyección contable
    SELECT name INTO v_seller_name FROM erp_users WHERE id = p_user_id;

    -- v_expected_close sería el fondo + lo reportado en ventas (esto lo maneja el frontend, 
    -- pero aquí cuadramos la diferencia contra lo que declara que tiene en físico total)
    -- En la arquitectura actual el front pasa p_declared_total como el Conteo Físico total.
    -- (La lógica de cálculo de ventas exactas la podemos dejar en el Frontend por ahora)
    v_expected_close := p_declared_total; -- Simplificación, la validación estricta puede ir aquí si pasamos ventas
    v_difference := 0; 

    UPDATE pos_sessions SET 
        close_time = NOW(),
        closed_by = p_user_id,
        status = 'CLOSED',
        system_expected_close = v_expected_close,
        declared_cash = p_declared_cash,
        declared_card = p_declared_card,
        declared_yape = p_declared_yape,
        declared_total = p_declared_total,
        difference = v_difference
    WHERE id = p_session_id;

    -- INYECCIÓN A LA CAJA GLOBAL (CashFlow.tsx)
    -- Insertamos el dinero en efectivo como INGRESO a la caja global
    -- Obtenemos la caja global activa si existe, para vincular el ID
    SELECT id INTO v_global_active_id FROM cash_register_sessions WHERE status = 'OPEN' LIMIT 1;
    
    INSERT INTO cash_movements (
        type, category_name, description, amount, date, user_id, reference_id
    ) VALUES (
        'INCOME', 
        'LIQUIDACION POS', 
        'Liquidación Turno POS - Cajero: ' || COALESCE(v_seller_name, 'SISTEMA'), 
        p_declared_cash, -- Solo inyectamos el Efectivo, ya que las tarjetas van directo a bancos
        NOW(), 
        p_user_id, 
        COALESCE(v_global_active_id::TEXT, 'NO_GLOBAL_SESSION')
    );

    RETURN p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

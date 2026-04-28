-- supabase_21_fixed_expenses.sql

CREATE OR REPLACE FUNCTION process_scheduled_transaction(p_tx_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tx RECORD;
    v_cat_name TEXT;
    v_new_movement_id UUID;
    v_new_next_date DATE;
    v_is_active BOOLEAN;
BEGIN
    -- 1. Obtener la transacción programada
    SELECT * INTO v_tx
    FROM scheduled_transactions
    WHERE id = p_tx_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción programada no encontrada';
    END IF;

    IF NOT v_tx.is_active THEN
        RAISE EXCEPTION 'La transacción programada no está activa';
    END IF;

    -- 2. Obtener el nombre de la categoría
    SELECT name INTO v_cat_name
    FROM expense_categories
    WHERE id = v_tx.category_id;

    IF v_cat_name IS NULL THEN
        v_cat_name := 'GASTO PROGRAMADO';
    END IF;

    -- 3. Crear el movimiento de caja (Egreso)
    v_new_movement_id := uuid_generate_v4();
    
    INSERT INTO cash_movements (
        id,
        type,
        category_id,
        category_name,
        description,
        amount,
        date,
        reference_id,
        user_id
    ) VALUES (
        v_new_movement_id,
        'EXPENSE',
        v_tx.category_id,
        v_cat_name,
        'Pago Automático: ' || v_tx.name,
        v_tx.amount,
        now(),
        v_tx.id,
        p_user_id
    );

    -- 4. Calcular próxima fecha y estado
    v_new_next_date := v_tx.next_due_date::DATE;
    v_is_active := TRUE;

    IF v_tx.frequency = 'MONTHLY' THEN
        v_new_next_date := v_new_next_date + INTERVAL '1 month';
    ELSIF v_tx.frequency = 'WEEKLY' THEN
        v_new_next_date := v_new_next_date + INTERVAL '7 days';
    ELSIF v_tx.frequency = 'BIWEEKLY' THEN
        v_new_next_date := v_new_next_date + INTERVAL '14 days';
    ELSIF v_tx.frequency = 'ONETIME' THEN
        v_is_active := FALSE;
    END IF;

    -- 5. Actualizar la transacción programada
    UPDATE scheduled_transactions
    SET 
        next_due_date = v_new_next_date,
        is_active = v_is_active
    WHERE id = p_tx_id;

    -- 6. Devolver resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_new_movement_id,
        'next_due_date', TO_CHAR(v_new_next_date, 'YYYY-MM-DD'),
        'is_active', v_is_active
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

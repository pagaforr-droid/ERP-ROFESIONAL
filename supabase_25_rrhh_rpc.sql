-- supabase_25_rrhh_rpc.sql

-- 1. Function to process a new salary advance
CREATE OR REPLACE FUNCTION process_salary_advance(
    p_employee_id UUID,
    p_amount DECIMAL(10,2),
    p_reason TEXT,
    p_user_id UUID,
    p_employee_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_advance_id UUID;
    v_movement_id UUID;
    v_movement_json JSONB;
BEGIN
    -- 1. Insert the advance
    INSERT INTO erp_salary_advances (employee_id, amount, reason, status)
    VALUES (p_employee_id, p_amount, p_reason, 'PENDING')
    RETURNING id INTO v_advance_id;

    -- 2. Insert the cash movement
    INSERT INTO cash_movements (
        type, 
        category_name, 
        description, 
        amount, 
        reference_id, 
        user_id
    ) VALUES (
        'EXPENSE',
        'ADELANTO_PERSONAL',
        'Vale/Adelanto: ' || p_employee_name || ' - ' || p_reason,
        p_amount,
        v_advance_id,
        p_user_id
    ) RETURNING id INTO v_movement_id;

    -- 3. Return the newly created cash movement so UI can add to store
    SELECT row_to_json(cm)::jsonb INTO v_movement_json
    FROM cash_movements cm
    WHERE id = v_movement_id;

    RETURN v_movement_json;
END;
$$;

-- 2. Function to process payroll
CREATE OR REPLACE FUNCTION process_payroll(
    p_employee_id UUID,
    p_employee_name TEXT,
    p_base_amount DECIMAL(10,2),
    p_legal_deductions DECIMAL(10,2),
    p_period TEXT,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pending_advances DECIMAL(10,2) := 0;
    v_net_paid DECIMAL(10,2);
    v_payroll_id UUID;
    v_movement_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Calculate pending advances
    SELECT COALESCE(SUM(amount), 0) INTO v_pending_advances
    FROM erp_salary_advances
    WHERE employee_id = p_employee_id AND status = 'PENDING';

    -- 2. Calculate net paid
    v_net_paid := p_base_amount - p_legal_deductions - v_pending_advances;

    IF v_net_paid < 0 THEN
        RAISE EXCEPTION 'El Neto a liquidar es negativo (%). Revise los adelantos.', v_net_paid;
    END IF;

    -- 3. Insert payroll record
    INSERT INTO erp_payroll_records (
        employee_id, period, base_amount, legal_deductions, advances_amount, net_paid
    ) VALUES (
        p_employee_id, p_period, p_base_amount, p_legal_deductions, v_pending_advances, v_net_paid
    ) RETURNING id INTO v_payroll_id;

    -- 4. Mark advances as PAID
    UPDATE erp_salary_advances
    SET status = 'PAID'
    WHERE employee_id = p_employee_id AND status = 'PENDING';

    -- 5. Insert cash movement
    INSERT INTO cash_movements (
        type, 
        category_name, 
        description, 
        amount, 
        reference_id, 
        user_id
    ) VALUES (
        'EXPENSE',
        'PAGO_PLANILLA',
        'Pago Planilla: ' || p_employee_name || ' (' || p_period || ')',
        v_net_paid,
        v_payroll_id,
        p_user_id
    ) RETURNING id INTO v_movement_id;

    -- 6. Return new rows
    v_result := jsonb_build_object(
        'payroll_record', (SELECT row_to_json(pr) FROM erp_payroll_records pr WHERE id = v_payroll_id),
        'cash_movement', (SELECT row_to_json(cm) FROM cash_movements cm WHERE id = v_movement_id)
    );

    RETURN v_result;
END;
$$;

-- 3. Triggers for maintaining cash movements on advance edit/delete
CREATE OR REPLACE FUNCTION fn_trg_maintain_advance_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emp_name TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        SELECT name INTO v_emp_name FROM erp_employees WHERE id = NEW.employee_id;
        
        UPDATE cash_movements
        SET 
            amount = NEW.amount,
            date = NEW.date,
            description = 'Vale/Adelanto (Editado): ' || v_emp_name || ' - ' || NEW.reason
        WHERE reference_id = NEW.id AND category_name = 'ADELANTO_PERSONAL';
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM cash_movements
        WHERE reference_id = OLD.id AND category_name = 'ADELANTO_PERSONAL';
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_advance_movement ON erp_salary_advances;
CREATE TRIGGER trg_maintain_advance_movement
AFTER UPDATE OR DELETE ON erp_salary_advances
FOR EACH ROW
EXECUTE FUNCTION fn_trg_maintain_advance_movement();

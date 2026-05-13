-- ==============================================================================
-- Migración 37: Módulo de Planillas de Cobranza (CxC Legacy) [FORCE PUSH SYNC]
-- ==============================================================================

-- 1. Crear tabla legacy_collection_sheets
CREATE TABLE IF NOT EXISTS public.legacy_collection_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    responsible_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSED', -- PROCESSED, REVERTED
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    cash_movement_id UUID,
    reversal_cash_movement_id UUID,
    user_id UUID REFERENCES public.erp_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alter table in case it was created with TEXT previously
ALTER TABLE public.legacy_collection_sheets 
    ALTER COLUMN cash_movement_id TYPE UUID USING cash_movement_id::UUID,
    ALTER COLUMN reversal_cash_movement_id TYPE UUID USING reversal_cash_movement_id::UUID;

-- 2. Crear tabla legacy_collection_sheet_details
CREATE TABLE IF NOT EXISTS public.legacy_collection_sheet_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID REFERENCES public.legacy_collection_sheets(id) ON DELETE CASCADE,
    legacy_debt_id UUID REFERENCES public.legacy_debts(id) ON DELETE RESTRICT,
    amount_collected NUMERIC(10,2) NOT NULL,
    previous_balance NUMERIC(10,2) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.legacy_collection_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_collection_sheet_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for legacy_collection_sheets" ON public.legacy_collection_sheets;
CREATE POLICY "Enable all for legacy_collection_sheets" ON public.legacy_collection_sheets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for legacy_collection_sheet_details" ON public.legacy_collection_sheet_details;
CREATE POLICY "Enable all for legacy_collection_sheet_details" ON public.legacy_collection_sheet_details FOR ALL USING (true) WITH CHECK (true);


-- 4. RPC para procesar planilla de cobranza
CREATE OR REPLACE FUNCTION public.process_legacy_sheet(
    p_responsible_name TEXT,
    p_items JSONB, -- Array de { debt_id: UUID, amount: NUMERIC }
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_debt public.legacy_debts%ROWTYPE;
    v_total_amount NUMERIC := 0;
    v_cash_movement_id UUID;
    v_sheet_id UUID;
    v_new_balance NUMERIC;
BEGIN
    -- 1. Generar UUIDs
    v_sheet_id := gen_random_uuid();
    v_cash_movement_id := gen_random_uuid();

    -- 2. Calcular total primero para poder insertar la cabecera
    SELECT SUM((item->>'amount')::NUMERIC) INTO v_total_amount 
    FROM jsonb_array_elements(p_items) AS item;

    IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
        RAISE EXCEPTION 'El monto total de la planilla debe ser mayor a 0';
    END IF;

    -- 3. Insertar cabecera de la planilla (Para evitar error de FK en los detalles)
    INSERT INTO public.legacy_collection_sheets (
        id,
        responsible_name,
        status,
        total_amount,
        cash_movement_id,
        user_id
    ) VALUES (
        v_sheet_id,
        p_responsible_name,
        'PROCESSED',
        v_total_amount,
        v_cash_movement_id,
        p_user_id
    );

    -- 4. Procesar cada ítem (Actualizar deudas e insertar detalles)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Bloquear deuda para evitar concurrencia
        SELECT * INTO v_debt
        FROM public.legacy_debts
        WHERE id = (v_item->>'debt_id')::UUID
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Deuda % no encontrada', v_item->>'debt_id';
        END IF;

        IF v_debt.balance < (v_item->>'amount')::NUMERIC THEN
            RAISE EXCEPTION 'El monto a cobrar (S/ %) supera el saldo (S/ %) para %', 
                v_item->>'amount', v_debt.balance, v_debt.client_name;
        END IF;

        -- Calcular y actualizar nuevo saldo
        v_new_balance := v_debt.balance - (v_item->>'amount')::NUMERIC;
        
        UPDATE public.legacy_debts
        SET balance = v_new_balance,
            is_active = CASE WHEN v_new_balance <= 0 THEN false ELSE true END
        WHERE id = v_debt.id;

        -- Insertar detalle de planilla
        INSERT INTO public.legacy_collection_sheet_details (
            sheet_id,
            legacy_debt_id,
            amount_collected,
            previous_balance
        ) VALUES (
            v_sheet_id,
            v_debt.id,
            (v_item->>'amount')::NUMERIC,
            v_debt.balance
        );
    END LOOP;

    -- 5. Insertar movimiento de caja consolidado
    INSERT INTO public.cash_movements (
        id, 
        date, 
        amount, 
        type, 
        description, 
        user_id, 
        category_name, 
        category_id,
        reference_id
    ) VALUES (
        v_cash_movement_id,
        now(),
        v_total_amount,
        'INCOME',
        'Planilla de Cobranza (Migración) - Responsable: ' || p_responsible_name,
        p_user_id,
        'COBRANZA MIGRACION PLANILLA',
        NULL,
        v_sheet_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'sheet_id', v_sheet_id,
        'total_amount', v_total_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 5. RPC para revertir planilla de cobranza
CREATE OR REPLACE FUNCTION public.revert_legacy_sheet(
    p_sheet_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sheet public.legacy_collection_sheets%ROWTYPE;
    v_detail public.legacy_collection_sheet_details%ROWTYPE;
    v_reversal_cash_movement_id UUID;
    v_debt public.legacy_debts%ROWTYPE;
BEGIN
    -- 1. Bloquear planilla
    SELECT * INTO v_sheet
    FROM public.legacy_collection_sheets
    WHERE id = p_sheet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Planilla no encontrada';
    END IF;

    IF v_sheet.status = 'REVERTED' THEN
        RAISE EXCEPTION 'La planilla ya fue revertida anteriormente';
    END IF;

    -- 2. Restaurar saldos de deudas
    FOR v_detail IN SELECT * FROM public.legacy_collection_sheet_details WHERE sheet_id = p_sheet_id
    LOOP
        SELECT * INTO v_debt FROM public.legacy_debts WHERE id = v_detail.legacy_debt_id FOR UPDATE;
        
        UPDATE public.legacy_debts
        SET balance = balance + v_detail.amount_collected,
            is_active = true -- Al devolver saldo, vuelve a estar activa
        WHERE id = v_detail.legacy_debt_id;
    END LOOP;

    -- 3. Generar movimiento de caja de reversión (Egreso)
    v_reversal_cash_movement_id := gen_random_uuid();
    
    INSERT INTO public.cash_movements (
        id, 
        date, 
        amount, 
        type, 
        description, 
        user_id, 
        category_name, 
        category_id,
        reference_id
    ) VALUES (
        v_reversal_cash_movement_id,
        now(),
        v_sheet.total_amount,
        'EXPENSE',
        'REVERSION Planilla de Cobranza - Responsable: ' || v_sheet.responsible_name,
        p_user_id,
        'REVERSION PLANILLA MIGRACION',
        NULL,
        p_sheet_id
    );

    -- 4. Actualizar estado de la planilla
    UPDATE public.legacy_collection_sheets
    SET status = 'REVERTED',
        reversal_cash_movement_id = v_reversal_cash_movement_id
    WHERE id = p_sheet_id;

    RETURN jsonb_build_object('success', true, 'message', 'Planilla revertida correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

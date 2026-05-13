-- ==============================================================================
-- Migración 35: Módulo de Cuentas por Cobrar Migración (Legacy)
-- ==============================================================================

-- 1. Crear tabla legacy_debts
CREATE TABLE IF NOT EXISTS public.legacy_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_name TEXT,
    client_name TEXT,
    doc_date DATE,
    due_date DATE,
    doc_type TEXT,
    doc_number TEXT,
    original_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla legacy_collections
CREATE TABLE IF NOT EXISTS public.legacy_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_debt_id UUID REFERENCES public.legacy_debts(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES public.erp_users(id),
    cash_movement_id TEXT -- Para enlazar con la tabla cash_movements
);

-- 3. Habilitar RLS (opcional si se requiere seguridad estricta, por ahora policy global)
ALTER TABLE public.legacy_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for legacy_debts" ON public.legacy_debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for legacy_collections" ON public.legacy_collections FOR ALL USING (true) WITH CHECK (true);

-- 4. RPC para procesar cobranza de migración de forma atómica
CREATE OR REPLACE FUNCTION public.process_legacy_collection(
    p_debt_id UUID,
    p_amount NUMERIC,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_debt public.legacy_debts%ROWTYPE;
    v_new_balance NUMERIC;
    v_cash_movement_id TEXT;
BEGIN
    -- Bloquear la fila para evitar concurrencia
    SELECT * INTO v_debt
    FROM public.legacy_debts
    WHERE id = p_debt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deuda no encontrada';
    END IF;

    IF v_debt.balance < p_amount THEN
        RAISE EXCEPTION 'El monto a cobrar (S/ %) supera el saldo restante (S/ %)', p_amount, v_debt.balance;
    END IF;

    -- Calcular nuevo saldo
    v_new_balance := v_debt.balance - p_amount;

    -- Actualizar la deuda
    UPDATE public.legacy_debts
    SET balance = v_new_balance,
        is_active = CASE WHEN v_new_balance <= 0 THEN false ELSE true END
    WHERE id = p_debt_id;

    -- Generar UUID manual para el movimiento de caja (como TEXT para la tabla)
    v_cash_movement_id := gen_random_uuid()::TEXT;

    -- Insertar en cash_movements para que afecte el Flujo de Caja global
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
        p_amount,
        'INCOME',
        'Planilla cobranza anterior - Doc: ' || v_debt.doc_type || ' ' || v_debt.doc_number || ' - Cliente: ' || v_debt.client_name,
        p_user_id,
        'COBRANZA MIGRACION',
        NULL,
        p_debt_id::TEXT
    );

    -- Registrar el historial del cobro
    INSERT INTO public.legacy_collections (
        legacy_debt_id,
        amount,
        user_id,
        cash_movement_id
    ) VALUES (
        p_debt_id,
        p_amount,
        p_user_id,
        v_cash_movement_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'is_active', (v_new_balance > 0)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

-- ========================================================================================
-- SCRIPT 33: MÓDULO DE TRASLADO A ALMACÉN DE DAÑOS/MERMAS
-- ========================================================================================

-- 1. Crear tabla de traslados (Historial para el Kardex)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    origin_batch_id UUID NOT NULL REFERENCES public.batches(id),
    dest_batch_id UUID NOT NULL REFERENCES public.batches(id),
    origin_warehouse_id TEXT NOT NULL,
    dest_warehouse_id TEXT NOT NULL,
    quantity_base INT NOT NULL CHECK (quantity_base > 0),
    user_id UUID,
    reason TEXT NOT NULL, -- Ej: 'MERMA', 'VENCIMIENTO', 'REUBICACION'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on stock_transfers" 
ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Función RPC para realizar el traslado de manera segura
CREATE OR REPLACE FUNCTION public.transfer_damaged_goods(
    p_batch_id UUID,
    p_qty INT,
    p_dest_warehouse TEXT,
    p_reason TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_origin_batch RECORD;
    v_dest_batch_id UUID;
    v_product_id UUID;
BEGIN
    -- Bloquear el lote de origen para evitar condiciones de carrera
    SELECT * INTO v_origin_batch 
    FROM public.batches 
    WHERE id = p_batch_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lote de origen no encontrado.';
    END IF;

    IF v_origin_batch.quantity_current < p_qty THEN
        RAISE EXCEPTION 'Stock insuficiente en el lote de origen. Actual: %, Solicitado: %', v_origin_batch.quantity_current, p_qty;
    END IF;

    v_product_id := v_origin_batch.product_id;

    -- Descontar del origen
    UPDATE public.batches 
    SET quantity_current = quantity_current - p_qty,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- Buscar si ya existe el mismo lote en el destino (mismo producto, código y costo)
    SELECT id INTO v_dest_batch_id
    FROM public.batches
    WHERE product_id = v_product_id 
      AND code = v_origin_batch.code 
      AND warehouse_id = p_dest_warehouse
      AND cost = v_origin_batch.cost
      AND expiration_date = v_origin_batch.expiration_date
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
        -- Si existe, sumamos la cantidad
        UPDATE public.batches
        SET quantity_current = quantity_current + p_qty,
            quantity_initial = quantity_initial + p_qty,
            updated_at = NOW()
        WHERE id = v_dest_batch_id;
    ELSE
        -- Si no existe, creamos un nuevo lote en el destino
        INSERT INTO public.batches (
            product_id, purchase_id, warehouse_id, code, 
            quantity_initial, quantity_current, cost, expiration_date
        ) VALUES (
            v_product_id, v_origin_batch.purchase_id, p_dest_warehouse, v_origin_batch.code,
            p_qty, p_qty, v_origin_batch.cost, v_origin_batch.expiration_date
        ) RETURNING id INTO v_dest_batch_id;
    END IF;

    -- Registrar el movimiento en el historial
    INSERT INTO public.stock_transfers (
        product_id, origin_batch_id, dest_batch_id, 
        origin_warehouse_id, dest_warehouse_id, 
        quantity_base, user_id, reason
    ) VALUES (
        v_product_id, p_batch_id, v_dest_batch_id,
        v_origin_batch.warehouse_id, p_dest_warehouse,
        p_qty, p_user_id, p_reason
    );

    RETURN jsonb_build_object('success', true, 'transferred_qty', p_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

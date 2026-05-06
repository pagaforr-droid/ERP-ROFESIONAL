-- ========================================================================================
-- SCRIPT 23: NOTAS DE CRÉDITO DE PROVEEDORES
-- ========================================================================================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS origin_purchase_id UUID;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS nc_type TEXT;

CREATE OR REPLACE FUNCTION process_supplier_credit_note(p_nc_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_origin_purchase_id UUID;
    v_supplier_id UUID;
    v_new_nc_id UUID;
    v_item JSONB;
    v_batch RECORD;
    v_remaining_to_return INT;
    v_total_amount DECIMAL(12,2);
    v_balance DECIMAL(12,2);
    v_orig_balance DECIMAL(12,2);
    v_orig_total DECIMAL(12,2);
    v_nc_type TEXT;
BEGIN
    v_new_nc_id := (p_nc_data->>'id')::UUID;
    v_origin_purchase_id := (p_nc_data->>'origin_purchase_id')::UUID;
    v_supplier_id := (p_nc_data->>'supplier_id')::UUID;
    v_total_amount := (p_nc_data->>'total')::DECIMAL;
    v_nc_type := p_nc_data->>'nc_type';

    -- 1. Insert header
    INSERT INTO purchases (
        id,
        supplier_id,
        supplier_name,
        warehouse_id,
        document_type,
        document_series,
        document_number,
        issue_date,
        entry_date,
        accounting_date,
        due_date,
        observation,
        currency,
        subtotal,
        igv,
        total,
        payment_status,
        balance,
        origin_purchase_id,
        nc_type
    ) VALUES (
        v_new_nc_id,
        v_supplier_id,
        p_nc_data->>'supplier_name',
        (p_nc_data->>'warehouse_id')::UUID,
        'NOTA_CREDITO',
        p_nc_data->>'document_series',
        p_nc_data->>'document_number',
        (p_nc_data->>'issue_date')::DATE,
        (p_nc_data->>'entry_date')::DATE,
        (p_nc_data->>'accounting_date')::DATE,
        (p_nc_data->>'issue_date')::DATE,
        p_nc_data->>'observation',
        p_nc_data->>'currency',
        (p_nc_data->>'subtotal')::DECIMAL,
        (p_nc_data->>'igv')::DECIMAL,
        v_total_amount,
        'PAID', -- NC starts as PAID because it's applied immediately to the balance
        0,
        v_origin_purchase_id,
        v_nc_type
    );

    -- 2. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_nc_data->'items')
    LOOP
        -- Insert item
        INSERT INTO purchase_items (
            purchase_id,
            product_id,
            quantity_presentation,
            unit_type,
            factor,
            quantity_base,
            unit_price,
            unit_value,
            total_value,
            total_cost,
            batch_code,
            expiration_date,
            is_bonus
        ) VALUES (
            v_new_nc_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'quantity_presentation')::INT,
            v_item->>'unit_type',
            (v_item->>'factor')::INT,
            (v_item->>'quantity_base')::INT,
            (v_item->>'unit_price')::DECIMAL,
            (v_item->>'unit_value')::DECIMAL,
            (v_item->>'total_value')::DECIMAL,
            (v_item->>'total_cost')::DECIMAL,
            v_item->>'batch_code',
            (v_item->>'expiration_date')::DATE,
            COALESCE((v_item->>'is_bonus')::BOOLEAN, false)
        );

        -- If it's DEVOLUCION and not a dummy discount item, update batches
        IF v_nc_type = 'DEVOLUCION' THEN
            v_remaining_to_return := (v_item->>'quantity_base')::INT;
            
            -- Find the batch from the original purchase
            SELECT * INTO v_batch FROM batches 
            WHERE purchase_id = v_origin_purchase_id 
              AND product_id = (v_item->>'product_id')::UUID 
              AND code = (v_item->>'batch_code')
            LIMIT 1;

            IF FOUND THEN
                IF v_batch.quantity_current < v_remaining_to_return THEN
                    RAISE EXCEPTION 'Stock insuficiente en el Kardex para el producto % (Lote %). Se requiere % pero solo hay % disponibles sin vender.', (v_item->>'product_id'), v_batch.code, v_remaining_to_return, v_batch.quantity_current;
                END IF;

                -- Deduct from batch
                UPDATE batches 
                SET quantity_current = quantity_current - v_remaining_to_return,
                    quantity_initial = quantity_initial - v_remaining_to_return,
                    updated_at = NOW()
                WHERE id = v_batch.id;
            ELSE
                 -- Si no encuentra el lote exacto por código, busca cualquier lote de esa compra para ese producto
                 SELECT * INTO v_batch FROM batches 
                 WHERE purchase_id = v_origin_purchase_id 
                   AND product_id = (v_item->>'product_id')::UUID 
                 LIMIT 1;

                 IF FOUND THEN
                     IF v_batch.quantity_current < v_remaining_to_return THEN
                        RAISE EXCEPTION 'Stock insuficiente en el Kardex para el producto %.', (v_item->>'product_id');
                     END IF;

                     UPDATE batches 
                     SET quantity_current = quantity_current - v_remaining_to_return,
                         quantity_initial = quantity_initial - v_remaining_to_return,
                         updated_at = NOW()
                     WHERE id = v_batch.id;
                 ELSE
                     RAISE EXCEPTION 'No se encontró lote asociado a la compra original para el producto %.', (v_item->>'product_id');
                 END IF;
            END IF;
        END IF;
    END LOOP;

    -- 3. Update original purchase balance
    SELECT balance, total INTO v_orig_balance, v_orig_total FROM purchases WHERE id = v_origin_purchase_id;
    
    v_orig_balance := v_orig_balance - v_total_amount;
    IF v_orig_balance < 0 THEN
        v_orig_balance := 0; -- Avoid negative balance if NC is larger than current debt
    END IF;

    UPDATE purchases 
    SET balance = v_orig_balance,
        payment_status = CASE WHEN v_orig_balance <= 0 THEN 'PAID' ELSE payment_status END,
        updated_at = NOW()
    WHERE id = v_origin_purchase_id;

    RETURN jsonb_build_object('success', true, 'nc_id', v_new_nc_id);
END;
$$;

-- supabase_15_rpc_annulments.sql

-- RPC para anular un pedido (Order)
CREATE OR REPLACE FUNCTION annul_order_transaction(
    p_order_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_status general_status;
BEGIN
    -- Verificar existencia y estado
    SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado.';
    END IF;

    IF v_order_status = 'canceled' THEN
        RETURN jsonb_build_object('success', true, 'msg', 'El pedido ya estaba anulado.');
    END IF;

    IF v_order_status = 'completed' THEN
        RAISE EXCEPTION 'No se puede anular un pedido que ya ha sido facturado/procesado.';
    END IF;

    -- Cambiar estado
    UPDATE orders SET status = 'canceled', updated_at = NOW() WHERE id = p_order_id;

    -- Eliminar las reservas de stock (esto dispara el trigger tr_after_delete_batch_allocation y devuelve el stock)
    DELETE FROM batch_allocations 
    WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = p_order_id);

    RETURN jsonb_build_object('success', true, 'msg', 'Pedido anulado y stock restituido correctamente.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC para anular una Venta/Factura/Boleta (Sale)
CREATE OR REPLACE FUNCTION annul_sale_transaction(
    p_sale_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale_status general_status;
    v_sunat_status sunat_status;
BEGIN
    -- Verificar existencia y estado
    SELECT status, sunat_status INTO v_sale_status, v_sunat_status FROM sales WHERE id = p_sale_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento de venta no encontrado.';
    END IF;

    IF v_sale_status = 'canceled' THEN
        RETURN jsonb_build_object('success', true, 'msg', 'El documento ya estaba anulado.');
    END IF;

    IF v_sunat_status = 'ACCEPTED' THEN
        RAISE EXCEPTION 'No se puede anular un documento que ya fue aceptado por SUNAT directamente. Se requiere Comunicación de Baja o Nota de Crédito.';
    END IF;

    -- Cambiar estado
    UPDATE sales SET 
        status = 'canceled', 
        payment_status = 'PENDING',
        collection_status = 'NONE',
        balance = total,
        updated_at = NOW() 
    WHERE id = p_sale_id;

    -- Eliminar las asignaciones de Kardex (dispara trigger para devolver stock)
    DELETE FROM batch_allocations 
    WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = p_sale_id);

    -- Registrar evento histórico si se desea (opcional)
    INSERT INTO sale_history (sale_id, action, details, user_id)
    VALUES (p_sale_id, 'ANNULLED', 'Documento anulado por administrador', p_user_id);

    RETURN jsonb_build_object('success', true, 'msg', 'Documento anulado y stock restituido al Kardex.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION annul_order_transaction(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION annul_sale_transaction(UUID, UUID) TO authenticated;

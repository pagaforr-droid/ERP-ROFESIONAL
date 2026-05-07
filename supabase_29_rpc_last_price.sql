-- ========================================================================================
-- SCRIPT 29: PROCEDIMIENTO PARA CONSULTAR EL PRECIO HISTÓRICO DE UN PRODUCTO POR CLIENTE
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.get_client_last_product_price(p_client_id UUID, p_product_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_last_price NUMERIC;
BEGIN
    SELECT si.unit_price
    INTO v_last_price
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.client_id = p_client_id
      AND si.product_id = p_product_id
      AND s.status != 'canceled'
    ORDER BY s.created_at DESC
    LIMIT 1;

    RETURN v_last_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

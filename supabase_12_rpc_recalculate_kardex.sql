-- ========================================================================================
-- FUNCION: RECALCULAR KARDEX DE FORMA ESTRICTA
-- ========================================================================================

CREATE OR REPLACE FUNCTION admin_recalculate_kardex()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Esta función recalcula el `quantity_current` de todos los lotes (batches)
    -- basándose en su `quantity_initial` y restando absolutamente todas las
    -- salidas registradas en `batch_allocations`.
    -- Nota: Las notas de crédito o devoluciones insertan batch_allocations negativos,
    -- por lo tanto, la sumatoria algebraica funciona perfectamente.

    -- 1. ELIMINAR LOTES HUÉRFANOS (que ya no están en purchase_items y no tienen historial)
    DELETE FROM batches b
    WHERE b.purchase_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM purchase_items pi
          WHERE pi.purchase_id = b.purchase_id
            AND pi.product_id = b.product_id
            AND pi.batch_code = b.code
      )
      AND NOT EXISTS (
          SELECT 1 FROM batch_allocations ba WHERE ba.batch_id = b.id
      );

    -- 2. DEDUPLICAR LOTES EXACTOS (mismo purchase_id, product_id, code)
    -- Pasar historial al lote más antiguo
    WITH duplicates AS (
        SELECT id, purchase_id, product_id, code,
               ROW_NUMBER() OVER(PARTITION BY purchase_id, product_id, code ORDER BY created_at ASC) as rn
        FROM batches
        WHERE purchase_id IS NOT NULL
    ),
    keeper AS (
        SELECT purchase_id, product_id, code, id as keep_id
        FROM duplicates
        WHERE rn = 1
    )
    UPDATE batch_allocations ba
    SET batch_id = k.keep_id
    FROM duplicates d
    JOIN keeper k ON d.purchase_id = k.purchase_id AND d.product_id = k.product_id AND d.code = k.code
    WHERE ba.batch_id = d.id AND d.rn > 1;

    -- Borrar lotes duplicados
    DELETE FROM batches b
    WHERE b.id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY purchase_id, product_id, code ORDER BY created_at ASC) as rn
            FROM batches
            WHERE purchase_id IS NOT NULL
        ) dupes WHERE rn > 1
    );

    -- 3. ACTUALIZAR QUANTITY_INITIAL EN BASE A PURCHASE_ITEMS (Fuente de la Verdad)
    UPDATE batches b
    SET quantity_initial = pi.quantity_base
    FROM purchase_items pi
    WHERE b.purchase_id IS NOT NULL
      AND b.purchase_id = pi.purchase_id
      AND b.product_id = pi.product_id
      AND b.code = pi.batch_code
      AND b.quantity_initial != pi.quantity_base;

    -- 4. RETROACTIVO: GENERAR BATCH_ALLOCATIONS FALTANTES PARA NOTAS DE CRÉDITO
    -- Las liquidaciones antiguas y las devoluciones automáticas sumaban el stock
    -- directamente a batches en lugar de insertar un batch_allocations negativo.
    -- Esto generaba el descuadre al recalcular. Aquí lo reparamos para siempre.
    INSERT INTO batch_allocations (sale_item_id, batch_id, batch_code, quantity)
    SELECT 
        si.id,
        (SELECT b.id FROM batches b WHERE b.product_id = si.product_id ORDER BY b.created_at DESC LIMIT 1),
        COALESCE((SELECT b.code FROM batches b WHERE b.product_id = si.product_id ORDER BY b.created_at DESC LIMIT 1), 'RETORNO'),
        -si.quantity_base
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE (s.document_type = 'NOTA_CREDITO' OR s.document_type = 'NOTA DE CREDITO')
      AND s.status != 'canceled'
      AND NOT EXISTS (
          SELECT 1 FROM batch_allocations ba WHERE ba.sale_item_id = si.id
      )
      AND (SELECT b.id FROM batches b WHERE b.product_id = si.product_id ORDER BY b.created_at DESC LIMIT 1) IS NOT NULL;

    -- 4.5. RETROACTIVO: LIMPIEZA DE PEDIDOS FANTASMAS QUE CAUSAN DESCUENTO DOBLE
    -- Identificar pedidos "pending" que en realidad ya fueron facturados (misma fecha, cliente y total)
    -- y liberar sus reservas para que el recalculo sea exacto.
    DELETE FROM batch_allocations 
    WHERE order_item_id IN (
        SELECT oi.id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'pending'
          AND EXISTS (
              SELECT 1 FROM sales s 
              WHERE s.client_ruc = o.client_doc_number 
                AND s.total = o.total 
                AND s.created_at >= o.created_at 
                AND s.created_at <= o.created_at + INTERVAL '2 days'
          )
    );

    UPDATE orders o
    SET status = 'completed'
    WHERE o.status = 'pending'
      AND EXISTS (
          SELECT 1 FROM sales s 
          WHERE s.client_ruc = o.client_doc_number 
            AND s.total = o.total 
            AND s.created_at >= o.created_at 
            AND s.created_at <= o.created_at + INTERVAL '2 days'
      );

    -- 5. RECALCULAR QUANTITY_CURRENT STRICTAMENTE
    UPDATE batches b
    SET quantity_current = b.quantity_initial - COALESCE(
        (SELECT SUM(ba.quantity)
         FROM batch_allocations ba
         WHERE ba.batch_id = b.id), 0
    )
    WHERE b.id IS NOT NULL;
END;
$$;

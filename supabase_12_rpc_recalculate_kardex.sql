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

    UPDATE batches b
    SET quantity_current = b.quantity_initial - COALESCE(
        (SELECT SUM(ba.quantity)
         FROM batch_allocations ba
         WHERE ba.batch_id = b.id), 0
    );

END;
$$;

-- supabase_16_rpc_print_batch.sql

-- RPC para marcar ventas como impresas de forma masiva
CREATE OR REPLACE FUNCTION mark_documents_as_printed(
    p_sale_ids UUID[]
)
RETURNS void AS $$
BEGIN
    UPDATE sales
    SET 
        printed = true,
        printed_at = NOW()
    WHERE id = ANY(p_sale_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_documents_as_printed(UUID[]) TO authenticated;

-- ========================================================================================
-- SCRIPT 32: HISTORIAL INMUTABLE DE TRACKING DE VENDEDORES (RETENCIÓN 8 DÍAS)
-- ========================================================================================

-- 1. Crear tabla de logs inmutable
CREATE TABLE IF NOT EXISTS public.seller_tracking_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'ORDER_CREATED', 'VISIT_NO_SALE'
    reference_code TEXT, -- Para referenciar el código de pedido original
    client_name TEXT, -- Denormalizado para evitar joins complejos si el pedido se elimina
    location JSONB, -- { "lat": -12.0, "lng": -77.0, "accuracy": 10 }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas en el reporte
CREATE INDEX IF NOT EXISTS idx_seller_tracking_logs_seller_date ON public.seller_tracking_logs (seller_id, created_at);

-- Permisos (RLS)
ALTER TABLE public.seller_tracking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for authenticated users on seller_tracking_logs" 
ON public.seller_tracking_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Trigger Automático: Insertar log cuando se crea un pedido
CREATE OR REPLACE FUNCTION public.log_order_creation_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.creation_location IS NOT NULL THEN
        INSERT INTO public.seller_tracking_logs (
            seller_id,
            event_type,
            reference_code,
            client_name,
            location
        ) VALUES (
            NEW.seller_id,
            'ORDER_CREATED',
            NEW.code,
            NEW.client_name,
            NEW.creation_location
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Evitar duplicados si el trigger ya existe
DROP TRIGGER IF EXISTS trg_log_order_creation ON public.orders;
CREATE TRIGGER trg_log_order_creation
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_creation_location();

-- 3. Función RPC (Garbage Collector) para limpiar logs mayores a 8 días
CREATE OR REPLACE FUNCTION public.cleanup_tracking_logs()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.seller_tracking_logs 
    WHERE created_at < NOW() - INTERVAL '8 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

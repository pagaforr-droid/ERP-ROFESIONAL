-- ========================================================================================
-- SCRIPT 35: TOPES, EXCLUSIVIDAD Y HAPPY HOURS PARA BONIFICACIONES
-- ========================================================================================

-- 1. Añadir campos a la tabla auto_promotions
ALTER TABLE public.auto_promotions 
ADD COLUMN IF NOT EXISTS max_reward_multiplier INT, -- Tope por transacción/ticket
ADD COLUMN IF NOT EXISTS max_uses_per_client INT, -- Tope por cliente
ADD COLUMN IF NOT EXISTS global_reward_limit INT, -- Stock total reservado para la promo
ADD COLUMN IF NOT EXISTS current_reward_uses INT DEFAULT 0, -- Consumo actual de la promo
ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false, -- Si aplica, anula las demás
ADD COLUMN IF NOT EXISTS is_happy_hour BOOLEAN DEFAULT false, -- Horario específico
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 2. Crear tabla para rastrear usos por cliente (DNI/RUC o ID interno)
CREATE TABLE IF NOT EXISTS public.promotion_client_uses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    auto_promo_id UUID NOT NULL REFERENCES public.auto_promotions(id) ON DELETE CASCADE,
    uses_count INT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, auto_promo_id)
);

-- Permisos
ALTER TABLE public.promotion_client_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable ALL for authenticated users on promotion_client_uses" ON public.promotion_client_uses;
CREATE POLICY "Enable ALL for authenticated users on promotion_client_uses" ON public.promotion_client_uses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Funciones y Triggers para Rastreo de Uso de Promociones
CREATE OR REPLACE FUNCTION public.fn_track_promo_usage()
RETURNS trigger AS $$
DECLARE
    v_client_id UUID;
    v_origin_order_id UUID;
BEGIN
    -- Obtener client_id desde la tabla padre (sales o orders)
    IF TG_TABLE_NAME = 'sale_items' THEN
        SELECT client_id, origin_order_id INTO v_client_id, v_origin_order_id FROM sales WHERE id = NEW.sale_id;
        
        -- Si esta venta viene de un pedido, el uso ya se registro cuando se hizo el pedido
        IF v_origin_order_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
    ELSIF TG_TABLE_NAME = 'order_items' THEN
        SELECT client_id INTO v_client_id FROM orders WHERE id = NEW.order_id;
    END IF;

    -- Incrementar usos globales de la promocion
    UPDATE auto_promotions 
    SET current_reward_uses = COALESCE(current_reward_uses, 0) + 1
    WHERE id = NEW.auto_promo_id;

    -- Incrementar usos por cliente (Upsert)
    IF v_client_id IS NOT NULL THEN
        INSERT INTO promotion_client_uses (client_id, auto_promo_id, uses_count, last_used_at)
        VALUES (v_client_id, NEW.auto_promo_id, 1, NOW())
        ON CONFLICT (client_id, auto_promo_id) 
        DO UPDATE SET uses_count = promotion_client_uses.uses_count + 1, last_used_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_track_sale_promo ON public.sale_items;
CREATE TRIGGER trg_track_sale_promo
AFTER INSERT ON public.sale_items
FOR EACH ROW
WHEN (NEW.is_bonus = true AND NEW.auto_promo_id IS NOT NULL)
EXECUTE FUNCTION public.fn_track_promo_usage();

DROP TRIGGER IF EXISTS trg_track_order_promo ON public.order_items;
CREATE TRIGGER trg_track_order_promo
AFTER INSERT ON public.order_items
FOR EACH ROW
WHEN (NEW.is_bonus = true AND NEW.auto_promo_id IS NOT NULL)
EXECUTE FUNCTION public.fn_track_promo_usage();

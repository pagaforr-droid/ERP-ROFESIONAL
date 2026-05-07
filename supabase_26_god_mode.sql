-- ==============================================================================
-- Migración 26: "God Mode", Feature Flags y Sistema de Trazabilidad (Audit Trail)
-- ==============================================================================

-- 1. Agregar columna de Feature Flags a la configuración de la empresa
ALTER TABLE public.company_config
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

-- 2. Crear tabla de Log de Auditoría (Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    record_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar RLS para audit_logs (solo ADMINs pueden leer, insert es automático por trigger)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los administradores pueden ver auditoría" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.erp_users
            WHERE erp_users.id = auth.uid() AND erp_users.role = 'ADMIN'
        )
    );

-- 3. Función Genérica para los Triggers de Auditoría
CREATE OR REPLACE FUNCTION public.log_audit_action()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_record_id TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Intentar obtener el user_id de la sesión (Supabase Auth)
    v_user_id := auth.uid();
    
    -- Determinar los datos a guardar dependiendo de la acción
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id::TEXT;
        v_old_data := row_to_json(OLD)::JSONB;
        v_new_data := NULL;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id::TEXT;
        v_old_data := row_to_json(OLD)::JSONB;
        v_new_data := row_to_json(NEW)::JSONB;
    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id::TEXT;
        v_old_data := NULL;
        v_new_data := row_to_json(NEW)::JSONB;
    END IF;

    -- Si v_old_data y v_new_data son idénticos en un UPDATE, no registrar nada (evitar ruido)
    IF (TG_OP = 'UPDATE' AND v_old_data = v_new_data) THEN
        RETURN NULL;
    END IF;

    -- Insertar en la tabla de auditoría
    INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_record_id, v_old_data, v_new_data, v_user_id);

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asignar Triggers a las tablas críticas
-- (Eliminamos por si ya existen de alguna prueba anterior)
DROP TRIGGER IF EXISTS audit_sales_trigger ON public.sales;
CREATE TRIGGER audit_sales_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

DROP TRIGGER IF EXISTS audit_clients_trigger ON public.clients;
CREATE TRIGGER audit_clients_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

DROP TRIGGER IF EXISTS audit_users_trigger ON public.erp_users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.erp_users
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- Opcional: Si el usuario confirma, también auditar sale_items (descomentar)
-- DROP TRIGGER IF EXISTS audit_sale_items_trigger ON public.sale_items;
-- CREATE TRIGGER audit_sale_items_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
-- FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

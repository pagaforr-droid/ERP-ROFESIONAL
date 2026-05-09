-- ========================================================================================
-- SCRIPT 34: MÓDULO DE DOCUMENTOS DE TRASLADO A ALMACÉN DE DAÑOS/MERMAS (MULTICARGA)
-- ========================================================================================

-- 1. Crear tabla principal (Cabecera del Documento)
CREATE TABLE IF NOT EXISTS public.transfer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_number TEXT NOT NULL UNIQUE,
    origin_warehouse_id TEXT NOT NULL,
    dest_warehouse_id TEXT NOT NULL,
    reason TEXT NOT NULL, -- Ej: 'MERMA', 'VENCIMIENTO', 'REUBICACION'
    user_id UUID,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'CANCELED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de items (Detalle del Documento)
CREATE TABLE IF NOT EXISTS public.transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.transfer_documents(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_base INT NOT NULL CHECK (quantity_base > 0),
    quantity_presentation INT NOT NULL,
    selected_unit TEXT NOT NULL,
    batch_allocations JSONB NOT NULL DEFAULT '[]'::JSONB
);

-- Permisos
ALTER TABLE public.transfer_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on transfer_documents" ON public.transfer_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on transfer_items" ON public.transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================================================================
-- FUNCION: process_transfer_document
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.process_transfer_document(
    p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_new_doc_id UUID;
    v_doc_number TEXT;
    v_origin_warehouse TEXT;
    v_dest_warehouse TEXT;
    v_reason TEXT;
    v_user_id UUID;
    v_item JSONB;
    v_alloc JSONB;
    v_origin_batch RECORD;
    v_dest_batch_id UUID;
    v_count INT;
BEGIN
    -- 1. Extraer datos de la cabecera
    v_origin_warehouse := p_data->>'origin_warehouse_id';
    v_dest_warehouse := p_data->>'dest_warehouse_id';
    v_reason := p_data->>'reason';
    v_user_id := (p_data->>'user_id')::UUID;
    
    -- 2. Generar Correlativo (Ej: TRF-00000001)
    SELECT COUNT(*) INTO v_count FROM public.transfer_documents;
    v_doc_number := 'TRF-' || LPAD((v_count + 1)::TEXT, 8, '0');

    -- 3. Crear cabecera
    INSERT INTO public.transfer_documents (
        document_number, origin_warehouse_id, dest_warehouse_id, reason, user_id, status
    ) VALUES (
        v_doc_number, v_origin_warehouse, v_dest_warehouse, v_reason, v_user_id, 'COMPLETED'
    ) RETURNING id INTO v_new_doc_id;

    -- 4. Procesar Items y Lotes
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items')
    LOOP
        -- Insertar el item
        INSERT INTO public.transfer_items (
            document_id, product_id, quantity_base, quantity_presentation, selected_unit, batch_allocations
        ) VALUES (
            v_new_doc_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'quantity_base')::INT,
            (v_item->>'quantity_presentation')::INT,
            (v_item->>'selected_unit'),
            v_item->'batch_allocations'
        );

        -- Procesar asignaciones físicas (Lotes FIFO)
        FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_item->'batch_allocations')
        LOOP
            -- 4a. Bloquear el lote de origen y descontar
            SELECT * INTO v_origin_batch FROM public.batches WHERE id = (v_alloc->>'batch_id')::UUID FOR UPDATE;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Lote % no encontrado en base de datos', (v_alloc->>'batch_id');
            END IF;
            
            IF v_origin_batch.quantity_current < (v_alloc->>'quantity')::INT THEN
                RAISE EXCEPTION 'Stock insuficiente en el lote %', v_origin_batch.code;
            END IF;

            UPDATE public.batches
            SET quantity_current = quantity_current - (v_alloc->>'quantity')::INT,
                updated_at = NOW()
            WHERE id = v_origin_batch.id;

            -- 4b. Buscar si existe el MISMO LOTE en el almacén destino (por product_id, code y expiration_date)
            SELECT id INTO v_dest_batch_id 
            FROM public.batches 
            WHERE product_id = v_origin_batch.product_id
              AND code = v_origin_batch.code
              AND (expiration_date = v_origin_batch.expiration_date OR (expiration_date IS NULL AND v_origin_batch.expiration_date IS NULL))
              AND warehouse_id = v_dest_warehouse
            LIMIT 1;

            IF FOUND THEN
                -- Sumar al lote existente en destino
                UPDATE public.batches
                SET quantity_current = quantity_current + (v_alloc->>'quantity')::INT,
                    quantity_initial = quantity_initial + (v_alloc->>'quantity')::INT,
                    updated_at = NOW()
                WHERE id = v_dest_batch_id;
            ELSE
                -- Crear nuevo lote en destino, heredando código y fecha
                INSERT INTO public.batches (
                    product_id, code, quantity_initial, quantity_current, expiration_date, warehouse_id, cost, purchase_id
                ) VALUES (
                    v_origin_batch.product_id,
                    v_origin_batch.code,
                    (v_alloc->>'quantity')::INT,
                    (v_alloc->>'quantity')::INT,
                    v_origin_batch.expiration_date,
                    v_dest_warehouse,
                    v_origin_batch.cost,
                    v_origin_batch.purchase_id
                ) RETURNING id INTO v_dest_batch_id;
            END IF;

        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'document_id', v_new_doc_id,
        'document_number', v_doc_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================================
-- FUNCION: cancel_transfer_document
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.cancel_transfer_document(
    p_document_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_doc RECORD;
    v_item RECORD;
    v_alloc JSONB;
    v_dest_batch_id UUID;
BEGIN
    -- 1. Obtener y bloquear documento
    SELECT * INTO v_doc FROM public.transfer_documents WHERE id = p_document_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento de traslado no encontrado.';
    END IF;
    
    IF v_doc.status = 'CANCELED' THEN
        RAISE EXCEPTION 'El documento ya se encuentra anulado.';
    END IF;

    -- 2. Procesar reversión de lotes
    FOR v_item IN SELECT * FROM public.transfer_items WHERE document_id = p_document_id
    LOOP
        FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_item.batch_allocations)
        LOOP
            -- a. Devolver stock al lote origen
            UPDATE public.batches
            SET quantity_current = quantity_current + (v_alloc->>'quantity')::INT,
                updated_at = NOW()
            WHERE id = (v_alloc->>'batch_id')::UUID;
            
            -- b. Quitar stock del lote destino (buscando por código exacto que generamos)
            -- Como el código de lote se heredó, buscamos el equivalente en destino
            -- Para mayor precisión, usaremos product_id y código del lote origen.
            SELECT id INTO v_dest_batch_id 
            FROM public.batches 
            WHERE product_id = v_item.product_id
              AND warehouse_id = v_doc.dest_warehouse_id
              AND code = (SELECT code FROM public.batches WHERE id = (v_alloc->>'batch_id')::UUID)
            LIMIT 1;

            IF FOUND THEN
                UPDATE public.batches
                SET quantity_current = quantity_current - (v_alloc->>'quantity')::INT,
                    updated_at = NOW()
                WHERE id = v_dest_batch_id;
            END IF;

        END LOOP;
    END LOOP;

    -- 3. Marcar documento como anulado
    UPDATE public.transfer_documents
    SET status = 'CANCELED'
    WHERE id = p_document_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

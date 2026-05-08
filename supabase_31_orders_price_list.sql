-- Migración para añadir price_list_id a la tabla orders

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS price_list_id UUID;

-- Nota: Esta columna permite que el sistema recuerde qué lista de precios se utilizó
-- específicamente para un pedido cuando fue creado o editado, en lugar de 
-- volver a jalar la lista por defecto del cliente cada vez que se abre el modo edición.

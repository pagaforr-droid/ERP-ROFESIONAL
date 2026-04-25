-- Agregar columnas para configuración de impresión por lotes en la tabla company_config
ALTER TABLE company_config 
ADD COLUMN IF NOT EXISTS max_items_factura INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS max_items_boleta INTEGER DEFAULT 15;

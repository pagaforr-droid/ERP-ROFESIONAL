-- ========================================================================================
-- SCRIPT 04: SEED DATA (Datos Iniciales de Prueba)
-- ========================================================================================
-- Este script inserta el catálogo base que tenías en Zustand dentro de tu nueva BD.
-- Ejecuta este script en el SQL Editor de Supabase para tener productos listos.

INSERT INTO products (
  sku, barcode, name, unit_type, package_type, package_content, 
  line, category, subcategory, brand, weight, volume, tax_igv, 
  tax_isc, min_stock, last_cost, profit_margin, price_unit, price_package, is_active, allow_sell
) VALUES 
('WH-001', '7750001001', 'WHISKY JOHNNIE WALKER RED LABEL * 750 ML', 'BOTELLA', 'CAJA', 12, 'LICORES', 'WHISKY', 'JOHNNIE WALKER', 'DIAGEO', 1.25, 0.75, 18, 0, 24, 53.69, 30, 69.80, 795.00, true, true),
('RO-002', '7750001002', 'RON CARTAVIO BLACK * 750 ML', 'BOTELLA', 'CAJA', 12, 'LICORES', 'RON', 'CARTAVIO', 'CARTAVIO', 1.16, 0.75, 18, 0, 50, 21.50, 30, 27.95, 310.00, true, true),
('VO-003', '7750001003', 'VODKA RUSSKAYA * 750 ML', 'BOTELLA', 'CAJA', 12, 'LICORES', 'VODKA', 'RUSSKAYA', 'BACKUS', 1.20, 0.75, 18, 0, 30, 17.70, 35, 23.00, 260.00, true, true),
('CE-004', '7750001004', 'CERVEZA CUSQUEÑA TRIGO * 330 ML', 'BOTELLA', 'CAJA', 24, 'BEBIDAS', 'CERVEZA', 'PREMIUM', 'BACKUS', 0.60, 0.33, 18, 0, 100, 4.13, 25, 5.37, 120.00, true, true),
('PI-005', '7750001005', 'PISCO QUEIROLO QUEBRANTA * 750 ML', 'BOTELLA', 'CAJA', 12, 'LICORES', 'PISCO', 'QUEIROLO', 'SANTIAGO QUEIROLO', 1.30, 0.75, 18, 0, 20, 33.00, 30, 42.90, 490.00, true, true);

-- Si deseas puedes insertar clientes de prueba (Nota: los campos enum requieren coincidir exactamente con el Type)
INSERT INTO clients (code, doc_type, doc_number, name, is_person, address, city, payment_condition, credit_limit) 
VALUES 
('CL-001', 'RUC', '20601234567', 'DISTRIBUIDORA SANTA ROSA SAC', false, 'AV. LA CULTURA 200', 'Cusco', 'CREDITO', 5000),
('CL-002', 'RUC', '20459876543', 'MINIMARKET EL TIO SAC', false, 'JR. LOS ANDES 450', 'Cusco', 'CONTADO', 0);

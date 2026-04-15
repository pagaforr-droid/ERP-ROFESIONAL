-- ========================================================================================
-- SCRIPT 02: RELACIONES (FOREIGN KEYS) E ÍNDICES DE RENDIMIENTO
-- ========================================================================================
-- Este script conecta todas las tablas mediante llaves foráneas para garantizar
-- la integridad referencial y crea índices en las columnas utilizadas frecuentemente 
-- en filtros, búsquedas y joins.
-- ========================================================================================

-- 1. MÓDULO ERP_USERS & CONFIG
ALTER TABLE erp_users
    ADD CONSTRAINT fk_erp_users_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE document_series
    ADD CONSTRAINT fk_document_company FOREIGN KEY (company_id) REFERENCES company_config(id) ON DELETE CASCADE;

-- 2. MÓDULO MAESTROS
ALTER TABLE zones
    ADD CONSTRAINT fk_zones_seller FOREIGN KEY (assigned_seller_id) REFERENCES sellers(id) ON DELETE SET NULL;

ALTER TABLE sellers
    ADD CONSTRAINT fk_sellers_pricelist FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL;

ALTER TABLE clients
    ADD CONSTRAINT fk_clients_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_clients_pricelist FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL;

ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_transporter FOREIGN KEY (transporter_id) REFERENCES transporters(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_vehicles_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

-- 3. MÓDULO INVENTARIO Y CATÁLOGO
ALTER TABLE products
    ADD CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE batches
    ADD CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_batches_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;

ALTER TABLE auto_promotions
    ADD CONSTRAINT fk_auto_promo_cond_product FOREIGN KEY (condition_product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_auto_promo_cond_supplier FOREIGN KEY (condition_supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_auto_promo_reward_product FOREIGN KEY (reward_product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 4. MÓDULO TRANSACCIONAL (PEDIDOS / VENTAS)
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE order_items
    ADD CONSTRAINT fk_orderitems_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_orderitems_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE sales
    ADD CONSTRAINT fk_sales_order FOREIGN KEY (origin_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sales_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_sales_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sales_transporter FOREIGN KEY (guide_transporter_id) REFERENCES transporters(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sales_driver FOREIGN KEY (guide_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sales_vehicle FOREIGN KEY (guide_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

ALTER TABLE sale_history
    ADD CONSTRAINT fk_salehistory_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_salehistory_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE SET NULL;

ALTER TABLE sale_items
    ADD CONSTRAINT fk_saleitems_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_saleitems_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE batch_allocations
    ADD CONSTRAINT fk_batchalloc_saleitem FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_batchalloc_orderitem FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_batchalloc_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT;

-- 5. MÓDULO TRANSACCIONAL (COMPRAS)
ALTER TABLE purchases
    ADD CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_purchases_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;

ALTER TABLE purchase_items
    ADD CONSTRAINT fk_purchaseitems_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_purchaseitems_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE purchase_payments
    ADD CONSTRAINT fk_purchasepay_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_purchasepay_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_purchasepay_cash_mov FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL;

-- 6. MÓDULO LOGÍSTICA
ALTER TABLE dispatch_sheets
    ADD CONSTRAINT fk_dsheets_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT;

ALTER TABLE dispatch_sales
    ADD CONSTRAINT fk_dsales_sheet FOREIGN KEY (dispatch_sheet_id) REFERENCES dispatch_sheets(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_dsales_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

ALTER TABLE dispatch_liquidations
    ADD CONSTRAINT fk_dliq_sheet FOREIGN KEY (dispatch_sheet_id) REFERENCES dispatch_sheets(id) ON DELETE RESTRICT;

ALTER TABLE liquidation_documents
    ADD CONSTRAINT fk_liqdoc_dliq FOREIGN KEY (dispatch_liquidation_id) REFERENCES dispatch_liquidations(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_liqdoc_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

-- 7. MÓDULO FINANCIERO Y CAJA
ALTER TABLE scheduled_transactions
    ADD CONSTRAINT fk_scheduled_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL;

ALTER TABLE cash_register_sessions
    ADD CONSTRAINT fk_crs_opened_by FOREIGN KEY (opened_by) REFERENCES erp_users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_crs_closed_by FOREIGN KEY (closed_by) REFERENCES erp_users(id) ON DELETE SET NULL;

ALTER TABLE cash_movements
    ADD CONSTRAINT fk_cashmov_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cashmov_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE SET NULL;

-- 8. MÓDULO COBRANZAS
ALTER TABLE collection_planillas
    ADD CONSTRAINT fk_collplan_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_collplan_cashmov FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL;

ALTER TABLE collection_records
    ADD CONSTRAINT fk_collrec_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_collrec_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_collrec_planilla FOREIGN KEY (planilla_id) REFERENCES collection_planillas(id) ON DELETE SET NULL;

-- 9. MÓDULO RRHH, ASISTENCIA Y METAS
ALTER TABLE employees
    ADD CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE SET NULL;

ALTER TABLE salary_advances
    ADD CONSTRAINT fk_saladv_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE payroll_records
    ADD CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attend_user FOREIGN KEY (user_id) REFERENCES erp_users(id) ON DELETE CASCADE;

ALTER TABLE quotas
    ADD CONSTRAINT fk_quotas_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;

-- ========================================================================================
-- ÍNDICES PARA MEJORAR EL RENDIMIENTO (QUERIES DE FILTRADO FRECUENTES)
-- ========================================================================================

-- ERP Users
CREATE INDEX idx_erp_users_auth ON erp_users(auth_id);
CREATE INDEX idx_erp_users_role ON erp_users(role);

-- Clients & Sellers
CREATE INDEX idx_clients_doc_number ON clients(doc_number);
CREATE INDEX idx_clients_channel ON clients(channel);
CREATE INDEX idx_clients_zone ON clients(zone_id);

-- Inventory (Products & Batches)
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_batches_product_id ON batches(product_id);
CREATE INDEX idx_batches_expiration ON batches(expiration_date);

-- Orders & Sales (Altamente Consultadas)
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_date ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sales_seller_id ON sales(seller_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_collection ON sales(collection_status);

-- Transaccional Items
CREATE INDEX idx_saleitems_sale_id ON sale_items(sale_id);
CREATE INDEX idx_saleitems_product_id ON sale_items(product_id);
CREATE INDEX idx_batchalloc_saleitem ON batch_allocations(sale_item_id);
CREATE INDEX idx_batchalloc_batch ON batch_allocations(batch_id);

-- Purchases
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(issue_date);

-- Finance
CREATE INDEX idx_cashmov_date ON cash_movements(date);
CREATE INDEX idx_cashmov_type ON cash_movements(type);

-- Attendance & HR
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_user ON attendance_records(user_id);

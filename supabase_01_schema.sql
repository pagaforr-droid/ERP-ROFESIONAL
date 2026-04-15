-- ========================================================================================
-- SCRIPT 01: CREACIÓN DE ESTRUCTURA BASE Y ENUMS (SIN RELACIONES)
-- ========================================================================================
-- Este script inicializa las extensiones necesarias, los tipos de datos enumerados (ENUMS)
-- y crea todas las tablas con sus llaves primarias nativas (UUID).
-- Las llaves foráneas se omiten aquí para evitar problemas de dependencia circular,
-- y se agregarán en el Script 02.
-- ========================================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creación de ENUMs (Tipos de Datos Estrictos)
CREATE TYPE user_role AS ENUM ('ADMIN', 'SELLER', 'WAREHOUSE', 'LOGISTICS', 'CLIENT');
CREATE TYPE doc_type AS ENUM ('RUC', 'DNI');
CREATE TYPE general_status AS ENUM ('pending', 'completed', 'canceled', 'rejected');
CREATE TYPE dispatch_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'liquidated', 'failed', 'partial');
CREATE TYPE delivery_mode AS ENUM ('REGULAR', 'EXPRESS_MISMO_DIA');
CREATE TYPE sunat_status AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'EXCEPTED');
CREATE TYPE payment_method AS ENUM ('CONTADO', 'CREDITO', 'CASH', 'TRANSFER', 'CHECK');
CREATE TYPE promo_type AS ENUM ('PERCENTAGE_DISCOUNT', 'FIXED_PRICE');
CREATE TYPE condition_type AS ENUM ('BUY_X_PRODUCT', 'SPEND_Y_CATEGORY', 'SPEND_Y_TOTAL');
CREATE TYPE transaction_type AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE cash_session_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE collection_status AS ENUM ('NONE', 'PARTIAL', 'REPORTED', 'COLLECTED');

-- ========================================================================================
-- MÓDULO: CONFIGURACIÓN ERP Y SEGURIDAD
-- ========================================================================================

CREATE TABLE erp_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID, -- Referencia a auth.users (Supabase)
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'SELLER',
    client_id UUID,
    avatar_url TEXT,
    requires_attendance BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    pin_code TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE company_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruc TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    logo_url TEXT,
    igv_percent DECIMAL(5,2) DEFAULT 18.00,
    currency_symbol TEXT DEFAULT 'S/',
    email TEXT,
    phone TEXT,
    sunat_provider TEXT,
    sunat_api_url TEXT,
    sunat_api_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE document_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    type TEXT NOT NULL, -- 'FACTURA', 'BOLETA', etc.
    series TEXT NOT NULL,
    current_number INT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: MAESTROS (LOGÍSTICA, CLIENTES Y RUTAS)
-- ========================================================================================

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    assigned_seller_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'BASE', 'VARIATION'
    factor DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    price_list_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    doc_type doc_type NOT NULL,
    doc_number TEXT NOT NULL,
    name TEXT NOT NULL,
    is_person BOOLEAN DEFAULT true,
    ubigeo TEXT,
    address TEXT NOT NULL,
    city TEXT,
    reference TEXT,
    branches JSONB DEFAULT '[]'::jsonb,
    phone TEXT,
    email TEXT,
    contact_name TEXT,
    channel TEXT,
    business_type TEXT,
    category TEXT,
    qualification TEXT,
    zone_id UUID,
    price_list_id UUID,
    payment_condition TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    is_agent_retention BOOLEAN DEFAULT false,
    is_agent_perception BOOLEAN DEFAULT false,
    apply_igv BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proveedores y Logística
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruc TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruc TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    certificate_mtc TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni TEXT UNIQUE NOT NULL,
    license TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate TEXT UNIQUE NOT NULL,
    brand TEXT,
    model TEXT,
    capacity_kg DECIMAL(10,2),
    transporter_id UUID,
    driver_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: CATÁLOGO Y REGISTRO DE STOCK (KARDEX)
-- ========================================================================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    unit_type TEXT NOT NULL,
    package_type TEXT,
    package_content INT NOT NULL DEFAULT 1,
    line TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    supplier_id UUID,
    weight DECIMAL(10,4) DEFAULT 0.00,
    volume DECIMAL(10,4) DEFAULT 0.00,
    tax_igv DECIMAL(5,2) DEFAULT 18.00,
    tax_isc DECIMAL(5,2) DEFAULT 0.00,
    min_stock INT DEFAULT 10,
    last_cost DECIMAL(12,4) DEFAULT 0.00,
    profit_margin DECIMAL(5,2) DEFAULT 0.00,
    price_unit DECIMAL(12,2) NOT NULL,
    price_package DECIMAL(12,2),
    is_active BOOLEAN DEFAULT true,
    allow_sell BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    purchase_id UUID,
    warehouse_id TEXT DEFAULT 'CENTRAL',
    code TEXT NOT NULL,
    quantity_initial INT NOT NULL,
    quantity_current INT NOT NULL CHECK (quantity_current >= 0),
    cost DECIMAL(12,4) NOT NULL,
    expiration_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type promo_type NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    product_ids UUID[], -- Array de productos permitidos
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    min_quantity INT,
    channels TEXT[],
    allowed_seller_ids UUID[],
    image_url TEXT,
    target_client_categories TEXT[],
    target_price_list_ids UUID[],
    target_cities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE combos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    items JSONB NOT NULL, -- Detalle interno del combo
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    channels TEXT[],
    allowed_seller_ids UUID[],
    target_client_categories TEXT[],
    target_price_list_ids UUID[],
    target_cities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE auto_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    start_date DATE,
    end_date DATE,
    condition_type condition_type NOT NULL,
    condition_product_id UUID,
    condition_product_ids UUID[],
    condition_category TEXT,
    condition_supplier_id UUID,
    condition_amount DECIMAL(12,2) NOT NULL,
    reward_product_id UUID NOT NULL,
    reward_quantity INT NOT NULL,
    reward_unit_type TEXT NOT NULL,
    channels TEXT[],
    allowed_seller_ids UUID[],
    target_client_categories TEXT[],
    target_price_list_ids UUID[],
    target_cities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: TRANSACCIONAL (PEDIDOS, VENTAS, COMPRAS)
-- ========================================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    seller_id UUID,
    client_id UUID,
    client_name TEXT NOT NULL,
    client_doc_type doc_type NOT NULL,
    client_doc_number TEXT NOT NULL,
    suggested_document_type TEXT,
    payment_method payment_method,
    delivery_date DATE,
    total DECIMAL(12,2) NOT NULL,
    status general_status DEFAULT 'pending',
    delivery_mode delivery_mode,
    observation TEXT,
    delivery_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    unit_type TEXT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    is_promo BOOLEAN DEFAULT false,
    is_bonus BOOLEAN DEFAULT false,
    auto_promo_id UUID,
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(12,2),
    combo_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_order_id UUID,
    document_type TEXT NOT NULL,
    series TEXT NOT NULL,
    number TEXT NOT NULL,
    payment_method payment_method NOT NULL,
    payment_status TEXT,
    collection_status collection_status DEFAULT 'NONE',
    client_id UUID,
    seller_id UUID,
    client_name TEXT NOT NULL,
    client_ruc TEXT NOT NULL,
    client_address TEXT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    igv DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    balance DECIMAL(12,2),
    observation TEXT,
    status general_status DEFAULT 'completed',
    dispatch_status dispatch_status DEFAULT 'pending',
    delivery_mode delivery_mode,
    guide_transporter_id UUID,
    guide_driver_id UUID,
    guide_vehicle_id UUID,
    delivery_reason TEXT,
    delivery_photo TEXT,
    delivery_location JSONB,
    sunat_status sunat_status DEFAULT 'PENDING',
    sunat_sent_at TIMESTAMP WITH TIME ZONE,
    sunat_message TEXT,
    printed BOOLEAN DEFAULT false,
    printed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sale_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL,
    action TEXT NOT NULL,
    user_id UUID,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    selected_unit TEXT NOT NULL,
    quantity_presentation INT NOT NULL,
    quantity_base INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    total_price DECIMAL(12,2) NOT NULL,
    is_bonus BOOLEAN DEFAULT false,
    auto_promo_id UUID,
    combo_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE batch_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_item_id UUID,
    order_item_id UUID, -- For commiting stock before invoice
    batch_id UUID NOT NULL,
    batch_code TEXT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL,
    supplier_name TEXT NOT NULL,
    warehouse_id UUID,
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    issue_date DATE NOT NULL,
    entry_date DATE NOT NULL,
    due_date DATE NOT NULL,
    accounting_date DATE,
    observation TEXT,
    currency TEXT DEFAULT 'PEN',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    subtotal DECIMAL(12,2) NOT NULL,
    igv DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    payment_status TEXT DEFAULT 'PENDING',
    collection_status collection_status DEFAULT 'NONE',
    paid_amount DECIMAL(12,2) DEFAULT 0.00,
    balance DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity_presentation INT NOT NULL,
    unit_type TEXT NOT NULL,
    factor INT NOT NULL,
    quantity_base INT NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    unit_value DECIMAL(12,4) NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    batch_code TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    is_bonus BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT,
    method payment_method NOT NULL,
    user_id UUID,
    cash_movement_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: DESPACHOS Y LIQUIDACIONES
-- ========================================================================================

CREATE TABLE dispatch_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    vehicle_id UUID NOT NULL,
    status dispatch_status DEFAULT 'pending',
    date DATE NOT NULL,
    sunat_status sunat_status DEFAULT 'PENDING',
    sunat_sent_at TIMESTAMP WITH TIME ZONE,
    sunat_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE dispatch_sales (
    dispatch_sheet_id UUID NOT NULL,
    sale_id UUID NOT NULL,
    PRIMARY KEY (dispatch_sheet_id, sale_id)
);

CREATE TABLE dispatch_liquidations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispatch_sheet_id UUID NOT NULL,
    date DATE NOT NULL,
    total_cash_collected DECIMAL(12,2) DEFAULT 0.00,
    total_credit_receivable DECIMAL(12,2) DEFAULT 0.00,
    total_voided DECIMAL(12,2) DEFAULT 0.00,
    total_returns_value DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE liquidation_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispatch_liquidation_id UUID NOT NULL,
    sale_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'PAID', 'CREDIT', 'VOID', 'PARTIAL_RETURN'
    amount_collected DECIMAL(12,2) DEFAULT 0.00,
    amount_credit DECIMAL(12,2) DEFAULT 0.00,
    amount_void DECIMAL(12,2) DEFAULT 0.00,
    amount_credit_note DECIMAL(12,2) DEFAULT 0.00,
    reason TEXT,
    credit_note_series TEXT,
    balance_payment_method payment_method,
    returned_items JSONB, -- Detalles de los items retornados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: FINANZAS Y CAJA
-- ========================================================================================

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type transaction_type NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE scheduled_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category_id UUID,
    amount DECIMAL(12,2) NOT NULL,
    frequency TEXT NOT NULL, -- 'MONTHLY', 'WEEKLY', etc.
    next_due_date DATE NOT NULL,
    beneficiary_type TEXT,
    beneficiary_id UUID,
    is_active BOOLEAN DEFAULT true,
    auto_process BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cash_register_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    open_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    close_time TIMESTAMP WITH TIME ZONE,
    opened_by UUID NOT NULL,
    closed_by UUID,
    status cash_session_status DEFAULT 'OPEN',
    system_opening_amount DECIMAL(12,2) DEFAULT 0.00,
    system_income DECIMAL(12,2) DEFAULT 0.00,
    system_expense DECIMAL(12,2) DEFAULT 0.00,
    system_expected_close DECIMAL(12,2) DEFAULT 0.00,
    declared_cash DECIMAL(12,2) DEFAULT 0.00,
    declared_transfers DECIMAL(12,2) DEFAULT 0.00,
    declared_vouchers DECIMAL(12,2) DEFAULT 0.00,
    declared_total DECIMAL(12,2) DEFAULT 0.00,
    difference DECIMAL(12,2) DEFAULT 0.00,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type transaction_type NOT NULL,
    category_id UUID,
    category_name TEXT NOT NULL, -- Backup en caso la categoría se borre
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reference_id UUID,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: COBRANZAS (PLANILLAS)
-- ========================================================================================

CREATE TABLE collection_planillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    record_count INT DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    user_id UUID,
    cash_movement_id UUID,
    glosa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE collection_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL,
    seller_id UUID,
    client_name TEXT NOT NULL,
    document_ref TEXT NOT NULL,
    amount_reported DECIMAL(12,2) NOT NULL,
    date_reported TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT DEFAULT 'PENDING_VALIDATION',
    payment_method payment_method,
    planilla_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================================
-- MÓDULO: RECURSOS HUMANOS Y PLANILLAS
-- ========================================================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    start_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    base_salary DECIMAL(12,2) NOT NULL,
    payment_frequency TEXT NOT NULL,
    next_due_date DATE NOT NULL,
    legal_deduction_percent DECIMAL(5,2) DEFAULT 0.00,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE salary_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    period TEXT NOT NULL,
    base_amount DECIMAL(12,2) NOT NULL,
    legal_deductions DECIMAL(12,2) DEFAULT 0.00,
    advances_amount DECIMAL(12,2) DEFAULT 0.00,
    net_paid DECIMAL(12,2) NOT NULL,
    issue_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE,
    photo_in TEXT,
    photo_out TEXT,
    location_in JSONB,
    location_out JSONB,
    total_hours DECIMAL(5,2) DEFAULT 0.00,
    status cash_session_status DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period TEXT NOT NULL,
    seller_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

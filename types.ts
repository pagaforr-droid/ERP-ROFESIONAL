
export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;

  // Presentation / Units
  unit_type: string; // e.g., 'BOTELLA'
  package_type?: string; // e.g., 'CAJA'
  package_content: number; // e.g., 12 (Factor de conversion)

  // Hierarchy
  line: string; // e.g., 'LICORES'
  category: string; // e.g., 'RON'
  subcategory: string; // e.g., 'CARTAVIO'
  brand: string; // e.g., 'CARTAVIO'

  // Relations
  supplier_id?: string;

  // Technical
  weight: number;
  volume: number;
  tax_igv: number; // 18 default
  tax_isc: number;

  // Inventory & Pricing
  min_stock: number;
  last_cost: number; // Costo de ultima compra (Base Unit)
  profit_margin: number; // Margen de ganancia %
  price_unit: number; // Precio calculado Unidad
  price_package: number; // Precio calculado Caja

  is_active: boolean;
  allow_sell: boolean;
  image_url?: string; // NEW: For Store
}

export interface Batch {
  id: string;
  product_id: string;
  purchase_id?: string; // Link to Purchase for Reversion
  code: string;
  quantity_initial: number;
  quantity_current: number;
  cost: number;
  expiration_date: string; // ISO Date
  created_at: string;
}

// === PROMOTIONS & COMBOS ===
export interface Promotion {
  id: string;
  name: string;
  type: 'PERCENTAGE_DISCOUNT' | 'FIXED_PRICE';
  value: number; // % off or fixed price amount
  product_ids: string[]; // Products this applies to
  start_date: string;
  end_date: string;
  is_active: boolean;
  min_quantity?: number; // Minimum units to trigger promo

  // NEW FIELDS
  channels: ('IN_STORE' | 'SELLER_APP')[]; // Where is this visible?
  allowed_seller_ids: string[]; // Empty = All
  image_url?: string; // Optional promo banner
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  price: number;
  items: {
    product_id: string;
    quantity: number;
    unit_type: 'UND' | 'PKG';
  }[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  image_url?: string;

  // NEW FIELDS
  channels: ('IN_STORE' | 'SELLER_APP')[];
  allowed_seller_ids: string[];
}

// === COMPANY SETTINGS ===
export interface DocumentSeries {
  id: string;
  type: 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO';
  series: string; // e.g. F001
  current_number: number; // e.g. 12515
  is_active: boolean;
}

export interface CompanyConfig {
  ruc: string;
  name: string;
  address: string;
  logo_url?: string; // Base64 or URL
  igv_percent: number;
  currency_symbol: string;
  email?: string;
  phone?: string;
  series: DocumentSeries[];

  // SUNAT
  sunat_provider?: 'PSE' | 'OSE' | 'SUNAT' | ''; // Proveedor e.g. Nubefact/APIPeru
  sunat_api_url?: string;
  sunat_api_token?: string;
}

// === CASH FLOW & EXPENSES ===
export interface ExpenseCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE'; // Updated: Now supports categorization by type
  description?: string;
  is_active: boolean;
}

export interface ScheduledTransaction {
  id: string;
  name: string; // e.g. "Alquiler Local" or "Sueldo Juan Perez"
  category_id: string;
  amount: number;
  frequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'ONETIME';
  next_due_date: string;
  beneficiary_type?: 'EMPLOYEE' | 'SUPPLIER' | 'OTHER';
  beneficiary_id?: string; // Link to Driver/Seller ID
  is_active: boolean;
  auto_process?: boolean;
}

export interface CashMovement {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category_id?: string; // Link to ExpenseCategory if expense
  category_name: string; // 'VENTA', 'COMPRA', 'GASTO', 'INGRESO_EXTRA'
  description: string;
  amount: number;
  date: string; // ISO DateTime
  reference_id?: string; // Link to Sale ID, Purchase ID, or Dispatch ID
  user_id?: string;
}

// === COLLECTION NEW STRUCTURE ===
export interface CollectionRecord {
  id: string;
  sale_id: string;
  seller_id: string;
  client_name: string;
  document_ref: string; // e.g., "F001-203"
  amount_reported: number;
  date_reported: string;
  status: 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED';
  payment_method?: 'CASH' | 'TRANSFER' | 'CHECK';
}

// === CLIENTS ===
export interface Client {
  id: string;
  code: string;

  // Identity
  doc_type: 'RUC' | 'DNI';
  doc_number: string;
  name: string;
  is_person: boolean;

  // Location / Contact
  ubigeo: string;
  address: string;
  reference?: string;
  phone?: string;
  email?: string;
  contact_name?: string;

  // Commercial
  channel: string;
  business_type: string;
  category?: string;
  qualification?: string;

  // Logic
  zone_id: string;
  price_list_id: string;
  payment_condition: string;
  credit_limit: number;

  // Config
  is_active: boolean;
  is_agent_retention: boolean;
  is_agent_perception: boolean;
  apply_igv: boolean;

  notes?: string;
}

export interface Seller {
  id: string;
  dni: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  is_active: boolean;
  price_list_id?: string; // NEW: Default price list for this seller's route
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  assigned_seller_id: string; // Links to Seller.id or Name for legacy
}

export interface PriceList {
  id: string;
  name: string; // e.g., "MAYORISTA", "HORECA"
  type: 'BASE' | 'VARIATION'; // BASE = Use product price, VARIATION = Use factor
  factor: number; // e.g., 1.0 (Base), 0.95 (5% Discount), 1.10 (10% Increment)
}

// === LOGISTICS NEW STRUCTURE ===

export interface Transporter {
  id: string;
  ruc: string;
  name: string; // Razon Social
  address: string;
  certificate_mtc?: string; // Certificado de Inscripción
}

export interface Driver {
  id: string;
  dni: string;
  license: string;
  name: string; // Nombres completos
  address: string;
  phone?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  capacity_kg: number;

  // Relations
  transporter_id: string;
  driver_id: string;
}

export interface Supplier {
  id: string;
  ruc: string;
  name: string;
  address: string;
  phone?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
}

// === SALES & ORDERS ===

export interface Order {
  id: string;
  code: string; // Order Code e.g. PED-0001
  seller_id: string;
  client_id: string;

  // Snapshot Data
  client_name: string;
  client_doc_type: 'RUC' | 'DNI';
  client_doc_number: string;

  // Details
  suggested_document_type: 'FACTURA' | 'BOLETA';
  payment_method: 'CONTADO' | 'CREDITO';
  delivery_date: string;

  total: number;
  status: 'pending' | 'processed' | 'rejected';

  created_at: string;
  items: OrderItem[];
}

export interface OrderItem {
  product_id: string; // If 'COMBO', this might be combo ID
  product_name: string;
  unit_type: 'UND' | 'PKG' | 'COMBO'; // Added COMBO
  quantity: number;
  unit_price: number;
  total_price: number;
  is_promo?: boolean;
  batch_allocations?: BatchAllocation[]; // NEW: Tracks committed stock

  // NEW: Snapshot
  combo_snapshot?: {
    product_id: string;
    quantity: number;
    unit_type: 'UND' | 'PKG';
  }[];
}

export interface Sale {
  id: string;
  document_type: 'FACTURA' | 'BOLETA' | 'NOTA DE CREDITO' | string; // Expanded for NC
  series: string;
  number: string;
  payment_method: 'CONTADO' | 'CREDITO';
  payment_status?: 'PAID' | 'PENDING';
  collection_status?: 'NONE' | 'PARTIAL' | 'REPORTED' | 'COLLECTED'; // Expanded

  client_id?: string;
  client_name: string;
  client_ruc: string;
  client_address: string;

  subtotal: number;
  igv: number;
  total: number;

  balance?: number; // NEW: Remaining amount to pay

  observation?: string;

  status: 'pending' | 'completed' | 'canceled';
  dispatch_status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'liquidated';
  created_at: string;

  // === SUNAT Integration ===
  sunat_status?: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTED';
  sunat_sent_at?: string;
  sunat_message?: string;

  // === Print Status ===
  printed?: boolean;
  printed_at?: string;

  items: SaleItem[];

  origin_order_id?: string;
}

export interface SaleItem {
  id: string; // Optional if constructed
  sale_id?: string;
  product_id?: string;
  product_sku: string;
  product_name: string;

  selected_unit: 'UND' | 'PKG' | string;
  quantity_presentation: number;
  quantity_base?: number;

  unit_price: number;
  total_price: number;

  // Discounts & Bonus
  discount_percent: number;
  discount_amount: number;
  is_bonus: boolean;

  batch_allocations?: BatchAllocation[];

  // NEW: Snapshot
  combo_snapshot?: {
    product_id: string;
    quantity: number;
    unit_type: 'UND' | 'PKG';
  }[];
}

export interface BatchAllocation {
  batch_id: string;
  batch_code: string;
  quantity: number;
}

export interface DispatchSheet {
  id: string;
  code: string;
  vehicle_id: string;
  status: 'pending' | 'in_transit' | 'completed';
  date: string;
  sale_ids: string[];

  // === SUNAT Integration ===
  sunat_status?: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTED';
  sunat_sent_at?: string;
  sunat_message?: string;
}

// === LIQUIDATION TYPES ===

export type LiquidationAction = 'PAID' | 'CREDIT' | 'VOID' | 'PARTIAL_RETURN';

export interface LiquidationDocument {
  sale_id: string;
  action: LiquidationAction;

  // Financial Split
  amount_collected: number; // Efectivo real
  amount_credit: number;    // Cuenta por cobrar (incluye saldo de parciales)
  amount_void: number;      // Importe anulado
  amount_credit_note: number; // Importe de la NC

  // Metadata for security/audit
  reason?: string; // Motivo anulación/NC
  credit_note_series?: string; // e.g. FC01-000023
  balance_payment_method?: 'CONTADO' | 'CREDITO'; // Logic for Partial Return Remainder

  returned_items: {
    product_id: string;
    product_name: string;
    quantity_base: number; // Units returned
    quantity_presentation: number; // For UI
    unit_type: string; // For UI
    unit_price: number; // Original price
    total_refund: number;
  }[];
}

export interface DispatchLiquidation {
  id: string;
  dispatch_sheet_id: string;
  date: string;
  total_cash_collected: number;
  total_credit_receivable: number;
  total_voided: number;
  total_returns_value: number;
  documents: LiquidationDocument[];
}

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string; // Added

  // Document Info
  document_type: string; // FACTURA, GUIA
  document_number: string;

  // Dates
  issue_date: string; // Fecha Emision
  entry_date: string; // Fecha Ingreso (Real)
  due_date: string; // Vencimiento
  accounting_date?: string; // Fecha Contable

  // Info
  observation?: string; // Glosa

  // Financials
  currency: 'PEN' | 'USD';
  exchange_rate: number;

  subtotal: number; // Base Imponible
  igv: number;      // Impuesto
  total: number;    // Total Final

  payment_status: 'PAID' | 'PENDING';

  items: PurchaseItem[];
}

export interface PurchaseItem {
  product_id: string;

  // Units
  unit_type: 'UND' | 'PKG';
  quantity_presentation: number; // What user typed
  factor: number; // Conversion factor used
  quantity_base: number; // Converted to units

  // Costs
  unit_value: number; // Valor Unitario (Sin IGV)
  unit_price: number; // Precio Unitario (Con IGV)

  total_value: number; // Valor Venta Total (Subtotal Linea)
  total_cost: number; // Importe Total (Total Linea)

  // Traceability
  batch_code: string;
  expiration_date: string;

  is_bonus: boolean; // Gratuito
}

// === USER MANAGEMENT ===
export interface User {
  id: string;
  username: string;
  password: string; // Stored in plain text for demo (Hash in production)
  name: string;
  role: 'ADMIN' | 'SELLER' | 'WAREHOUSE' | 'LOGISTICS' | 'CLIENT'; // Added CLIENT
  client_id?: string; // If role is CLIENT, link to Client ID
  requires_attendance: boolean;
  is_active: boolean;
  pin_code?: string; // For quick attendance
  permissions: string[]; // List of ViewStates allowed
}

// === ATTENDANCE ===
export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // ISO Timestamp
  check_out?: string; // ISO Timestamp
  total_hours: number;
  status: 'OPEN' | 'CLOSED';
}

export type ViewState =
  | 'dashboard'
  | 'products'
  | 'purchases'
  | 'sales'
  | 'cash-flow'
  | 'mobile-orders'
  | 'collection-consolidation' // NEW
  | 'order-processing'
  | 'inventory'
  | 'dispatch'
  | 'dispatch-liquidation'
  | 'document-manager'
  | 'reports'
  | 'kardex'
  | 'users'
  | 'attendance'
  | 'clients'
  | 'suppliers'
  | 'warehouses'
  | 'logistics'
  | 'territory'
  | 'company-settings'
  | 'print-batch'
  | 'promo-manager'
  | 'price-manager'
  | 'virtual-store'
  | 'sunat-manager';

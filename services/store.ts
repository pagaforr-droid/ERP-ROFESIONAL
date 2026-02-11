
import { create } from 'zustand';
import { Product, Batch, Sale, Vehicle, DispatchSheet, Client, Supplier, Warehouse, Driver, Transporter, Purchase, Zone, PriceList, Seller, Order, SaleItem, BatchAllocation, CompanyConfig, DocumentSeries, CashMovement, ExpenseCategory, ScheduledTransaction, DispatchLiquidation, User, AttendanceRecord, Promotion, Combo, CollectionRecord, OrderItem } from '../types';

// Helper for UUID generation
const generateUUID = () => {
   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
   }
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
   });
};

const MOCK_PRODUCTS: Product[] = [
   {
      id: 'p1', sku: 'WH-001', barcode: '7750001001', name: 'WHISKY JOHNNIE WALKER RED LABEL * 750 ML',
      unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 12,
      line: 'LICORES', category: 'WHISKY', subcategory: 'JOHNNIE WALKER', brand: 'DIAGEO',
      weight: 1.25, volume: 0.75, tax_igv: 18, tax_isc: 0, min_stock: 24,
      last_cost: 53.69, profit_margin: 30, price_unit: 69.80, price_package: 795.00,
      is_active: true, allow_sell: true, image_url: 'https://images.unsplash.com/photo-1527281400683-1abc777219f8?auto=format&fit=crop&w=300&q=80'
   },
   {
      id: 'p2', sku: 'RO-002', barcode: '7750001002', name: 'RON CARTAVIO BLACK * 750 ML',
      unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 12,
      line: 'LICORES', category: 'RON', subcategory: 'CARTAVIO', brand: 'CARTAVIO',
      weight: 1.16, volume: 0.75, tax_igv: 18, tax_isc: 0, min_stock: 50,
      last_cost: 21.50, profit_margin: 30, price_unit: 27.95, price_package: 310.00,
      is_active: true, allow_sell: true, image_url: 'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=300&q=80'
   },
   {
      id: 'p3', sku: 'VO-003', barcode: '7750001003', name: 'VODKA RUSSKAYA * 750 ML',
      unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 12,
      line: 'LICORES', category: 'VODKA', subcategory: 'RUSSKAYA', brand: 'BACKUS',
      weight: 1.20, volume: 0.75, tax_igv: 18, tax_isc: 0, min_stock: 30,
      last_cost: 17.70, profit_margin: 35, price_unit: 23.00, price_package: 260.00,
      is_active: true, allow_sell: true
   },
   {
      id: 'p4', sku: 'CE-004', barcode: '7750001004', name: 'CERVEZA CUSQUEÑA TRIGO * 330 ML',
      unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 24,
      line: 'BEBIDAS', category: 'CERVEZA', subcategory: 'PREMIUM', brand: 'BACKUS',
      weight: 0.60, volume: 0.33, tax_igv: 18, tax_isc: 0, min_stock: 100,
      last_cost: 4.13, profit_margin: 25, price_unit: 5.37, price_package: 120.00,
      is_active: true, allow_sell: true, image_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=300&q=80'
   },
   {
      id: 'p5', sku: 'PI-005', barcode: '7750001005', name: 'PISCO QUEIROLO QUEBRANTA * 750 ML',
      unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 12,
      line: 'LICORES', category: 'PISCO', subcategory: 'QUEIROLO', brand: 'SANTIAGO QUEIROLO',
      weight: 1.30, volume: 0.75, tax_igv: 18, tax_isc: 0, min_stock: 20,
      last_cost: 33.00, profit_margin: 30, price_unit: 42.90, price_package: 490.00,
      is_active: true, allow_sell: true
   },
];

const MOCK_BATCHES: Batch[] = [
   { id: 'b1', product_id: 'p1', code: 'L-JW23', quantity_initial: 200, quantity_current: 150, cost: 53.69, expiration_date: '2028-01-01', created_at: '2024-01-01' },
   { id: 'b2', product_id: 'p2', code: 'L-CAR24', quantity_initial: 500, quantity_current: 420, cost: 21.50, expiration_date: '2026-06-01', created_at: '2024-02-01' },
   { id: 'b3', product_id: 'p3', code: 'L-RUS24', quantity_initial: 300, quantity_current: 280, cost: 17.70, expiration_date: '2025-12-31', created_at: '2024-01-15' },
   { id: 'b4', product_id: 'p4', code: 'L-CUSQ1', quantity_initial: 1000, quantity_current: 850, cost: 4.13, expiration_date: '2024-12-01', created_at: '2024-03-01' },
   { id: 'b5', product_id: 'p5', code: 'L-QUE23', quantity_initial: 150, quantity_current: 120, cost: 33.00, expiration_date: '2030-01-01', created_at: '2023-11-01' },
];

const MOCK_CLIENTS: Client[] = [
   { id: 'c1', code: 'CL-001', doc_type: 'RUC', doc_number: '20601234567', name: 'DISTRIBUIDORA SANTA ROSA SAC', is_person: false, address: 'AV. LA CULTURA 200', ubigeo: '080101', channel: 'MAYORISTA', business_type: 'DISTRIBUIDORA', zone_id: 'z1', price_list_id: 'pl1', payment_condition: 'CREDITO', credit_limit: 5000, is_active: true, is_agent_retention: false, is_agent_perception: true, apply_igv: true },
   { id: 'c2', code: 'CL-002', doc_type: 'RUC', doc_number: '20459876543', name: 'MINIMARKET EL TIO SAC', is_person: false, address: 'JR. LOS ANDES 450', ubigeo: '080102', channel: 'MINORISTA', business_type: 'MINIMARKET', zone_id: 'z2', price_list_id: 'pl2', payment_condition: 'CONTADO', credit_limit: 0, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c3', code: 'CL-003', doc_type: 'DNI', doc_number: '44556677', name: 'JUAN CARLOS MAMANI', is_person: true, address: 'AV. SOL 888', ubigeo: '080101', channel: 'MINORISTA', business_type: 'BODEGA', zone_id: 'z1', price_list_id: 'pl2', payment_condition: 'CONTADO', credit_limit: 0, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c4', code: 'CL-004', doc_type: 'RUC', doc_number: '20501234123', name: 'LICORERIA EL PUNTO', is_person: false, address: 'CALLE MARURI 320', ubigeo: '080101', channel: 'MINORISTA', business_type: 'LICORERIA', zone_id: 'z1', price_list_id: 'pl2', payment_condition: 'CREDITO', credit_limit: 2000, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c5', code: 'CL-005', doc_type: 'DNI', doc_number: '23984567', name: 'MARIA LOPEZ TIENDA', is_person: true, address: 'AV. PARDO 567', ubigeo: '080101', channel: 'MINORISTA', business_type: 'BODEGA', zone_id: 'z1', price_list_id: 'pl2', payment_condition: 'CREDITO', credit_limit: 500, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c6', code: 'CL-006', doc_type: 'RUC', doc_number: '20609876123', name: 'REST. TURISTICO EL INKA', is_person: false, address: 'PLAZA DE ARMAS 100', ubigeo: '080101', channel: 'HORECA', business_type: 'RESTAURANTE', zone_id: 'z1', price_list_id: 'pl3', payment_condition: 'CREDITO', credit_limit: 3000, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c7', code: 'CL-007', doc_type: 'RUC', doc_number: '20405678901', name: 'SUPERMERCADO ORIION', is_person: false, address: 'AV. GARCILASO 900', ubigeo: '080102', channel: 'MAYORISTA', business_type: 'SUPERMERCADO', zone_id: 'z2', price_list_id: 'pl1', payment_condition: 'CREDITO', credit_limit: 10000, is_active: true, is_agent_retention: true, is_agent_perception: false, apply_igv: true },
   { id: 'c8', code: 'CL-008', doc_type: 'DNI', doc_number: '40506070', name: 'PEDRO CASTILLO BODEGA', is_person: true, address: 'JR. HUASCAR 222', ubigeo: '080102', channel: 'MINORISTA', business_type: 'BODEGA', zone_id: 'z2', price_list_id: 'pl2', payment_condition: 'CONTADO', credit_limit: 0, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c9', code: 'CL-009', doc_type: 'RUC', doc_number: '20102030405', name: 'DISCOTECA MYTHOLOGY', is_person: false, address: 'CALLE SUECIA 300', ubigeo: '080101', channel: 'HORECA', business_type: 'DISCOTECA', zone_id: 'z2', price_list_id: 'pl3', payment_condition: 'CREDITO', credit_limit: 5000, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c10', code: 'CL-010', doc_type: 'RUC', doc_number: '20556677889', name: 'HOTEL MONASTERIO', is_person: false, address: 'CALLE PALACIO 136', ubigeo: '080101', channel: 'HORECA', business_type: 'HOTEL', zone_id: 'z3', price_list_id: 'pl3', payment_condition: 'CREDITO', credit_limit: 15000, is_active: true, is_agent_retention: true, is_agent_perception: false, apply_igv: true },
   { id: 'c11', code: 'CL-011', doc_type: 'DNI', doc_number: '70809010', name: 'KIOSKO ESCUELA CLORINDA', is_person: true, address: 'AV. CULTURA 500', ubigeo: '080103', channel: 'MINORISTA', business_type: 'KIOSKO', zone_id: 'z3', price_list_id: 'pl2', payment_condition: 'CONTADO', credit_limit: 0, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c12', code: 'CL-012', doc_type: 'RUC', doc_number: '20601122334', name: 'EVENTOS CUSCO SAC', is_person: false, address: 'URB. MAGISTERIAL G-5', ubigeo: '080103', channel: 'MAYORISTA', business_type: 'EVENTOS', zone_id: 'z3', price_list_id: 'pl1', payment_condition: 'CREDITO', credit_limit: 8000, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
   { id: 'c13', code: 'CL-013', doc_type: 'DNI', doc_number: '23456789', name: 'JUANA ARCO', is_person: true, address: 'APV. ENACE M-4', ubigeo: '080104', channel: 'MINORISTA', business_type: 'BODEGA', zone_id: 'z3', price_list_id: 'pl2', payment_condition: 'CREDITO', credit_limit: 200, is_active: true, is_agent_retention: false, is_agent_perception: false, apply_igv: true },
];

const MOCK_PRICE_LISTS: PriceList[] = [
   { id: 'pl1', name: 'MAYORISTA', type: 'VARIATION', factor: 0.92 },
   { id: 'pl2', name: 'COBERTURA (BODEGAS)', type: 'BASE', factor: 1.0 },
   { id: 'pl3', name: 'HORECA (HOTELES/REST)', type: 'VARIATION', factor: 1.05 },
];

const MOCK_SELLERS: Seller[] = [
   { id: 'sel1', dni: '44556677', name: 'TOMAS LINARES', address: 'AV. SOL 123', phone: '987654321', is_active: true, price_list_id: 'pl2' },
   { id: 'sel2', dni: '77665544', name: 'JUAN PEREZ', address: 'JR. UNION 444', phone: '912345678', is_active: true, price_list_id: 'pl2' },
   { id: 'sel3', dni: '11223344', name: 'MARIA GOMEZ', address: 'URB. MAGISTERIAL', phone: '998877665', is_active: true, price_list_id: 'pl3' },
];

const MOCK_ZONES: Zone[] = [
   { id: 'z1', code: '0004', name: 'ZONA 4 - CUSCO CENTRO', assigned_seller_id: 'sel1' },
   { id: 'z2', code: '0005', name: 'ZONA 5 - WANCHAQ', assigned_seller_id: 'sel2' },
   { id: 'z3', code: '0006', name: 'ZONA 6 - SAN SEBASTIAN', assigned_seller_id: 'sel3' },
];

const MOCK_SALES: Sale[] = [
   { id: 's101', document_type: 'FACTURA', series: 'F001', number: '000101', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c4', client_name: 'LICORERIA EL PUNTO', client_ruc: '20501234123', client_address: 'CALLE MARURI 320', subtotal: 423.73, igv: 76.27, total: 500.00, balance: 500.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-01T10:00:00Z', items: [] },
   { id: 's102', document_type: 'BOLETA', series: 'B001', number: '000205', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c5', client_name: 'MARIA LOPEZ TIENDA', client_ruc: '23984567', client_address: 'AV. PARDO 567', subtotal: 127.12, igv: 22.88, total: 150.00, balance: 150.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-05T11:30:00Z', items: [] },
   { id: 's103', document_type: 'FACTURA', series: 'F001', number: '000112', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c6', client_name: 'REST. TURISTICO EL INKA', client_ruc: '20609876123', client_address: 'PLAZA DE ARMAS 100', subtotal: 1016.95, igv: 183.05, total: 1200.00, balance: 1200.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-10T14:00:00Z', items: [] },
   { id: 's104', document_type: 'FACTURA', series: 'F001', number: '000120', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c7', client_name: 'SUPERMERCADO ORIION', client_ruc: '20405678901', client_address: 'AV. GARCILASO 900', subtotal: 2542.37, igv: 457.63, total: 3000.00, balance: 3000.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-12T09:00:00Z', items: [] },
   { id: 's105', document_type: 'FACTURA', series: 'F001', number: '000125', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c9', client_name: 'DISCOTECA MYTHOLOGY', client_ruc: '20102030405', client_address: 'CALLE SUECIA 300', subtotal: 847.46, igv: 152.54, total: 1000.00, balance: 1000.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-15T22:00:00Z', items: [] },
   { id: 's106', document_type: 'FACTURA', series: 'F001', number: '000130', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c10', client_name: 'HOTEL MONASTERIO', client_ruc: '20556677889', client_address: 'CALLE PALACIO 136', subtotal: 4237.29, igv: 762.71, total: 5000.00, balance: 5000.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-18T08:00:00Z', items: [] },
   { id: 's107', document_type: 'FACTURA', series: 'F001', number: '000132', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c12', client_name: 'EVENTOS CUSCO SAC', client_ruc: '20601122334', client_address: 'URB. MAGISTERIAL G-5', subtotal: 1694.92, igv: 305.08, total: 2000.00, balance: 2000.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-20T16:00:00Z', items: [] },
   { id: 's108', document_type: 'BOLETA', series: 'B001', number: '000210', payment_method: 'CREDITO', payment_status: 'PENDING', collection_status: 'NONE', client_id: 'c13', client_name: 'JUANA ARCO', client_ruc: '23456789', client_address: 'APV. ENACE M-4', subtotal: 67.80, igv: 12.20, total: 80.00, balance: 80.00, status: 'completed', dispatch_status: 'delivered', created_at: '2024-03-22T10:00:00Z', items: [] },
];

const MOCK_USERS: User[] = [
   {
      id: 'u1', username: 'admin', password: '123456', name: 'Admin General', role: 'ADMIN', requires_attendance: false, is_active: true,
      permissions: ['dashboard', 'reports', 'kardex', 'sales', 'document-manager', 'print-batch', 'mobile-orders', 'order-processing', 'collection-consolidation', 'dispatch', 'dispatch-liquidation', 'cash-flow', 'users', 'attendance', 'purchases', 'products', 'clients', 'territory', 'suppliers', 'warehouses', 'logistics', 'company-settings', 'promo-manager', 'price-manager', 'virtual-store']
   },
   {
      id: 'u2', username: 'vendedor1', password: '123', name: 'Tomas Linares', role: 'SELLER', requires_attendance: true, is_active: true,
      permissions: ['sales', 'mobile-orders', 'clients', 'products', 'inventory']
   },
   {
      id: 'u3', username: 'almacen', password: '123', name: 'Jefe Almacén', role: 'WAREHOUSE', requires_attendance: true, is_active: true,
      permissions: ['products', 'inventory', 'dispatch', 'kardex', 'warehouses']
   },
   {
      id: 'u4', username: 'cliente', password: '123', name: 'JUAN CARLOS MAMANI', role: 'CLIENT', client_id: 'c3', requires_attendance: false, is_active: true, permissions: ['virtual-store']
   }
];

const MOCK_PROMOTIONS: Promotion[] = [
   { id: 'promo1', name: 'DESCUENTO RON CARTAVIO', type: 'PERCENTAGE_DISCOUNT', value: 10, product_ids: ['p2'], start_date: '2024-01-01', end_date: '2024-12-31', is_active: true, channels: ['IN_STORE'], allowed_seller_ids: [] },
];

const MOCK_COMBOS: Combo[] = [
   {
      id: 'combo1', name: 'PACK FIESTA', description: '1 Ron Cartavio + 2 Coca Cola (Simulada)', price: 40.00, is_active: true, start_date: '2024-01-01', end_date: '2024-12-31',
      items: [{ product_id: 'p2', quantity: 1, unit_type: 'UND' }],
      channels: ['IN_STORE', 'SELLER_APP'], allowed_seller_ids: []
   }
];

const MOCK_COMPANY: CompanyConfig = {
   ruc: '20601234567',
   name: 'DISTRIBUIDORA DEMO S.A.C.',
   address: 'AV. DE LA CULTURA 1000, CUSCO',
   logo_url: '', // Empty or a placeholder
   igv_percent: 18,
   currency_symbol: 'S/',
   email: 'contacto@distribuidora.com',
   phone: '084-234567',
   series: [
      { id: 's1', type: 'FACTURA', series: 'F001', current_number: 1520, is_active: true },
      { id: 's2', type: 'BOLETA', series: 'B001', current_number: 3450, is_active: true },
      { id: 's3', type: 'GUIA', series: 'T001', current_number: 120, is_active: true },
      { id: 's4', type: 'NOTA_CREDITO', series: 'NC01', current_number: 45, is_active: true },
   ]
};

interface AppState {
   company: CompanyConfig;
   products: Product[];
   batches: Batch[];
   sales: Sale[];
   orders: Order[];
   vehicles: Vehicle[];
   dispatchSheets: DispatchSheet[];
   dispatchLiquidations: DispatchLiquidation[];
   clients: Client[];
   suppliers: Supplier[];
   warehouses: Warehouse[];
   drivers: Driver[];
   transporters: Transporter[];
   sellers: Seller[];
   purchases: Purchase[];
   zones: Zone[];
   priceLists: PriceList[];
   users: User[];
   attendanceRecords: AttendanceRecord[];

   // Promos
   promotions: Promotion[];
   combos: Combo[];

   // Auth State
   currentUser: User | null;

   // Cash Flow State
   cashMovements: CashMovement[];
   expenseCategories: ExpenseCategory[];
   scheduledTransactions: ScheduledTransaction[];
   collectionRecords: CollectionRecord[];

   // Actions
   updateCompany: (config: Partial<CompanyConfig>) => void;
   updateSeries: (series: DocumentSeries) => void;

   addProduct: (product: Product) => void;
   updateProduct: (product: Product) => void;
   batchUpdateProductPrices: (updates: { id: string, price_unit: number, price_package: number, profit_margin: number }[]) => void;
   addBatch: (batch: Batch) => void;

   // Sales & Orders
   createSale: (sale: Sale) => void;
   createOrder: (order: Order) => void;
   updateOrder: (order: Order) => void;
   processOrderToSale: (orderId: string, series: string, number: string) => { success: boolean, msg: string };
   batchProcessOrders: (orderIds: string[]) => void;
   reportCollection: (saleId: string, sellerId: string, amount: number) => void;
   consolidateCollections: (recordIds: string[]) => void;

   createPurchase: (purchase: Purchase) => void;
   updatePurchase: (purchase: Purchase) => boolean;
   createDispatch: (dispatch: DispatchSheet) => void;
   updateSaleStatus: (saleIds: string[], status: Sale['dispatch_status']) => void;
   processDispatchLiquidation: (liquidation: DispatchLiquidation) => void;

   // Master Data Actions
   addClient: (client: Client) => void;
   updateClient: (client: Client) => void;
   batchUpdateClientZone: (clientIds: string[], zoneId: string) => void;
   addSupplier: (supplier: Supplier) => void;
   addWarehouse: (warehouse: Warehouse) => void;

   // Logistics Actions
   addDriver: (driver: Driver) => void;
   addTransporter: (transporter: Transporter) => void;
   addVehicle: (vehicle: Vehicle) => void;
   updateVehicle: (vehicle: Vehicle) => void;

   // Territory Actions
   addSeller: (seller: Seller) => void;
   updateSeller: (seller: Seller) => void;
   addZone: (zone: Zone) => void;

   // Pricing Actions
   addPriceList: (list: PriceList) => void;
   updatePriceList: (list: PriceList) => void;

   // Cash Flow Actions
   addCashMovement: (movement: CashMovement) => void;
   addExpenseCategory: (category: ExpenseCategory) => void;
   updateExpenseCategory: (category: ExpenseCategory) => void;
   deleteExpenseCategory: (id: string) => void;
   addScheduledTransaction: (tx: ScheduledTransaction) => void;
   updateScheduledTransaction: (tx: ScheduledTransaction) => void;
   processScheduledTransaction: (txId: string) => void;

   // User Actions
   addUser: (user: User) => void;
   updateUser: (user: User) => void;
   clockIn: (userId: string) => void;
   clockOut: (userId: string) => void;
   updateAttendanceRecord: (record: AttendanceRecord) => void;

   // Promo Actions
   addPromotion: (promo: Promotion) => void;
   updatePromotion: (promo: Promotion) => void;
   addCombo: (combo: Combo) => void;
   updateCombo: (combo: Combo) => void;

   // Auth Actions
   setCurrentUser: (userId: string) => void;
   logout: () => void;

   // Selectors/Helpers
   getBatchesForProduct: (productId: string) => Batch[];
}

export const useStore = create<AppState>((set, get) => ({
   company: MOCK_COMPANY,
   products: MOCK_PRODUCTS,
   batches: MOCK_BATCHES,
   sales: MOCK_SALES,
   orders: [],
   vehicles: [],
   dispatchSheets: [],
   dispatchLiquidations: [],
   clients: MOCK_CLIENTS,
   suppliers: [
      { id: 'sup1', name: 'DIAGEO PERU', ruc: '20123456789', address: 'LIMA' },
      { id: 'sup2', name: 'BACKUS Y JOHNSTON', ruc: '20100099999', address: 'LIMA' },
      { id: 'sup3', name: 'SANTIAGO QUEIROLO', ruc: '20555566666', address: 'LIMA' }
   ],
   warehouses: [{ id: 'wh1', name: 'ALMACEN PRINCIPAL', address: 'AV. CULTURA' }],
   drivers: [],
   transporters: [],
   sellers: MOCK_SELLERS,
   purchases: [],
   zones: MOCK_ZONES,
   priceLists: MOCK_PRICE_LISTS,
   cashMovements: [],
   expenseCategories: [],
   scheduledTransactions: [],
   users: MOCK_USERS,
   attendanceRecords: [],
   promotions: MOCK_PROMOTIONS,
   combos: MOCK_COMBOS,
   currentUser: null,
   collectionRecords: [],

   updateCompany: (config) => set((s) => ({ company: { ...s.company, ...config } })),
   updateSeries: (updatedSeries) => set((s) => ({
      company: {
         ...s.company,
         series: s.company.series.map(ser => ser.id === updatedSeries.id ? updatedSeries : ser)
      }
   })),

   addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
   updateProduct: (product) => set((state) => ({ products: state.products.map(p => p.id === product.id ? product : p) })),

   batchUpdateProductPrices: (updates) => set((state) => {
      const newProducts = state.products.map(p => {
         const update = updates.find(u => u.id === p.id);
         if (update) {
            return { ...p, price_unit: update.price_unit, price_package: update.price_package, profit_margin: update.profit_margin };
         }
         return p;
      });
      return { products: newProducts };
   }),

   addBatch: (batch) => set((state) => ({ batches: [...state.batches, batch] })),

   createSale: (sale) => set((state) => {
      // Basic implementation for direct sales
      const newBatches = [...state.batches];
      sale.items.forEach(item => {
         item.batch_allocations?.forEach(alloc => {
            const batchIndex = newBatches.findIndex(b => b.id === alloc.batch_id);
            if (batchIndex >= 0) {
               newBatches[batchIndex] = {
                  ...newBatches[batchIndex],
                  quantity_current: newBatches[batchIndex].quantity_current - alloc.quantity
               };
            }
         });
      });

      const finalSale = {
         ...sale,
         payment_status: sale.payment_method === 'CONTADO' ? 'PAID' : 'PENDING',
         collection_status: sale.payment_method === 'CONTADO' ? 'COLLECTED' : 'NONE',
         balance: sale.payment_method === 'CONTADO' ? 0 : sale.total
      } as Sale;

      return { sales: [finalSale, ...state.sales], batches: newBatches };
   }),

   // Updated createOrder with FIFO Allocation
   createOrder: (order) => set(s => {
      const newBatches = [...s.batches];

      // 1. Process allocations for each item in the order
      const processedItems: OrderItem[] = order.items.map(item => {
         let allocations: BatchAllocation[] = [];
         let comboSnapshot: any[] | undefined = undefined;

         if (item.unit_type === 'COMBO') {
            const combo = s.combos.find(c => c.id === item.product_id);
            if (!combo) return item;

            // Snapshot the current combo definition
            comboSnapshot = combo.items;

            // Iterate over combo components to allocate stock
            combo.items.forEach(comboItem => {
               const product = s.products.find(p => p.id === comboItem.product_id);
               if (!product) return;

               // Calculate total base units needed for this component
               // (Order Qty * Item Qty per Combo * Package Conversion if necessary)
               const itemFactor = comboItem.unit_type === 'PKG' ? (product.package_content || 1) : 1;
               const totalRequiredForComponent = item.quantity * comboItem.quantity * itemFactor;

               // Find batches for this component
               const availableBatches = newBatches
                  .filter(b => b.product_id === comboItem.product_id && b.quantity_current > 0)
                  .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

               let remaining = totalRequiredForComponent;

               for (const b of availableBatches) {
                  if (remaining <= 0) break;
                  const take = Math.min(remaining, b.quantity_current);

                  const batchIndex = newBatches.findIndex(x => x.id === b.id);
                  if (batchIndex >= 0) {
                     newBatches[batchIndex] = {
                        ...newBatches[batchIndex],
                        quantity_current: newBatches[batchIndex].quantity_current - take
                     };
                  }
                  allocations.push({ batch_id: b.id, batch_code: b.code, quantity: take });
                  remaining -= take;
               }
            });

         } else {
            // Normal Product Logic
            const product = s.products.find(p => p.id === item.product_id);
            if (!product) return item;

            const conversionFactor = item.unit_type === 'PKG' ? (product.package_content || 1) : 1;
            const requiredBase = item.quantity * conversionFactor;

            const availableBatches = newBatches
               .filter(b => b.product_id === item.product_id && b.quantity_current > 0)
               .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

            let remaining = requiredBase;

            for (const b of availableBatches) {
               if (remaining <= 0) break;
               const take = Math.min(remaining, b.quantity_current);

               const batchIndex = newBatches.findIndex(x => x.id === b.id);
               if (batchIndex >= 0) {
                  newBatches[batchIndex] = {
                     ...newBatches[batchIndex],
                     quantity_current: newBatches[batchIndex].quantity_current - take
                  };
               }

               allocations.push({ batch_id: b.id, batch_code: b.code, quantity: take });
               remaining -= take;
            }
         }

         return { ...item, batch_allocations: allocations, combo_snapshot: comboSnapshot };
      });

      // 2. Return new state with updated batches and the order containing allocations
      return {
         orders: [{ ...order, items: processedItems }, ...s.orders],
         batches: newBatches
      };
   }),

   updateOrder: (order) => set(s => ({ orders: s.orders.map(o => o.id === order.id ? order : o) })),

   processOrderToSale: (orderId, series, number) => {
      // Single process fallback - better use batchProcessOrders
      return { success: true, msg: 'Use procesamiento masivo' };
   },

   // === UPDATED: BATCH PROCESS ORDERS (ROBUST VERSION) ===
   batchProcessOrders: (orderIds) => set(s => {
      const selectedOrders = s.orders.filter(o => orderIds.includes(o.id));
      if (selectedOrders.length === 0) return s;

      // Sort by creation date to assign series in order
      selectedOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const newSales: Sale[] = [];
      const updatedOrders = [...s.orders];
      // Clone series to increment them correctly
      const currentSeriesState = s.company.series.map(ser => ({ ...ser }));

      selectedOrders.forEach(order => {
         // Robust Doc Type determination from Order Snapshot
         const ruc = order.client_doc_number || '';
         const docType = ruc.length === 11 ? 'FACTURA' : 'BOLETA';

         // Find series config
         const seriesObj = currentSeriesState.find(ser => ser.type === docType && ser.is_active);
         const seriesStr = seriesObj ? seriesObj.series : (docType === 'FACTURA' ? 'F001' : 'B001');

         // Increment Number
         const nextNum = seriesObj ? seriesObj.current_number + 1 : 1;
         const numberStr = String(nextNum).padStart(8, '0');

         // Update local series state for next iteration
         if (seriesObj) seriesObj.current_number = nextNum;

         // Try to enrich client address if missing from order snapshot
         let address = order.client_address || '';
         if (!address) {
            const client = s.clients.find(c => c.id === order.client_id || c.doc_number === order.client_doc_number);
            address = client?.address || '';
         }

         // Map Order Items to Sale Items (Transferring Allocations)
         const saleItems: SaleItem[] = order.items.map(item => {
            const product = s.products.find(p => p.id === item.product_id);
            const factor = item.unit_type === 'PKG' ? (product?.package_content || 1) : 1;
            const requiredBase = item.quantity * factor;

            // Calculate values
            const itemSubtotal = item.total_price / 1.18;
            const saleItem: SaleItem = {
               id: generateUUID(),
               product_id: item.product_id,
               product_sku: product?.sku || 'UNK',
               product_name: item.product_name,
               selected_unit: item.unit_type,
               quantity_presentation: item.quantity,
               quantity_base: requiredBase,
               unit_price: item.unit_price,
               total_price: item.total_price,
               discount_percent: 0,
               discount_amount: 0,
               is_bonus: false,
               batch_allocations: item.batch_allocations || []
            };
            return saleItem;
         });

         const saleSubtotal = order.total / 1.18;
         const saleIgv = order.total - saleSubtotal;

         const newSale: Sale = {
            id: generateUUID(),
            document_type: docType,
            series: seriesStr,
            number: numberStr,
            payment_method: order.payment_method,
            payment_status: 'PENDING',
            collection_status: 'NONE',
            client_id: order.client_id,
            client_name: order.client_name,
            client_ruc: order.client_doc_number,
            client_address: address,
            subtotal: saleSubtotal,
            igv: saleIgv,
            total: order.total,
            balance: order.total,
            status: 'completed',
            dispatch_status: 'pending',
            created_at: new Date().toISOString(),
            items: saleItems,
            origin_order_id: order.id
         };
         newSales.push(newSale);

         // Mark order processed
         const orderIndex = updatedOrders.findIndex(o => o.id === order.id);
         if (orderIndex >= 0) {
            updatedOrders[orderIndex] = { ...updatedOrders[orderIndex], status: 'processed' };
         }
      });

      return {
         sales: [...newSales, ...s.sales],
         orders: updatedOrders,
         company: {
            ...s.company,
            series: currentSeriesState
         }
      };
   }),

   // ... (Rest of actions unchanged)
   reportCollection: (saleId, sellerId, amount) => set(s => {
      const sale = s.sales.find(x => x.id === saleId);
      if (!sale) return s;

      const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
      const newBalance = Math.max(0, currentBalance - amount);

      const isPaidOff = newBalance < 0.1;
      const newStatus = isPaidOff ? 'REPORTED' : 'PARTIAL';

      const updatedSales = s.sales.map(item => item.id === saleId ? {
         ...item,
         collection_status: newStatus,
         balance: newBalance
      } : item);

      const newRecord: CollectionRecord = {
         id: generateUUID(),
         sale_id: sale.id,
         seller_id: sellerId,
         client_name: sale.client_name,
         document_ref: `${sale.series}-${sale.number}`,
         amount_reported: amount,
         date_reported: new Date().toISOString(),
         status: 'PENDING_VALIDATION',
         payment_method: 'CASH'
      };

      return {
         sales: updatedSales as Sale[],
         collectionRecords: [...s.collectionRecords, newRecord]
      };
   }),

   consolidateCollections: (recordIds) => set(s => {
      const selectedRecords = s.collectionRecords.filter(r => recordIds.includes(r.id));
      if (selectedRecords.length === 0) return s;

      const updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];
      const sellerNamesSet = new Set<string>();
      let totalTotal = 0;

      selectedRecords.forEach(rec => {
         const recIndex = updatedRecords.findIndex(r => r.id === rec.id);
         if (recIndex > -1) updatedRecords[recIndex] = { ...rec, status: 'VALIDATED' };

         const saleIndex = updatedSales.findIndex(sale => sale.id === rec.sale_id);
         if (saleIndex > -1) {
            const sale = updatedSales[saleIndex];
            if (sale.collection_status === 'REPORTED') {
               updatedSales[saleIndex] = {
                  ...sale,
                  payment_status: 'PAID',
                  collection_status: 'COLLECTED'
               };
            }
         }

         const seller = s.sellers.find(sel => sel.id === rec.seller_id);
         if (seller) sellerNamesSet.add(seller.name);
         totalTotal += rec.amount_reported;
      });

      const sellerNames = Array.from(sellerNamesSet).map(n => n.split(' ')[0]).join(', ');
      const newMovement: CashMovement = {
         id: generateUUID(),
         type: 'INCOME',
         category_name: 'COBRANZA MASIVA',
         description: `Planilla de Cobranza - Vendedores: ${sellerNames} cobranzas del dia`,
         amount: totalTotal,
         date: new Date().toISOString(),
         user_id: 'ADMIN'
      };

      return {
         collectionRecords: updatedRecords,
         sales: updatedSales,
         cashMovements: [newMovement, ...s.cashMovements]
      };
   }),

   createPurchase: (purchase) => set((state) => {
      const newBatches = [...state.batches];
      const newProducts = [...state.products];

      purchase.items.forEach(item => {
         newBatches.push({
            id: crypto.randomUUID(),
            product_id: item.product_id,
            purchase_id: purchase.id,
            code: item.batch_code,
            quantity_initial: item.quantity_base,
            quantity_current: item.quantity_base,
            cost: item.unit_price,
            expiration_date: item.expiration_date,
            created_at: new Date().toISOString()
         });

         if (!item.is_bonus) {
            const prodIndex = newProducts.findIndex(p => p.id === item.product_id);
            if (prodIndex >= 0) {
               const grossUnitCost = item.unit_price / item.factor;
               newProducts[prodIndex] = {
                  ...newProducts[prodIndex],
                  last_cost: Number(grossUnitCost.toFixed(4))
               };
            }
         }
      });

      return { purchases: [purchase, ...state.purchases], batches: newBatches, products: newProducts };
   }),

   updatePurchase: (purchase) => true,

   createDispatch: (dispatch) => set((state) => ({ dispatchSheets: [dispatch, ...state.dispatchSheets] })),
   updateSaleStatus: (saleIds, status) => set((state) => ({
      sales: state.sales.map(s => saleIds.includes(s.id) ? { ...s, dispatch_status: status } : s)
   })),

   processDispatchLiquidation: (liquidation) => set(s => ({ dispatchLiquidations: [liquidation, ...s.dispatchLiquidations] })),

   getBatchesForProduct: (productId) => {
      return get().batches
         .filter(b => b.product_id === productId && b.quantity_current > 0)
         .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
   },

   addClient: (c) => set(s => ({ clients: [...s.clients, c] })),
   updateClient: (c) => set(s => ({ clients: s.clients.map(client => client.id === c.id ? c : client) })),
   batchUpdateClientZone: (clientIds, zoneId) => set(s => ({
      clients: s.clients.map(c => clientIds.includes(c.id) ? { ...c, zone_id: zoneId } : c)
   })),
   addSupplier: (s) => set(state => ({ suppliers: [...state.suppliers, s] })),
   addWarehouse: (w) => set(s => ({ warehouses: [...s.warehouses, w] })),

   addDriver: (d) => set(s => ({ drivers: [...s.drivers, d] })),
   addTransporter: (t) => set(s => ({ transporters: [...s.transporters, t] })),
   addVehicle: (vehicle) => set(s => ({ vehicles: [...s.vehicles, vehicle] })),
   updateVehicle: (vehicle) => set(s => ({ vehicles: s.vehicles.map(veh => veh.id === vehicle.id ? vehicle : veh) })),

   addSeller: (seller) => set(s => ({ sellers: [...s.sellers, seller] })),
   updateSeller: (seller) => set(s => ({ sellers: s.sellers.map(sel => sel.id === seller.id ? seller : sel) })),
   addZone: (zone) => set(s => ({ zones: [...s.zones, zone] })),

   addPriceList: (list) => set(s => ({ priceLists: [...s.priceLists, list] })),
   updatePriceList: (list) => set(s => ({ priceLists: s.priceLists.map(l => l.id === list.id ? list : l) })),

   addCashMovement: (m) => set(s => ({ cashMovements: [m, ...s.cashMovements] })),
   addExpenseCategory: (c) => set(s => ({ expenseCategories: [...s.expenseCategories, c] })),
   updateExpenseCategory: (c) => set(s => ({ expenseCategories: s.expenseCategories.map(cat => cat.id === c.id ? c : cat) })),
   deleteExpenseCategory: (id) => set(s => ({ expenseCategories: s.expenseCategories.filter(c => c.id !== id) })),

   addScheduledTransaction: (tx) => set(s => ({ scheduledTransactions: [...s.scheduledTransactions, tx] })),
   updateScheduledTransaction: (tx) => set(s => ({ scheduledTransactions: s.scheduledTransactions.map(t => t.id === tx.id ? tx : t) })),
   processScheduledTransaction: (txId) => { },

   addUser: (user) => set(s => ({ users: [...s.users, user] })),
   updateUser: (user) => set(s => {
      const currentUser = s.currentUser?.id === user.id ? user : s.currentUser;
      return {
         users: s.users.map(u => u.id === user.id ? user : u),
         currentUser
      };
   }),
   clockIn: (userId) => { },
   clockOut: (userId) => { },
   updateAttendanceRecord: (record) => { },

   addPromotion: (p) => set(s => ({ promotions: [...s.promotions, p] })),
   updatePromotion: (p) => set(s => ({ promotions: s.promotions.map(x => x.id === p.id ? p : x) })),
   addCombo: (c) => set(s => ({ combos: [...s.combos, c] })),
   updateCombo: (c) => set(s => ({ combos: s.combos.map(x => x.id === c.id ? c : x) })),

   setCurrentUser: (userId) => set(s => ({
      currentUser: s.users.find(u => u.id === userId) || null
   })),

   logout: () => set(() => ({ currentUser: null }))
}));

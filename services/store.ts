import { create } from 'zustand';
import { Product, Batch, Sale, Vehicle, DispatchSheet, Client, Supplier, Warehouse, Driver, Transporter, Purchase, Zone, PriceList, Seller, Order, SaleItem, BatchAllocation, CompanyConfig, DocumentSeries, CashMovement, ExpenseCategory, ScheduledTransaction, DispatchLiquidation, User, AttendanceRecord, Promotion, Combo, CollectionRecord, CollectionPlanilla, OrderItem, AutoPromotion, Quota } from '../types';
import { calculatePromotions } from '../utils/promotions';

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

const extractUniqueValues = (products: Product[], key: keyof Product): string[] => {
   return Array.from(new Set(products.map(p => String(p[key] || '')).filter(Boolean))).sort();
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
   { id: 'c1', code: 'CL-001', doc_type: 'RUC', doc_number: '20601234567', name: 'DISTRIBUIDORA SANTA ROSA SAC', is_person: false, address: 'AV. LA CULTURA 200', branches: ['SUCURSAL SAN SEBASTIAN', 'ALMACEN PRINCIPAL'], ubigeo: '080101', channel: 'MAYORISTA', business_type: 'DISTRIBUIDORA', zone_id: 'z1', price_list_id: 'pl1', payment_condition: 'CREDITO', credit_limit: 5000, is_active: true, is_agent_retention: false, is_agent_perception: true, apply_igv: true },
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
      permissions: ['dashboard', 'advanced-orders', 'reports', 'kardex', 'sales', 'credit-notes', 'document-manager', 'print-batch', 'mobile-orders', 'mobile-delivery', 'order-processing', 'collection-consolidation', 'dispatch', 'dispatch-liquidation', 'cash-flow', 'users', 'attendance', 'purchases', 'products', 'clients', 'territory', 'suppliers', 'warehouses', 'logistics', 'company-settings', 'promo-manager', 'price-manager', 'virtual-store', 'sunat-manager', 'accounting-reports', 'quota-manager']
   },
   {
      id: 'u2', username: 'vendedor1', password: '123', name: 'Tomas Linares', role: 'SELLER', requires_attendance: true, is_active: true,
      permissions: ['sales', 'advanced-orders', 'mobile-orders', 'clients', 'products', 'inventory']
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
      channels: ['IN_STORE', 'SELLER_APP'], allowed_seller_ids: [],
      target_client_categories: [], target_price_list_ids: []
   }
];

const MOCK_AUTO_PROMOTIONS: AutoPromotion[] = [
   {
      id: 'apromo1', name: 'BONIF. CUSQUEÑA', description: 'Por la compra de 24 und, llévate 2 und gratis.',
      is_active: true, start_date: '2024-01-01', end_date: '2024-12-31',
      condition_type: 'BUY_X_PRODUCT', condition_product_id: 'p4', condition_amount: 24,
      reward_product_id: 'p4', reward_quantity: 2, reward_unit_type: 'UND',
      channels: ['IN_STORE', 'SELLER_APP'], target_client_categories: [], target_price_list_ids: []
   }
];

const MOCK_ORDERS: Order[] = [
   {
      id: generateUUID(),
      code: 'PED-1001',
      client_id: 'c1',
      client_name: 'BODEGA LAS PALMERAS',
      client_doc_number: '20123456780', // RUC -> FACTURA
      client_doc_type: 'RUC',
      seller_id: 'u2',
      payment_method: 'CONTADO',
      status: 'pending',
      total: 240.00,
      suggested_document_type: 'FACTURA',
      created_at: new Date(Date.now() - 100000).toISOString(),
      delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [
         { product_id: 'p4', product_name: 'CERVEZA CUSQUEÑA TRIGO * 330 ML', unit_price: 5.00, quantity: 48, total_price: 240.00, unit_type: 'UND', is_bonus: false, batch_allocations: [] },
         { product_id: 'p4', product_name: 'CERVEZA CUSQUEÑA TRIGO * 330 ML', unit_price: 0, quantity: 4, total_price: 0, unit_type: 'UND', is_bonus: true, batch_allocations: [] }
      ]
   },
   {
      id: generateUUID(),
      code: 'PED-1002',
      client_id: 'c2',
      client_name: 'MINIMARKET EL SOL',
      client_doc_number: '70123456', // DNI -> BOLETA
      client_doc_type: 'DNI',
      seller_id: 'u2',
      payment_method: 'CREDITO',
      status: 'pending',
      total: 69.80,
      suggested_document_type: 'BOLETA',
      created_at: new Date(Date.now() - 50000).toISOString(),
      delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [
         { product_id: 'p1', product_name: 'WHISKY JOHNNIE WALKER RED LABEL * 750 ML', unit_price: 69.80, quantity: 1, total_price: 69.80, unit_type: 'UND', is_bonus: false, batch_allocations: [] }
      ]
   },
   {
      id: generateUUID(), code: 'PED-1003', client_id: 'c3', client_name: 'COMERCIAL ROSITA', client_doc_number: '20555555551', client_doc_type: 'RUC', seller_id: 'u3', payment_method: 'CONTADO', status: 'pending', total: 53.00, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 40000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p3', product_name: 'VODKA RUSSKAYA * 750 ML', unit_price: 23.00, quantity: 2, total_price: 46.00, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1004', client_id: 'c1', client_name: 'BODEGA LAS PALMERAS', client_doc_number: '20123456780', client_doc_type: 'RUC', seller_id: 'u3', payment_method: 'CREDITO', status: 'pending', total: 107.40, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 35000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p4', product_name: 'CERVEZA CUSQUEÑA TRIGO * 330 ML', unit_price: 5.37, quantity: 20, total_price: 107.40, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1005', client_id: 'c2', client_name: 'MINIMARKET EL SOL', client_doc_number: '70123456', client_doc_type: 'DNI', seller_id: 'u1', payment_method: 'CONTADO', status: 'pending', total: 27.95, suggested_document_type: 'BOLETA', created_at: new Date(Date.now() - 30000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p2', product_name: 'RON CARTAVIO BLACK * 750 ML', unit_price: 27.95, quantity: 1, total_price: 27.95, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1006', client_id: 'c3', client_name: 'COMERCIAL ROSITA', client_doc_number: '20555555551', client_doc_type: 'RUC', seller_id: 'u1', payment_method: 'CREDITO', status: 'pending', total: 69.80, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 25000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p1', product_name: 'WHISKY JOHNNIE WALKER RED LABEL * 750 ML', unit_price: 69.80, quantity: 1, total_price: 69.80, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1007', client_id: 'c1', client_name: 'BODEGA LAS PALMERAS', client_doc_number: '20123456780', client_doc_type: 'RUC', seller_id: 'u2', payment_method: 'CONTADO', status: 'pending', total: 23.00, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 20000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p3', product_name: 'VODKA RUSSKAYA * 750 ML', unit_price: 23.00, quantity: 1, total_price: 23.00, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1008', client_id: 'c2', client_name: 'MINIMARKET EL SOL', client_doc_number: '70123456', client_doc_type: 'DNI', seller_id: 'u2', payment_method: 'CREDITO', status: 'pending', total: 53.70, suggested_document_type: 'BOLETA', created_at: new Date(Date.now() - 15000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p4', product_name: 'CERVEZA CUSQUEÑA TRIGO * 330 ML', unit_price: 5.37, quantity: 10, total_price: 53.70, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1009', client_id: 'c3', client_name: 'COMERCIAL ROSITA', client_doc_number: '20555555551', client_doc_type: 'RUC', seller_id: 'u3', payment_method: 'CONTADO', status: 'pending', total: 69.80, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 10000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p1', product_name: 'WHISKY JOHNNIE WALKER RED LABEL * 750 ML', unit_price: 69.80, quantity: 1, total_price: 69.80, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
   },
   {
      id: generateUUID(), code: 'PED-1010', client_id: 'c1', client_name: 'BODEGA LAS PALMERAS', client_doc_number: '20123456780', client_doc_type: 'RUC', seller_id: 'u1', payment_method: 'CREDITO', status: 'pending', total: 27.95, suggested_document_type: 'FACTURA', created_at: new Date(Date.now() - 5000).toISOString(), delivery_date: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product_id: 'p2', product_name: 'RON CARTAVIO BLACK * 750 ML', unit_price: 27.95, quantity: 1, total_price: 27.95, unit_type: 'UND', is_bonus: false, batch_allocations: [] }]
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
      { id: 's5', type: 'PEDIDO', series: 'PE01', current_number: 1, is_active: true },
      { id: 's6', type: 'PEDIDO', series: 'PE04', current_number: 1, is_active: true },
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

   // Promos & Quotas
   promotions: Promotion[];
   combos: Combo[];
   autoPromotions: AutoPromotion[];
   quotas: Quota[];

   // Classifications
   categories: string[];
   subcategories: string[];
   brands: string[];
   unitTypes: string[];
   packageTypes: string[];

   // Auth State
   currentUser: User | null;
   deliveryMode: 'REGULAR' | 'EXPRESS_MISMO_DIA'; // Added for order type context

   // Cash Flow State
   cashMovements: CashMovement[];
   expenseCategories: ExpenseCategory[];
   scheduledTransactions: ScheduledTransaction[];
   collectionRecords: CollectionRecord[];
   collectionPlanillas: CollectionPlanilla[];
   cashSessions: import('../types').CashRegisterSession[];
   currentCashSession: import('../types').CashRegisterSession | null;

   // Actions
   updateCompany: (config: Partial<CompanyConfig>) => void;
   updateSeries: (series: DocumentSeries) => void;
   addSeries: (series: DocumentSeries) => void;    // NEW
   removeSeries: (seriesId: string) => void;       // NEW
   getNextDocumentNumber: (type: DocumentSeries['type'], seriesStr?: string) => { series: string, number: string } | null; // NEW

   // Classification Actions
   addCategory: (category: string) => void;
   addSubcategory: (subcategory: string) => void;
   addBrand: (brand: string) => void;
   addUnitType: (unitType: string) => void;
   addPackageType: (packageType: string) => void;

   addProduct: (product: Product) => void;
   updateProduct: (product: Product) => void;
   batchUpdateProductPrices: (updates: { id: string, price_unit: number, price_package: number, profit_margin: number }[]) => void;
   addBatch: (batch: Batch) => void;

   // Sales & Orders
   createSale: (sale: Sale) => void;
   createCreditNote: (creditNote: Sale, originalSaleId: string, returnedItems: SaleItem[]) => void;
   createOrder: (order: Order) => void;
   updateOrder: (order: Order) => void;
   batchProcessOrders: (orderIds: string[], targetSeries?: { FACTURA?: string, BOLETA?: string }) => void;
   reportCollection: (saleId: string, sellerId: string, amount: number) => void;
   consolidateCollections: (recordIds: string[], userId?: string, metadata?: { editPlanillaId?: string, editPlanillaCode?: string }) => void;
   manualLiquidation: (payments: { saleId: string, amount: number }[], userId?: string, metadata?: { date: string, glosa: string, editPlanillaId?: string, editPlanillaCode?: string }) => void;
   annulCollectionPlanilla: (planillaId: string, userId: string) => void;
   revertPlanillaForEdit: (planillaId: string) => void;
   removeRecordFromPlanilla: (planillaId: string, recordId: string) => void;

   createPurchase: (purchase: Purchase) => void;
   updatePurchase: (purchase: Purchase, userId?: string) => { success: boolean; msg: string };
   addPurchasePayment: (purchaseId: string, payment: Omit<import('../types').PurchasePayment, 'id'>, userId: string) => void;
   createDispatch: (dispatch: DispatchSheet) => void;
   updateDispatch: (dispatchId: string, updates: Partial<DispatchSheet>) => void;
   updateDispatchStatus: (dispatchId: string, status: DispatchSheet['status']) => void;
   updateSaleStatus: (saleIds: string[], status: Sale['dispatch_status']) => void;
   updateSaleDeliveryStatus: (saleId: string, status: Sale['dispatch_status'], details?: { reason?: string; photo?: string; location?: { lat: number; lng: number } }) => void;
   updateSunatStatus: (type: 'sale' | 'dispatch', id: string, status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTED', message?: string) => void;
   processDispatchLiquidation: (liquidation: DispatchLiquidation) => void;
   markDocumentsAsPrinted: (saleIds: string[]) => void;
   generateGuiasFromSales: (saleIds: string[], transporterId: string, driverId: string, vehicleId: string) => void;

   // Auditory and Modifications
   addSaleHistoryEvent: (saleId: string, event: import('../types').SaleHistoryEvent) => void;
   returnItemsToKardex: (items: SaleItem[]) => void;
   updateSaleDetailed: (updatedSale: Sale, originalSale: Sale, userId: string) => { success: boolean, msg: string };
   changeSaleDocumentType: (saleId: string, newType: 'FACTURA' | 'BOLETA', userId: string) => { success: boolean, msg: string, newSale?: Sale };
   revertDispatchLiquidation: (liquidationId: string, userId: string) => { success: boolean, msg: string };

   // Master Data Actions
   addClient: (Client) => void;
   updateClient: (Client) => void;
   batchUpdateClientZone: (clientIds: string[], zoneId: string) => void;
   addSupplier: (Supplier) => void;
   addWarehouse: (Warehouse) => void;

   // Logistics Actions
   addDriver: (Driver) => void;
   addTransporter: (Transporter) => void;
   addVehicle: (Vehicle) => void;
   updateVehicle: (Vehicle) => void;

   // Territory Actions
   addSeller: (Seller) => void;
   updateSeller: (Seller) => void;
   addZone: (Zone) => void;

   // Pricing Actions
   addPriceList: (PriceList) => void;
   updatePriceList: (PriceList) => void;

   // Cash Flow Actions
   addCashMovement: (CashMovement) => void;
   updateCashMovement: (CashMovement) => void;
   deleteCashMovement: (id: string) => void;
   addExpenseCategory: (ExpenseCategory) => void;
   updateExpenseCategory: (ExpenseCategory) => void;
   deleteExpenseCategory: (id: string) => void;
   addScheduledTransaction: (ScheduledTransaction) => void;
   updateScheduledTransaction: (ScheduledTransaction) => void;
   deleteScheduledTransaction: (id: string) => void;
   processScheduledTransaction: (txId: string, userId: string) => void;
   openCashSession: (amount: number, userId: string) => void;
   closeCashSession: (sessionId: string, details: Omit<import('../types').CashRegisterSession, 'id' | 'open_time' | 'opened_by' | 'status' | 'system_opening_amount' | 'system_income' | 'system_expense' | 'system_expected_close' | 'difference'>, userId: string) => void;

   // User Actions
   addUser: (User) => void;
   updateUser: (User) => void;
   clockIn: (userId: string, photo?: string, location?: { lat: number, lng: number }) => void;
   clockOut: (userId: string, photo?: string, location?: { lat: number, lng: number }) => void;
   updateAttendanceRecord: (AttendanceRecord) => void;

   // Promo Actions
   addPromotion: (Promotion) => void;
   updatePromotion: (Promotion) => void;
   addCombo: (Combo) => void;
   updateCombo: (Combo) => void;
   addAutoPromotion: (AutoPromotion) => void;
   updateAutoPromotion: (AutoPromotion) => void;

   // Quota Actions
   addQuota: (Quota) => void;
   updateQuota: (Quota) => void;
   deleteQuota: (id: string) => void;
   batchUpdateQuotas: (quotas: Quota[]) => void;



   // Auth Actions
   setCurrentUser: (userId: string) => void;
   logout: () => void;
   setDeliveryMode: (mode: 'REGULAR' | 'EXPRESS_MISMO_DIA') => void; // Added for order type

   // Selectors/Helpers
   getBatchesForProduct: (productId: string) => Batch[];
}

export const useStore = create<AppState>((set, get) => ({
   company: MOCK_COMPANY,
   products: MOCK_PRODUCTS,
   batches: MOCK_BATCHES,
   sales: MOCK_SALES,
   orders: MOCK_ORDERS,
   vehicles: [
      { id: 'v1', plate: 'X2A-987', brand: 'HINO', model: '300', capacity_kg: 5000, transporter_id: 't1', driver_id: 'd1' }
   ],
   dispatchSheets: [],
   dispatchLiquidations: [],
   clients: MOCK_CLIENTS,
   suppliers: [
      { id: 'sup1', name: 'DIAGEO PERU', ruc: '20123456789', address: 'LIMA' },
      { id: 'sup2', name: 'BACKUS Y JOHNSTON', ruc: '20100099999', address: 'LIMA' },
      { id: 'sup3', name: 'SANTIAGO QUEIROLO', ruc: '20555566666', address: 'LIMA' }
   ],
   warehouses: [{ id: 'wh1', name: 'ALMACEN PRINCIPAL', address: 'AV. CULTURA' }],
   drivers: [
      { id: 'd1', dni: '45678912', license: 'A-IIIc', name: 'JUAN CHOFER', address: 'AV. CULTURA 123', phone: '987654321' }
   ],
   transporters: [
      { id: 't1', ruc: '20601234568', name: 'LOGISTICA CUSCO EIRL', address: 'CUSCO' }
   ],
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
   quotas: [],

   // Classifications initial state
   categories: extractUniqueValues(MOCK_PRODUCTS, 'category'),
   subcategories: extractUniqueValues(MOCK_PRODUCTS, 'subcategory'),
   brands: extractUniqueValues(MOCK_PRODUCTS, 'brand'),
   unitTypes: extractUniqueValues(MOCK_PRODUCTS, 'unit_type'),
   packageTypes: extractUniqueValues(MOCK_PRODUCTS, 'package_type'),
   combos: MOCK_COMBOS,
   autoPromotions: MOCK_AUTO_PROMOTIONS,
   currentUser: null,
   deliveryMode: 'REGULAR', // Default to REGULAR
   collectionRecords: [],
   collectionPlanillas: [],
   cashSessions: [],
   currentCashSession: null,

   updateCompany: (config) => set((s) => ({ company: { ...s.company, ...config } })),

   updateSeries: (updatedSeries) => set((s) => ({
      company: {
         ...s.company,
         series: s.company.series.map(ser => ser.id === updatedSeries.id ? updatedSeries : ser)
      }
   })),

   addSeries: (newSeries) => set((s) => ({
      company: {
         ...s.company,
         series: [...s.company.series, newSeries]
      }
   })),

   removeSeries: (seriesId) => set((s) => ({
      company: {
         ...s.company,
         series: s.company.series.filter(ser => ser.id !== seriesId)
      }
   })),

   getNextDocumentNumber: (type, seriesStr) => {
      const state = get();
      // Find the specific series, or the first active one of that type
      const seriesObj = seriesStr
         ? state.company.series.find(s => s.type === type && s.series === seriesStr)
         : state.company.series.find(s => s.type === type && s.is_active);

      if (!seriesObj) return null;

      // Increment in state
      const nextNum = seriesObj.current_number + 1;

      // Update state synchronously without replacing the whole object tree immediately (Zustand will handle it)
      set(s => ({
         company: {
            ...s.company,
            series: s.company.series.map(ser =>
               ser.id === seriesObj.id ? { ...ser, current_number: nextNum } : ser
            )
         }
      }));

      return {
         series: seriesObj.series,
         number: String(nextNum).padStart(8, '0')
      };
   },   // Classification Actions
   addCategory: (category: string) => set((state) => ({ categories: Array.from(new Set([...state.categories, category])).sort() })),
   addSubcategory: (subcategory: string) => set((state) => ({ subcategories: Array.from(new Set([...state.subcategories, subcategory])).sort() })),
   addBrand: (brand: string) => set((state) => ({ brands: Array.from(new Set([...state.brands, brand])).sort() })),
   addUnitType: (unitType: string) => set((state) => ({ unitTypes: Array.from(new Set([...state.unitTypes, unitType])).sort() })),
   addPackageType: (packageType: string) => set((state) => ({ packageTypes: Array.from(new Set([...state.packageTypes, packageType])).filter(Boolean).sort() })),


   addProduct: (product) => set((state) => ({
      products: [...state.products, product],
      categories: Array.from(new Set([...state.categories, product.category])).filter(Boolean).sort(),
      subcategories: Array.from(new Set([...state.subcategories, product.subcategory])).filter(Boolean).sort(),
      brands: Array.from(new Set([...state.brands, product.brand])).filter(Boolean).sort(),
      unitTypes: Array.from(new Set([...state.unitTypes, product.unit_type])).filter(Boolean).sort(),
      packageTypes: Array.from(new Set([...state.packageTypes, product.package_type || ''])).filter(Boolean).sort(),
   })),
   updateProduct: (product) => set((state) => ({
      products: state.products.map(p => p.id === product.id ? product : p),
      categories: Array.from(new Set([...state.categories, product.category])).filter(Boolean).sort(),
      subcategories: Array.from(new Set([...state.subcategories, product.subcategory])).filter(Boolean).sort(),
      brands: Array.from(new Set([...state.brands, product.brand])).filter(Boolean).sort(),
      unitTypes: Array.from(new Set([...state.unitTypes, product.unit_type])).filter(Boolean).sort(),
      packageTypes: Array.from(new Set([...state.packageTypes, product.package_type || ''])).filter(Boolean).sort(),
   })),

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

      // Auto-recalculate promos to ensure data integrity
      // Since sale.items are SaleItem[], we temporarily map to OrderItem structure for calculatePromotions
      // and map back. In a real scenario, calculatePromotions might be generalized.
      const orderItemsContent: OrderItem[] = sale.items.map(i => ({
         product_id: i.product_id,
         product_name: i.product_name,
         unit_type: i.selected_unit === 'UND' || i.selected_unit === 'PKG' ? i.selected_unit : 'UND',
         quantity: i.quantity_presentation,
         unit_price: i.unit_price,
         total_price: i.total_price,
         is_promo: i.is_bonus,
         auto_promo_id: i.auto_promo_id,
         discount_percent: i.discount_percent,
         discount_amount: i.discount_amount
      }));

      const validatedItems = calculatePromotions(orderItemsContent, state.autoPromotions, state.products);

      // Map back to SaleItem (combining with original IDs if possible)
      sale.items = validatedItems.map((vi, idx) => {
         const originalItem = sale.items.find(si => si.product_id === vi.product_id && (si.selected_unit === vi.unit_type || (si.selected_unit !== 'UND' && si.selected_unit !== 'PKG')));
         return {
            id: originalItem ? originalItem.id : generateUUID(),
            product_id: vi.product_id,
            product_sku: originalItem?.product_sku || 'PROMO',
            product_name: vi.product_name,
            selected_unit: (vi.unit_type === 'UND' || vi.unit_type === 'PKG') ? vi.unit_type : 'UND', // Fallback for promos which might not have COMBO type legally in SaleItem
            quantity_presentation: vi.quantity,
            quantity_base: vi.quantity * (vi.unit_type === 'PKG' ? (state.products.find(p => p.id === vi.product_id)?.package_content || 1) : 1),
            unit_price: vi.unit_price,
            total_price: vi.total_price,
            discount_percent: vi.discount_percent || originalItem?.discount_percent || 0,
            discount_amount: vi.discount_amount || originalItem?.discount_amount || 0,
            is_bonus: !!vi.is_promo,
            auto_promo_id: vi.auto_promo_id || originalItem?.auto_promo_id,
            batch_allocations: originalItem?.batch_allocations || []
         };
      });

      // Recalculate totals
      sale.subtotal = sale.items.reduce((acc, item) => acc + item.total_price, 0) / 1.18;
      sale.igv = sale.items.reduce((acc, item) => acc + item.total_price, 0) - sale.subtotal;
      sale.total = sale.items.reduce((acc, item) => acc + item.total_price, 0);

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
         balance: sale.payment_method === 'CONTADO' ? 0 : sale.total,
         sunat_status: 'PENDING'
      } as Sale;
      return { sales: [finalSale, ...state.sales], batches: newBatches };
   }),

   createCreditNote: (creditNote, originalSaleId, returnedItems) => set((state) => {
      // 1. Revert Items to Kardex (Add stock back)
      const newBatches = [...state.batches];
      returnedItems.forEach(item => {
         item.batch_allocations?.forEach(alloc => {
            const batchIndex = newBatches.findIndex(b => b.id === alloc.batch_id);
            if (batchIndex >= 0) {
               newBatches[batchIndex] = {
                  ...newBatches[batchIndex],
                  quantity_current: newBatches[batchIndex].quantity_current + alloc.quantity
               };
            }
         });
      });

      // 2. Add Credit Note to Sales
      const finalizedCN = {
         ...creditNote,
         payment_status: 'PAID', // credit notes are technically 'paid' outwards
         collection_status: 'NONE',
         balance: 0,
         sunat_status: 'PENDING'
      } as Sale;

      let allSales = [finalizedCN, ...state.sales];

      // 3. Apply to original Sale balance if needed
      allSales = allSales.map(s => {
         if (s.id === originalSaleId) {
            const currentBalance = s.balance !== undefined ? s.balance : s.total;
            const newBalance = Math.max(0, currentBalance - finalizedCN.total);
            return {
               ...s,
               balance: newBalance,
               payment_status: newBalance <= 0 && s.payment_status !== 'PAID' ? 'PAID' : s.payment_status
            };
         }
         return s;
      });

      return { batches: newBatches, sales: allSales };
   }),

   // Updated createOrder with FIFO Allocation and Delivery Mode
   createOrder: (order) => set((state) => {
      const orderWithMode = {
         ...order,
         delivery_mode: order.delivery_mode || state.deliveryMode // Inherit session mode if not provided
      };

      const newBatches = [...state.batches];

      // Auto-recalculate promos to ensure data integrity
      const validatedItems = calculatePromotions(orderWithMode.items, state.autoPromotions, state.products);
      orderWithMode.total = validatedItems.reduce((acc, item) => acc + item.total_price, 0);

      // 1. Process allocations for each item in the order
      const processedItems: OrderItem[] = validatedItems.map(item => {
         let allocations: BatchAllocation[] = [];
         let comboSnapshot: any[] | undefined = undefined;

         if (item.unit_type === 'COMBO') {
            const combo = state.combos.find(c => c.id === item.product_id);
            if (!combo) return item;

            // Snapshot the current combo definition
            comboSnapshot = combo.items;

            // Iterate over combo components to allocate stock
            combo.items.forEach(comboItem => {
               const product = state.products.find(p => p.id === comboItem.product_id);
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
            const product = state.products.find(p => p.id === item.product_id);
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
         orders: [...state.orders, { ...orderWithMode, items: processedItems }],
         batches: newBatches
      };
   }),

   updateOrder: (order) => set(s => ({ orders: s.orders.map(o => o.id === order.id ? order : o) })),

   processOrderToSale: (orderId, series, number) => {
      // Single process fallback - better use batchProcessOrders
      return { success: true, msg: 'Use procesamiento masivo' };
   },

   // === UPDATED: BATCH PROCESS ORDERS (ROBUST VERSION) ===
   batchProcessOrders: (orderIds, targetSeries) => set(s => {
      const selectedOrders = s.orders.filter(o => orderIds.includes(o.id));
      if (selectedOrders.length === 0) return s;

      // Sort by seller_id first (to group by seller), then by creation date to assign series in order
      selectedOrders.sort((a, b) => {
         if (a.seller_id < b.seller_id) return -1;
         if (a.seller_id > b.seller_id) return 1;
         return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const newSales: Sale[] = [];
      const updatedOrders = [...s.orders];
      // Clone series to increment them correctly
      const currentSeriesState = s.company.series.map(ser => ({ ...ser }));

      selectedOrders.forEach(order => {
         // Robust Doc Type determination from Order Snapshot
         const ruc = order.client_doc_number || '';
         const docType = ruc.length === 11 ? 'FACTURA' : 'BOLETA';

         // Find series config
         let seriesObj;
         if (targetSeries && targetSeries[docType as 'FACTURA' | 'BOLETA']) {
            seriesObj = currentSeriesState.find(ser => ser.type === docType && ser.series === targetSeries[docType as 'FACTURA' | 'BOLETA']);
         } else {
            seriesObj = currentSeriesState.find(ser => ser.type === docType && ser.is_active);
         }
         const seriesStr = seriesObj ? seriesObj.series : (docType === 'FACTURA' ? 'F001' : 'B001');

         // Increment Number
         const nextNum = seriesObj ? seriesObj.current_number + 1 : 1;
         const numberStr = String(nextNum).padStart(8, '0');

         // Update local series state for next iteration
         if (seriesObj) seriesObj.current_number = nextNum;

         // Try to enrich client address if missing from order snapshot
         let address = (order as any).client_address || '';
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
               selected_unit: item.unit_type === 'COMBO' ? 'UND' : item.unit_type,
               quantity_presentation: item.quantity,
               quantity_base: requiredBase,
               unit_price: item.unit_price,
               total_price: item.total_price,
               discount_percent: item.discount_percent || 0,
               discount_amount: item.discount_amount || 0,
               is_bonus: item.is_bonus || false,
               auto_promo_id: item.auto_promo_id,
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
            delivery_mode: order.delivery_mode, // Inherit order type from original order
            created_at: new Date().toISOString(),
            sunat_status: 'PENDING',
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

   consolidateCollections: (recordIds, userId, metadata) => set(s => {
      const selectedRecords = s.collectionRecords.filter(r => recordIds.includes(r.id) && r.status === 'PENDING_VALIDATION');
      if (selectedRecords.length === 0) return s;

      const updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];
      const sellerNamesSet = new Set<string>();
      let totalTotal = 0;

      // Autogenerate Planilla Code or reuse existing
      const maxPlanillaNum = s.collectionPlanillas.reduce((max, p) => {
         const num = parseInt(p.code.replace('PLAN-', ''), 10);
         return isNaN(num) ? max : Math.max(max, num);
      }, 0);

      let planillaId = generateUUID();
      let planillaCode = `PLAN-${String(maxPlanillaNum + 1).padStart(4, '0')}`;

      if (metadata?.editPlanillaId && metadata?.editPlanillaCode) {
         planillaId = metadata.editPlanillaId;
         planillaCode = metadata.editPlanillaCode;
      }

      selectedRecords.forEach(rec => {
         const recIndex = updatedRecords.findIndex(r => r.id === rec.id);
         if (recIndex > -1) {
            updatedRecords[recIndex] = { ...rec, status: 'VALIDATED', planilla_id: planillaId };
         }

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

      const cashMovementId = generateUUID();
      const newMovement: CashMovement = {
         id: cashMovementId,
         type: 'INCOME',
         category_name: 'COBRANZA MASIVA',
         description: `Planilla de Cobranza ${planillaCode} - Vendedores: ${sellerNames}`,
         amount: totalTotal,
         date: new Date().toISOString(),
         user_id: userId || 'ADMIN',
         reference_id: planillaId
      };

      const newPlanilla: CollectionPlanilla = {
         id: planillaId,
         code: planillaCode,
         date: new Date().toISOString(),
         total_amount: totalTotal,
         record_count: selectedRecords.length,
         status: 'ACTIVE',
         user_id: userId,
         cash_movement_id: cashMovementId,
         records: selectedRecords.map(r => r.id)
      };

      if (metadata?.editPlanillaId) {
         const pIndex = s.collectionPlanillas.findIndex(x => x.id === metadata.editPlanillaId);
         if (pIndex > -1) {
            const updated = [...s.collectionPlanillas];
            updated[pIndex] = newPlanilla;
            return { collectionRecords: updatedRecords, sales: updatedSales, cashMovements: [newMovement, ...s.cashMovements], collectionPlanillas: updated };
         }
      }

      return {
         collectionRecords: updatedRecords,
         sales: updatedSales,
         cashMovements: [newMovement, ...s.cashMovements],
         collectionPlanillas: [newPlanilla, ...s.collectionPlanillas]
      };
   }),

   manualLiquidation: (payments, userId, metadata) => set(s => {
      if (payments.length === 0) return s;

      const updatedSales = [...s.sales];
      const newRecords: CollectionRecord[] = [];
      let totalCollected = 0;

      const maxPlanillaNum = s.collectionPlanillas.reduce((max, p) => {
         const num = parseInt(p.code.replace('PLAN-', ''), 10);
         return isNaN(num) ? max : Math.max(max, num);
      }, 0);

      let planillaId = generateUUID();
      let planillaCode = `PLAN-${String(maxPlanillaNum + 1).padStart(4, '0')}`;

      if (metadata?.editPlanillaId && metadata?.editPlanillaCode) {
         planillaId = metadata.editPlanillaId;
         planillaCode = metadata.editPlanillaCode;
      }

      const dateNow = metadata?.date || new Date().toISOString();
      const planillaGlosa = metadata?.glosa || `Cobranza Directa en Oficina`;

      payments.forEach(payment => {
         const saleIndex = updatedSales.findIndex(sale => sale.id === payment.saleId);
         if (saleIndex > -1) {
            const sale = updatedSales[saleIndex];
            const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
            const newBalance = Math.max(0, currentBalance - payment.amount);
            const isPaidOff = newBalance < 0.1;

            updatedSales[saleIndex] = {
               ...sale,
               balance: newBalance,
               payment_status: isPaidOff ? 'PAID' : 'PENDING',
               collection_status: isPaidOff ? 'COLLECTED' : 'PARTIAL'
            };

            const recordId = generateUUID();
            newRecords.push({
               id: recordId,
               sale_id: sale.id,
               seller_id: 'MANUAL', // Indicator that it didn't come from a seller app
               client_name: sale.client_name,
               document_ref: `${sale.series}-${sale.number}`,
               amount_reported: payment.amount,
               date_reported: dateNow,
               status: 'VALIDATED', // Automatically validated
               payment_method: 'CASH',
               planilla_id: planillaId
            });

            totalCollected += payment.amount;
         }
      });

      const cashMovementId = generateUUID();
      const newMovement: CashMovement = {
         id: cashMovementId,
         type: 'INCOME',
         category_name: 'COBRANZA MANUAL',
         description: `Liquidación Manual ${planillaCode} - ${planillaGlosa}`,
         amount: totalCollected,
         date: dateNow,
         user_id: userId || 'ADMIN',
         reference_id: planillaId
      };

      const newPlanilla: CollectionPlanilla = {
         id: planillaId,
         code: planillaCode,
         date: dateNow,
         total_amount: totalCollected,
         record_count: newRecords.length,
         status: 'ACTIVE',
         user_id: userId,
         cash_movement_id: cashMovementId,
         records: newRecords.map(r => r.id),
         glosa: metadata?.glosa
      };

      if (metadata?.editPlanillaId) {
         const pIndex = s.collectionPlanillas.findIndex(x => x.id === metadata.editPlanillaId);
         if (pIndex > -1) {
            const updated = [...s.collectionPlanillas];
            updated[pIndex] = newPlanilla;
            return { sales: updatedSales, collectionRecords: [...s.collectionRecords, ...newRecords], cashMovements: [newMovement, ...s.cashMovements], collectionPlanillas: updated };
         }
      }

      return {
         sales: updatedSales,
         collectionRecords: [...s.collectionRecords, ...newRecords],
         cashMovements: [newMovement, ...s.cashMovements],
         collectionPlanillas: [newPlanilla, ...s.collectionPlanillas]
      };
   }),

   annulCollectionPlanilla: (planillaId, userId) => set(s => {
      const planillaIndex = s.collectionPlanillas.findIndex(p => p.id === planillaId);
      if (planillaIndex === -1) return s;

      const planilla = s.collectionPlanillas[planillaIndex];
      if (planilla.status === 'ANNULLED') return s; // already annulled

      const updatedPlanillas = [...s.collectionPlanillas];
      updatedPlanillas[planillaIndex] = { ...planilla, status: 'ANNULLED' };

      const updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];

      // Revert Records and Sales
      planilla.records.forEach(recordId => {
         const recIndex = updatedRecords.findIndex(r => r.id === recordId);
         if (recIndex > -1) {
            const rec = updatedRecords[recIndex];
            if (rec.seller_id === 'MANUAL') {
               // Soft delete by omitting it from updatedRecords happens later via filter
            } else {
               updatedRecords[recIndex] = { ...rec, status: 'PENDING_VALIDATION', planilla_id: undefined };
            }

            // Revert Sale balance
            const saleIndex = updatedSales.findIndex(sale => sale.id === rec.sale_id);
            if (saleIndex > -1) {
               const sale = updatedSales[saleIndex];
               const currentBalance = sale.balance !== undefined ? sale.balance : 0;
               const newBalance = currentBalance + rec.amount_reported;

               // Reverse status
               const isFullyUnpaid = newBalance >= sale.total - 0.1; // adding tolerance
               updatedSales[saleIndex] = {
                  ...sale,
                  balance: newBalance,
                  payment_status: 'PENDING',
                  collection_status: isFullyUnpaid ? 'NONE' : 'PARTIAL'
               };
            }
         }
      });

      // Handle CashMovement
      const updatedCashMovements = s.cashMovements.filter(cm => cm.id !== planilla.cash_movement_id);

      // Clean out MANUAL dummy records
      const cleanedRecords = updatedRecords.filter(r => !(planilla.records.includes(r.id) && r.seller_id === 'MANUAL'));

      return {
         collectionPlanillas: updatedPlanillas,
         collectionRecords: cleanedRecords,
         sales: updatedSales,
         cashMovements: updatedCashMovements
      };
   }),

   revertPlanillaForEdit: (planillaId) => set(s => {
      const planillaIndex = s.collectionPlanillas.findIndex(p => p.id === planillaId);
      if (planillaIndex === -1) return s;

      const planilla = s.collectionPlanillas[planillaIndex];
      // Allow editing if ACTIVE or even if ANNULLED (but usually ACTIVE)

      const updatedPlanillas = [...s.collectionPlanillas];
      // Mark as EDITING and unlink cash movement and records (they will be regenerated on next process)
      updatedPlanillas[planillaIndex] = { ...planilla, status: 'EDITING', cash_movement_id: undefined, records: [] };

      // Revert records
      let updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];

      planilla.records.forEach(recordId => {
         const recIndex = updatedRecords.findIndex(r => r.id === recordId);
         if (recIndex > -1) {
            const rec = updatedRecords[recIndex];
            // If it's manual, we simply let it be filtered out. Otherwise, reset status.
            if (rec.seller_id !== 'MANUAL') {
               updatedRecords[recIndex] = { ...rec, status: 'PENDING_VALIDATION', planilla_id: undefined };
            }

            // Revert Sale balance
            const saleIndex = updatedSales.findIndex(sale => sale.id === rec.sale_id);
            if (saleIndex > -1) {
               const sale = updatedSales[saleIndex];
               const currentBalance = sale.balance !== undefined ? sale.balance : 0;
               const newBalance = currentBalance + rec.amount_reported;

               const isFullyUnpaid = newBalance >= sale.total - 0.1;
               updatedSales[saleIndex] = {
                  ...sale,
                  balance: newBalance,
                  payment_status: 'PENDING',
                  collection_status: isFullyUnpaid ? 'NONE' : 'PARTIAL'
               };
            }
         }
      });

      // Erase MANUAL dummy records created for this planilla
      updatedRecords = updatedRecords.filter(r => !(planilla.records.includes(r.id) && r.seller_id === 'MANUAL'));

      const updatedCashMovements = s.cashMovements.filter(cm => cm.id !== planilla.cash_movement_id);

      return {
         collectionPlanillas: updatedPlanillas,
         collectionRecords: updatedRecords,
         sales: updatedSales,
         cashMovements: updatedCashMovements
      };
   }),

   removeRecordFromPlanilla: (planillaId, recordId) => set(s => {
      const planillaIndex = s.collectionPlanillas.findIndex(p => p.id === planillaId);
      if (planillaIndex === -1) return s;

      const planilla = s.collectionPlanillas[planillaIndex];
      if (planilla.status === 'ANNULLED') return s; // Should not edit annulled

      const recordIndex = s.collectionRecords.findIndex(r => r.id === recordId);
      if (recordIndex === -1) return s;

      const record = s.collectionRecords[recordIndex];
      if (record.planilla_id !== planillaId) return s;

      // 1. Update Planilla
      const updatedPlanillas = [...s.collectionPlanillas];
      const updatedRecordIds = planilla.records.filter(id => id !== recordId);

      // If we remove the last record, annul the planilla
      if (updatedRecordIds.length === 0) {
         // Fallback to full annul
         // We will just let the next steps happen but set the planilla to annulled
         updatedPlanillas[planillaIndex] = { ...planilla, records: [], total_amount: 0, record_count: 0, status: 'ANNULLED' };
      } else {
         updatedPlanillas[planillaIndex] = {
            ...planilla,
            records: updatedRecordIds,
            total_amount: planilla.total_amount - record.amount_reported,
            record_count: updatedRecordIds.length
         };
      }

      // 2. Revert Record
      const updatedRecords = [...s.collectionRecords];
      updatedRecords[recordIndex] = { ...record, status: 'PENDING_VALIDATION', planilla_id: undefined };

      // 3. Revert Sale
      const updatedSales = [...s.sales];
      const saleIndex = updatedSales.findIndex(sale => sale.id === record.sale_id);
      if (saleIndex > -1) {
         const sale = updatedSales[saleIndex];
         const currentBalance = sale.balance !== undefined ? sale.balance : 0;
         const newBalance = currentBalance + record.amount_reported;

         const isFullyUnpaid = newBalance >= sale.total - 0.1;
         updatedSales[saleIndex] = {
            ...sale,
            balance: newBalance,
            payment_status: 'PENDING',
            collection_status: isFullyUnpaid ? 'NONE' : 'PARTIAL'
         };
      }

      // 4. Update Cash Movement
      let updatedCashMovements = [...s.cashMovements];
      if (updatedPlanillas[planillaIndex].status === 'ANNULLED') {
         updatedCashMovements = updatedCashMovements.filter(cm => cm.id !== planilla.cash_movement_id);
      } else {
         const cmIndex = updatedCashMovements.findIndex(cm => cm.id === planilla.cash_movement_id);
         if (cmIndex > -1) {
            updatedCashMovements[cmIndex] = {
               ...updatedCashMovements[cmIndex],
               amount: updatedPlanillas[planillaIndex].total_amount
            };
         }
      }

      return {
         collectionPlanillas: updatedPlanillas,
         collectionRecords: updatedRecords,
         sales: updatedSales,
         cashMovements: updatedCashMovements
      };
   }),

   createPurchase: (purchase) => set((state) => {
      const newBatches = [...state.batches];
      const newProducts = [...state.products];

      const finalizedPurchase = {
         ...purchase,
         payment_status: purchase.payment_status,
         collection_status: purchase.payment_status === 'PAID' ? 'COLLECTED' : 'NONE',
         paid_amount: purchase.payment_status === 'PAID' ? purchase.total : 0,
         balance: purchase.payment_status === 'PAID' ? 0 : purchase.total,
         payments: []
      } as Purchase;

      finalizedPurchase.items.forEach(item => {
         newBatches.push({
            id: crypto.randomUUID(),
            product_id: item.product_id,
            purchase_id: finalizedPurchase.id,
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

      return { purchases: [finalizedPurchase, ...state.purchases], batches: newBatches, products: newProducts };
   }),

   updatePurchase: (updatedPurchase, userId) => {
      const state = get();
      const oldPurchase = state.purchases.find(p => p.id === updatedPurchase.id);
      if (!oldPurchase) return { success: false, msg: 'Compra no encontrada.' };

      // 1. Check if batches can be reverted
      const oldBatches = state.batches.filter(b => b.purchase_id === oldPurchase.id);
      const isConsumed = oldBatches.some(b => b.quantity_current < b.quantity_initial);
      
      if (isConsumed) {
         return { success: false, msg: 'No se puede editar: Los lotes de esta compra ya han sido vendidos o ajustados.' };
      }

      // 2. Safe to revert. Filter out old batches
      let newBatches = state.batches.filter(b => b.purchase_id !== oldPurchase.id);
      let newProducts = [...state.products];

      // Preserve financial state (do not overwrite payments if just editing items)
      // Recalculate balance based on new total and existing paid_amount
      const currentPaid = oldPurchase.paid_amount || 0;
      const newTotal = updatedPurchase.total;
      const newBalance = Math.max(0, newTotal - currentPaid);
      const isPaid = newBalance <= 0;

      const finalizedPurchase = {
         ...updatedPurchase,
         paid_amount: currentPaid,
         balance: newBalance,
         payment_status: isPaid ? 'PAID' : 'PENDING',
         collection_status: isPaid ? 'COLLECTED' : (currentPaid > 0 ? 'PARTIAL' : 'NONE'),
         payments: oldPurchase.payments || []
      } as Purchase;

      // 3. Create New Batches
      finalizedPurchase.items.forEach(item => {
         newBatches.push({
            id: crypto.randomUUID(),
            product_id: item.product_id,
            purchase_id: finalizedPurchase.id,
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

      const newPurchases = state.purchases.map(p => p.id === finalizedPurchase.id ? finalizedPurchase : p);

      set({ purchases: newPurchases, batches: newBatches, products: newProducts });
      return { success: true, msg: 'Compra actualizada y Kardex rectificado correctamente.' };
   },

   addPurchasePayment: (purchaseId, paymentInput, userId) => set(s => {
      const purchaseIndex = s.purchases.findIndex(p => p.id === purchaseId);
      if (purchaseIndex === -1) return s;

      const purchase = s.purchases[purchaseIndex];
      const amount = paymentInput.amount;
      
      const currentPaid = purchase.paid_amount || 0;
      const newPaid = currentPaid + amount;
      const currentBalance = purchase.balance !== undefined ? purchase.balance : purchase.total;
      const newBalance = Math.max(0, currentBalance - amount);
      const isPaid = newBalance <= 0;

      const cashMovementId = crypto.randomUUID();
      const newPayment = {
         ...paymentInput,
         id: crypto.randomUUID(),
         date: paymentInput.date || new Date().toISOString(),
         cash_movement_id: cashMovementId,
         user_id: userId
      };

      const existingPayments = purchase.payments || [];

      const updatedPurchase = {
         ...purchase,
         paid_amount: newPaid,
         balance: newBalance,
         payment_status: isPaid ? 'PAID' : 'PENDING',
         collection_status: isPaid ? 'COLLECTED' : 'PARTIAL',
         payments: [...existingPayments, newPayment]
      } as Purchase;

      const updatedPurchases = [...s.purchases];
      updatedPurchases[purchaseIndex] = updatedPurchase;

      // Register Expense in CashFlow
      const newMovement: import('../types').CashMovement = {
         id: cashMovementId,
         type: 'EXPENSE',
         category_name: 'COMPRA PROVEEDOR',
         description: `Pago a Proveedor: ${purchase.supplier_name} (Doc: ${purchase.document_type} ${purchase.document_number}) ${newPayment.reference}`,
         amount: amount,
         date: newPayment.date,
         user_id: userId,
         reference_id: purchase.id
      };

      return {
         purchases: updatedPurchases,
         cashMovements: [newMovement, ...s.cashMovements]
      };
   }),

   createDispatch: (dispatch) => set((state) => {
      let finalCode = dispatch.code;
      if (!finalCode || finalCode === 'TBD') {
         // Attempt to auto-generate GUIA series
         const nextCorrelative = state.getNextDocumentNumber('GUIA');
         if (nextCorrelative) {
            finalCode = `${nextCorrelative.series}-${nextCorrelative.number}`;
         } else {
            // Fallback
            finalCode = `HR-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
         }
      }
      return { dispatchSheets: [{ ...dispatch, code: finalCode, sunat_status: 'PENDING' }, ...state.dispatchSheets] };
   }),

   updateDispatchStatus: (dispatchId, status) => set((s) => ({
      dispatchSheets: s.dispatchSheets.map(ds => ds.id === dispatchId ? { ...ds, status } : ds)
   })),

   updateDispatch: (dispatchId, updates) => set(s => {
      const dispatch = s.dispatchSheets.find(d => d.id === dispatchId);
      if (!dispatch) return s; // Dispatch not found

      const newSalesList = updates.sale_ids !== undefined ? updates.sale_ids : dispatch.sale_ids;
      
      // Calculate which sales are removed or added based on the previous list
      const removedSaleIds = dispatch.sale_ids.filter(id => !newSalesList.includes(id));
      const addedSaleIds = newSalesList.filter(id => !dispatch.sale_ids.includes(id));

      return {
         // Update the physical dispatch sheet
         dispatchSheets: s.dispatchSheets.map(d => 
            d.id === dispatchId ? { ...d, ...updates } : d
         ),
         // Update the sales dispatch status
         sales: s.sales.map(sale => {
            if (removedSaleIds.includes(sale.id)) {
               // Revert safely back to pending
               return { ...sale, dispatch_status: 'pending' };
            }
            if (addedSaleIds.includes(sale.id)) {
               return { ...sale, dispatch_status: 'assigned' };
            }
            return sale;
         })
      };
   }),

   updateSaleStatus: (saleIds, status) => set((s) => ({
      sales: s.sales.map(sale => saleIds.includes(sale.id) ? { ...sale, dispatch_status: status } : sale)
   })),

   updateSaleDeliveryStatus: (saleId, status, details) => set((s) => ({
      sales: s.sales.map(sale => {
         if (sale.id === saleId) {
            return {
               ...sale,
               dispatch_status: status,
               delivery_reason: details?.reason !== undefined ? details.reason : sale.delivery_reason,
               delivery_photo: details?.photo !== undefined ? details.photo : sale.delivery_photo,
               delivery_location: details?.location !== undefined ? details.location : sale.delivery_location,
            };
         }
         return sale;
      })
   })),

   updateSunatStatus: (type, id, status, message) => set((state) => {
      if (type === 'sale') {
         return {
            sales: state.sales.map(s => s.id === id ? { ...s, sunat_status: status, sunat_message: message, sunat_sent_at: status !== 'PENDING' ? new Date().toISOString() : s.sunat_sent_at } : s)
         };
      } else {
         return {
            dispatchSheets: state.dispatchSheets.map(d => d.id === id ? { ...d, sunat_status: status, sunat_message: message, sunat_sent_at: status !== 'PENDING' ? new Date().toISOString() : d.sunat_sent_at } : d)
         };
      }
   }),

   markDocumentsAsPrinted: (saleIds) => set((state) => ({
      sales: state.sales.map(s => saleIds.includes(s.id) ? { ...s, printed: true, printed_at: new Date().toISOString() } : s)
   })),

   processDispatchLiquidation: (liquidation) => set((s) => {
      let currentSeriesState = [...s.company.series];
      let currentSales = [...s.sales];

      // Auto-generate Correlative code for this Liquidation
      const maxLiqNum = s.dispatchLiquidations.reduce((max, l) => {
         const num = parseInt(l.id.replace('LIQ-', ''), 10); // Or use a code field if we add one, assuming id/code duality here
         return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const liqCode = `LIQ-${String(maxLiqNum + 1).padStart(4, '0')}`;
      const liquidationToSave = { ...liquidation, id: liqCode };

      const updatedDocs = liquidationToSave.documents.map(doc => {
         if (doc.action === 'PARTIAL_RETURN' && (!doc.credit_note_series || doc.credit_note_series === 'TBD')) {
            const ncSeries = currentSeriesState.find(ser => ser.type === 'NOTA_CREDITO' && ser.is_active);
            let seriesStr = '';
            let nextNumStr = '';
            if (ncSeries) {
               const nextNum = ncSeries.current_number + 1;
               currentSeriesState = currentSeriesState.map(ser =>
                  ser.id === ncSeries.id ? { ...ser, current_number: nextNum } : ser
               );
               seriesStr = ncSeries.series;
               nextNumStr = String(nextNum).padStart(8, '0');
            } else {
               seriesStr = 'NC01';
               nextNumStr = String(Math.floor(Math.random() * 10000)).padStart(6, '0');
            }
            const fullSeries = `${seriesStr}-${nextNumStr}`;

            // Create ACTUAL Credit Note Sale Record in the system
            const originalSale = currentSales.find(s => s.id === doc.sale_id);
            if (originalSale && doc.returned_items && doc.returned_items.length > 0) {
               const creditNoteId = generateUUID();
               const subT = Number((doc.amount_credit_note! / (1 + (s.company.igv_percent / 100))).toFixed(2));
               const igvT = Number((doc.amount_credit_note! - subT).toFixed(2));

               const ncSale: Sale = {
                  id: creditNoteId,
                  document_type: 'NOTA_CREDITO',
                  series: seriesStr,
                  number: nextNumStr,
                  payment_method: 'CONTADO',
                  payment_status: 'PAID',
                  collection_status: 'NONE',
                  client_id: originalSale.client_id,
                  client_name: originalSale.client_name,
                  client_ruc: originalSale.client_ruc,
                  client_address: originalSale.client_address,
                  subtotal: subT,
                  igv: igvT,
                  total: doc.amount_credit_note!,
                  balance: 0,
                  observation: `Devolución de la planilla ${liqCode} - Doc. Org: ${originalSale.series}-${originalSale.number}`,
                  status: 'completed',
                  dispatch_status: 'liquidated',
                  created_at: new Date().toISOString(),
                  sunat_status: 'PENDING',
                  printed: false,
                  origin_order_id: originalSale.id, // Linking back to the original text
                  items: doc.returned_items.map((ri: any) => ({
                     id: generateUUID(),
                     sale_id: creditNoteId,
                     product_id: ri.product_id,
                     product_sku: '',
                     product_name: ri.product_name,
                     selected_unit: ri.unit_type === 'MIXTO' ? 'UND' : ri.unit_type,
                     quantity_presentation: ri.quantity_presentation,
                     quantity_base: ri.quantity_base,
                     unit_price: ri.unit_price,
                     discount_percent: 0,
                     discount_amount: 0,
                     total_price: ri.total_refund,
                     is_bonus: false,
                     batch_allocations: []
                  }))
               };
               currentSales.unshift(ncSale);
            }

            return { ...doc, credit_note_series: fullSeries };
         }
         return doc;
      });

      // Update Sales Statuses
      updatedDocs.forEach(doc => {
         const saleIndex = currentSales.findIndex(sale => sale.id === doc.sale_id);
         if (saleIndex > -1) {
            const sale = currentSales[saleIndex];

            let newPaymentStatus = sale.payment_status;
            let newCollectionStatus = sale.collection_status;
            let newBalance = sale.balance !== undefined ? sale.balance : sale.total;
            let finalDispatchStatus = sale.dispatch_status;

            if (doc.action === 'PAID') {
               newBalance = 0;
               newPaymentStatus = 'PAID';
               newCollectionStatus = 'COLLECTED';
               finalDispatchStatus = 'liquidated';
            } else if (doc.action === 'CREDIT') {
               newBalance = sale.total;
               newPaymentStatus = 'PENDING';
               newCollectionStatus = 'NONE';
               finalDispatchStatus = 'liquidated';
            } else if (doc.action === 'VOID') {
               newBalance = 0;
               newPaymentStatus = 'PAID'; // Treat void as closed
               newCollectionStatus = 'NONE';
               finalDispatchStatus = 'liquidated';
            } else if (doc.action === 'PARTIAL_RETURN') {
               const remainder = (sale.total - doc.amount_credit_note);
               if (doc.balance_payment_method === 'CONTADO') {
                  newBalance = 0;
                  newPaymentStatus = 'PAID';
                  newCollectionStatus = 'COLLECTED';
               } else {
                  newBalance = remainder;
                  newPaymentStatus = 'PENDING';
                  newCollectionStatus = 'NONE';
               }
               finalDispatchStatus = 'liquidated';
            }

            currentSales[saleIndex] = {
               ...sale,
               balance: newBalance,
               payment_status: newPaymentStatus as any,
               collection_status: newCollectionStatus as any,
               dispatch_status: finalDispatchStatus as any
            };
         }
      });

      const finalLiquidation = {
         ...liquidationToSave,
         documents: updatedDocs
      };

      // Generate Cash movement if there is cash collected
      const newCashMovements = [...s.cashMovements];
      if (finalLiquidation.total_cash_collected > 0) {
         newCashMovements.unshift({
            id: generateUUID(),
            type: 'INCOME',
            category_name: 'LIQUIDACION RUTA',
            description: `Liquidación ${liqCode} - Efectivo entregado`,
            amount: finalLiquidation.total_cash_collected,
            date: finalLiquidation.date,
            reference_id: finalLiquidation.id,
            user_id: 'SISTEMA'
         });
      }

      // Update Dispatch Sheet Status
      const updatedDispatchSheets = s.dispatchSheets.map(ds =>
         ds.id === finalLiquidation.dispatch_sheet_id ? { ...ds, status: 'completed' as const } : ds
      );

      return {
         dispatchLiquidations: [finalLiquidation, ...s.dispatchLiquidations],
         sales: currentSales,
         dispatchSheets: updatedDispatchSheets,
         cashMovements: newCashMovements,
         company: {
            ...s.company,
            series: currentSeriesState
         }
      };
   }),

   addSaleHistoryEvent: (saleId, event) => set((s) => {
      const sale = s.sales.find(x => x.id === saleId);
      if (!sale) return s;
      const history = sale.history || [];
      return {
         sales: s.sales.map(item => item.id === saleId ? { ...item, history: [...history, event] } : item)
      };
   }),

   generateGuiasFromSales: (saleIds, transporterId, driverId, vehicleId) => set(s => {
      if (saleIds.length === 0) return s;

      const currentSeriesState = [...s.company.series];
      const seriesObj = currentSeriesState.find(ser => ser.type === 'GUIA' && ser.is_active);
      if (!seriesObj) {
         alert("No hay serie activa configurada para Guías de Remisión.");
         return s;
      }
      
      let nextNum = seriesObj.current_number;
      
      const newDispatchSheets: DispatchSheet[] = [];
      const updatedSales = [...s.sales];

      saleIds.forEach(saleId => {
         const saleIndex = updatedSales.findIndex(sale => sale.id === saleId);
         if (saleIndex === -1) return;

         nextNum++;
         const code = `${seriesObj.series}-${String(nextNum).padStart(8, '0')}`;

         const newDispatch: DispatchSheet = {
            id: generateUUID(),
            code,
            vehicle_id: vehicleId,
            status: 'pending',
            date: new Date().toISOString(),
            sale_ids: [saleId],
            sunat_status: 'PENDING'
         };

         newDispatchSheets.push(newDispatch);
         
         updatedSales[saleIndex] = {
            ...updatedSales[saleIndex],
            dispatch_status: 'assigned',
            guide_transporter_id: transporterId,
            guide_driver_id: driverId,
            guide_vehicle_id: vehicleId,
         };
      });

      const finalSeriesState = currentSeriesState.map(ser =>
         ser.id === seriesObj.id ? { ...ser, current_number: nextNum } : ser
      );

      return {
         dispatchSheets: [...newDispatchSheets, ...s.dispatchSheets],
         sales: updatedSales,
         company: { ...s.company, series: finalSeriesState }
      };
   }),

   returnItemsToKardex: (items) => set((s) => {
      let currentBatches = [...s.batches];
      items.forEach(item => {
         item.batch_allocations?.forEach(alloc => {
            const batchIndex = currentBatches.findIndex(b => b.id === alloc.batch_id);
            if (batchIndex >= 0) {
               currentBatches[batchIndex] = {
                  ...currentBatches[batchIndex],
                  quantity_current: currentBatches[batchIndex].quantity_current + alloc.quantity
               };
            }
         });
      });
      return { batches: currentBatches };
   }),

   updateSaleDetailed: (updatedSale, originalSale, userId) => {
      let success = true;
      let msg = "Venta actualizada correctamente.";

      set((s) => {
         if (originalSale.sunat_status === 'SENT' || originalSale.sunat_status === 'ACCEPTED') {
            success = false;
            msg = "No se puede modificar un documento ya emitido a SUNAT.";
            return s;
         }

         // 1. Revert original items
         let nextBatches = [...s.batches];
         originalSale.items.forEach(item => {
            item.batch_allocations?.forEach(alloc => {
               const bIndex = nextBatches.findIndex(b => b.id === alloc.batch_id);
               if (bIndex >= 0) {
                  nextBatches[bIndex] = {
                     ...nextBatches[bIndex],
                     quantity_current: nextBatches[bIndex].quantity_current + alloc.quantity
                  };
               }
            });
         });

         // 2. Apply new items (they already have batch allocations from NewSale before saving)
         updatedSale.items.forEach(item => {
            item.batch_allocations?.forEach(alloc => {
               const bIndex = nextBatches.findIndex(b => b.id === alloc.batch_id);
               if (bIndex >= 0) {
                  // We could check if it goes negative, but we trust NewSale checks it first
                  nextBatches[bIndex] = {
                     ...nextBatches[bIndex],
                     quantity_current: nextBatches[bIndex].quantity_current - alloc.quantity
                  };
               }
            });
         });

         // 3. Add to history
         const event: import('../types').SaleHistoryEvent = {
            date: new Date().toISOString(),
            action: 'MODIFIED',
            user_id: userId,
            details: `Subtotal original: ${originalSale.subtotal.toFixed(2)} -> Nuevo: ${updatedSale.subtotal.toFixed(2)}`
         };

         const newHistory = [...(updatedSale.history || []), event];
         const finalSale = { ...updatedSale, history: newHistory };

         return {
            batches: nextBatches,
            sales: s.sales.map(sale => sale.id === updatedSale.id ? finalSale : sale)
         };
      });

      return { success, msg };
   },

   changeSaleDocumentType: (saleId, newType, userId) => {
      let success = true;
      let msg = "Tipo de documento actualizado correctamente.";
      let newSaleObj: Sale | undefined = undefined;

      set((s) => {
         const saleIndex = s.sales.findIndex(sale => sale.id === saleId);
         if (saleIndex === -1) {
            success = false;
            msg = "Venta no encontrada.";
            return s;
         }

         const sale = s.sales[saleIndex];

         if (sale.sunat_status === 'SENT' || sale.sunat_status === 'ACCEPTED') {
            success = false;
            msg = "No se puede cambiar el tipo de un documento ya emitido a SUNAT.";
            return s;
         }

         if (sale.document_type === newType) {
            success = false;
            msg = "El documento ya es de este tipo.";
            return s;
         }

         // Fetch new series and correlative
         let currentSeriesState = [...s.company.series];
         const seriesObj = currentSeriesState.find(ser => ser.type === newType && ser.is_active);
         if (!seriesObj) {
            success = false;
            msg = `No hay serie activa configurada para ${newType}.`;
            return s;
         }

         const nextNum = seriesObj.current_number + 1;
         const seriesStr = seriesObj.series;
         const numberStr = String(nextNum).padStart(8, '0');

         currentSeriesState = currentSeriesState.map(ser =>
            ser.id === seriesObj.id ? { ...ser, current_number: nextNum } : ser
         );

         const event: import('../types').SaleHistoryEvent = {
            date: new Date().toISOString(),
            action: 'MODIFIED',
            user_id: userId,
            details: `Cambio de Tipo: ${sale.document_type} (${sale.series}-${sale.number}) -> ${newType} (${seriesStr}-${numberStr})`
         };

         newSaleObj = {
            ...sale,
            document_type: newType,
            series: seriesStr,
            number: numberStr,
            history: [...(sale.history || []), event]
         };

         const updatedSales = [...s.sales];
         updatedSales[saleIndex] = newSaleObj;

         return {
            sales: updatedSales,
            company: {
               ...s.company,
               series: currentSeriesState
            }
         };
      });

      return { success, msg, newSale: newSaleObj };
   },

   revertDispatchLiquidation: (liquidationId, userId) => {
      let success = true;
      let msg = "Liquidación revertida exitosamente. La cobranza se ha deshecho.";

      set((s) => {
         const liquidationIndex = s.dispatchLiquidations.findIndex(l => l.id === liquidationId);
         if (liquidationIndex === -1) {
            success = false;
            msg = "Liquidación no encontrada.";
            return s;
         }

         const liquidation = s.dispatchLiquidations[liquidationIndex];
         const updatedSales = [...s.sales];

         // 1. Revert Sales Collections Statuses ONLY
         // Note: We DO NOT revert the actual stock returns/NCs. 
         // We only revert the financial/collection part so they can re-liquidate.
         liquidation.documents.forEach(doc => {
            const saleIndex = updatedSales.findIndex(sale => sale.id === doc.sale_id);
            if (saleIndex > -1) {
               const sale = updatedSales[saleIndex];

               // Restore to PENDING strictly for collection purposes, except VOID docs which stay as is financially (balance 0, paid).
               // But actually, if they want to re-do the liquidation, it's safer to just set everything except VOID to PENDING final state to allow a fresh liquidation.
               // For Partial Return, it's tricky since the Partial NC persists. So its balance is still (Sale.Total - NC Amount).

               let newBalance = sale.balance !== undefined ? sale.balance : sale.total;
               let collectionStatus = sale.collection_status;
               let paymentStatus = sale.payment_status;

               if (doc.action === 'PAID' || doc.action === 'CREDIT') {
                  newBalance = sale.total;
                  paymentStatus = 'PENDING';
                  collectionStatus = 'NONE';
               } else if (doc.action === 'PARTIAL_RETURN') {
                  // Keep the partial balance intact, just reset collection
                  const remainder = (sale.total - doc.amount_credit_note);
                  newBalance = remainder;
                  paymentStatus = 'PENDING';
                  collectionStatus = 'NONE';
               }

               updatedSales[saleIndex] = {
                  ...sale,
                  balance: newBalance,
                  payment_status: paymentStatus as any,
                  collection_status: collectionStatus as any,
                  dispatch_status: 'delivered' // Back to waiting for liquidation
               };
            }
         });

         // 2. Remove Cash Movement
         // Find cash movements related to this liquidation
         const updatedCashMovements = s.cashMovements.filter(cm => cm.reference_id !== liquidationId);

         // 3. Re-activate Dispatch Sheet
         const updatedDispatchSheets = s.dispatchSheets.map(ds =>
            ds.id === liquidation.dispatch_sheet_id ? { ...ds, status: 'in_transit' as const } : ds
         );

         // 4. Remove Liquidation Record
         const updatedLiquidations = s.dispatchLiquidations.filter(l => l.id !== liquidationId);

         return {
            sales: updatedSales,
            cashMovements: updatedCashMovements,
            dispatchSheets: updatedDispatchSheets,
            dispatchLiquidations: updatedLiquidations
         };
      });

      return { success, msg };
   },

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
   updateCashMovement: (m) => set(s => ({ cashMovements: s.cashMovements.map(cm => cm.id === m.id ? m : cm) })),
   deleteCashMovement: (id) => set(s => ({ cashMovements: s.cashMovements.filter(cm => cm.id !== id) })),
   addExpenseCategory: (c) => set(s => ({ expenseCategories: [...s.expenseCategories, c] })),
   updateExpenseCategory: (c) => set(s => ({ expenseCategories: s.expenseCategories.map(cat => cat.id === c.id ? c : cat) })),
   deleteExpenseCategory: (id) => set(s => ({ expenseCategories: s.expenseCategories.filter(c => c.id !== id) })),

   addScheduledTransaction: (tx) => set(s => ({ scheduledTransactions: [...s.scheduledTransactions, tx] })),
   updateScheduledTransaction: (tx) => set(s => ({ scheduledTransactions: s.scheduledTransactions.map(t => t.id === tx.id ? tx : t) })),
   deleteScheduledTransaction: (id) => set(s => ({ scheduledTransactions: s.scheduledTransactions.filter(t => t.id !== id) })),

   processScheduledTransaction: (txId, userId) => set(s => {
      const tx = s.scheduledTransactions.find(t => t.id === txId);
      if (!tx || !tx.is_active) return s;

      const cat = s.expenseCategories.find(c => c.id === tx.category_id);

      // 1. Create the Expense Movement
      const newMovement: import('../types').CashMovement = {
         id: crypto.randomUUID(),
         type: 'EXPENSE',
         category_id: tx.category_id,
         category_name: cat?.name || 'GASTO PROGRAMADO',
         description: `Pago Automático: ${tx.name}`,
         amount: tx.amount,
         date: new Date().toISOString(),
         reference_id: tx.id,
         user_id: userId
      };

      // 2. Adjust Next Due Date or Mark Inactive
      let newNextDate = new Date(tx.next_due_date);
      let newIsActive = true;

      if (tx.frequency === 'MONTHLY') {
         newNextDate.setUTCMonth(newNextDate.getUTCMonth() + 1);
      } else if (tx.frequency === 'WEEKLY') {
         newNextDate.setUTCDate(newNextDate.getUTCDate() + 7);
      } else if (tx.frequency === 'BIWEEKLY') {
         newNextDate.setUTCDate(newNextDate.getUTCDate() + 14);
      } else if (tx.frequency === 'ONETIME') {
         newIsActive = false;
      }

      const updatedTx = {
         ...tx,
         is_active: newIsActive,
         next_due_date: newNextDate.toISOString().split('T')[0]
      };

      return {
         cashMovements: [newMovement, ...s.cashMovements],
         scheduledTransactions: s.scheduledTransactions.map(t => t.id === tx.id ? updatedTx : t)
      };
   }),

   openCashSession: (amount, userId) => set(s => {
      if (s.currentCashSession) return s; // Already open

      const newSession: import('../types').CashRegisterSession = {
         id: crypto.randomUUID(),
         open_time: new Date().toISOString(),
         opened_by: userId,
         status: 'OPEN',
         system_opening_amount: amount,
         system_income: 0,
         system_expense: 0,
         system_expected_close: amount,
         declared_cash: 0,
         declared_transfers: 0,
         declared_vouchers: 0,
         declared_total: 0,
         difference: 0
      };

      // Create an initial cash movement for traceability if needed (optional, but good practice)
      const openMovement: import('../types').CashMovement = {
         id: crypto.randomUUID(),
         type: 'INCOME',
         category_name: 'APERTURA CAJA',
         description: `Saldo inicial declarado al abrir caja`,
         amount: amount,
         date: new Date().toISOString(),
         user_id: userId,
         reference_id: newSession.id
      };

      return {
         cashSessions: [newSession, ...s.cashSessions],
         currentCashSession: newSession,
         cashMovements: [openMovement, ...s.cashMovements]
      };
   }),

   closeCashSession: (sessionId, details, userId) => set(s => {
      const session = s.cashSessions.find(x => x.id === sessionId);
      if (!session || session.status === 'CLOSED') return s;

      const closeTime = new Date().toISOString();

      // 1. Calculate real SYSTEM totals during this timeframe
      // Only get movements that happened between open_time and right now.
      // Exclude the 'APERTURA CAJA' movement itself because it's already in system_opening_amount
      const sessionMovements = s.cashMovements.filter(m =>
         new Date(m.date) >= new Date(session.open_time) &&
         new Date(m.date) <= new Date(closeTime) &&
         m.reference_id !== session.id // exclude the opener
      );

      // Add Sales built-in incomes (CONTADO) during this session timeframe
      const sessionSales = s.sales.filter(sale =>
         sale.payment_method === 'CONTADO' &&
         !sale.document_type.includes('NOTA') &&
         new Date(sale.created_at) >= new Date(session.open_time) &&
         new Date(sale.created_at) <= new Date(closeTime)
      );

      // Summarize
      const manualIncome = sessionMovements.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0);
      const manualExpense = sessionMovements.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0);

      const salesIncome = sessionSales.reduce((acc, sale) => acc + sale.total, 0);

      const totalIncome = manualIncome + salesIncome;
      const totalExpense = manualExpense;

      const expectedClose = session.system_opening_amount + totalIncome - totalExpense;

      // 2. Finalize Difference & Session
      const diff = details.declared_total - expectedClose;

      const closedSession: import('../types').CashRegisterSession = {
         ...session,
         ...details,
         close_time: closeTime,
         closed_by: userId,
         status: 'CLOSED',
         system_income: totalIncome,
         system_expense: totalExpense,
         system_expected_close: expectedClose,
         difference: diff
      };

      return {
         cashSessions: s.cashSessions.map(c => c.id === sessionId ? closedSession : c),
         currentCashSession: null // Clear active session
      };
   }),

   addUser: (user) => set(s => ({ users: [...s.users, user] })),
   updateUser: (user) => set(s => {
      const currentUser = s.currentUser?.id === user.id ? user : s.currentUser;
      return {
         users: s.users.map(u => u.id === user.id ? user : u),
         currentUser
      };
   }),
   clockIn: (userId, photo, location) => set(s => {
      const today = new Date().toISOString().split('T')[0];
      const newRecord: import('../types').AttendanceRecord = {
         id: crypto.randomUUID(),
         user_id: userId,
         date: today,
         check_in: new Date().toISOString(),
         photo_in: photo,
         location_in: location,
         total_hours: 0,
         status: 'OPEN'
      };
      return { attendanceRecords: [...s.attendanceRecords, newRecord] };
   }),

   clockOut: (userId, photo, location) => set(s => {
      const today = new Date().toISOString().split('T')[0];
      return {
         attendanceRecords: s.attendanceRecords.map(r => {
            if (r.user_id === userId && r.date === today && r.status === 'OPEN') {
               const checkOut = new Date();
               const checkIn = new Date(r.check_in);
               const diffMs = checkOut.getTime() - checkIn.getTime();
               const totalHours = diffMs / (1000 * 60 * 60);

               return {
                  ...r,
                  check_out: checkOut.toISOString(),
                  photo_out: photo,
                  location_out: location,
                  total_hours: totalHours,
                  status: 'CLOSED'
               };
            }
            return r;
         })
      };
   }),

   updateAttendanceRecord: (record) => set(s => ({
      attendanceRecords: s.attendanceRecords.map(r => r.id === record.id ? record : r)
   })),

   // Promo Actions
   addPromotion: (promo) => set((state) => ({ promotions: [...state.promotions, promo] })),
   updatePromotion: (promo) => set((state) => ({
      promotions: state.promotions.map(p => p.id === promo.id ? promo : p)
   })),
   addCombo: (combo) => set((state) => ({ combos: [...state.combos, combo] })),
   updateCombo: (combo) => set((state) => ({
      combos: state.combos.map(c => c.id === combo.id ? combo : c)
   })),
   addAutoPromotion: (ap) => set((state) => ({ autoPromotions: [...state.autoPromotions, ap] })),
   updateAutoPromotion: (ap) => set((state) => ({
      autoPromotions: state.autoPromotions.map(a => a.id === ap.id ? ap : a)
   })),

   // Quota Actions
   addQuota: (quota) => set((state) => ({ quotas: [...state.quotas, quota] })),
   updateQuota: (quota) => set((state) => ({ quotas: state.quotas.map(q => q.id === quota.id ? quota : q) })),
   deleteQuota: (id) => set((state) => ({ quotas: state.quotas.filter(q => q.id !== id) })),
   batchUpdateQuotas: (newQuotas) => set((state) => {
      let updatedQuotas = [...state.quotas];
      newQuotas.forEach(nq => {
         const existingIndex = updatedQuotas.findIndex(q => q.id === nq.id);
         if (existingIndex >= 0) {
            updatedQuotas[existingIndex] = nq;
         } else {
            updatedQuotas.push(nq);
         }
      });
      return { quotas: updatedQuotas };
   }),

   setCurrentUser: (userId) => set(s => ({
      currentUser: s.users.find(u => u.id === userId) || null
   })),

   logout: () => set(() => ({ currentUser: null, deliveryMode: 'REGULAR' })),
   setDeliveryMode: (mode) => set({ deliveryMode: mode }),
}));

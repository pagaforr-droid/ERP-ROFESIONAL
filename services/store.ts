import { create } from 'zustand';
import { Product, Batch, Sale, Vehicle, DispatchSheet, Client, Supplier, Warehouse, Driver, Transporter, Purchase, Zone, PriceList, Seller, Order, SaleItem, BatchAllocation, CompanyConfig, DocumentSeries, CashMovement, ExpenseCategory, ScheduledTransaction, DispatchLiquidation, User, AttendanceRecord, Promotion, Combo, CollectionRecord, CollectionPlanilla, OrderItem, AutoPromotion, Quota, Employee, SalaryAdvance, PayrollRecord } from '../types';
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

// ESTADO INICIAL EN BLANCO (CERO MOCK_DB)
const INITIAL_COMPANY: CompanyConfig = {
   ruc: '',
   name: '',
   address: '',
   logo_url: '',
   igv_percent: 18,
   currency_symbol: 'S/',
   email: '',
   phone: '',
   series: []
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

   // Personnel & Payroll
   employees: Employee[];
   salaryAdvances: SalaryAdvance[];
   payrollRecords: PayrollRecord[];

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
   deliveryMode: 'REGULAR' | 'EXPRESS_MISMO_DIA';

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
   addSeries: (series: DocumentSeries) => void;    
   removeSeries: (seriesId: string) => void;       
   getNextDocumentNumber: (type: DocumentSeries['type'], seriesStr?: string) => { series: string, number: string } | null;

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
   addClient: (Client: Client) => void;
   updateClient: (Client: Client) => void;
   batchUpdateClientZone: (clientIds: string[], zoneId: string) => void;
   addSupplier: (Supplier: Supplier) => void;
   addWarehouse: (Warehouse: Warehouse) => void;

   // Logistics Actions
   addDriver: (Driver: Driver) => void;
   addTransporter: (Transporter: Transporter) => void;
   addVehicle: (Vehicle: Vehicle) => void;
   updateVehicle: (Vehicle: Vehicle) => void;

   // Territory Actions
   addSeller: (Seller: Seller) => void;
   updateSeller: (Seller: Seller) => void;
   addZone: (Zone: Zone) => void;

   // Pricing Actions
   addPriceList: (PriceList: PriceList) => void;
   updatePriceList: (PriceList: PriceList) => void;

   // Cash Flow Actions
   addCashMovement: (CashMovement: CashMovement) => void;
   updateCashMovement: (CashMovement: CashMovement) => void;
   deleteCashMovement: (id: string) => void;
   addExpenseCategory: (ExpenseCategory: ExpenseCategory) => void;
   updateExpenseCategory: (ExpenseCategory: ExpenseCategory) => void;
   deleteExpenseCategory: (id: string) => void;
   addScheduledTransaction: (ScheduledTransaction: ScheduledTransaction) => void;
   updateScheduledTransaction: (ScheduledTransaction: ScheduledTransaction) => void;
   deleteScheduledTransaction: (id: string) => void;
   processScheduledTransaction: (txId: string, userId: string) => void;
   openCashSession: (amount: number, userId: string) => void;
   closeCashSession: (sessionId: string, details: Omit<import('../types').CashRegisterSession, 'id' | 'open_time' | 'opened_by' | 'status' | 'system_opening_amount' | 'system_income' | 'system_expense' | 'system_expected_close' | 'difference'>, userId: string) => void;

   // User Actions
   addUser: (User: User) => void;
   updateUser: (User: User) => void;
   clockIn: (userId: string, photo?: string, location?: { lat: number, lng: number }) => void;
   clockOut: (userId: string, photo?: string, location?: { lat: number, lng: number }) => void;
   updateAttendanceRecord: (AttendanceRecord: AttendanceRecord) => void;

   // Personnel Actions
   addEmployee: (Employee: Employee) => void;
   updateEmployee: (Employee: Employee) => void;
   addSalaryAdvance: (SalaryAdvance: SalaryAdvance) => void;
   updateSalaryAdvance: (SalaryAdvance: SalaryAdvance) => void;
   deleteSalaryAdvance: (id: string) => void;
   addPayrollRecord: (PayrollRecord: PayrollRecord) => void;
   processPayroll: (employeeId: string, userId: string) => void;

   // Promo Actions
   addPromotion: (Promotion: Promotion) => void;
   updatePromotion: (Promotion: Promotion) => void;
   addCombo: (Combo: Combo) => void;
   updateCombo: (Combo: Combo) => void;
   addAutoPromotion: (AutoPromotion: AutoPromotion) => void;
   updateAutoPromotion: (AutoPromotion: AutoPromotion) => void;

   // Quota Actions
   addQuota: (Quota: Quota) => void;
   updateQuota: (Quota: Quota) => void;
   deleteQuota: (id: string) => void;
   batchUpdateQuotas: (quotas: Quota[]) => void;

   // Auth Actions
   setCurrentUser: (userId: string) => void;
   setSupabaseSessionUser: (user: import('../types').User) => void;
   logout: () => void;
   setDeliveryMode: (mode: 'REGULAR' | 'EXPRESS_MISMO_DIA') => void;

   // Selectors/Helpers
   getBatchesForProduct: (productId: string) => Batch[];
   transferToMermas: (productId: string, batchId: string, quantity: number) => { success: boolean, msg?: string };
}

export const useStore = create<AppState>((set, get) => ({
   company: INITIAL_COMPANY,
   products: [],
   batches: [],
   sales: [],
   orders: [],
   vehicles: [],
   dispatchSheets: [],
   dispatchLiquidations: [],
   clients: [],
   suppliers: [],
   warehouses: [],
   drivers: [],
   transporters: [],
   sellers: [],
   purchases: [],
   zones: [],
   priceLists: [],
   cashMovements: [],
   expenseCategories: [],
   scheduledTransactions: [],
   users: [],
   attendanceRecords: [],
   employees: [],
   salaryAdvances: [],
   payrollRecords: [],
   promotions: [],
   quotas: [],

   categories: [],
   subcategories: [],
   brands: [],
   unitTypes: [],
   packageTypes: [],
   combos: [],
   autoPromotions: [],
   currentUser: null,
   deliveryMode: 'REGULAR',
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
      const seriesObj = seriesStr
         ? state.company.series.find(s => s.type === type && s.series === seriesStr)
         : state.company.series.find(s => s.type === type && s.is_active);

      if (!seriesObj) return null;

      const nextNum = seriesObj.current_number + 1;

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
   },
   
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
      const newBatches = [...state.batches];

      sale.items = sale.items.map(item => {
         let allocations = item.batch_allocations || [];
         
         if (allocations.length === 0 && item.quantity_base > 0) {
            const product = state.products.find(p => p.id === item.product_id);
            if (!product) return item;

            const availableBatches = newBatches
               .filter(b => b.product_id === item.product_id && b.quantity_current > 0 && b.warehouse_id !== 'MERMAS')
               .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

            let remaining = item.quantity_base;
            const newAllocations: typeof allocations = [];

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
               newAllocations.push({ batch_id: b.id, batch_code: b.code, quantity: take });
               remaining -= take;
            }

            if (remaining > 0) {
               throw new Error(`KARDEX ERROR: Stock insuficiente real para la bonificación/producto "${product.name}". Restan ${remaining} unid.`);
            }
            allocations = newAllocations;
         } else if (allocations.length > 0) {
             allocations.forEach(alloc => {
                 const batchIndex = newBatches.findIndex(b => b.id === alloc.batch_id);
                 if (batchIndex >= 0) {
                    const newQty = newBatches[batchIndex].quantity_current - alloc.quantity;
                    if (newQty < 0) {
                        throw new Error(`KARDEX ERROR: Venta bloqueada. El lote ${alloc.batch_code} no tiene stock suficiente para cubrir la venta. (Faltan ${Math.abs(newQty)})`);
                    }
                    newBatches[batchIndex] = {
                       ...newBatches[batchIndex],
                       quantity_current: newQty
                    };
                 }
             });
         }

         return { ...item, batch_allocations: allocations };
      });

      sale.subtotal = sale.items.reduce((acc, item) => acc + item.total_price, 0) / 1.18;
      sale.igv = sale.items.reduce((acc, item) => acc + item.total_price, 0) - sale.subtotal;
      sale.total = sale.items.reduce((acc, item) => acc + item.total_price, 0);

      const finalSale = {
         ...sale,
         payment_status: sale.payment_method === 'CONTADO' ? 'PAID' : 'PENDING',
         collection_status: sale.payment_method === 'CONTADO' ? 'COLLECTED' : 'NONE',
         balance: sale.payment_method === 'CONTADO' ? 0 : sale.total,
         sunat_status: 'PENDING'
      } as Sale;
      return { sales: [finalSale, ...state.sales], batches: newBatches };
   }),

   transferToMermas: (productId, batchId, quantity) => {
      const state = get();
      const batches = [...state.batches];
      const sourceBatchIndex = batches.findIndex(b => b.id === batchId);
      
      if (sourceBatchIndex === -1) return { success: false, msg: 'Lote fuente no encontrado' };
      const sourceBatch = batches[sourceBatchIndex];
      
      if (sourceBatch.quantity_current < quantity) {
         return { success: false, msg: 'Cantidad insuficiente en el lote' };
      }
      
      batches[sourceBatchIndex] = {
         ...sourceBatch,
         quantity_current: sourceBatch.quantity_current - quantity
      };
      
      batches.push({
         ...sourceBatch,
         id: crypto.randomUUID(), 
         warehouse_id: 'MERMAS',
         quantity_initial: quantity,
         quantity_current: quantity,
         created_at: new Date().toISOString()
      });
      
      set({ batches });
      return { success: true };
   },

   createCreditNote: (creditNote, originalSaleId, returnedItems) => set((state) => {
      const newBatches = [...state.batches];
      returnedItems.forEach(item => {
         item.batch_allocations?.forEach(alloc => {
            const batchIndex = newBatches.findIndex(b => b.id === alloc.batch_id);
            if (batchIndex >= 0) {
               if (item.warehouse_id === 'MERMAS') {
                  newBatches.push({
                     ...newBatches[batchIndex],
                     id: crypto.randomUUID(),
                     warehouse_id: 'MERMAS',
                     quantity_initial: alloc.quantity,
                     quantity_current: alloc.quantity,
                     created_at: new Date().toISOString()
                  });
               } else {
                  newBatches[batchIndex] = {
                     ...newBatches[batchIndex],
                     quantity_current: newBatches[batchIndex].quantity_current + alloc.quantity
                  };
               }
            }
         });
      });

      const finalizedCN = {
         ...creditNote,
         payment_status: 'PAID', 
         collection_status: 'NONE',
         balance: 0,
         sunat_status: 'PENDING'
      } as Sale;

      let allSales = [finalizedCN, ...state.sales];

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

   createOrder: (order) => set((state) => {
      const orderWithMode = {
         ...order,
         delivery_mode: order.delivery_mode || state.deliveryMode 
      };

      const newBatches = [...state.batches];

      const validatedItems = calculatePromotions(orderWithMode.items, state.autoPromotions, state.products);
      orderWithMode.total = validatedItems.reduce((acc, item) => acc + item.total_price, 0);

      const processedItems: OrderItem[] = validatedItems.map(item => {
         let allocations: BatchAllocation[] = [];
         let comboSnapshot: any[] | undefined = undefined;

         if (item.unit_type === 'COMBO') {
            const combo = state.combos.find(c => c.id === item.product_id);
            if (!combo) return item;

            comboSnapshot = combo.items;

            combo.items.forEach(comboItem => {
               const product = state.products.find(p => p.id === comboItem.product_id);
               if (!product) return;

               const itemFactor = comboItem.unit_type === 'PKG' ? (product.package_content || 1) : 1;
               const totalRequiredForComponent = item.quantity * comboItem.quantity * itemFactor;

               const availableBatches = newBatches
                  .filter(b => b.product_id === comboItem.product_id && b.quantity_current > 0 && b.warehouse_id !== 'MERMAS')
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

               if (remaining > 0) {
                  throw new Error(`KARDEX ERROR: Stock insuficiente real para surtir el componente "${product.name}" del combo. Restan ${remaining} unid.`);
               }
            });

         } else {
            const product = state.products.find(p => p.id === item.product_id);
            if (!product) return item;

            const conversionFactor = item.unit_type === 'PKG' ? (product.package_content || 1) : 1;
            const requiredBase = item.quantity * conversionFactor;

            const availableBatches = newBatches
               .filter(b => b.product_id === item.product_id && b.quantity_current > 0 && b.warehouse_id !== 'MERMAS')
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

            if (remaining > 0) {
               throw new Error(`KARDEX ERROR: Stock insuficiente real para el producto "${product.name}". Restan ${remaining} unid.`);
            }
         }

         return { ...item, batch_allocations: allocations, combo_snapshot: comboSnapshot };
      });

      return {
         orders: [...state.orders, { ...orderWithMode, items: processedItems }],
         batches: newBatches
      };
   }),

   updateOrder: (order) => set(s => ({ orders: s.orders.map(o => o.id === order.id ? order : o) })),

   processOrderToSale: (orderId, series, number) => {
      return { success: true, msg: 'Use procesamiento masivo' };
   },

   batchProcessOrders: (orderIds, targetSeries) => set(s => {
      const selectedOrders = s.orders.filter(o => orderIds.includes(o.id));
      if (selectedOrders.length === 0) return s;

      selectedOrders.sort((a, b) => {
         if (a.seller_id < b.seller_id) return -1;
         if (a.seller_id > b.seller_id) return 1;
         return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const newSales: Sale[] = [];
      const updatedOrders = [...s.orders];
      const currentSeriesState = s.company.series.map(ser => ({ ...ser }));

      selectedOrders.forEach(order => {
         const ruc = order.client_doc_number || '';
         const docType = ruc.length === 11 ? 'FACTURA' : 'BOLETA';

         let seriesObj;
         if (targetSeries && targetSeries[docType as 'FACTURA' | 'BOLETA']) {
            seriesObj = currentSeriesState.find(ser => ser.type === docType && ser.series === targetSeries[docType as 'FACTURA' | 'BOLETA']);
         } else {
            seriesObj = currentSeriesState.find(ser => ser.type === docType && ser.is_active);
         }
         const seriesStr = seriesObj ? seriesObj.series : (docType === 'FACTURA' ? 'F001' : 'B001');

         const nextNum = seriesObj ? seriesObj.current_number + 1 : 1;
         const numberStr = String(nextNum).padStart(8, '0');

         if (seriesObj) seriesObj.current_number = nextNum;

         let address = (order as any).client_address || '';
         if (!address) {
            const client = s.clients.find(c => c.id === order.client_id || c.doc_number === order.client_doc_number);
            address = client?.address || '';
         }

         const saleItems: SaleItem[] = order.items.map(item => {
            const product = s.products.find(p => p.id === item.product_id);
            const factor = item.unit_type === 'PKG' ? (product?.package_content || 1) : 1;
            const requiredBase = item.quantity * factor;

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
            delivery_mode: order.delivery_mode, 
            created_at: new Date().toISOString(),
            sunat_status: 'PENDING',
            items: saleItems,
            origin_order_id: order.id
         };
         newSales.push(newSale);

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
               seller_id: 'MANUAL', 
               client_name: sale.client_name,
               document_ref: `${sale.series}-${sale.number}`,
               amount_reported: payment.amount,
               date_reported: dateNow,
               status: 'VALIDATED', 
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
      if (planilla.status === 'ANNULLED') return s; 

      const updatedPlanillas = [...s.collectionPlanillas];
      updatedPlanillas[planillaIndex] = { ...planilla, status: 'ANNULLED' };

      const updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];

      planilla.records.forEach(recordId => {
         const recIndex = updatedRecords.findIndex(r => r.id === recordId);
         if (recIndex > -1) {
            const rec = updatedRecords[recIndex];
            if (rec.seller_id === 'MANUAL') {
               // Soft delete
            } else {
               updatedRecords[recIndex] = { ...rec, status: 'PENDING_VALIDATION', planilla_id: undefined };
            }

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

      const updatedCashMovements = s.cashMovements.filter(cm => cm.id !== planilla.cash_movement_id);
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
      const updatedPlanillas = [...s.collectionPlanillas];
      
      updatedPlanillas[planillaIndex] = { ...planilla, status: 'EDITING', cash_movement_id: undefined, records: [] };

      let updatedRecords = [...s.collectionRecords];
      const updatedSales = [...s.sales];

      planilla.records.forEach(recordId => {
         const recIndex = updatedRecords.findIndex(r => r.id === recordId);
         if (recIndex > -1) {
            const rec = updatedRecords[recIndex];
            if (rec.seller_id !== 'MANUAL') {
               updatedRecords[recIndex] = { ...rec, status: 'PENDING_VALIDATION', planilla_id: undefined };
            }

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
      if (planilla.status === 'ANNULLED') return s; 

      const recordIndex = s.collectionRecords.findIndex(r => r.id === recordId);
      if (recordIndex === -1) return s;

      const record = s.collectionRecords[recordIndex];
      if (record.planilla_id !== planillaId) return s;

      const updatedPlanillas = [...s.collectionPlanillas];
      const updatedRecordIds = planilla.records.filter(id => id !== recordId);

      if (updatedRecordIds.length === 0) {
         updatedPlanillas[planillaIndex] = { ...planilla, records: [], total_amount: 0, record_count: 0, status: 'ANNULLED' };
      } else {
         updatedPlanillas[planillaIndex] = {
            ...planilla,
            records: updatedRecordIds,
            total_amount: planilla.total_amount - record.amount_reported,
            record_count: updatedRecordIds.length
         };
      }

      const updatedRecords = [...s.collectionRecords];
      updatedRecords[recordIndex] = { ...record, status: 'PENDING_VALIDATION', planilla_id: undefined };

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
            warehouse_id: 'CENTRAL', 
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

      const oldBatches = state.batches.filter(b => b.purchase_id === oldPurchase.id);
      const isConsumed = oldBatches.some(b => b.quantity_current < b.quantity_initial);
      
      if (isConsumed) {
         return { success: false, msg: 'No se puede editar: Los lotes de esta compra ya han sido vendidos o ajustados.' };
      }

      let newBatches = state.batches.filter(b => b.purchase_id !== oldPurchase.id);
      let newProducts = [...state.products];

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
         // Generar fallback si no encuentra correlativo (ahora no usamos el de la tienda falsa)
         finalCode = `HR-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      }
      return { dispatchSheets: [{ ...dispatch, code: finalCode, sunat_status: 'PENDING' }, ...state.dispatchSheets] };
   }),

   updateDispatchStatus: (dispatchId, status) => set((s) => ({
      dispatchSheets: s.dispatchSheets.map(ds => ds.id === dispatchId ? { ...ds, status } : ds)
   })),

   updateDispatch: (dispatchId, updates) => set(s => {
      const dispatch = s.dispatchSheets.find(d => d.id === dispatchId);
      if (!dispatch) return s; 

      const newSalesList = updates.sale_ids !== undefined ? updates.sale_ids : dispatch.sale_ids;
      
      const removedSaleIds = dispatch.sale_ids.filter(id => !newSalesList.includes(id));
      const addedSaleIds = newSalesList.filter(id => !dispatch.sale_ids.includes(id));

      return {
         dispatchSheets: s.dispatchSheets.map(d => 
            d.id === dispatchId ? { ...d, ...updates } : d
         ),
         sales: s.sales.map(sale => {
            if (removedSaleIds.includes(sale.id)) {
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

      const maxLiqNum = s.dispatchLiquidations.reduce((max, l) => {
         const num = parseInt(l.id.replace('LIQ-', ''), 10); 
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
                  origin_order_id: originalSale.id, 
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
               newPaymentStatus = 'PAID'; 
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

         updatedSale.items.forEach(item => {
            item.batch_allocations?.forEach(alloc => {
               const bIndex = nextBatches.findIndex(b => b.id === alloc.batch_id);
               if (bIndex >= 0) {
                  nextBatches[bIndex] = {
                     ...nextBatches[bIndex],
                     quantity_current: nextBatches[bIndex].quantity_current - alloc.quantity
                  };
               }
            });
         });

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

         liquidation.documents.forEach(doc => {
            const saleIndex = updatedSales.findIndex(sale => sale.id === doc.sale_id);
            if (saleIndex > -1) {
               const sale = updatedSales[saleIndex];

               let newBalance = sale.balance !== undefined ? sale.balance : sale.total;
               let collectionStatus = sale.collection_status;
               let paymentStatus = sale.payment_status;

               if (doc.action === 'PAID' || doc.action === 'CREDIT') {
                  newBalance = sale.total;
                  paymentStatus = 'PENDING';
                  collectionStatus = 'NONE';
               } else if (doc.action === 'PARTIAL_RETURN') {
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
                  dispatch_status: 'delivered' 
               };
            }
         });

         const updatedCashMovements = s.cashMovements.filter(cm => cm.reference_id !== liquidationId);

         const updatedDispatchSheets = s.dispatchSheets.map(ds =>
            ds.id === liquidation.dispatch_sheet_id ? { ...ds, status: 'in_transit' as const } : ds
         );

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
      if (s.currentCashSession) return s; 

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

      const sessionMovements = s.cashMovements.filter(m =>
         new Date(m.date) >= new Date(session.open_time) &&
         new Date(m.date) <= new Date(closeTime) &&
         m.reference_id !== session.id 
      );

      const sessionSales = s.sales.filter(sale =>
         sale.payment_method === 'CONTADO' &&
         !sale.document_type.includes('NOTA') &&
         new Date(sale.created_at) >= new Date(session.open_time) &&
         new Date(sale.created_at) <= new Date(closeTime)
      );

      const manualIncome = sessionMovements.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0);
      const manualExpense = sessionMovements.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0);

      const salesIncome = sessionSales.reduce((acc, sale) => acc + sale.total, 0);

      const totalIncome = manualIncome + salesIncome;
      const totalExpense = manualExpense;

      const expectedClose = session.system_opening_amount + totalIncome - totalExpense;

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
         currentCashSession: null 
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

   updateAttendanceRecord: (record) => set((s) => ({ attendanceRecords: s.attendanceRecords.map(r => r.id === record.id ? record : r) })),

   addEmployee: (employee) => set((s) => ({ employees: [...s.employees, employee] })),
   updateEmployee: (employee) => set((s) => ({ employees: s.employees.map(e => e.id === employee.id ? employee : e) })),
   
   addSalaryAdvance: (advance) => set((s) => ({ salaryAdvances: [...s.salaryAdvances, advance] })),
   updateSalaryAdvance: (advance) => set((s) => ({ salaryAdvances: s.salaryAdvances.map(a => a.id === advance.id ? advance : a) })),
   deleteSalaryAdvance: (id) => set((s) => ({ salaryAdvances: s.salaryAdvances.filter(a => a.id !== id) })),
   
   addPayrollRecord: (record) => set((s) => ({ payrollRecords: [...s.payrollRecords, record] })),
   
   processPayroll: (employeeId, userId) => set((s) => {
      const employee = s.employees.find(e => e.id === employeeId);
      if (!employee) return s;

      const pendingAdvances = s.salaryAdvances.filter(a => a.employee_id === employeeId && a.status === 'PENDING');
      const advancesAmount = pendingAdvances.reduce((acc, curr) => acc + curr.amount, 0);

      const baseAmount = employee.base_salary;
      const legalDeductions = baseAmount * (employee.legal_deduction_percent / 100);
      const netPaid = baseAmount - legalDeductions - advancesAmount;

      const newRecord: import('../types').PayrollRecord = {
         id: 'PR-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
         employee_id: employeeId,
         period: new Date().toISOString().substring(0, 7), // YYYY-MM
         base_amount: baseAmount,
         legal_deductions: legalDeductions,
         advances_amount: advancesAmount,
         net_paid: netPaid,
         issue_date: new Date().toISOString()
      };

      const cashMovement: import('../types').CashMovement = {
         id: 'CM-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
         type: 'EXPENSE',
         category_name: 'PAGO_PLANILLA',
         description: `Pago Nómina ${employee.name} (${newRecord.period})`,
         amount: netPaid,
         date: new Date().toISOString(),
         reference_id: newRecord.id,
         user_id: userId
      };

      let newNextDate = new Date(employee.next_due_date);
      if (employee.payment_frequency === 'MONTHLY') {
         newNextDate.setUTCMonth(newNextDate.getUTCMonth() + 1);
      } else if (employee.payment_frequency === 'WEEKLY') {
         newNextDate.setUTCDate(newNextDate.getUTCDate() + 7);
      } else if (employee.payment_frequency === 'BIWEEKLY') {
         newNextDate.setUTCDate(newNextDate.getUTCDate() + 14);
      }
      
      const updatedEmployee = {
         ...employee,
         next_due_date: newNextDate.toISOString().split('T')[0]
      };

      return {
         employees: s.employees.map(e => e.id === employeeId ? updatedEmployee : e),
         payrollRecords: [...s.payrollRecords, newRecord],
         salaryAdvances: s.salaryAdvances.map(a => 
            (a.employee_id === employeeId && a.status === 'PENDING') ? { ...a, status: 'PAID' } : a
         ),
         cashMovements: [...s.cashMovements, cashMovement],
      };
   }),

   addPromotion: (promo) => set((s) => ({ promotions: [...s.promotions, promo] })),
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

   setSupabaseSessionUser: (user) => set(s => ({
      users: s.users.some(u => u.id === user.id) ? s.users : [...s.users, user],
      currentUser: user
   })),

   logout: () => set(() => ({ currentUser: null, deliveryMode: 'REGULAR' })),
   setDeliveryMode: (mode) => set({ deliveryMode: mode }),
}));

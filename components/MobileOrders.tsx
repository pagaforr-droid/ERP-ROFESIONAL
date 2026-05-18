import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Client, Order, AutoPromotion, Promotion, Sale } from '../types';
import { Plus, Trash2, Search, Save, X, ChevronDown, ChevronLeft, MapPin, Clock, Wallet, CheckCircle, Loader2, LogOut, User, ArrowRight, Edit, Minus, Eye, ShoppingCart, Lock, Truck, Zap, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { isPromoValidForContext } from '../utils/promoUtils';
import { supabase } from '../services/supabase';
import { saveOfflineOrder, getOfflineOrdersBySeller, removeOfflineOrder, markOfflineOrderError, OfflineOrder, saveMasterDataLocal, getMasterDataLocal, saveActiveSeller, getActiveSeller, clearActiveSeller } from '../utils/offlineSync';

type ViewMode = 'SELLER_SELECT' | 'CLIENT_LIST' | 'CLIENT_DETAIL' | 'PRODUCT_SELECT';
type ClientTab = 'ORDER' | 'COLLECTION';

interface CartItem {
   id: string;
   product_id: string;
   sku: string;
   name: string;
   quantity: number;
   unit_type: string;
   unit_price: number;
   discount_percent: number;
   total_price: number;
   is_bonus: boolean;
   auto_promo_id?: string;
   promo_name?: string;
   product_ref: Product;
   original_base_qty?: number;
}

const generateUUID = () => {
   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
       return crypto.randomUUID();
   }
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
       const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
       return v.toString(16);
   });
};


export const MobileOrders: React.FC = () => {
   const { currentUser, logout, annulOrder } = useStore();

   const [orderToAnnul, setOrderToAnnul] = useState<Order | null>(null);

   const [viewMode, setViewMode] = useState<ViewMode>('SELLER_SELECT');
   const [clientTab, setClientTab] = useState<ClientTab>('ORDER');
   const [listTab, setListTab] = useState<'CLIENTS' | 'HISTORY' | 'COLLECTIONS'>('CLIENTS');
   const [isExitModalOpen, setIsExitModalOpen] = useState(false);

   const [dbSellers, setDbSellers] = useState<any[]>([]);
   const [dbZones, setDbZones] = useState<any[]>([]);
   const [dbCompany, setDbCompany] = useState<any>(null);
   const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
   const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);
   const [dbPromos, setDbPromos] = useState<Promotion[]>([]);
   const [dbProducts, setDbProducts] = useState<(Product & { current_stock: number })[]>([]);
   const [dbSeries, setDbSeries] = useState<any[]>([]);
   const [dbClients, setDbClients] = useState<Client[]>([]);
   const [dbSales, setDbSales] = useState<Sale[]>([]);
   const [dbOrders, setDbOrders] = useState<Order[]>([]);
   const [loadedBatches, setLoadedBatches] = useState<Record<string, any[]>>({});
   const [cartProductsCache, setCartProductsCache] = useState<Record<string, Product>>({});

   const [isLoadingInitial, setIsLoadingInitial] = useState(true);
   const [isLoadingData, setIsLoadingData] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const [savingMessage, setSavingMessage] = useState('Sincronizando con Base...');
   const isSavingRef = React.useRef(false);
   const [isEditMode, setIsEditMode] = useState(false);
   const [originalOrder, setOriginalOrder] = useState<Order | null>(null);
   const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

   const [currentSellerId, setCurrentSellerId] = useState('');
   const [selectedClientId, setSelectedClientId] = useState('');
   const [selectedClient, setSelectedClient] = useState<Client | null>(null);

   const [docType, setDocType] = useState('BOLETA');
   const [pedidoSeries, setPedidoSeries] = useState('');
   const [pedidoNumber, setPedidoNumber] = useState('');
   const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
   const [deliveryMode, setDeliveryMode] = useState<'REGULAR' | 'EXPRESS_MISMO_DIA'>('REGULAR');
   const [clientAddress, setClientAddress] = useState('');
   const [priceListId, setPriceListId] = useState('');
   const [showBranchSelector, setShowBranchSelector] = useState(false);

   const [clientSearchTerm, setClientSearchTerm] = useState('');
   const [prodSearch, setProdSearch] = useState('');
   const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

   const [entryQty, setEntryQty] = useState<number>(1);
   const [entryUnit, setEntryUnit] = useState('UND');
   const [entryPrice, setEntryPrice] = useState<number>(0);
   const [entryDiscount, setEntryDiscount] = useState<number>(0);
   const [entryBonus, setEntryBonus] = useState(false);

   const [cart, setCart] = useState<CartItem[]>([]);

   const [pinPrompt, setPinPrompt] = useState<{ show: boolean, sellerId: string, expectedPin: string }>({ show: false, sellerId: '', expectedPin: '' });
   const [pinInput, setPinInput] = useState('');
   const [pinError, setPinError] = useState(false);

   const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
   const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
   const [paymentAmount, setPaymentAmount] = useState<number>(0);

   // --- SYSTEM NATIVE MODALS ---
   const [systemAlert, setSystemAlert] = useState<{ show: boolean, message: string, type?: 'info'|'error'|'success', title?: string }>({ show: false, message: '' });
   const [showReviewModal, setShowReviewModal] = useState(false);
   const [systemConfirm, setSystemConfirm] = useState<{ show: boolean, message: string, onConfirm: () => void, title?: string }>({ show: false, message: '', onConfirm: () => {} });
   const [showOrdersModal, setShowOrdersModal] = useState(false);
   const [selectedOrderActions, setSelectedOrderActions] = useState<Order | null>(null);
   const [isOffline, setIsOffline] = useState(!navigator.onLine);
   const [offlineOrders, setOfflineOrders] = useState<OfflineOrder[]>([]);
   
   useEffect(() => {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
         window.removeEventListener('online', handleOnline);
         window.removeEventListener('offline', handleOffline);
      };
   }, []);

   // --- BARRERAS ANTI-ACCIDENTES ---
   useEffect(() => {
      // 1. Prevenir Pull-to-Refresh en móviles
      const originalOverscroll = document.body.style.overscrollBehaviorY;
      document.body.style.overscrollBehaviorY = 'none';

      // 2. Alerta de salida accidental (beforeunload)
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
         e.preventDefault();
         e.returnValue = ''; // Requerido por navegadores modernos para mostrar la alerta nativa
         return '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      // 3. Prevenir F5 y Ctrl+R en teclado físico
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R')) || (e.metaKey && (e.key === 'r' || e.key === 'R'))) {
            e.preventDefault();
            setSystemAlert({ show: true, message: 'Actualización bloqueada. Si necesitas reiniciar, usa el botón de Salir.', type: 'info' });
         }
      };
      window.addEventListener('keydown', handleKeyDown);

      // Limpieza al desmontar el módulo para no afectar al resto del ERP
      return () => {
         document.body.style.overscrollBehaviorY = originalOverscroll;
         window.removeEventListener('beforeunload', handleBeforeUnload);
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, []);

   useEffect(() => {
       if (currentSellerId) {
           setOfflineOrders(getOfflineOrdersBySeller(currentSellerId));
       }
   }, [currentSellerId, viewMode, listTab]);

   useEffect(() => {
      const loadInitialApp = async () => {
         try {
            if (!navigator.onLine || isOffline) throw new Error("Offline");

            const [sellRes, zoneRes] = await Promise.all([
               supabase.from('sellers').select('*').eq('is_active', true).order('name'),
               supabase.from('zones').select('*')
            ]);
            if (sellRes.data) setDbSellers(sellRes.data);
            if (zoneRes.data) setDbZones(zoneRes.data);

             if (currentUser?.role === 'SELLER' && sellRes.data) {
                const matchingSeller = sellRes.data.find(s => String(s.name || '').trim().toUpperCase() === String(currentUser.name || '').trim().toUpperCase());
                if (matchingSeller) {
                    saveActiveSeller(matchingSeller.id);
                    handleSellerSelect(matchingSeller.id);
                }
             } else {
                 const activeSellerId = getActiveSeller();
                 if (activeSellerId && sellRes.data) {
                     handleSellerSelect(activeSellerId);
                 }
             }
         } catch (error) {
            console.error("Error al iniciar App Móvil:", error);
            const activeSellerId = getActiveSeller();
            if (activeSellerId) {
                const snapshot = getMasterDataLocal(activeSellerId);
                if (snapshot) {
                    setDbSellers(snapshot.sellers || []);
                    setDbZones(snapshot.zones || []);
                    handleSellerSelect(activeSellerId);
                } else {
                    setSystemAlert({ show: true, message: 'Sin conexión y sin respaldo local. Conéctese a internet.', type: 'error' });
                }
            } else {
                 setSystemAlert({ show: true, message: 'Sin conexión para inicio de sesión inicial.', type: 'error' });
            }
         } finally {
            setIsLoadingInitial(false);
         }
      };
      loadInitialApp();
   }, [currentUser, isOffline]);

   const handleSellerSelect = async (sellerId: string) => {
      if (!sellerId) return;

      const seller = dbSellers.find(s => s.id === sellerId);
      if (seller && seller.pin_code && viewMode === 'SELLER_SELECT') {
         setPinPrompt({ show: true, sellerId: sellerId, expectedPin: seller.pin_code });
         setPinInput('');
         return;
      }
      completeSellerSelect(sellerId);
   };

   const completeSellerSelect = async (sellerId: string) => {
      setCurrentSellerId(sellerId);
      setIsLoadingData(true);
      setViewMode('CLIENT_LIST');
      setListTab('CLIENTS');

      try {
         if (!navigator.onLine || isOffline) throw new Error("Offline");

         const today = new Date().toISOString().split('T')[0];
         const sellerZoneIds = dbZones.filter(z => z.assigned_seller_id === sellerId).map(z => z.id);

         let clientQuery = supabase.from('clients').select('*').eq('is_active', true);
         if (sellerZoneIds.length > 0) clientQuery = clientQuery.in('zone_id', sellerZoneIds);

         const [compRes, plRes, apRes, promRes, cliRes, prodRes, salesRes, ordersRes, seriesRes] = await Promise.all([
            supabase.from('company_config').select('*').limit(1).maybeSingle(),
            supabase.from('price_lists').select('*').order('name'),
            supabase.from('auto_promotions').select('*').eq('is_active', true),
            supabase.from('promotions').select('*').eq('is_active', true),
            clientQuery,
            // 🔥 CORRECCIÓN: Filtramos para descargar solo productos con stock > 0 para optimizar memoria
            supabase.from('vw_active_products').select('*').gt('current_stock', 0),
            supabase.from('sales').select('*').or('balance.gt.0,and(balance.is.null,total.gt.0)').neq('status', 'canceled').neq('document_type', 'NOTA_CREDITO'),
            supabase.from('orders').select('*').eq('seller_id', sellerId).gte('created_at', today),
            supabase.from('document_series').select('*').eq('type', 'PEDIDO').eq('is_active', true)
         ]);

         if (compRes.data) setDbCompany(compRes.data);
         if (plRes.data) setDbPriceLists(plRes.data);
         if (apRes.data) setDbAutoPromos(apRes.data);
         if (promRes.data) setDbPromos(promRes.data);
         if (cliRes.data) setDbClients(cliRes.data as Client[]);
         if (salesRes.data) setDbSales(salesRes.data as Sale[]);
         if (ordersRes.data) setDbOrders(ordersRes.data as Order[]);
         if (prodRes.data) setDbProducts(prodRes.data as any[]);

         if (seriesRes.data && seriesRes.data.length > 0) {
            setDbSeries(seriesRes.data);
            setPedidoSeries(seriesRes.data[0].series || '');
            setPedidoNumber(String(seriesRes.data[0].current_number + 1).padStart(8, '0'));
         }

         // Guardar Snapshot Local
         saveActiveSeller(sellerId);
         saveMasterDataLocal(sellerId, {
             company: compRes.data,
             priceLists: plRes.data,
             autoPromos: apRes.data,
             promos: promRes.data,
             clients: cliRes.data,
             products: prodRes.data,
             sales: salesRes.data,
             orders: ordersRes.data,
             series: seriesRes.data,
             sellers: dbSellers,
             zones: dbZones
         });

      } catch (error: any) {
         console.error("Error cargando maestros:", error);
         if (error.message === 'Offline' || error.message === 'Failed to fetch' || String(error.message).includes('fetch') || error.code === 'TypeError') {
             const snapshot = getMasterDataLocal(sellerId);
             if (snapshot) {
                 setDbCompany(snapshot.company || null);
                 setDbPriceLists(snapshot.priceLists || []);
                 setDbAutoPromos(snapshot.autoPromos || []);
                 setDbPromos(snapshot.promos || []);
                 setDbClients(snapshot.clients || []);
                 setDbProducts(snapshot.products || []);
                 setDbSales(snapshot.sales || []);
                 setDbOrders(snapshot.orders || []);
                 
                 if (snapshot.series && snapshot.series.length > 0) {
                     setDbSeries(snapshot.series);
                     setPedidoSeries(snapshot.series[0].series || '');
                     setPedidoNumber(String(snapshot.series[0].current_number + 1).padStart(8, '0'));
                 }
                 setSystemAlert({ show: true, message: 'Ruta cargada desde Respaldo Offline Local.', type: 'info' });
             } else {
                 setSystemAlert({ show: true, message: 'Sin conexión y sin respaldo local para esta ruta.', type: 'error' });
             }
         } else {
             setSystemAlert({ show: true, message: 'Error de conexión al cargar la ruta.', type: 'error' });
         }
      } finally {
         setIsLoadingData(false);
      }
   };

   const getMultiplier = (listId: string) => {
      if (!listId) return 1;
      const list = dbPriceLists.find(pl => pl.id === listId);
      return list ? Number(list.multiplier || list.factor || 1) : 1;
   };

   const calculateCalculatedPrice = (p: Product, unit: string, listId: string) => {
      let basePrice = 0;
      if (p.package_type && unit === p.package_type) {
         basePrice = Number(p.price_package || (p.price_unit * Number(p.package_content || 1)));
      } else {
         basePrice = Number(p.price_unit || 0);
      }

      let finalPrice = basePrice * getMultiplier(listId);
      let defaultDiscount = 0;

      const activePromo = dbPromos.find(promo => {
         if (!(promo.product_ids || []).includes(p.id)) return false;
         if (!isPromoValidForContext(promo, 'SELLER_APP', selectedClient?.city || '', currentSellerId || currentUser?.id, currentUser?.role)) return false;
         if (promo.target_price_list_ids?.length > 0 && listId && !promo.target_price_list_ids.includes('ALL') && !promo.target_price_list_ids.includes(listId)) return false;
         return true;
      });

      if (activePromo) {
         if (activePromo.type === 'PERCENTAGE_DISCOUNT') {
            defaultDiscount = Number(activePromo.value || 0);
         } else if (activePromo.type === 'FIXED_PRICE') {
            finalPrice = Number(activePromo.value || 0);
         }
      }

      return { price: finalPrice, discount: defaultDiscount };
   };

   const applyPromotions = (currentCart: CartItem[], listId: string) => {
      let cleanCart = currentCart.filter(item => !item.auto_promo_id);

      const getBaseQuantity = (item: CartItem) => {
         const conversionFactor = Number((item.unit_type || '').split('/')[1]) || 1;
         return item.quantity * conversionFactor;
      };

      const validPromos = dbAutoPromos.filter(ap => {
         if (!isPromoValidForContext(ap, 'SELLER_APP', selectedClient?.city || '', currentSellerId || currentUser?.id, currentUser?.role)) return false;
         if (ap.target_price_list_ids && ap.target_price_list_ids.length > 0 && listId) {
            if (!ap.target_price_list_ids.includes('ALL') && !ap.target_price_list_ids.includes(listId)) return false;
         }
         return true;
      });

      validPromos.forEach(ap => {
         let applies = false;
         let multiplier = 0;

         if (ap.condition_type === 'BUY_X_PRODUCT') {
            const qtyBought = cleanCart.filter(i => {
               if (i.is_bonus) return false;
               const hasList = ap.condition_product_ids && ap.condition_product_ids.length > 0;
               const hasSingle = !!ap.condition_product_id;
               if (hasList) return ap.condition_product_ids.includes(i.product_id);
               if (hasSingle) return i.product_id === ap.condition_product_id;
               return true;
            }).reduce((sum, i) => sum + getBaseQuantity(i), 0);

            if (qtyBought >= ap.condition_amount) {
               applies = true;
               multiplier = Math.floor(qtyBought / ap.condition_amount);
            }
         }
         else if (ap.condition_type === 'SPEND_Y_TOTAL') {
            const conditionItemKeys = ap.condition_product_ids || [];
            const totalSpent = cleanCart.reduce((sum, item) => {
               if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
               return sum + item.total_price;
            }, 0);
            if (totalSpent >= ap.condition_amount) {
               applies = true;
               multiplier = Math.floor(totalSpent / ap.condition_amount);
            }
         }
         else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = cleanCart.reduce((sum, item) => {
               const p = cartProductsCache[item.product_id] || item.product_ref;
               if (p?.category === ap.condition_category) return sum + item.total_price;
               return sum;
            }, 0);
            if (catSpent >= ap.condition_amount) {
               applies = true;
               multiplier = Math.floor(catSpent / ap.condition_amount);
            }
         }

         if (applies && multiplier > 0) {
            const rewardProduct = dbProducts.find(p => p.id === ap.reward_product_id) || cartProductsCache[ap.reward_product_id];
            if (rewardProduct) {
               const rewardQty = ap.reward_quantity * multiplier;
               const isPkgMode = ap.reward_unit_type === 'PKG' || ap.reward_unit_type === rewardProduct.package_type;
               const conversionFactor = isPkgMode ? Number(rewardProduct.package_content || 1) : 1;
               const realUnitName = isPkgMode ? `${String(rewardProduct.package_type || 'CAJA').toUpperCase()} / ${conversionFactor}` : `${String(rewardProduct.unit_type || 'UND').toUpperCase()} / 1`;

               cleanCart.push({
                  id: generateUUID(),
                  product_id: rewardProduct.id,
                  sku: rewardProduct.sku,
                  name: rewardProduct.name,
                  quantity: rewardQty,
                  unit_type: realUnitName,
                  unit_price: 0,
                  discount_percent: 100,
                  total_price: 0,
                  is_bonus: true,
                  auto_promo_id: ap.id,
                  promo_name: ap.name,
                  product_ref: rewardProduct
               });
            }
         }
      });

      setCart(cleanCart);
   };

   const executeAddToCart = () => {
      if (!selectedProduct) return;
      if (entryQty <= 0) return;

      const isPkgMode = entryUnit === selectedProduct.package_type;
      const conversionFactor = isPkgMode ? Number(selectedProduct.package_content || 1) : 1;
      const requiredBaseUnits = entryQty * conversionFactor;
      const formattedUnitName = `${entryUnit} / ${conversionFactor}`;

      const availableBatches = loadedBatches[selectedProduct.id] || [];

      // 🔥 CORRECCIÓN 2: Eliminamos la dependencia al "stock" heredado fantasma
      let totalStock = availableBatches.length > 0
         ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0)
         : Number(selectedProduct.current_stock || 0);

      let tempCart = [...cart];
      const existingIdx = tempCart.findIndex(i => i.product_id === selectedProduct.id && !i.is_bonus && !i.auto_promo_id && i.unit_type === formattedUnitName);

      let originalReserved = 0;
      let existingQty = 0;
      if (existingIdx >= 0) {
         existingQty = tempCart[existingIdx].quantity;
         if (isEditMode && tempCart[existingIdx].original_base_qty) {
            originalReserved = tempCart[existingIdx].original_base_qty || 0;
         }
      }

      totalStock += originalReserved;

      const totalRequiredBaseUnits = (existingQty + entryQty) * conversionFactor;

      if (totalStock < totalRequiredBaseUnits && !entryBonus) {
         setSystemAlert({ show: true, message: 'Stock Insuficiente para ' + selectedProduct.name + '.\nDisponible: ' + totalStock + ' unid.\nRequerido total: ' + totalRequiredBaseUnits + ' unid.', type: 'error' });
         return;
      }

      const gross = entryQty * entryPrice;
      const finalPrice = gross - (gross * (entryDiscount / 100));

      if (existingIdx >= 0) {
         setSystemAlert({ show: true, message: 'Producto duplicado: ¡Este producto ya estaba en el pedido! La cantidad ha sido sumada exitosamente.', type: 'error', title: 'Producto Actualizado' });
         tempCart[existingIdx].quantity += entryQty;
         const tGross = tempCart[existingIdx].quantity * tempCart[existingIdx].unit_price;
         tempCart[existingIdx].total_price = tGross - (tGross * (tempCart[existingIdx].discount_percent / 100));
      } else {
         tempCart.push({
            id: generateUUID(),
            product_id: selectedProduct.id,
            sku: selectedProduct.sku,
            name: selectedProduct.name,
            quantity: entryQty,
            unit_type: formattedUnitName,
            unit_price: entryPrice,
            discount_percent: entryDiscount,
            total_price: entryBonus ? 0 : finalPrice,
            is_bonus: entryBonus,
            product_ref: selectedProduct
         });
      }

      applyPromotions(tempCart, priceListId);

      setSelectedProduct(null);
      setProdSearch('');
      setEntryQty(1);
      setEntryPrice(0);
      setEntryDiscount(0);
      setEntryBonus(false);
      setClientTab('ORDER');
      setViewMode('CLIENT_DETAIL');
   };

   const handleCartQtyChange = (id: string, newQty: number) => {
      if (isNaN(newQty) || newQty <= 0) return;

      let tempCart = [...cart];
      const itemIndex = tempCart.findIndex(i => i.id === id);
      if (itemIndex < 0) return;

      const item = tempCart[itemIndex];
      const pRef = item.product_ref;

      const isPkgMode = item.unit_type === pRef.package_type;
      const conversionFactor = isPkgMode ? Number(pRef.package_content || 1) : 1;
      const requiredBaseUnits = newQty * conversionFactor;

      const availableBatches = loadedBatches[pRef.id] || [];

      // 🔥 CORRECCIÓN 3: Eliminamos la trampa de stock heredado aquí también
      let totalStock = availableBatches.length > 0
         ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0)
         : Number(pRef.current_stock || 0);

      if (isEditMode && item.original_base_qty) {
         totalStock += item.original_base_qty;
      }

      if (totalStock < requiredBaseUnits && !item.is_bonus) {
         // Permitir siempre la reducción de cantidad para destrabar al usuario
         if (newQty > item.quantity) {
            setSystemAlert({ show: true, message: 'Stock Insuficiente para ' + pRef.name + '.\nDisponible: ' + totalStock + ' unid.\nIntentó solicitar: ' + requiredBaseUnits + ' unid.', type: 'error' });
            return;
         }
      }

      const tGross = newQty * item.unit_price;
      tempCart[itemIndex] = { ...item, quantity: newQty, total_price: tGross - (tGross * (item.discount_percent / 100)) };

      applyPromotions(tempCart, priceListId);
   };

   const handleClientSelect = (client: Client) => {
      setIsEditMode(false); setOriginalOrder(null); setEditingOrderId(null);
      setSelectedClient(client);
      setSelectedClientId(client.id);
      
      const safeAddress = client.address ? String(client.address) : '';
      setClientAddress(safeAddress);
      
      setPriceListId(client.price_list_id || '');
      
      const safePaymentCond = String(client.payment_condition || '').toUpperCase();
      // Siempre predeterminar CONTADO por solicitud del usuario
      setPaymentMethod('CONTADO');
      
      const safeDocNum = String(client.doc_number || '');
      setDocType(safeDocNum.length === 11 ? 'FACTURA' : 'BOLETA');
      
      setCart([]);
      setClientTab('ORDER');
      setViewMode('CLIENT_DETAIL');
      setShowBranchSelector(false);
   };

   const handleEditOrder = async (order: Order) => {
      if (order.status !== 'pending') { setSystemAlert({ show: true, message: 'Solo editables los pedidos pendientes.', type: 'error' }); return; }
      setIsLoadingData(true);
      try {
         const { data: orderItemsData, error } = await supabase.from('order_items').select(`*`).eq('order_id', order.id);
         if (error) throw error;

         const client = dbClients.find(c => c.id === order.client_id);

         let loadedItems: CartItem[] = [];
         if (orderItemsData && orderItemsData.length > 0) {
            const pIds = [...new Set(orderItemsData.map((item: any) => item.product_id))];

            const [prodsRes, batchesRes] = await Promise.all([
               supabase.from('vw_active_products').select('*').in('id', pIds), // Consultar la vista también aquí
               supabase.from('batches').select('*').in('product_id', pIds).gt('quantity_current', 0)
            ]);

            const prods = prodsRes.data || [];
            const bData = batchesRes.data || [];

            const batchCache: Record<string, any[]> = { ...loadedBatches };
            const prodMap = prods.reduce((acc: any, p: any) => {
               batchCache[p.id] = bData.filter(b => b.product_id === p.id);
               return { ...acc, [p.id]: p };
            }, {});

            setLoadedBatches(batchCache);

            loadedItems = orderItemsData.map((item: any) => {
               const pRef = prodMap[item.product_id] || dbProducts.find(p => p.id === item.product_id) || {} as Product;
               const loadedUnitType = item.unit_type || item.selected_unit || 'UND';
               const conversionFactor = Number(loadedUnitType.split('/')[1]) || 1;
               const rawQuantity = item.quantity || item.quantity_presentation || item.quantity_base || 1;
               
               return {
                  id: item.id,
                  product_id: item.product_id,
                  sku: item.product_sku || pRef.sku,
                  name: item.product_name || pRef.name,
                  quantity: rawQuantity / conversionFactor,
                  unit_type: loadedUnitType,
                  unit_price: item.unit_price || 0,
                  discount_percent: item.discount_percent || 0,
                  total_price: item.total_price || 0,
                  is_bonus: item.is_bonus || false,
                  auto_promo_id: item.auto_promo_id || undefined,
                  promo_name: item.auto_promo_id ? 'PROMO' : undefined,
                  product_ref: pRef,
                  original_base_qty: rawQuantity
               };
            });
         }

         setOriginalOrder(order);
         setIsEditMode(true);
         setEditingOrderId(order.id);
         setDocType((order.suggested_document_type as any) || 'FACTURA');

         if (order.code && order.code.includes('-')) {
            const [s, n] = order.code.split('-'); setPedidoSeries(s || ''); setPedidoNumber(n || '');
         } else { setPedidoNumber(order.code || ''); }

         setPaymentMethod((order.payment_method as any) || 'CONTADO');
         setDeliveryMode((order.delivery_mode as any) || 'REGULAR');
         setClientAddress(order.delivery_address || '');
         setSelectedClientId(order.client_id || '');
         if (client) {
            setSelectedClient(client);
            setPriceListId(order.price_list_id || client.price_list_id || '');
         } else {
            setPriceListId(order.price_list_id || '');
         }

         setCart(loadedItems);
         setClientTab('ORDER');
         setViewMode('CLIENT_DETAIL');
      } catch (e) { setSystemAlert({ show: true, message: 'Error al cargar pedido.', type: 'error' }); } finally { setIsLoadingData(false); }
   };


   const handleProductClick = async (p: Product) => {
      setIsLoadingData(true);
      try {
         let bData = null;
         let fetchError = null;

         if (navigator.onLine && !isOffline) {
             const { data, error } = await supabase.from('batches').select('*').eq('product_id', p.id).gt('quantity_current', 0);
             bData = data;
             if (error && !String(error.message).includes('fetch') && error.message !== 'Offline' && error.code !== 'TypeError') {
                 fetchError = error;
             }
         }

         if (fetchError) {
            console.error("Error crítico leyendo lotes:", fetchError);
            setSystemAlert({ show: true, message: 'Error validando el stock en tiempo real.', type: 'error' });
            return;
         }

         const freshStock = bData ? bData.reduce((sum, b) => sum + Number(b.quantity_current || 0), 0) : Number(p.current_stock || 0);

         const updatedProduct = { ...p, current_stock: freshStock };

         setDbProducts(prev => prev.map(prod => prod.id === p.id ? updatedProduct : prod));
         setCartProductsCache(prev => ({ ...prev, [p.id]: updatedProduct }));
         setLoadedBatches(prev => ({ ...prev, [p.id]: bData || [] }));
         setSelectedProduct(updatedProduct);

         const defaultUnit = p.unit_type || 'UND';
         setEntryUnit(defaultUnit);
         setEntryQty(1);

         const { price, discount } = calculateCalculatedPrice(updatedProduct, defaultUnit, priceListId);
         setEntryPrice(price);
         setEntryDiscount(discount);
         setEntryBonus(false);
         setViewMode('PRODUCT_SELECT');
      } catch (e) {
         console.error(e);
      } finally {
         setIsLoadingData(false);
      }
   };

   const handleUnitChange = (newUnit: string) => {
      setEntryUnit(newUnit);
      if (selectedProduct) {
         const { price, discount } = calculateCalculatedPrice(selectedProduct, newUnit, priceListId);
         setEntryPrice(price);
         setEntryDiscount(discount);
      }
   };

   const handleSaveOrder = async () => {
      if (!selectedClient) return;
      if (cart.length === 0) { setSystemAlert({ show: true, message: "El pedido está vacío.", type: "error" }); return; }

      const currentTotal = cart.reduce((sum, item) => sum + item.total_price, 0);

      setSystemConfirm({
         show: true,
         title: isEditMode ? 'Sobreescribir Pedido' : 'Enviar Pedido',
         message: '¿Está seguro de CERRAR Y ENVIAR este pedido por S/ ' + currentTotal.toFixed(2) + '?',
         onConfirm: async () => {
            isSavingRef.current = true;
            setIsSaving(true);
            setSavingMessage('Localizando GPS (Alta precisión)...');

            // 🔥 CAPTURA GPS ROBUSTA CON FALLBACK
            let creationLocation = null;
            if ("geolocation" in navigator) {
                try {
                    creationLocation = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
                            (err) => reject(err),
                            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 } // Forzar GPS fresco
                        );
                    });
                } catch (e) {
                    // Fallback a baja precisión (red/wifi) si el GPS puro falla en interiores
                    setSavingMessage('GPS débil. Intentando red...');
                    try {
                        creationLocation = await new Promise((resolve) => {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
                                () => resolve(null),
                                { enableHighAccuracy: false, timeout: 7000, maximumAge: 0 }
                            );
                        });
                    } catch (e2) {
                        creationLocation = null;
                    }
                }
            }

            setSavingMessage('Guardando Pedido...');

            const currentClientDebt = pendingBills.reduce((sum, s) => sum + Number(s.balance ?? s.total ?? 0), 0);

            const orderPayload = {
               id: isEditMode && originalOrder ? originalOrder.id : generateUUID(),
               code: isEditMode && originalOrder ? originalOrder.code : pedidoSeries + '-' + pedidoNumber,
               client_id: selectedClientId || null,
               client_name: selectedClient?.name || '',
               client_doc_type: (selectedClient?.doc_number || '').length === 11 ? 'RUC' : 'DNI',
               client_doc_number: selectedClient?.doc_number || '',
               seller_id: currentSellerId || null,
               suggested_document_type: docType,
               payment_method: paymentMethod,
               total: Number(currentTotal.toFixed(2)),
               status: 'pending',
               delivery_address: clientAddress || null,
               creation_location: creationLocation, // NUEVO: Tracking GPS
               price_list_id: priceListId || null,
               previous_debt: currentClientDebt,
               delivery_mode: deliveryMode,
               delivery_date: deliveryMode === 'EXPRESS_MISMO_DIA' ? new Date().toISOString().split('T')[0] : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })(),
               items: cart.map(c => {
                  const conversionFactor = Number((c.unit_type || '').split('/')[1]) || 1;
                  const qtyBase = c.quantity * conversionFactor;
                  return {
                     id: c.id,
                     product_id: c.product_id,
                     product_sku: c.sku,
                     product_name: c.name,
                     quantity: qtyBase,
                     unit_type: c.unit_type,
                     selected_unit: c.unit_type,
                     quantity_presentation: c.quantity,
                     quantity_base: qtyBase,
                     unit_price: c.unit_price,
                     discount_percent: c.discount_percent,
                     discount_amount: (c.quantity * c.unit_price) * (c.discount_percent / 100),
                     total_price: c.total_price,
                     is_bonus: c.is_bonus,
                     auto_promo_id: c.auto_promo_id || null
                  };
               })
            };

            try {
               if (!navigator.onLine || isOffline) {
                   saveOfflineOrder(orderPayload, currentSellerId || 'UNK');
                   setSystemAlert({ show: true, message: '¡Guardado Localmente (Sin Conexión)! Se enviará al recuperar la señal.', type: 'info' });
                   setViewMode('CLIENT_LIST');
                   setListTab('HISTORY');
                   setCart([]);
                   setOfflineOrders(getOfflineOrdersBySeller(currentSellerId || 'UNK'));
                   return;
               }

               const rpcName = isEditMode ? 'update_order_transaction' : 'process_order_transaction';
               const { data, error } = await supabase.rpc(rpcName, { p_order_data: orderPayload });
               if (error) {
                   if (error.message === 'Failed to fetch' || String(error.message).includes('fetch') || error.code === 'TypeError') {
                       saveOfflineOrder(orderPayload, currentSellerId || 'UNK');
                       setSystemAlert({ show: true, message: '¡Guardado Localmente por fallo de red! Se reintentará luego.', type: 'info' });
                       setViewMode('CLIENT_LIST');
                       setListTab('HISTORY');
                       setCart([]);
                       setOfflineOrders(getOfflineOrdersBySeller(currentSellerId || 'UNK'));
                       return;
                   }
                   throw error;
               }
               setSystemAlert({ show: true, message: isEditMode ? '¡Pedido modificado con éxito!' : ('¡Pedido guardado! Código: ' + (data?.real_code || pedidoNumber)), type: 'success' });
               setViewMode('CLIENT_LIST');
               setListTab('HISTORY');
               setCart([]);
               handleSellerSelect(currentSellerId);
            } catch (error: any) {
               setSystemAlert({ show: true, message: 'Error al guardar: ' + (error.message || JSON.stringify(error)), type: 'error' });
            } finally {
               isSavingRef.current = false;
               setIsSaving(false);
               setSavingMessage('Sincronizando con Base...');
            }
         }
      });
   };

   const syncOfflineOrders = async () => {
      if (!navigator.onLine || isOffline) {
          setSystemAlert({ show: true, message: 'No hay conexión a internet para sincronizar.', type: 'error' });
          return;
      }

      setIsSaving(true);
      setSavingMessage('Sincronizando pedidos locales...');
      isSavingRef.current = true;

      const pendingOrders = getOfflineOrdersBySeller(currentSellerId);
      let successCount = 0;
      let errorCount = 0;

      for (const localOrder of pendingOrders) {
          if (localOrder.status === 'ERROR') continue; // Solo reintentar los PENDING_SYNC

          try {
             const { error } = await supabase.rpc('process_order_transaction', { p_order_data: localOrder.payload });
             
             if (error) {
                if (String(error.message).toLowerCase().includes('stock')) {
                   markOfflineOrderError(localOrder.localId, 'Pedido sin stock');
                   errorCount++;
                } else {
                   markOfflineOrderError(localOrder.localId, error.message);
                   errorCount++;
                }
             } else {
                removeOfflineOrder(localOrder.localId);
                successCount++;
             }
          } catch (e: any) {
             console.error("Sync error:", e);
             errorCount++;
          }
      }

      setOfflineOrders(getOfflineOrdersBySeller(currentSellerId));
      isSavingRef.current = false;
      setIsSaving(false);
      setSavingMessage('Sincronizando con Base...');

      if (successCount > 0 || errorCount > 0) {
          setSystemAlert({ 
             show: true, 
             message: `Sincronización finalizada.\nÉxitos: ${successCount}\nErrores: ${errorCount}`, 
             type: errorCount > 0 ? 'error' : 'success' 
          });
          handleSellerSelect(currentSellerId);
      }
   };

   const handleNewOrder = () => {
      setIsEditMode(false);
      setOriginalOrder(null);
      setEditingOrderId(null);
      setDeliveryMode('REGULAR');
      setCart([]);
      setViewMode('CLIENT_LIST');
   };

   const confirmPayment = async () => {
      if (!selectedSale || paymentAmount <= 0) return;
      const currentBalance = selectedSale.balance !== undefined && selectedSale.balance !== null ? selectedSale.balance : selectedSale.total;
      if (paymentAmount > currentBalance) { setSystemAlert({ show: true, message: 'El monto supera el saldo.', type: 'error' }); return; }

      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setIsSaving(true);
      try {
         const { error } = await supabase.rpc('process_collection', {
            p_sale_id: selectedSale.id, p_seller_id: currentSellerId, p_amount: paymentAmount
         });
         if (error) throw error;
         setSystemAlert({ show: true, message: 'Cobro reportado a central.', type: 'success' });
         setIsPaymentModalOpen(false); setPaymentAmount(0); setSelectedSale(null);
         handleSellerSelect(currentSellerId);
      } catch (e: any) { setSystemAlert({ show: true, message: 'Error reportando cobro: ' + e.message, type: 'error' }); }
      finally { 
         isSavingRef.current = false;
         setIsSaving(false); 
      }
   };

   const confirmExitApp = () => {
      if (currentUser?.role === 'SELLER') { logout(); return; }
      setCurrentSellerId(''); setSelectedClient(null); setCart([]); setViewMode('SELLER_SELECT'); setIsExitModalOpen(false);
   };

   const confirmAnnulOrder = async () => {
      if (!orderToAnnul) return;
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setIsSaving(true);
      try {
         const { success, msg } = await annulOrder(orderToAnnul.id, currentUser?.id || 'SELLER');
         if (!success) throw new Error(msg);
         
         // Actualizar estado local eliminando o marcando como cancelado
         setDbOrders(prev => prev.map(o => o.id === orderToAnnul.id ? { ...o, status: 'canceled' as any } : o));
         setOrderToAnnul(null);
      } catch (e: any) {
         setSystemAlert({ show: true, message: 'Error anulando pedido: ' + e.message, type: 'error' });
      } finally {
         isSavingRef.current = false;
         setIsSaving(false);
      }
   };

   const openPaymentModal = (bill: Sale) => {
      setSelectedSale(bill);
      setPaymentAmount(bill.balance ?? bill.total ?? 0);
      setIsPaymentModalOpen(true);
   };

   const filteredClientsList = useMemo(() => {
      if (!clientSearchTerm) return dbClients;
      let term = clientSearchTerm.toLowerCase();
      try { term = term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
      
      return dbClients.filter(c => {
         let name = (c.name || '').toLowerCase();
         try { name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
         return name.includes(term) || (c.doc_number || '').includes(term);
      });
   }, [dbClients, clientSearchTerm]);

   const filteredProductsList = useMemo(() => {
      const term = String(prodSearch || '').toLowerCase();
      return dbProducts.filter(p => {
         const pName = String(p.name || '').toLowerCase();
         const pSku = String(p.sku || '').toLowerCase();
         const matchesSearch = pName.includes(term) || pSku.includes(term);
         const matchesCategory = selectedCategory === 'TODOS' || p.category === selectedCategory;
         return matchesSearch && matchesCategory;
      });
   }, [dbProducts, prodSearch, selectedCategory]);

   const pendingBills = useMemo(() => {
      try {
         if (!selectedClient) return [];
         return (dbSales || []).filter(s => {
            if (!s || s.client_id !== selectedClient.id) return false;
            const balance = s.balance ?? s.total ?? 0;
            return balance > 0;
         }).sort((a, b) => {
            const getSafeTime = (dateVal: any) => {
               try {
                  if (!dateVal) return 0;
                  const safeStr = typeof dateVal === 'string' ? dateVal.replace(' ', 'T') : String(dateVal);
                  const time = new Date(safeStr).getTime();
                  return isNaN(time) ? 0 : time;
               } catch(e) { return 0; }
            };
            return getSafeTime(a?.created_at) - getSafeTime(b?.created_at);
         });
      } catch (e) {
         console.error("Error in pendingBills:", e);
         return [];
      }
   }, [dbSales, selectedClient]);

   let cartTotal = 0;
   try {
      cartTotal = (cart || []).reduce((acc, item) => acc + Number(item?.total_price || 0), 0);
   } catch(e) { console.error("Error in cartTotal", e); }
   const categoriesList = useMemo(() => ['TODOS', ...Array.from(new Set(dbProducts.map(p => p.category))).filter(Boolean).sort()], [dbProducts]);

   const renderContent = () => {
   if (isLoadingInitial) {
      return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
   }

   if (viewMode === 'SELLER_SELECT') {
      return (
         <div className="fixed inset-0 bg-slate-900 p-4 flex flex-col justify-center items-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border-t-4 border-blue-500">
               <div className="bg-blue-50 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <User className="w-12 h-12 text-blue-600" />
               </div>
               <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">App Ruta Ventas</h2>
               <p className="text-slate-500 mb-8 text-sm">Seleccione su perfil de campo.</p>
               <select className="w-full p-4 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-700 bg-slate-50 focus:border-blue-500 outline-none" onChange={(e) => handleSellerSelect(e.target.value)} value={currentSellerId}>
                  <option value="">-- Seleccionar Perfil --</option>
                  {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
         </div>
      );
   }

   if (viewMode === 'CLIENT_LIST') {
      return (
         <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden">
            {isLoadingData && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>}

            {isExitModalOpen && (
               <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-fade-in-up">
                     <LogOut className="w-16 h-16 text-red-500 mx-auto mb-4 bg-red-50 p-3 rounded-full" />
                     <h3 className="text-xl font-black text-slate-800 mb-2">¿Finalizar Ruta?</h3>
                     <p className="text-slate-500 text-sm mb-6">Se cerrará la sesión del dispositivo.</p>
                     <div className="flex gap-3">
                        <button onClick={() => setIsExitModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
                        <button onClick={confirmExitApp} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">Salir</button>
                     </div>
                  </div>
               </div>
            )}

            {orderToAnnul && (
               <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-fade-in-up">
                     <Trash2 className="w-16 h-16 text-red-500 mx-auto mb-4 bg-red-50 p-3 rounded-full" />
                     <h3 className="text-xl font-black text-slate-800 mb-2">¿Anular Pedido?</h3>
                     <p className="text-slate-500 text-sm mb-6">El pedido <b>{orderToAnnul.code}</b> será anulado y el stock regresará al Kardex. Esta acción no se puede deshacer.</p>
                     <div className="flex gap-3">
                        <button onClick={() => setOrderToAnnul(null)} disabled={isSaving} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 disabled:opacity-50">Cancelar</button>
                        <button onClick={confirmAnnulOrder} disabled={isSaving} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg flex justify-center items-center disabled:opacity-50">
                           {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sí, Anular'}
                        </button>
                     </div>
                  </div>
               </div>
            )}

            <div className="bg-slate-900 text-white p-4 shadow-lg rounded-b-[1.5rem] shrink-0 z-10">
               <div className="flex justify-between items-center mb-3">
                  <div>
                     <h2 className="text-lg font-black leading-tight">Ruta Móvil</h2>
                     <div className="flex items-center gap-2 mt-0.5">
                         <p className="text-[11px] text-blue-300 font-medium">Vendedor: {dbSellers.find(s => s.id === currentSellerId)?.name || 'Desconocido'}</p>
                         {isOffline && <span className="bg-red-500/20 text-red-300 border border-red-500/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold"><WifiOff className="w-3 h-3"/> OFFLINE</span>}
                         {(!navigator.onLine || isOffline) && getActiveSeller() === currentSellerId && <span className="bg-orange-500/20 text-orange-300 border border-orange-500/50 text-[9px] px-1.5 py-0.5 rounded font-bold">RESPALDO LOCAL</span>}
                     </div>
                  </div>
                  <div className="flex gap-2 items-center">
                     <button onClick={() => { if (!isOffline && currentSellerId) completeSellerSelect(currentSellerId); }} disabled={isOffline || isLoadingData} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors shrink-0 disabled:opacity-50" title="Actualizar Catálogo">
                        <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin text-blue-500' : 'text-slate-300'}`} />
                     </button>
                     {offlineOrders.length > 0 && (
                        <button onClick={() => setShowOrdersModal(true)} className="relative bg-orange-500 hover:bg-orange-600 p-2 rounded-full transition-colors shadow-lg animate-pulse">
                           <CloudOff className="w-4 h-4 text-white" />
                           <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">{offlineOrders.length}</span>
                        </button>
                     )}
                     <button onClick={() => setIsExitModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors shrink-0">
                        <LogOut className="w-4 h-4 text-slate-300" />
                     </button>
                  </div>
               </div>

               <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                  <button onClick={() => setListTab('CLIENTS')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${listTab === 'CLIENTS' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}>
                     <User className="w-4 h-4 mr-2" /> Clientes
                  </button>
                  <button onClick={() => setShowOrdersModal(true)} className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all text-slate-400 active:bg-slate-700">
                     <Clock className="w-4 h-4 mr-2" /> Mis Pedidos
                  </button>
               </div>

               {listTab === 'CLIENTS' && (
                  <div className="relative mt-3">
                     <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                     <input
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-400 font-medium outline-none focus:border-blue-500 transition-colors"
                        placeholder="Buscar cliente (RUC o Nombre)..."
                        value={clientSearchTerm}
                        onChange={e => setClientSearchTerm(e.target.value)}
                     />
                  </div>
               )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-2 custom-scrollbar">
               {listTab === 'CLIENTS' && filteredClientsList.map(c => {
                  const debt = dbSales.filter(s => {
                     const balance = s.balance ?? s.total ?? 0;
                     return s.client_id === c.id && balance > 0;
                  }).reduce((sum, s) => sum + Number(s.balance ?? s.total ?? 0), 0);
                  
                  const initials = (c.name || 'C').substring(0, 2).toUpperCase();
                  
                  return (
                     <div key={c.id} onClick={() => handleClientSelect(c)} className="bg-white p-3 rounded-2xl shadow-sm active:scale-95 transition-transform cursor-pointer border border-slate-100 flex items-center gap-3 relative overflow-hidden group">
                        {debt > 0 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                           <span className="font-black text-slate-400 text-xs">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <h3 className="font-black text-slate-800 text-[13px] leading-tight truncate">{c.name}</h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{c.doc_number || '-'}</span>
                              {debt > 0 && <span className="text-[10px] text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded border border-red-100 shrink-0">Deuda: S/ {debt.toFixed(2)}</span>}
                           </div>
                        </div>
                        <ArrowRight className="text-slate-300 w-4 h-4 shrink-0 group-hover:text-blue-500 transition-colors" />
                     </div>
                  );
               })}
               {listTab === 'CLIENTS' && filteredClientsList.length === 0 && <div className="text-center p-8 text-slate-400 font-bold text-sm">Sin resultados en la ruta.</div>}
            </div>
         </div>
      );
   }

   if (viewMode === 'CLIENT_DETAIL') {
      if (!selectedClient) return null;
      
      const hasBranches = Array.isArray(selectedClient.branches) && selectedClient.branches.length > 0;
      const branchList = Array.isArray(selectedClient.branches) ? selectedClient.branches : [];

      return (
         <div className="fixed inset-0 h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">

            {isSaving && <div className="absolute inset-0 bg-white/90 z-[100] flex flex-col items-center justify-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-2" /><p className="font-bold text-slate-600 px-6 text-center">{savingMessage}</p></div>}

            {isPaymentModalOpen && selectedSale && (
               <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
                  <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-10 shadow-2xl animate-slide-up max-h-[85dvh] overflow-y-auto flex flex-col">
                     <div className="flex justify-between items-start mb-6 shrink-0">
                        <div>
                           <h3 className="text-xl font-black text-slate-800">Reportar Cobro</h3>
                           <p className="text-sm text-slate-500 font-mono font-bold mt-1">{selectedSale.series}-{selectedSale.number}</p>
                        </div>
                        <button onClick={() => setIsPaymentModalOpen(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 shrink-0">
                        <div className="flex justify-between items-center text-sm mb-2"><span className="text-slate-500 font-bold">Total:</span><span className="font-bold">S/ {Number(selectedSale.total || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between items-center text-red-600 border-t border-slate-200 pt-2">
                           <span className="font-black">Saldo Pendiente:</span>
                           <span className="font-black text-xl">S/ {Number(selectedSale.balance ?? selectedSale.total ?? 0).toFixed(2)}</span>
                        </div>
                     </div>
                     <div className="mb-6 shrink-0 flex-1">
                        <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest flex justify-between">
                           <span>A CUENTA / AMORTIZACIÓN (S/)</span>
                        </label>
                        <input type="number" autoFocus className="w-full py-3 text-center text-3xl font-black text-slate-800 border-2 border-slate-300 rounded-2xl focus:border-green-500 focus:ring-0 outline-none" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} />
                     </div>
                     <button onClick={confirmPayment} disabled={isSaving || paymentAmount <= 0} className="w-full shrink-0 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg shadow-green-600/30 flex items-center justify-center disabled:opacity-50 mt-4">
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'CONFIRMAR COBRO'}
                     </button>
                  </div>
               </div>
            )}

            {/* HEADER SUPERIOR */}
            <div className="bg-white shadow-sm p-3 z-20 shrink-0">
               <div className="flex items-start gap-2 mb-2">
                  <button onClick={() => { setViewMode('CLIENT_LIST'); handleSellerSelect(currentSellerId); }} className="bg-slate-100 p-1.5 rounded-full mt-0.5 active:bg-slate-200"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <div className="flex-1">
                     <h2 className="font-black text-base text-slate-900 leading-tight">{String(selectedClient?.name || 'Cliente sin nombre')}</h2>
                     <div className="text-xs font-bold text-slate-500 mt-0.5">{String(selectedClient?.doc_number || '-')}</div>
                  </div>
               </div>

               {isEditMode && (
                  <div className="mb-3 px-3 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-lg flex justify-between items-center shadow-sm">
                     <span className="flex items-center text-xs"><Edit className="w-4 h-4 mr-2" /> MODIFICANDO: {originalOrder?.code}</span>
                     <button onClick={handleNewOrder} className="bg-white text-red-600 font-black px-2 py-1 rounded text-[10px] uppercase">Descartar</button>
                  </div>
               )}

               <div className="relative mb-3">
                  <div className={`flex items-center gap-2 p-2 bg-slate-50 border rounded-lg ${hasBranches ? 'active:bg-blue-50 border-blue-200' : 'border-slate-200'}`} onClick={() => { if (hasBranches) setShowBranchSelector(!showBranchSelector); }}>
                     <MapPin className={`w-4 h-4 shrink-0 ${hasBranches ? 'text-blue-600' : 'text-slate-400'}`} />
                     <div className="flex-1 text-xs font-bold text-slate-700 truncate">{clientAddress || 'Sin dirección'}</div>
                     {hasBranches ? <ChevronDown className="w-4 h-4 text-blue-500" /> : null}
                  </div>
                  {showBranchSelector && hasBranches && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg z-50 overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-[10px] text-slate-500 uppercase">Cambiar Dirección</div>
                        <div className="max-h-48 overflow-y-auto p-1 space-y-1">
                           {[selectedClient.address, ...branchList].filter(Boolean).map((addr, idx) => (
                              <div key={idx} onClick={() => { setClientAddress(String(addr)); setShowBranchSelector(false); }} className="p-2 rounded-lg active:bg-blue-50 bg-white flex items-center gap-2">
                                 <MapPin className={`w-4 h-4 shrink-0 ${clientAddress === addr ? 'text-blue-600' : 'text-slate-300'}`} />
                                 <div className={`text-xs ${clientAddress === addr ? 'font-black text-blue-900' : 'font-bold text-slate-600'}`}>{addr}</div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               <div className="flex gap-2">
                  <button onClick={() => setClientTab('ORDER')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${clientTab === 'ORDER' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>Pedido</button>
                  <button onClick={() => setClientTab('COLLECTION')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 ${clientTab === 'COLLECTION' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-slate-100 text-slate-500'}`}>
                     Cobranzas {pendingBills.length > 0 && <span className="bg-white text-orange-600 px-1.5 py-0.5 rounded-full text-[9px]">{pendingBills.length}</span>}
                  </button>
               </div>
            </div>

            {clientTab === 'ORDER' && (
               <div className="flex-1 flex flex-col min-h-0">

                  <div className="flex flex-col gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
                     <div className="flex gap-2">
                        <div className="flex-1 flex items-center justify-center rounded-lg text-[10px] font-black border bg-white text-slate-700 shadow-sm border-slate-200">
                           {docType}
                        </div>
                        <select className="flex-1 bg-white text-slate-700 px-2 py-2 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm outline-none" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                           <option value="CONTADO">CONTADO</option>
                           <option value="CREDITO">CRÉDITO</option>
                        </select>
                     </div>
                     <div className="flex gap-1 bg-slate-200/70 p-1 rounded-lg">
                        <button onClick={() => setDeliveryMode('REGULAR')} className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all flex items-center justify-center gap-1.5 ${deliveryMode === 'REGULAR' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                           <Truck className="w-3.5 h-3.5" /> Ruta (Mañana)
                        </button>
                        <button onClick={() => setDeliveryMode('EXPRESS_MISMO_DIA')} className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all flex items-center justify-center gap-1.5 ${deliveryMode === 'EXPRESS_MISMO_DIA' ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'text-slate-500 hover:bg-slate-200'}`}>
                           <Zap className="w-3.5 h-3.5" /> Fuera de Ruta (Hoy)
                        </button>
                     </div>
                  </div>

                                    <div className="flex-1 bg-slate-100 p-4 flex flex-col items-center justify-center text-center">
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full animate-fade-in-up">
                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                           <ShoppingCart className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-1">Carrito Activo</h3>
                        <p className="text-slate-500 text-sm font-bold mb-6">
                           Tienes <span className="text-blue-600">{cart.length}</span> productos agregados por un total de <span className="text-blue-600">S/ {cartTotal.toFixed(2)}</span>
                        </p>
                        <button onClick={() => setShowReviewModal(true)} disabled={cart.length === 0} className={`w-full mb-3 py-3 ${(paymentMethod === 'CREDITO' || deliveryMode === 'EXPRESS_MISMO_DIA') ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'} text-white rounded-xl font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none`}>
                           <Eye className="w-5 h-5" /> REVISAR Y EDITAR CARRITO
                        </button>
                        <button onClick={() => setViewMode('PRODUCT_SELECT')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black flex items-center justify-center gap-2 active:bg-black transition-colors text-sm shadow-md">
                           <Plus className="w-5 h-5" /> AGREGAR NUEVO PRODUCTO
                        </button>
                     </div>
                  </div>
            </div>
         )}

            {clientTab === 'COLLECTION' && (
               <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3 pb-[100px] custom-scrollbar">
                  {pendingBills.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                        <CheckCircle className="w-12 h-12 mb-3 text-green-200" />
                        <p className="font-bold text-sm">Cliente sin deudas pendientes.</p>
                     </div>
                  ) : (
                     pendingBills.map(bill => (
                        <div key={bill.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                           <div className="flex justify-between items-start mb-4">
                              <div>
                                 <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-0.5">{String(bill.document_type || 'DOC')}</div>
                                 <div className="font-mono font-black text-slate-800 text-base">{String(bill.series || '')}-{String(bill.number || '')}</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-[10px] text-slate-400 font-bold line-through">S/ {Number(bill.total || 0).toFixed(2)}</div>
                                 <div className="text-lg font-black text-red-600">S/ {Number(bill.balance ?? bill.total ?? 0).toFixed(2)}</div>
                              </div>
                           </div>
                           <button onClick={() => openPaymentModal(bill)} className="w-full py-3 bg-green-500 text-white rounded-xl font-black text-sm shadow-md shadow-green-500/20 active:scale-95 flex justify-center items-center gap-2">
                              <Wallet className="w-4 h-4" /> COBRAR AHORA
                           </button>
                        </div>
                     ))
                  )}
               </div>
            )}
         </div>
      );
   }

   if (viewMode === 'PRODUCT_SELECT') {
      const minUnit = selectedProduct?.unit_type || 'UND';
      const maxUnit = selectedProduct?.package_type || 'PKG';
      const isMinSelected = entryUnit === minUnit;
      const isMaxSelected = entryUnit === maxUnit;

      const minPriceObj = selectedProduct ? calculateCalculatedPrice(selectedProduct, minUnit, priceListId) : { price: 0, discount: 0 };
      const maxPriceObj = selectedProduct && selectedProduct.package_type ? calculateCalculatedPrice(selectedProduct, maxUnit, priceListId) : { price: 0, discount: 0 };

      const currentTotalItemPrice = (entryQty * entryPrice) * (1 - (entryDiscount / 100));

      return (
         <div className="fixed inset-0 flex flex-col bg-slate-50 pb-safe">
            <div className="bg-white p-3 border-b border-slate-200 sticky top-0 z-20 rounded-b-xl shadow-sm">
               <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => { setViewMode('CLIENT_DETAIL'); setSelectedProduct(null); }} className="bg-slate-100 p-2 rounded-full active:bg-slate-200"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <div className="flex-1 relative">
                     <input className="w-full bg-slate-100 py-2.5 pl-9 pr-3 rounded-lg font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Buscar por Nombre o SKU..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                     <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
               </div>
               <div className="overflow-x-auto pb-1 scrollbar-hide flex gap-2">
                  {categoriesList.map(cat => (
                     <button key={cat as string} onClick={() => setSelectedCategory(cat as string)} className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-[10px] font-black transition-colors ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{cat}</button>
                  ))}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pb-[200px] space-y-1.5">
               {selectedProduct ? (
                  <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 animate-slide-up mt-2">
                     <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{selectedProduct.sku}</div>
                     <h3 className="text-lg font-black text-slate-800 leading-tight mb-4">{selectedProduct.name}</h3>

                     <div className="text-xs font-black text-green-700 mb-6 bg-green-50 p-3 rounded-xl border border-green-200 flex justify-between items-center">
                        <span>DISPONIBLE EN RUTA:</span>
                        <span className="text-base">{selectedProduct.current_stock || 0} Und.</span>
                     </div>

                     <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl mb-6 border border-slate-200 shadow-inner">
                        <button onClick={() => setEntryQty(Math.max(1, entryQty - 1))} className="w-14 h-14 rounded-xl bg-white shadow flex items-center justify-center text-2xl font-black text-slate-600 active:scale-95">-</button>
                        <span className="text-4xl font-black text-blue-600">{entryQty}</span>
                        <button onClick={() => setEntryQty(entryQty + 1)} className="w-14 h-14 rounded-xl bg-white shadow flex items-center justify-center text-2xl font-black text-slate-600 active:scale-95">+</button>
                     </div>

                     <div className="grid grid-cols-2 gap-2 mb-6">
                        <button onClick={() => handleUnitChange(minUnit)} className={`p-3 rounded-xl font-black flex flex-col items-center border-2 transition-all ${isMinSelected ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-400'}`}>
                           <span className="text-[10px] tracking-widest mb-0.5 uppercase">MÍNIMA ({minUnit})</span>
                           <span className="text-base">S/ {minPriceObj.price.toFixed(2)}</span>
                        </button>

                        <button onClick={() => handleUnitChange(maxUnit)} disabled={!selectedProduct.package_type || selectedProduct.package_type.trim() === ''} className={`p-3 rounded-xl font-black flex flex-col items-center border-2 transition-all ${isMaxSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-white text-slate-400'} disabled:opacity-30 disabled:bg-slate-50`}>
                           <span className="text-[10px] tracking-widest mb-0.5 uppercase">MÁXIMA ({maxUnit === 'PKG' ? 'CAJA' : maxUnit})</span>
                           <span className="text-base">S/ {maxPriceObj.price.toFixed(2)}</span>
                        </button>
                     </div>

                     <button onClick={executeAddToCart} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-base shadow-lg active:scale-95 transition-transform mb-2">
                        AGREGAR S/ {currentTotalItemPrice.toFixed(2)}
                     </button>

                     <button onClick={() => setSelectedProduct(null)} className="w-full py-3 text-slate-500 font-bold text-sm bg-slate-100 rounded-xl active:bg-slate-200 transition-colors">CANCELAR</button>
                  </div>
               ) : (
                  filteredProductsList.map(p => (
                     <div key={p.id} onClick={() => handleProductClick(p)} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-95 transition-transform cursor-pointer">
                        <div className="flex-1 pr-2">
                           <div className="font-bold text-slate-800 text-xs leading-tight mb-1">{p.name}</div>
                           <div className="flex gap-1.5 items-center">
                              <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1 py-0.5 rounded tracking-widest">{p.sku}</span>
                              <span className={`text-[9px] font-black px-1 py-0.5 rounded tracking-widest ${(p.current_stock || 0) > 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                 {p.current_stock || 0} DISP
                              </span>
                           </div>
                        </div>
                        <div className="text-right flex flex-col items-end justify-center">
                           <div className="font-black text-blue-600 text-sm mb-1">S/ {Number((p.price_unit || 0) * getMultiplier(priceListId)).toFixed(2)}</div>
                           <div className="bg-slate-900 text-white rounded-md p-1 shadow-sm"><Plus className="w-3 h-3" /></div>
                        </div>
                     </div>
                  ))
               )}
               {!selectedProduct && filteredProductsList.length === 0 && <div className="text-center p-6 text-slate-400 font-bold text-sm">No hay productos que coincidan.</div>}
            </div>
         </div>
      );
   }

   return null;
   };

   return (
      <>
         {renderContent()}

         {/* --- ORDERS FULL SCREEN MODAL --- */}
         {showOrdersModal && (
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 animate-fade-in-up">
               <div className="bg-slate-900 text-white p-4 shrink-0 shadow-lg z-20 flex justify-between items-center">
                  <div>
                     <h2 className="text-xl font-black mb-1">Pedidos del Día</h2>
                     <p className="text-sm text-slate-300">Toca un pedido para opciones</p>
                  </div>
                  <button onClick={() => setShowOrdersModal(false)} className="bg-slate-800 p-2 rounded-full active:bg-slate-700">
                     <X className="w-5 h-5 text-slate-300" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 pb-[120px] space-y-3">
                  {offlineOrders.length > 0 && (
                      <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <h3 className="text-sm font-black text-slate-500 flex items-center gap-1 uppercase tracking-wider"><CloudOff className="w-4 h-4"/> Locales ({offlineOrders.length})</h3>
                             <button onClick={syncOfflineOrders} disabled={isSaving || isOffline} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 disabled:opacity-50">
                                 {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                 SINCRONIZAR
                             </button>
                         </div>
                         <div className="space-y-2">
                             {offlineOrders.map(o => (
                                 <div key={o.localId} className="bg-orange-50 p-4 rounded-2xl shadow-sm border border-orange-200">
                                     <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col gap-1">
                                           <div className="bg-orange-200 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-fit"><CloudOff className="w-3 h-3"/> PENDIENTE</div>
                                           <div className="font-bold text-slate-700 text-sm">{o.payload.client_name}</div>
                                        </div>
                                        <div className="text-right">
                                           <div className="font-black text-orange-600 text-base">S/ {Number(o.payload.total).toFixed(2)}</div>
                                        </div>
                                     </div>
                                     <div className="text-xs text-slate-500">{o.payload.items.length} items • {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                     {o.status === 'ERROR' && (
                                         <div className="mt-2 text-[10px] font-black text-red-600 bg-red-100 p-2 rounded border border-red-200">Error: {o.errorMessage}</div>
                                     )}
                                 </div>
                             ))}
                         </div>
                         <hr className="my-4 border-slate-200" />
                      </div>
                  )}

                  <h3 className="text-sm font-black text-slate-500 flex items-center gap-1 uppercase tracking-wider mb-2">Pedidos Enviados</h3>
                  {dbOrders.map(o => (
                     <div key={o.id} onClick={() => { if(o.status === 'pending') setSelectedOrderActions(o); }} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 ${o.status === 'pending' ? 'active:scale-95 transition-transform cursor-pointer' : 'opacity-70'}`}>
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex flex-col gap-1">
                              <div className="bg-slate-100 text-slate-600 text-xs font-mono font-bold px-2 py-1 rounded inline-block w-fit">{o.code}</div>
                              {o.delivery_mode === 'EXPRESS_MISMO_DIA' ? (
                                 <div className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><Zap className="w-3 h-3"/> URGENTE: HOY</div>
                              ) : (
                                 <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1"><Truck className="w-3 h-3"/> Ruta: Mañana</div>
                              )}
                           </div>
                           <span className="font-black text-slate-900 text-lg">S/ {Number(o.total || 0).toFixed(2)}</span>
                        </div>
                        <h3 className="font-bold text-slate-700 text-sm mb-3">{o.client_name}</h3>
                        
                        {o.status === 'pending' ? (
                           <div className="flex items-center text-blue-600 text-xs font-bold">
                              <span>Toque para opciones</span>
                              <ChevronDown className="w-4 h-4 ml-1" />
                           </div>
                        ) : o.status === 'canceled' ? (
                           <div className="text-left text-xs font-bold text-red-600">ANULADO</div>
                        ) : (
                           <div className="text-left text-xs font-bold text-green-600">PROCESADO</div>
                        )}
                     </div>
                  ))}
                  {dbOrders.length === 0 && (
                     <div className="text-center p-8 text-slate-400 flex flex-col items-center">
                        <Clock className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="font-bold">No hay pedidos generados hoy.</p>
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* --- ORDERS ACTION BOTTOM SHEET --- */}
         {selectedOrderActions && (
            <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={() => setSelectedOrderActions(null)}>
               <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-xs text-slate-400 font-black uppercase tracking-widest">{selectedOrderActions.code}</div>
                        <h3 className="text-lg font-black text-slate-800 leading-tight mt-1 truncate">{selectedOrderActions.client_name}</h3>
                     </div>
                     <button onClick={() => setSelectedOrderActions(null)} className="bg-slate-100 p-2 rounded-full"><X className="w-4 h-4 text-slate-500" /></button>
                  </div>
                  
                  <div className="space-y-3">
                     <button onClick={() => { 
                           handleEditOrder(selectedOrderActions); 
                           setSelectedOrderActions(null); 
                           setShowOrdersModal(false); 
                        }} 
                        className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-black flex items-center justify-center gap-2 active:bg-blue-100 transition-colors">
                        <Edit className="w-5 h-5" /> MODIFICAR PEDIDO
                     </button>
                     
                     <button onClick={() => { 
                           setOrderToAnnul(selectedOrderActions); 
                           setSelectedOrderActions(null); 
                        }} 
                        className="w-full py-4 bg-red-50 text-red-700 rounded-2xl font-black flex items-center justify-center gap-2 active:bg-red-100 transition-colors">
                        <Trash2 className="w-5 h-5" /> ANULAR PEDIDO
                     </button>
                  </div>
               </div>
            </div>
         )}

         
         {/* --- INTERACTIVE REVIEW MODAL --- */}
         {showReviewModal && (
            <div className="fixed inset-0 z-[150] flex flex-col bg-slate-50 animate-fade-in-up">
               <div className="bg-slate-900 text-white p-4 shrink-0 shadow-lg z-20">
                  <h2 className="text-xl font-black mb-1">Revisión Final</h2>
                  <p className="text-sm text-slate-300">Verifica o edita las cantidades antes de enviar.</p>
               </div>
               
               <div className="bg-white p-3 border-b border-slate-200 shrink-0 shadow-sm z-10 flex justify-between items-center">
                  <div>
                     <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total:</div>
                     <div className="text-3xl font-black text-blue-600 leading-none">S/ {cartTotal.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                     <div className="text-xs font-bold text-slate-500">{cart.length} productos</div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-2 pb-[200px] space-y-1.5 bg-slate-100">
                     {cart.map((item, idx) => (
                        <div key={idx} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${item.is_bonus ? 'border-green-300 bg-green-50' : String(item.name || '').includes('(Duplicado)') ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}>
                           <div className={`flex justify-between items-center p-2 border-b ${item.is_bonus ? 'border-green-100 bg-green-100/50' : String(item.name || '').includes('(Duplicado)') ? 'border-orange-200 bg-orange-100/50' : 'border-slate-100 bg-slate-50'}`}>
                              <div className="font-bold text-slate-800 text-[11px] pr-2 leading-tight truncate">
                                 {item.is_bonus && <span className="bg-green-500 text-white text-[8px] px-1 py-0.5 rounded mr-1 uppercase">Premio</span>}
                                 {String(item.name || '').includes('(Duplicado)') && <span className="bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded mr-1 uppercase">x2</span>}
                                 {String(item.name || '').replace(' (Duplicado)', '')}
                              </div>
                              {!item.auto_promo_id && <button onClick={() => { let tempCart = cart.filter(c => c.id !== item.id); applyPromotions(tempCart, priceListId); }} className="text-slate-400 p-1 active:text-red-500"><X className="w-4 h-4" /></button>}
                           </div>
                           <div className="p-1 flex items-center justify-between">
                              {!item.is_bonus ? (
                                 <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                    <button onClick={() => handleCartQtyChange(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded shadow-sm active:scale-95"><Minus className="w-4 h-4" /></button>
                                    <div className="w-7 text-center font-black text-sm text-slate-800 text-base">{item.quantity}</div>
                                    <button onClick={() => handleCartQtyChange(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded shadow-sm active:scale-95"><Plus className="w-4 h-4" /></button>
                                 </div>
                              ) : (
                                 <div className="font-black text-green-600 text-xl pl-2">{item.quantity}</div>
                              )}
                              <div className="text-right flex flex-col justify-center">
                                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{item.unit_type} | S/ {item.unit_price.toFixed(2)}</div>
                                 <div className="font-black text-slate-900 text-base leading-none">S/ {Number(item.total_price || 0).toFixed(2)}</div>
                              </div>
                           </div>
                        </div>
                     ))}
               </div>

               <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20 pb-safe">
                  <div className="flex gap-3 max-w-md mx-auto">
                     <button onClick={() => setShowReviewModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black active:scale-95 transition-transform flex items-center justify-center gap-2">
                        <ChevronLeft className="w-5 h-5" /> Volver
                     </button>
                     <button onClick={() => { setShowReviewModal(false); handleSaveOrder(); }} disabled={cart.length === 0 || isSaving} className={`flex-1 py-4 text-white rounded-2xl font-black shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-transform ${isEditMode ? 'bg-red-600 shadow-red-600/30' : 'bg-green-600 shadow-green-600/30'}`}>
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        ENVIAR
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* --- SYSTEM NATIVE MODALS --- */}
         {systemAlert.show && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
               <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-fade-in-up border border-slate-100">
                  <div className={"mx-auto mb-4 p-3 rounded-full inline-flex " + (systemAlert.type === 'success' ? 'bg-green-50 text-green-500' : systemAlert.type === 'info' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500')}>
                     {systemAlert.type === 'success' ? <CheckCircle className="w-12 h-12" /> : systemAlert.type === 'info' ? <div className="w-12 h-12 flex items-center justify-center text-4xl font-black">!</div> : <X className="w-12 h-12" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">{systemAlert.title || (systemAlert.type === 'success' ? 'Éxito' : systemAlert.type === 'info' ? 'Atención' : 'Error')}</h3>
                  <p className="text-slate-500 text-sm mb-6 whitespace-pre-wrap">{systemAlert.message}</p>
                  <button onClick={() => setSystemAlert({ show: false, message: '' })} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Entendido</button>
               </div>
            </div>
         )}

         {systemConfirm.show && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
               <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-fade-in-up border border-slate-100">
                  <div className="mx-auto mb-4 p-3 rounded-full inline-flex bg-blue-50 text-blue-500">
                     <CheckCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">{systemConfirm.title || 'Confirmar Acción'}</h3>
                  <p className="text-slate-500 text-sm mb-6 whitespace-pre-wrap">{systemConfirm.message}</p>
                  <div className="flex gap-3">
                     <button onClick={() => setSystemConfirm({ show: false, message: '', onConfirm: () => {} })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold active:scale-95 transition-transform">Cancelar</button>
                     <button onClick={() => { systemConfirm.onConfirm(); setSystemConfirm({ show: false, message: '', onConfirm: () => {} }); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Confirmar</button>
                  </div>
               </div>
            </div>
         )}

         {/* PIN PROMPT MODAL */}
         {pinPrompt.show && (
             <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fade-in">
                 <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-8 text-center animate-slide-up border border-slate-100">
                     <div className="mx-auto mb-6 bg-blue-50 w-20 h-20 flex items-center justify-center rounded-full shadow-inner">
                         <Lock className="w-10 h-10 text-blue-600" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 mb-2">Ingreso Seguro</h3>
                     <p className="text-slate-500 text-sm mb-6">Por favor, ingresa tu código PIN de acceso.</p>
                     <input 
                         type="password" 
                         autoFocus 
                         maxLength={4} 
                         value={pinInput}
                         onChange={(e) => {
                             const val = e.target.value;
                             setPinInput(val);
                             if (pinError) setPinError(false);
                             if (val.length === 4) {
                                 if (val === pinPrompt.expectedPin) {
                                     completeSellerSelect(pinPrompt.sellerId);
                                     setPinPrompt({ show: false, sellerId: '', expectedPin: '' });
                                     setPinError(false);
                                 } else {
                                     setPinError(true);
                                     setPinInput('');
                                 }
                             }
                         }}
                         className={`w-full text-center text-4xl font-black p-4 rounded-xl outline-none mb-2 tracking-widest transition-colors ${pinError ? 'bg-red-50 text-red-600 border-2 border-red-500 animate-shake' : 'bg-slate-50 text-slate-800 border-2 border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                         onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                                 if (pinInput === pinPrompt.expectedPin) {
                                     completeSellerSelect(pinPrompt.sellerId);
                                     setPinPrompt({ show: false, sellerId: '', expectedPin: '' });
                                     setPinError(false);
                                 } else {
                                     setPinError(true);
                                     setPinInput('');
                                 }
                             }
                         }}
                     />
                     {pinError ? (
                         <div className="text-red-500 text-sm font-black mb-4 animate-fade-in uppercase">PIN Incorrecto</div>
                     ) : (
                         <div className="h-6 mb-4"></div>
                     )}
                     <div className="flex gap-2">
                         <button onClick={() => { setPinPrompt({ show: false, sellerId: '', expectedPin: '' }); setPinError(false); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold active:scale-95 transition-transform">Cancelar</button>
                         <button onClick={() => {
                             if (pinInput === pinPrompt.expectedPin) {
                                 completeSellerSelect(pinPrompt.sellerId);
                                 setPinPrompt({ show: false, sellerId: '', expectedPin: '' });
                                 setPinError(false);
                             } else {
                                 setPinError(true);
                                 setPinInput('');
                             }
                         }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform">Entrar</button>
                     </div>
                 </div>
             </div>
         )}
         
      </>
   );
};
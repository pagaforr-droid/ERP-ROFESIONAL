import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Client, Order, AutoPromotion, Promotion, Sale } from '../types';
import { Plus, Trash2, Search, Save, X, ChevronDown, ChevronLeft, MapPin, Clock, Wallet, CheckCircle, Loader2, LogOut, User, ArrowRight, Edit, Minus } from 'lucide-react';
import { isPromoValidForContext } from '../utils/promoUtils';
import { supabase } from '../services/supabase';

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

export const MobileOrders: React.FC = () => {
  const { currentUser, logout } = useStore();

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
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  useEffect(() => {
    const loadInitialApp = async () => {
        try {
            const [sellRes, zoneRes] = await Promise.all([
                supabase.from('sellers').select('*').eq('is_active', true).order('name'),
                supabase.from('zones').select('*')
            ]);
            if (sellRes.data) setDbSellers(sellRes.data);
            if (zoneRes.data) setDbZones(zoneRes.data);
            
            if (currentUser?.role === 'SELLER' && sellRes.data) {
                const matchingSeller = sellRes.data.find(s => (s.name || '').trim().toUpperCase() === (currentUser.name || '').trim().toUpperCase());
                if (matchingSeller) handleSellerSelect(matchingSeller.id);
            }
        } catch (error) {
            console.error("Error al iniciar App Móvil:", error);
        } finally {
            setIsLoadingInitial(false);
        }
    };
    loadInitialApp();
  }, [currentUser]);

  const handleSellerSelect = async (sellerId: string) => {
    if (!sellerId) return;
    setCurrentSellerId(sellerId);
    setIsLoadingData(true);
    setViewMode('CLIENT_LIST');
    setListTab('CLIENTS');

    try {
        const today = new Date().toISOString().split('T')[0];
        const sellerZoneIds = dbZones.filter(z => z.assigned_seller_id === sellerId).map(z => z.id);
        
        let clientQuery = supabase.from('clients').select('*').eq('is_active', true);
        if (sellerZoneIds.length > 0) clientQuery = clientQuery.in('zone_id', sellerZoneIds);

        const [compRes, plRes, apRes, promRes, cliRes, prodRes, batchRes, salesRes, ordersRes, seriesRes] = await Promise.all([
            supabase.from('company_config').select('*').limit(1).maybeSingle(),
            supabase.from('price_lists').select('*').order('name'),
            supabase.from('auto_promotions').select('*').eq('is_active', true),
            supabase.from('promotions').select('*').eq('is_active', true),
            clientQuery,
            supabase.from('products').select('*').eq('is_active', true),
            supabase.from('batches').select('*').gt('quantity_current', 0),
            supabase.from('sales').select('*').eq('payment_status', 'PENDING').eq('payment_method', 'CREDITO'),
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
        
        if (seriesRes.data && seriesRes.data.length > 0) {
            setDbSeries(seriesRes.data);
            setPedidoSeries(seriesRes.data[0].series || '');
            setPedidoNumber(String(seriesRes.data[0].current_number + 1).padStart(8, '0'));
        }

        if (prodRes.data && batchRes.data) {
            const batchCache: Record<string, any[]> = {};
            const enrichedProds = prodRes.data.map(p => {
               const pBatches = batchRes.data.filter(b => b.product_id === p.id);
               batchCache[p.id] = pBatches;
               const stock = pBatches.reduce((sum, b) => sum + Number(b.quantity_current || 0), 0);
               return { ...p, current_stock: stock };
            });
            setLoadedBatches(batchCache);
            setDbProducts(enrichedProds as any[]);
        }
    } catch (error) {
        console.error("Error cargando maestros:", error);
        alert("Error de conexión al cargar la ruta.");
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
    let price = Number(p.price_unit || 0);
    let defaultDiscount = 0;

    if (p.package_type && unit === p.package_type) {
        price = p.price_package ? Number(p.price_package) : price * Number(p.package_content || 1);
    }
    price = price * getMultiplier(listId);

    const activePromo = dbPromos.find(promo => {
        if (!(promo.product_ids || []).includes(p.id)) return false;
        if (!isPromoValidForContext(promo, 'IN_STORE', selectedClient?.city || '', currentSellerId || currentUser?.id, currentUser?.role)) return false;
        if (promo.target_price_list_ids?.length > 0 && listId && !promo.target_price_list_ids.includes('ALL') && !promo.target_price_list_ids.includes(listId)) return false;
        return true;
    });

    if (activePromo) {
        if (activePromo.type === 'PERCENTAGE_DISCOUNT') defaultDiscount = Number(activePromo.value || 0);
        else if (activePromo.type === 'FIXED_PRICE') {
            let promoPrice = Number(activePromo.value || 0);
            if (p.package_type && unit === p.package_type && !p.price_package) promoPrice = promoPrice * Number(p.package_content || 1);
            price = promoPrice;
        }
    }
    return { price, discount: defaultDiscount };
  };

  const applyPromotions = (currentCart: CartItem[], listId: string) => {
    let cleanCart = currentCart.filter(item => !item.auto_promo_id);
    const getBaseQuantity = (item: CartItem) => item.unit_type === item.product_ref?.package_type ? item.quantity * Number(item.product_ref.package_content || 1) : item.quantity;

    const validPromos = dbAutoPromos.filter(ap => {
      if (!isPromoValidForContext(ap, 'IN_STORE', selectedClient?.city || '', currentSellerId || currentUser?.id, currentUser?.role)) return false;
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
            if (ap.condition_product_ids && ap.condition_product_ids.length > 0) return ap.condition_product_ids.includes(i.product_id);
            if (ap.condition_product_id) return i.product_id === ap.condition_product_id;
            return true;
        }).reduce((sum, i) => sum + getBaseQuantity(i), 0); 
        if (qtyBought >= (ap.condition_amount || 1)) { applies = true; multiplier = Math.floor(qtyBought / (ap.condition_amount || 1)); }
      } 
      else if (ap.condition_type === 'SPEND_Y_TOTAL') {
        const conditionItemKeys = ap.condition_product_ids || [];
        const totalSpent = cleanCart.reduce((sum, item) => (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) ? sum : sum + (item.total_price || 0), 0);
        if (totalSpent >= (ap.condition_amount || 1)) { applies = true; multiplier = Math.floor(totalSpent / (ap.condition_amount || 1)); }
      } 
      else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
        const catSpent = cleanCart.reduce((sum, item) => {
            const p = cartProductsCache[item.product_id] || item.product_ref;
            return p?.category === ap.condition_category ? sum + (item.total_price || 0) : sum;
        }, 0);
        if (catSpent >= (ap.condition_amount || 1)) { applies = true; multiplier = Math.floor(catSpent / (ap.condition_amount || 1)); }
      }

      if (applies && multiplier > 0) {
        const rewardProduct = dbProducts.find(p => p.id === ap.reward_product_id) || cartProductsCache[ap.reward_product_id];
        if (rewardProduct) {
          const rewardQty = (ap.reward_quantity || 1) * multiplier;
          const isPkgMode = ap.reward_unit_type === 'PKG' || ap.reward_unit_type === rewardProduct.package_type;
          const realUnitName = isPkgMode ? (rewardProduct.package_type || 'CAJA').toUpperCase() : (rewardProduct.unit_type || 'UND').toUpperCase();

          cleanCart.push({
            id: crypto.randomUUID(), product_id: rewardProduct.id, sku: rewardProduct.sku, name: rewardProduct.name,
            quantity: rewardQty, unit_type: realUnitName, unit_price: 0, discount_percent: 100, total_price: 0,
            is_bonus: true, auto_promo_id: ap.id, promo_name: ap.name, product_ref: rewardProduct
          });
        }
      }
    });
    setCart(cleanCart);
  };

  const executeAddToCart = () => {
    if (!selectedProduct || entryQty <= 0) return;

    const isPkgMode = entryUnit === selectedProduct.package_type;
    const conversionFactor = isPkgMode ? Number(selectedProduct.package_content || 1) : 1; 
    const requiredBaseUnits = entryQty * conversionFactor;

    let totalStock = selectedProduct.current_stock || 0;
    let tempCart = [...cart];
    const existingIdx = tempCart.findIndex(i => i.product_id === selectedProduct.id && !i.is_bonus && !i.auto_promo_id && i.unit_type === entryUnit);
    
    let originalReserved = 0;
    let existingQty = 0;
    if (existingIdx >= 0) {
        existingQty = tempCart[existingIdx].quantity;
        if (isEditMode && tempCart[existingIdx].original_base_qty) originalReserved = tempCart[existingIdx].original_base_qty || 0;
    }

    totalStock += originalReserved; 
    const totalRequiredBaseUnits = (existingQty + entryQty) * conversionFactor;

    if (totalStock < totalRequiredBaseUnits && !entryBonus) {
        alert(`❌ Stock Insuficiente para ${selectedProduct.name}.\nDisponible: ${totalStock} unid. (Incluye tu reserva original)`);
        return;
    }

    const gross = entryQty * entryPrice;
    const finalPrice = gross - (gross * (entryDiscount / 100));

    if (existingIdx >= 0) {
      tempCart[existingIdx].quantity += entryQty;
      const tGross = tempCart[existingIdx].quantity * tempCart[existingIdx].unit_price;
      tempCart[existingIdx].total_price = tGross - (tGross * (tempCart[existingIdx].discount_percent / 100));
    } else {
      tempCart.push({
        id: crypto.randomUUID(), product_id: selectedProduct.id, sku: selectedProduct.sku, name: selectedProduct.name,
        quantity: entryQty, unit_type: entryUnit, unit_price: entryPrice, discount_percent: entryDiscount,
        total_price: entryBonus ? 0 : finalPrice, is_bonus: entryBonus, product_ref: selectedProduct
      });
    }

    applyPromotions(tempCart, priceListId);
    setSelectedProduct(null); setEntryQty(1); setEntryPrice(0); setEntryDiscount(0); setEntryBonus(false);
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

    let totalStock = dbProducts.find(p => p.id === pRef.id)?.current_stock || 0;
    if (isEditMode && item.original_base_qty) totalStock += item.original_base_qty;

    if (totalStock < requiredBaseUnits && !item.is_bonus) {
        alert(`❌ Stock Insuficiente para ${pRef.name || 'Producto'}.\nDisponible: ${totalStock} unid. (Incluye reserva original)`);
        return;
    }

    const tGross = newQty * item.unit_price;
    tempCart[itemIndex] = { ...item, quantity: newQty, total_price: tGross - (tGross * (item.discount_percent / 100)) };
    applyPromotions(tempCart, priceListId);
  };

  const handleClientSelect = (client: Client) => {
    setIsEditMode(false); setOriginalOrder(null); setEditingOrderId(null);
    setSelectedClient(client);
    setSelectedClientId(client.id);
    setClientAddress(client.address || '');
    setPriceListId(client.price_list_id || '');
    setPaymentMethod((client.payment_condition || '').toUpperCase().includes('CREDIT') ? 'CREDITO' : 'CONTADO');
    setDocType((client.doc_number || '').length === 11 ? 'FACTURA' : 'BOLETA');
    setCart([]);
    setClientTab('ORDER'); 
    setViewMode('CLIENT_DETAIL');
    setShowBranchSelector(false);
  };

  const handleEditOrder = async (order: Order) => {
    if (order.status !== 'pending') { alert("Solo editables los pedidos pendientes."); return; }
    setIsLoadingData(true);
    try {
        const { data: orderItemsData, error } = await supabase.from('order_items').select(`*`).eq('order_id', order.id);
        if (error) throw error;

        const client = dbClients.find(c => c.id === order.client_id);
        
        let loadedItems: CartItem[] = [];
        if (orderItemsData) {
            loadedItems = orderItemsData.map((item: any) => {
                const pRef = dbProducts.find(p => p.id === item.product_id) || {} as Product;
                setCartProductsCache(prev => ({...prev, [pRef.id]: pRef}));
                return {
                    id: item.id, product_id: item.product_id, sku: item.product_sku || pRef.sku || '', name: item.product_name || pRef.name || 'Producto',
                    quantity: item.quantity || 1, unit_type: item.unit_type || 'UND', unit_price: item.unit_price || 0,
                    discount_percent: item.discount_percent || 0, total_price: item.total_price || 0,
                    is_bonus: item.is_bonus || false, auto_promo_id: item.auto_promo_id || undefined,
                    promo_name: item.auto_promo_id ? 'PROMO' : undefined, product_ref: pRef,
                    original_base_qty: item.quantity_base || 0 
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
        setClientAddress(order.delivery_address || '');
        setSelectedClientId(order.client_id || '');
        if (client) {
           setSelectedClient(client);
           setPriceListId(client.price_list_id || '');
        }

        setCart(loadedItems); 
        setClientTab('ORDER');
        setViewMode('CLIENT_DETAIL');
    } catch(e) { alert("Error al cargar pedido."); } finally { setIsLoadingData(false); }
  };

  const handleProductClick = (p: Product) => {
    setCartProductsCache(prev => ({...prev, [p.id]: p}));
    setSelectedProduct(p);
    
    // MEJORA: Presentación predeterminada es la unidad mínima real del producto (No UND genérico)
    const defaultUnit = p.unit_type || 'UND';
    setEntryUnit(defaultUnit);
    setEntryQty(1);
    
    // MEJORA: Calcula precio automático al seleccionar
    const { price, discount } = calculateCalculatedPrice(p, defaultUnit, priceListId);
    setEntryPrice(price);
    setEntryDiscount(discount);
    setEntryBonus(false);
    setViewMode('PRODUCT_SELECT');
  };

  const handleUnitChange = (newUnit: string) => {
     setEntryUnit(newUnit);
     if (selectedProduct) {
        // MEJORA: Recalcula precio al cambiar de unidad táctilmente
        const { price, discount } = calculateCalculatedPrice(selectedProduct, newUnit, priceListId);
        setEntryPrice(price);
        setEntryDiscount(discount);
     }
  };

  const handleSaveOrder = async () => {
    if (!selectedClient) return;
    if (cart.length === 0) { alert("El pedido está vacío."); return; }
    
    setIsSaving(true);
    const currentTotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

    const orderPayload = {
      id: isEditMode && originalOrder ? originalOrder.id : crypto.randomUUID(),
      code: isEditMode && originalOrder ? originalOrder.code : `${pedidoSeries}-${pedidoNumber}`,
      client_id: selectedClientId || null,
      client_name: selectedClient.name || '',
      client_doc_type: selectedClient.doc_type || 'RUC',
      client_doc_number: selectedClient.doc_number || '',
      seller_id: currentSellerId || null,
      suggested_document_type: docType,
      payment_method: paymentMethod,
      total: Number(currentTotal.toFixed(2)), 
      status: 'pending', 
      delivery_address: clientAddress || null, 
      items: cart.map(c => {
        const isPkgMode = c.unit_type === c.product_ref?.package_type;
        const factor = isPkgMode ? Number(c.product_ref?.package_content || 1) : 1;
        return {
          id: c.id, product_id: c.product_id, product_sku: c.sku, product_name: c.name,
          quantity: c.quantity, unit_type: c.unit_type, selected_unit: c.unit_type,
          quantity_presentation: c.quantity, quantity_base: c.quantity * factor,
          unit_price: c.unit_price, discount_percent: c.discount_percent,
          discount_amount: (c.quantity * c.unit_price) * ((c.discount_percent || 0) / 100),
          total_price: c.total_price, is_bonus: c.is_bonus, auto_promo_id: c.auto_promo_id || null
        };
      })
    };

    try {
      const rpcName = isEditMode ? 'update_order_transaction' : 'process_order_transaction';
      const { data, error } = await supabase.rpc(rpcName, { p_order_data: orderPayload });
      if (error) throw error;

      alert(isEditMode ? `¡Pedido modificado!` : `¡Pedido guardado! Código: ${data?.real_code || pedidoNumber}`);
      
      setViewMode('CLIENT_LIST');
      setListTab('HISTORY');
      setCart([]);
      handleSellerSelect(currentSellerId); 
    } catch (error: any) { alert("Error al guardar: " + error.message); } 
    finally { setIsSaving(false); }
  };

  const handleNewOrder = () => {
    setIsEditMode(false); 
    setOriginalOrder(null); 
    setEditingOrderId(null);
    setCart([]); 
    setViewMode('CLIENT_LIST');
  };

  const confirmPayment = async () => {
    if (!selectedSale || paymentAmount <= 0) return;
    const currentBalance = selectedSale.balance !== undefined && selectedSale.balance !== null ? selectedSale.balance : selectedSale.total;
    if (paymentAmount > currentBalance) { alert("El monto supera el saldo."); return; }

    setIsSaving(true);
    try {
       const { error } = await supabase.rpc('process_collection', { 
          p_sale_id: selectedSale.id, p_seller_id: currentSellerId, p_amount: paymentAmount 
       });
       if (error) throw error;
       alert("Cobro reportado a central.");
       setIsPaymentModalOpen(false); setPaymentAmount(0); setSelectedSale(null);
       handleSellerSelect(currentSellerId); 
    } catch(e:any) { alert("Error reportando cobro: " + e.message); } 
    finally { setIsSaving(false); }
  };

  const confirmExitApp = () => {
    if (currentUser?.role === 'SELLER') { logout(); return; }
    setCurrentSellerId(''); setSelectedClient(null); setCart([]); setViewMode('SELLER_SELECT'); setIsExitModalOpen(false);
  };

  const openPaymentModal = (bill: Sale) => {
     setSelectedSale(bill);
     setPaymentAmount(bill.balance ?? bill.total ?? 0);
     setIsPaymentModalOpen(true);
  };

  // ============================================================================
  // DERIVED UI DATA (A prueba de Nulls)
  // ============================================================================
  const filteredClientsList = useMemo(() => {
      if (!clientSearchTerm) return dbClients;
      const term = clientSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return dbClients.filter(c => (c.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term) || (c.doc_number || '').includes(term));
  }, [dbClients, clientSearchTerm]);

  const filteredProductsList = useMemo(() => {
      const term = prodSearch.toLowerCase();
      return dbProducts.filter(p => {
         const matchesSearch = (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
         const matchesCategory = selectedCategory === 'TODOS' || p.category === selectedCategory;
         return matchesSearch && matchesCategory;
      });
  }, [dbProducts, prodSearch, selectedCategory]);

  const pendingBills = useMemo(() => {
      if (!selectedClient) return [];
      return dbSales.filter(s => s.client_id === selectedClient.id).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  }, [dbSales, selectedClient]);

  const cartTotal = cart.reduce((acc, item) => acc + Number(item.total_price || 0), 0);
  const categoriesList = useMemo(() => ['TODOS', ...Array.from(new Set(dbProducts.map(p => p.category))).filter(Boolean).sort()], [dbProducts]);

  // ============================================================================
  // RENDER (UI MÓVIL)
  // ============================================================================

  if (isLoadingInitial) {
     return <div className="h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
  }

  if (viewMode === 'SELLER_SELECT') {
    return (
       <div className="h-screen bg-slate-900 p-4 flex flex-col justify-center items-center">
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
       <div className="h-screen flex flex-col bg-slate-50 relative pb-safe">
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

          <div className="bg-slate-900 text-white p-5 shadow-lg rounded-b-2xl z-10">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h2 className="text-xl font-black">Ruta Móvil</h2>
                   <p className="text-sm text-blue-300 font-medium">Vendedor: {dbSellers.find(s=>s.id === currentSellerId)?.name || 'Desconocido'}</p>
                </div>
                <button onClick={() => setIsExitModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors">
                   <LogOut className="w-5 h-5 text-slate-300" />
                </button>
             </div>

             <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                <button onClick={() => setListTab('CLIENTS')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${listTab === 'CLIENTS' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}>
                   <User className="w-4 h-4 mr-2" /> Clientes
                </button>
                <button onClick={() => setListTab('HISTORY')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${listTab === 'HISTORY' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}>
                   <Clock className="w-4 h-4 mr-2" /> Pedidos
                </button>
             </div>

             {listTab === 'CLIENTS' && (
                <div className="relative mt-4">
                   <Search className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                   <input
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 font-medium outline-none focus:border-blue-500 transition-colors"
                      placeholder="Buscar cliente (RUC o Nombre)..."
                      value={clientSearchTerm}
                      onChange={e => setClientSearchTerm(e.target.value)}
                   />
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {listTab === 'CLIENTS' && filteredClientsList.map(c => {
                const debt = dbSales.filter(s => s.client_id === c.id && s.payment_status === 'PENDING').reduce((sum, s) => sum + Number(s.balance ?? s.total ?? 0), 0);
                return (
                   <div key={c.id} onClick={() => handleClientSelect(c)} className="bg-white p-4 rounded-2xl shadow-sm active:scale-95 transition-transform cursor-pointer border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                         <h3 className="font-bold text-slate-800 text-base leading-tight pr-4">{c.name}</h3>
                         <ArrowRight className="text-slate-300 w-5 h-5 shrink-0" />
                      </div>
                      <div className="flex justify-between items-end">
                         <div className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded inline-block">{c.doc_number || '-'}</div>
                         {debt > 0 && <span className="bg-red-50 text-red-600 border border-red-100 text-xs px-2 py-1 rounded-lg font-black shadow-sm">Deuda: S/ {debt.toFixed(2)}</span>}
                      </div>
                   </div>
                );
             })}
             {listTab === 'CLIENTS' && filteredClientsList.length === 0 && <div className="text-center p-8 text-slate-400">Sin resultados en la ruta.</div>}

             {listTab === 'HISTORY' && dbOrders.map(o => (
                <div key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                   <div className="flex justify-between items-start mb-2">
                      <div className="bg-slate-100 text-slate-600 text-xs font-mono font-bold px-2 py-1 rounded">{o.code}</div>
                      <span className="font-black text-slate-900 text-lg">S/ {Number(o.total || 0).toFixed(2)}</span>
                   </div>
                   <h3 className="font-bold text-slate-700 text-sm mb-3">{o.client_name}</h3>
                   {o.status === 'pending' ? (
                      <button onClick={() => handleEditOrder(o)} className="w-full bg-blue-50 text-blue-700 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center">
                         <Edit className="w-4 h-4 mr-2" /> Editar Pedido
                      </button>
                   ) : (
                      <div className="text-center text-xs font-bold text-green-600 bg-green-50 py-2 rounded-xl">YA PROCESADO</div>
                   )}
                </div>
             ))}
             {listTab === 'HISTORY' && dbOrders.length === 0 && <div className="text-center p-8 text-slate-400">No hay pedidos generados hoy.</div>}
          </div>
       </div>
    );
  }

  if (viewMode === 'CLIENT_DETAIL') {
    return (
       <div className="h-screen flex flex-col bg-slate-50 relative pb-safe">
          
          {isSaving && <div className="absolute inset-0 bg-white/90 z-[100] flex flex-col items-center justify-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-2" /><p className="font-bold text-slate-600">Sincronizando con Base...</p></div>}

          {/* PAYMENT MODAL */}
          {isPaymentModalOpen && selectedSale && (
             <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full rounded-t-3xl p-6 shadow-2xl animate-slide-up">
                   <div className="flex justify-between items-start mb-6">
                      <div>
                         <h3 className="text-xl font-black text-slate-800">Reportar Cobro</h3>
                         <p className="text-sm text-slate-500 font-mono font-bold mt-1">{selectedSale.series}-{selectedSale.number}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                      <div className="flex justify-between items-center text-sm mb-2"><span className="text-slate-500 font-bold">Total:</span><span className="font-bold">S/ {Number(selectedSale.total || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between items-center text-red-600 border-t border-slate-200 pt-2">
                         <span className="font-black">Saldo Pendiente:</span>
                         <span className="font-black text-xl">S/ {Number(selectedSale.balance ?? selectedSale.total ?? 0).toFixed(2)}</span>
                      </div>
                   </div>
                   <div className="mb-6">
                      <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Monto que paga el cliente</label>
                      <input type="number" autoFocus className="w-full py-4 text-center text-4xl font-black text-slate-800 border-2 border-slate-300 rounded-2xl focus:border-green-500 focus:ring-0 outline-none" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} />
                   </div>
                   <button onClick={confirmPayment} disabled={isSaving || paymentAmount <= 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black text-xl shadow-lg shadow-green-600/30 flex items-center justify-center disabled:opacity-50">
                      {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'CONFIRMAR COBRO'}
                   </button>
                </div>
             </div>
          )}

          <div className="bg-white shadow-sm p-4 sticky top-0 z-20 rounded-b-3xl">
             <div className="flex items-start gap-3 mb-4">
                <button onClick={() => { setViewMode('CLIENT_LIST'); handleSellerSelect(currentSellerId); }} className="bg-slate-100 p-2 rounded-full mt-1 active:bg-slate-200"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
                <div className="flex-1">
                   <h2 className="font-black text-xl text-slate-900 leading-tight mb-1">{selectedClient?.name}</h2>
                   <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{selectedClient?.doc_number || '-'}</span>
                </div>
             </div>
             
             {isEditMode && (
                <div className="mb-4 px-3 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-xl flex justify-between items-center shadow">
                   <span className="flex items-center text-xs"><Edit className="w-4 h-4 mr-2" /> EDITANDO: {originalOrder?.code}</span>
                   <button onClick={handleNewOrder} className="bg-white text-red-600 font-black px-2 py-1 rounded shadow-sm text-[10px] uppercase">Descartar</button>
                </div>
             )}

             <div className="relative mb-4">
                <div className={`flex items-start gap-2 p-3 bg-slate-50 border rounded-xl ${selectedClient?.branches?.length ? 'active:bg-blue-50 border-blue-200' : 'border-slate-200'}`} onClick={() => { if (selectedClient?.branches?.length) setShowBranchSelector(!showBranchSelector); }}>
                   <MapPin className={`w-5 h-5 shrink-0 ${selectedClient?.branches?.length ? 'text-blue-600' : 'text-slate-400'}`} />
                   <div className="flex-1 text-sm font-bold text-slate-700 leading-tight">{clientAddress || 'Sin dirección'}</div>
                   {selectedClient?.branches?.length ? <ChevronDown className="w-5 h-5 text-blue-500" /> : null}
                </div>
                {showBranchSelector && selectedClient?.branches?.length && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase">Cambiar Dirección</div>
                      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                         {[selectedClient.address, ...(selectedClient.branches || [])].filter(Boolean).map((addr, idx) => (
                            <div key={idx} onClick={() => { setClientAddress(addr); setShowBranchSelector(false); }} className="p-3 rounded-lg active:bg-blue-50 bg-white border border-slate-50 flex items-start gap-2">
                               <MapPin className={`w-5 h-5 shrink-0 ${clientAddress === addr ? 'text-blue-600' : 'text-slate-300'}`} />
                               <div className={`text-sm leading-tight ${clientAddress === addr ? 'font-black text-blue-900' : 'font-bold text-slate-600'}`}>{addr}</div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
             </div>

             <div className="flex gap-2">
                <button onClick={() => setClientTab('ORDER')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${clientTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>Pedido de Venta</button>
                <button onClick={() => setClientTab('COLLECTION')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1 ${clientTab === 'COLLECTION' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-500'}`}>
                   Cobranzas {pendingBills.length > 0 && <span className="bg-white text-orange-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingBills.length}</span>}
                </button>
             </div>
          </div>

          {clientTab === 'ORDER' && (
             <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                   <div className="flex-1 flex items-center justify-center rounded-xl text-xs font-black border bg-white text-slate-700 shadow-sm border-slate-200">
                      {docType}
                   </div>
                   <select className="flex-1 bg-white text-slate-700 px-3 py-3 rounded-xl text-xs font-black border border-slate-200 shadow-sm outline-none" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                      <option value="CONTADO">CONTADO</option>
                      <option value="CREDITO">CRÉDITO</option>
                   </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                   {cart.map((item, idx) => (
                      <div key={idx} className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${item.is_bonus ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                         <div className="flex justify-between items-start p-3 border-b border-slate-100">
                            <div className="font-bold text-slate-800 text-sm pr-2 leading-tight">
                               {item.is_bonus && <span className="bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded mr-1 uppercase">Premio</span>}
                               {item.name}
                            </div>
                            {!item.auto_promo_id && <button onClick={() => { let tempCart = cart.filter(c => c.id !== item.id); applyPromotions(tempCart, priceListId); }} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>}
                         </div>
                         <div className="p-3 flex items-center justify-between">
                            {!item.is_bonus ? (
                               <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
                                  <button onClick={() => handleCartQtyChange(item.id, item.quantity - 1)} className="w-10 h-10 flex items-center justify-center bg-white text-slate-600 rounded-lg shadow-sm active:scale-95"><Minus className="w-5 h-5" /></button>
                                  <div className="w-12 text-center font-black text-slate-800 text-lg">{item.quantity}</div>
                                  <button onClick={() => handleCartQtyChange(item.id, item.quantity + 1)} className="w-10 h-10 flex items-center justify-center bg-white text-slate-600 rounded-lg shadow-sm active:scale-95"><Plus className="w-5 h-5" /></button>
                               </div>
                            ) : (
                               <div className="font-black text-green-600 text-2xl pl-2">{item.quantity}</div>
                            )}
                            <div className="text-right">
                               <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{item.unit_type}</div>
                               <div className="font-black text-slate-900 text-xl">S/ {Number(item.total_price || 0).toFixed(2)}</div>
                            </div>
                         </div>
                      </div>
                   ))}

                   <button onClick={() => setViewMode('PRODUCT_SELECT')} className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-600 bg-blue-50/50 rounded-2xl font-black flex items-center justify-center gap-2 active:bg-blue-100 transition-colors">
                      <Plus className="w-6 h-6" /> AGREGAR PRODUCTOS
                   </button>
                </div>

                <div className="bg-white border-t border-slate-200 p-5 sticky bottom-0">
                   <div className="flex justify-between items-end mb-4">
                      <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Total a Pagar</span>
                      <span className="text-3xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                   </div>
                   <button onClick={handleSaveOrder} disabled={cart.length === 0 || isSaving} className={`w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl flex justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:shadow-none ${isEditMode ? 'bg-red-600 shadow-red-600/30' : 'bg-blue-600 shadow-blue-600/30'}`}>
                      <Save className="w-6 h-6" /> {isEditMode ? 'SOBREESCRIBIR PEDIDO' : 'GUARDAR PEDIDO'}
                   </button>
                </div>
             </div>
          )}

          {clientTab === 'COLLECTION' && (
             <div className="flex-1 overflow-auto p-4 space-y-4">
                {pendingBills.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                      <CheckCircle className="w-16 h-16 mb-4 text-green-200" />
                      <p className="font-bold">Cliente sin deudas pendientes.</p>
                   </div>
                ) : (
                   pendingBills.map(bill => (
                      <div key={bill.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                         <div className="flex justify-between items-start mb-6">
                            <div>
                               <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">{bill.document_type || 'DOC'}</div>
                               <div className="font-mono font-black text-slate-800 text-lg">{bill.series}-{bill.number}</div>
                            </div>
                            <div className="text-right">
                               <div className="text-xs text-slate-400 font-bold line-through">S/ {Number(bill.total || 0).toFixed(2)}</div>
                               <div className="text-2xl font-black text-red-600">S/ {Number(bill.balance ?? bill.total ?? 0).toFixed(2)}</div>
                            </div>
                         </div>
                         <button onClick={() => openPaymentModal(bill)} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black text-base shadow-lg shadow-green-500/30 active:scale-95 flex justify-center items-center gap-2">
                            <Wallet className="w-5 h-5" /> COBRAR AHORA
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
    // === MEJORA VISUAL PARA LOS BOTONES DE SELECCIÓN ===
    const minUnit = selectedProduct?.unit_type || 'UND';
    const maxUnit = selectedProduct?.package_type || 'PKG';
    const isMinSelected = entryUnit === minUnit;
    const isMaxSelected = entryUnit === maxUnit;

    const minPriceObj = selectedProduct ? calculateCalculatedPrice(selectedProduct, minUnit, priceListId) : { price: 0, discount: 0 };
    const maxPriceObj = selectedProduct && selectedProduct.package_type ? calculateCalculatedPrice(selectedProduct, maxUnit, priceListId) : { price: 0, discount: 0 };
    
    // Calculadora en vivo del importe del ítem que estás por agregar
    const currentTotalItemPrice = (entryQty * entryPrice) * (1 - (entryDiscount / 100));

    return (
       <div className="h-screen flex flex-col bg-slate-50 pb-safe">
          <div className="bg-white p-4 border-b border-slate-200 sticky top-0 z-20 rounded-b-2xl shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <button onClick={() => { setViewMode('CLIENT_DETAIL'); setSelectedProduct(null); }} className="bg-slate-100 p-2 rounded-full active:bg-slate-200"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
                <div className="flex-1 relative">
                   <input autoFocus className="w-full bg-slate-100 py-3 pl-10 pr-4 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Buscar por Nombre o SKU..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                   <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                </div>
             </div>
             <div className="overflow-x-auto pb-2 scrollbar-hide flex gap-2">
                {categoriesList.map(cat => (
                   <button key={cat as string} onClick={() => setSelectedCategory(cat as string)} className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-xs font-black transition-colors ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{cat}</button>
                ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
             {selectedProduct ? (
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-slide-up mt-4">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{selectedProduct.sku}</div>
                   <h3 className="text-xl font-black text-slate-800 leading-tight mb-4">{selectedProduct.name}</h3>
                   
                   <div className="text-sm font-black text-green-700 mb-8 bg-green-50 p-4 rounded-2xl border border-green-200 flex justify-between items-center">
                      <span>DISPONIBLE EN RUTA:</span>
                      <span className="text-lg">{selectedProduct.current_stock || 0} Und.</span>
                   </div>
                   
                   <div className="flex items-center justify-between bg-slate-50 p-3 rounded-3xl mb-8 border border-slate-200 shadow-inner">
                      <button onClick={() => setEntryQty(Math.max(1, entryQty - 1))} className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-3xl font-black text-slate-600 active:scale-95">-</button>
                      <span className="text-5xl font-black text-blue-600">{entryQty}</span>
                      <button onClick={() => setEntryQty(entryQty + 1)} className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-3xl font-black text-slate-600 active:scale-95">+</button>
                   </div>

                   {/* MEJORA VISUAL: Diferenciación de colores Mínima (Azul) vs Máxima (Índigo) */}
                   <div className="grid grid-cols-2 gap-3 mb-8">
                      <button onClick={() => handleUnitChange(minUnit)} className={`p-4 rounded-2xl font-black flex flex-col items-center border-2 transition-all ${isMinSelected ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-200 bg-white text-slate-400'}`}>
                         <span className="text-xs tracking-widest mb-1 uppercase">MÍNIMA ({minUnit})</span>
                         <span className="text-xl">S/ {minPriceObj.price.toFixed(2)}</span>
                      </button>
                      
                      <button onClick={() => handleUnitChange(maxUnit)} disabled={!selectedProduct.package_type} className={`p-4 rounded-2xl font-black flex flex-col items-center border-2 transition-all ${isMaxSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-200 bg-white text-slate-400'} disabled:opacity-30 disabled:bg-slate-50`}>
                         <span className="text-xs tracking-widest mb-1 uppercase">MÁXIMA ({maxUnit})</span>
                         <span className="text-xl">S/ {maxPriceObj.price.toFixed(2)}</span>
                      </button>
                   </div>

                   {/* MEJORA VISUAL: Calculadora en vivo en el botón */}
                   <button onClick={executeAddToCart} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-transform mb-3">
                      AGREGAR S/ {currentTotalItemPrice.toFixed(2)}
                   </button>
                   
                   <button onClick={() => setSelectedProduct(null)} className="w-full py-4 text-slate-500 font-bold bg-slate-100 rounded-2xl active:bg-slate-200 transition-colors">CANCELAR</button>
                </div>
             ) : (
                filteredProductsList.map(p => (
                   <div key={p.id} onClick={() => handleProductClick(p)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-95 transition-transform cursor-pointer">
                      <div className="flex-1 pr-3">
                         <div className="font-bold text-slate-800 text-sm leading-tight mb-1.5">{p.name}</div>
                         <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-widest">{p.sku}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded tracking-widest ${(p.current_stock || 0) > 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                               {p.current_stock || 0} DISP
                            </span>
                         </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <div className="font-black text-blue-600 text-base mb-2">S/ {Number(p.price_unit || 0).toFixed(2)}</div>
                         <div className="bg-slate-900 text-white rounded-full p-1.5 shadow-md"><Plus className="w-4 h-4" /></div>
                      </div>
                   </div>
                ))
             )}
             {!selectedProduct && filteredProductsList.length === 0 && <div className="text-center p-8 text-slate-400 font-bold">No hay productos que coincidan.</div>}
          </div>
       </div>
    );
  }

  return null;
};

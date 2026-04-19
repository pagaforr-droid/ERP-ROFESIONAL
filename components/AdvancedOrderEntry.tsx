import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, Client, Order, AutoPromotion, Promotion, Sale } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Eye, Zap, MapPin, Edit, Lock } from 'lucide-react';
import { isPromoValidForContext } from '../utils/promoUtils';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';

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
}

export const AdvancedOrderEntry: React.FC = () => {
  const { users, currentUser } = useStore();

  // REFS PARA NAVEGACIÓN POR TECLADO
  const clientInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // --- MAESTROS ---
  const [dbCompany, setDbCompany] = useState<any>(null);
  const [dbSellers, setDbSellers] = useState<any[]>([]);
  const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
  const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);
  const [dbPromos, setDbPromos] = useState<Promotion[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbSeries, setDbSeries] = useState<any[]>([]);
  const [dbZones, setDbZones] = useState<any[]>([]);
  const [cartProductsCache, setCartProductsCache] = useState<Record<string, Product>>({});
  const [loadedBatches, setLoadedBatches] = useState<Record<string, any[]>>({}); 
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);

  const [docType, setDocType] = useState('FACTURA'); 
  const [pedidoSeries, setPedidoSeries] = useState('');
  const [pedidoNumber, setPedidoNumber] = useState('');
  const [currency, setCurrency] = useState('SOLES');
  const [sellerId, setSellerId] = useState('');

  // CLIENTES
  const [clientSearch, setClientSearch] = useState('');
  const [searchedClients, setSearchedClients] = useState<Client[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [highlightedClientIdx, setHighlightedClientIdx] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const [clientName, setClientName] = useState('');
  const [clientDoc, setClientDoc] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CONTADO');
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [clientCreditInfo, setClientCreditInfo] = useState({ limit: 0, debt: 0, overdue: false, isChecking: false });

  // PRODUCTOS
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<(Product & { current_stock: number })[]>([]);
  const [isSearchingProd, setIsSearchingProd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const [entryQty, setEntryQty] = useState<number>(1);
  const [entryUnit, setEntryUnit] = useState('UND');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [entryDiscount, setEntryDiscount] = useState<number>(0);
  const [entryBonus, setEntryBonus] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState({ isOpen: false, action: () => {}, targetName: '' });
  const [adminPwd, setAdminPwd] = useState('');

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [searchedOrders, setSearchedOrders] = useState<Order[]>([]);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<{ isOpen: boolean, order: Order | null }>({ isOpen: false, order: null });

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [compRes, sellRes, plRes, apRes, prodRes, serRes, zoneRes, promRes] = await Promise.all([
          supabase.from('company_config').select('*').limit(1).maybeSingle(),
          supabase.from('sellers').select('*').order('name'),
          supabase.from('price_lists').select('*').order('name'),
          supabase.from('auto_promotions').select('*').eq('is_active', true),
          supabase.from('products').select('*').eq('is_active', true),
          supabase.from('document_series').select('*').eq('type', 'PEDIDO').eq('is_active', true),
          supabase.from('zones').select('*'),
          supabase.from('promotions').select('*').eq('is_active', true)
        ]);
        
        if (compRes.data) setDbCompany(compRes.data);
        if (sellRes.data) setDbSellers(sellRes.data);
        if (plRes.data) setDbPriceLists(plRes.data);
        if (apRes.data) setDbAutoPromos(apRes.data);
        if (prodRes.data) setDbProducts(prodRes.data as Product[]);
        if (zoneRes.data) setDbZones(zoneRes.data);
        if (promRes.data) setDbPromos(promRes.data);
        if (serRes.data && serRes.data.length > 0) {
          setDbSeries(serRes.data);
          setPedidoSeries(serRes.data[0].series);
          setPedidoNumber(String(serRes.data[0].current_number + 1).padStart(8, '0'));
        }
      } catch (e) {
        console.error("Error inicializando maestros:", e);
      }
    };
    fetchMasters();
  }, []);

  const fetchLiveSeries = async () => {
    const { data } = await supabase.from('document_series').select('*').eq('type', 'PEDIDO').eq('is_active', true);
    if (data && data.length > 0) {
        setDbSeries(data);
        const current = data.find(s => s.series === pedidoSeries) || data[0];
        setPedidoSeries(current.series);
        setPedidoNumber(String(current.current_number + 1).padStart(8, '0'));
    }
  };

  // --- LÓGICA CORE DE PRECIOS ---
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
        if (!promo.product_ids.includes(p.id)) return false;
        if (!isPromoValidForContext(promo, 'IN_STORE', selectedClient?.city || '', sellerId || currentUser?.id, currentUser?.role)) return false;
        if (promo.target_price_list_ids?.length > 0 && listId && !promo.target_price_list_ids.includes('ALL') && !promo.target_price_list_ids.includes(listId)) return false;
        return true;
    });

    if (activePromo) {
        if (activePromo.type === 'PERCENTAGE_DISCOUNT') {
            defaultDiscount = activePromo.value;
        } else if (activePromo.type === 'FIXED_PRICE') {
            let promoPrice = Number(activePromo.value);
            if (p.package_type && unit === p.package_type && !p.price_package) {
                promoPrice = promoPrice * Number(p.package_content || 1);
            }
            price = promoPrice;
        }
    }

    return { price, discount: defaultDiscount };
  };

  // BÚSQUEDA DE CLIENTES
  useEffect(() => {
    if (clientSearch.length < 3) { setSearchedClients([]); setHighlightedClientIdx(0); return; }
    const timer = setTimeout(async () => {
      setIsSearchingClient(true);
      const { data } = await supabase.from('clients').select('*').or(`name.ilike.%${clientSearch}%,doc_number.ilike.%${clientSearch}%`).limit(10);
      if (data) setSearchedClients(data as Client[]);
      setHighlightedClientIdx(0);
      setIsSearchingClient(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const handleClientKeyDown = (e: React.KeyboardEvent) => {
    if (searchedClients.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedClientIdx(prev => (prev + 1) % searchedClients.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedClientIdx(prev => (prev - 1 + searchedClients.length) % searchedClients.length); }
    else if (e.key === 'Enter') { e.preventDefault(); handleSelectClient(searchedClients[highlightedClientIdx]); }
    else if (e.key === 'Escape') { setSearchedClients([]); }
  };

  const handleSelectClient = async (c: Client) => {
    setSelectedClient(c);
    setSelectedClientId(c.id);
    setClientName(c.name);
    setClientDoc(c.doc_number);
    setClientAddress(c.address);
    setPriceListId(c.price_list_id || '');
    setPaymentMethod(c.payment_condition?.toUpperCase().includes('CREDIT') ? 'CREDITO' : 'CONTADO');
    setClientSearch('');
    setSearchedClients([]);
    
    let autoSellerId = '';
    if (c.zone_id) { const zone = dbZones.find(z => z.id === c.zone_id); if (zone && zone.assigned_seller_id) { autoSellerId = zone.assigned_seller_id; } }
    if (autoSellerId) setSellerId(autoSellerId);
    
    await fetchLiveSeries();
    
    checkClientCredit(c.id, c.credit_limit || 0);
    setTimeout(() => productInputRef.current?.focus(), 100);
  };

  // BÚSQUEDA DE PRODUCTOS CON KARDEX INTEGRADO
  useEffect(() => {
    if (productSearch.length < 2) { setSearchedProducts([]); setHighlightedIndex(0); return; }
    const timer = setTimeout(async () => {
      setIsSearchingProd(true);
      try {
        const { data: pData } = await supabase.from('products').select('*').or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`).eq('is_active', true).limit(15);
        if (pData && pData.length > 0) {
          const pIds = pData.map(p => p.id);
          const { data: bData } = await supabase.from('batches').select('*').in('product_id', pIds).gt('quantity_current', 0).order('expiration_date', { ascending: true });
          const batchCache: Record<string, any[]> = {};
          
          const enriched = pData.map(p => {
            const prodBatches = (bData || []).filter(b => b.product_id === p.id);
            batchCache[p.id] = prodBatches;
            const stock = prodBatches.length > 0 ? prodBatches.reduce((sum, b) => sum + Number(b.quantity_current || 0), 0) : Number(p.current_stock || p.stock || 0);
            return { ...p, current_stock: stock };
          });
          
          setLoadedBatches(prev => ({ ...prev, ...batchCache }));
          setSearchedProducts(enriched);
        } else {
          setSearchedProducts([]);
        }
        setHighlightedIndex(0);
      } catch (error) { console.error(error); } finally { setIsSearchingProd(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % searchedProducts.length);
    } else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + searchedProducts.length) % searchedProducts.length);
    } else if (e.key === 'Enter') { 
       e.preventDefault(); 
       if (searchedProducts.length > 0) handleSelectProduct(searchedProducts[highlightedIndex]);
    } else if (e.key === 'Escape') { setSearchedProducts([]); }
  };

  const handleSelectProduct = (p: Product) => {
    setCartProductsCache(prev => ({...prev, [p.id]: p}));
    setSelectedProduct(p);
    setProductSearch(p.sku + ' - ' + p.name); 
    setSearchedProducts([]);
    
    const defaultUnit = p.unit_type || 'UND';
    setEntryUnit(defaultUnit);
    setEntryQty(1);
    
    const { price, discount } = calculateCalculatedPrice(p, defaultUnit, priceListId);
    setEntryPrice(price);
    setEntryDiscount(discount);
    setEntryBonus(false);

    setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
  };

  const handleUnitChange = (newUnit: string) => {
    setEntryUnit(newUnit);
    if (selectedProduct) {
        const { price, discount } = calculateCalculatedPrice(selectedProduct, newUnit, priceListId);
        setEntryPrice(price);
        setEntryDiscount(discount);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        executeAddToCart();
    }
  };

  const checkClientCredit = async (clientId: string, creditLimit: number = 0) => {
    setClientCreditInfo({ limit: creditLimit, debt: 0, overdue: false, isChecking: true });
    try {
        const { data: unpaidSales } = await supabase.from('sales').select('created_at, total, balance').eq('client_id', clientId).eq('payment_status', 'PENDING').neq('status', 'canceled');
        let debt = 0; let hasOverdue = false;
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (unpaidSales) {
            unpaidSales.forEach(s => {
                const amount = s.balance !== undefined && s.balance !== null ? Number(s.balance) : Number(s.total);
                debt += amount;
                if (new Date(s.created_at) < sevenDaysAgo && amount > 0) hasOverdue = true;
            });
        }
        setClientCreditInfo({ limit: creditLimit, debt, overdue: hasOverdue, isChecking: false });
    } catch(e) { console.error(e); setClientCreditInfo(prev => ({...prev, isChecking: false})); }
  }

  // --- RE-EVALUACIÓN AUTOMÁTICA DE PROMOCIONES ---
  const applyPromotions = (currentCart: CartItem[], listId: string) => {
    let cleanCart = currentCart.filter(item => !item.auto_promo_id);

    const getBaseQuantity = (item: CartItem) => {
        if (item.unit_type === item.product_ref?.package_type) {
            return item.quantity * Number(item.product_ref.package_content || 1);
        }
        return item.quantity;
    };

    const validPromos = dbAutoPromos.filter(ap => {
      if (!isPromoValidForContext(ap, 'IN_STORE', selectedClient?.city || '', sellerId || currentUser?.id, currentUser?.role)) return false;
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
          const realUnitName = isPkgMode ? (rewardProduct.package_type || 'CAJA').toUpperCase() : (rewardProduct.unit_type || 'UND').toUpperCase();

          cleanCart.push({
            id: crypto.randomUUID(),
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

    const availableBatches = loadedBatches[selectedProduct.id] || [];
    const totalStock = availableBatches.length > 0 ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0) : Number(selectedProduct.current_stock || selectedProduct.stock || 0);

    if (totalStock < requiredBaseUnits && !entryBonus) {
        alert(`❌ Stock Insuficiente para ${selectedProduct.name}.\nDisponible: ${totalStock} unid.\nRequerido: ${requiredBaseUnits} unid.`);
        return;
    }

    const gross = entryQty * entryPrice;
    const finalPrice = gross - (gross * (entryDiscount / 100));

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product_id: selectedProduct.id,
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      quantity: entryQty,
      unit_type: entryUnit,
      unit_price: entryPrice,
      discount_percent: entryDiscount,
      total_price: entryBonus ? 0 : finalPrice,
      is_bonus: entryBonus,
      product_ref: selectedProduct
    };

    let tempCart = [...cart];
    const existingIdx = tempCart.findIndex(i => i.product_id === newItem.product_id && !i.is_bonus && !i.auto_promo_id && i.unit_type === newItem.unit_type);
    
    if (existingIdx >= 0) {
      tempCart[existingIdx].quantity += entryQty;
      const tGross = tempCart[existingIdx].quantity * tempCart[existingIdx].unit_price;
      tempCart[existingIdx].total_price = tGross - (tGross * (tempCart[existingIdx].discount_percent / 100));
    } else {
      tempCart.push(newItem);
    }

    applyPromotions(tempCart, priceListId);

    setSelectedProduct(null);
    setProductSearch('');
    setEntryQty(1);
    setEntryPrice(0);
    setEntryDiscount(0);
    setEntryBonus(false);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const handleUpdateCartPrices = () => {
    let tempCart = cart.map(item => {
      if (item.is_bonus || item.auto_promo_id) return item;
      const pRef = item.product_ref;
      const { price, discount } = calculateCalculatedPrice(pRef, item.unit_type, priceListId);
      const tGross = item.quantity * price;
      return {
        ...item,
        unit_price: price,
        discount_percent: discount,
        total_price: tGross - (tGross * (discount / 100))
      };
    });
    applyPromotions(tempCart, priceListId);
    alert("Precios del carrito actualizados según lista y unidades configuradas.");
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
    const totalStock = availableBatches.length > 0 ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0) : Number(pRef.current_stock || pRef.stock || 0);

    if (totalStock < requiredBaseUnits && !item.is_bonus) {
        alert(`❌ Stock Insuficiente para ${pRef.name}.\nDisponible: ${totalStock} unid.\nIntentó solicitar: ${requiredBaseUnits} unid.`);
        return;
    }

    const tGross = newQty * item.unit_price;
    tempCart[itemIndex] = { ...item, quantity: newQty, total_price: tGross - (tGross * (item.discount_percent / 100)) };
    
    applyPromotions(tempCart, priceListId);
  };

  // --- BÚSQUEDA CORREGIDA (ENUM STRICT) ---
  useEffect(() => {
    if (!isSearchModalOpen) return;
    const timer = setTimeout(async () => {
        setIsSearchingOrder(true);
        try {
            // Buscamos estrictamente 'pending' en minúsculas por restricción de Postgres ENUM
            let query = supabase.from('orders')
                .select('*')
                .eq('status', 'pending') 
                .order('created_at', { ascending: false })
                .limit(20);
                
            if (orderSearchTerm.trim().length > 0) {
                query = query.or(`code.ilike.%${orderSearchTerm}%,client_name.ilike.%${orderSearchTerm}%,client_doc_number.ilike.%${orderSearchTerm}%`);
            }
            
            const { data, error } = await query;
            if (error) console.error("Error BD:", error);
            if (data) setSearchedOrders(data as Order[]);
        } catch (e) {
            console.error("Error App:", e);
        } finally { 
            setIsSearchingOrder(false); 
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [orderSearchTerm, isSearchModalOpen]);

  // --- CARGA DIRECTA Y OPTIMIZADA DESDE DB ---
  const loadOrder = async (order: Order) => {
    setIsSaving(true);
    try {
        // "Agarra el ID y busca el detalle"
        const { data: orderItemsData, error } = await supabase.from('order_items').select(`*`).eq('order_id', order.id);
        
        if (error) throw error;

        let loadedItems: CartItem[] = [];
        if (orderItemsData) {
            // Traer productos involucrados por si no están en caché
            const pIds = [...new Set(orderItemsData.map((item: any) => item.product_id))];
            const { data: prods } = await supabase.from('products').select('*').in('id', pIds);
            const prodMap = (prods || []).reduce((acc: any, p: any) => ({...acc, [p.id]: p}), {});

            loadedItems = orderItemsData.map((item: any) => {
                const pRef = prodMap[item.product_id] || dbProducts.find(p => p.id === item.product_id) || {} as Product;
                return {
                    id: item.id,
                    product_id: item.product_id,
                    sku: item.product_sku || pRef.sku,
                    name: item.product_name || pRef.name,
                    quantity: item.quantity_presentation || item.quantity_base || item.quantity || 1,
                    unit_type: item.unit_type || item.selected_unit || 'UND',
                    unit_price: item.unit_price || 0,
                    discount_percent: item.discount_percent || 0,
                    total_price: item.total_price || 0,
                    is_bonus: item.is_bonus || false,
                    auto_promo_id: item.auto_promo_id || undefined,
                    product_ref: pRef
                };
            });
        }

        setOriginalOrder(order);
        setIsEditMode(true);
        
        setDocType((order.suggested_document_type as any) || 'FACTURA'); 
        if (order.code && order.code.includes('-')) {
           const [s, n] = order.code.split('-');
           setPedidoSeries(s); setPedidoNumber(n);
        } else {
           setPedidoNumber(order.code);
        }

        setSellerId(order.seller_id || ''); 
        setPaymentMethod(order.payment_method as any || 'CONTADO'); 
        setClientName(order.client_name);
        setClientDoc(order.client_doc_number);
        setClientAddress(order.delivery_address || '');
        setSelectedClientId(order.client_id || '');

        setCart(loadedItems); 
        setIsSearchModalOpen(false);
    } catch (err: any) {
        alert('Error al cargar pedido: ' + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleNewOrder = () => {
    setIsEditMode(false); setOriginalOrder(null); setCart([]); setSelectedClientId(''); setSelectedClient(null);
    setClientName(''); setClientDoc(''); setClientAddress(''); setPriceListId(''); setSellerId('');
    fetchLiveSeries();
    setTimeout(() => clientInputRef.current?.focus(), 100);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0) / (1 + (Number(dbCompany?.igv_percent || 18) / 100));
  const igv = cart.reduce((sum, item) => sum + item.total_price, 0) - subtotal;
  const total = cart.reduce((sum, item) => sum + item.total_price, 0);

  const handlePreview = async () => {
    const seller = dbSellers.find(s => s.id === sellerId);
    const tempOrder: any = { 
       id: 'preview', document_type: docType, series: pedidoSeries, number: pedidoNumber, 
       payment_method: paymentMethod, payment_status: 'PENDING', balance: total, 
       client_name: clientName || 'CLIENTE MOSTRADOR', client_ruc: clientDoc || '00000000', 
       client_address: clientAddress || '', subtotal, igv, total: total, 
       status: 'completed', created_at: new Date().toISOString(), items: cart,
       seller_name: seller ? seller.name : ''
    };
    try { 
      await PdfEngine.openDocument(tempOrder as unknown as Sale, docType, dbCompany); 
    } catch (err) { alert('Error generando la vista previa.'); }
  };

  const handleSaveOrder = async () => {
    if (!clientName) { alert("Debe ingresar un cliente."); clientInputRef.current?.focus(); return; }
    if (cart.length === 0) { alert("El pedido no puede estar vacío."); productInputRef.current?.focus(); return; }
    if (!pedidoSeries && !isEditMode) { alert("Configure una serie para PEDIDO en ajustes."); return; }

    setIsSaving(true);
    const orderPayload = {
      id: isEditMode && originalOrder ? originalOrder.id : crypto.randomUUID(),
      code: isEditMode && originalOrder ? originalOrder.code : `${pedidoSeries}-${pedidoNumber}`,
      client_id: selectedClientId || undefined,
      client_name: clientName,
      client_doc_type: clientDoc.length === 11 ? 'RUC' : 'DNI',
      client_doc_number: clientDoc,
      seller_id: sellerId || undefined,
      suggested_document_type: docType,
      payment_method: paymentMethod,
      total: total,
      status: 'pending', 
      delivery_address: clientAddress,
      items: cart.map(c => ({
        id: c.id,
        product_id: c.product_id,
        product_sku: c.sku,
        product_name: c.name,
        quantity_base: (c.unit_type === c.product_ref?.package_type) ? (c.quantity * Number(c.product_ref.package_content || 1)) : c.quantity,
        quantity_presentation: c.quantity,
        quantity: c.quantity, 
        unit_type: c.unit_type, 
        selected_unit: c.unit_type, 
        unit_price: c.unit_price,
        discount_percent: c.discount_percent,
        discount_amount: (c.quantity * c.unit_price) * (c.discount_percent / 100),
        total_price: c.total_price,
        is_bonus: c.is_bonus,
        auto_promo_id: c.auto_promo_id || null
      }))
    };

    try {
      const rpcName = isEditMode ? 'update_order_transaction' : 'process_order_transaction';
      const { data, error } = await supabase.rpc(rpcName, { p_order_data: orderPayload });
      if (error) throw error;

      alert(isEditMode ? `¡Pedido modificado con éxito!` : `¡Pedido guardado! Código: ${data?.real_code || pedidoNumber}`);
      handleNewOrder();
    } catch (error: any) { alert("Error al guardar: " + error.message);
    } finally { setIsSaving(false); }
  };

  const verifyAdmin = () => {
    const admin = users.find(u => u.role === 'ADMIN' && u.password === adminPwd);
    if (admin) {
      showAdminAuthModal.action();
      setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' });
      setAdminPwd('');
    } else { alert("Contraseña incorrecta."); }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 font-sans text-xs">
      {/* OVERLAY SAVING */}
      {isSaving && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex flex-col items-center justify-center">
            <h2 className="text-2xl font-black text-white tracking-widest">PROCESANDO PEDIDO...</h2>
            <p className="text-blue-200 font-medium mt-2">Asegurando y reservando stock</p>
        </div>
      )}

      {/* CABECERA PRINCIPAL REORGANIZADA */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 mb-0.5">Convertir a</label>
            <select className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none" value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="FACTURA">FACTURA</option>
              <option value="BOLETA">BOLETA</option>
            </select>
          </div>

          <div className="flex flex-col">
             <label className="text-[10px] font-bold text-slate-500 mb-0.5">Documento N°</label>
             <div className="flex items-center bg-slate-50 border border-slate-300 rounded overflow-hidden">
                <select className="bg-transparent px-2 py-1.5 font-bold text-slate-900 border-r border-slate-300 outline-none hover:bg-slate-100 min-w-[5rem]" value={pedidoSeries} onChange={e => setPedidoSeries(e.target.value)} disabled={isEditMode}>
                  {dbSeries.map(s => <option key={s.id} value={s.series}>{s.series}</option>)}
                </select>
                <input className="w-32 px-3 py-1.5 text-center bg-transparent font-bold text-slate-900 outline-none" value={pedidoNumber || 'Cargando...'} readOnly />
             </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 mb-0.5">Moneda</label>
            <select className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="SOLES">SOLES</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 mb-0.5">Vendedor Asignado</label>
            <select className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 font-bold text-slate-900 w-48 focus:ring-1 focus:ring-blue-500 outline-none" value={sellerId} onChange={e => setSellerId(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

        </div>

        <div className="flex gap-2">
          <button onClick={handleNewOrder} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg font-bold shadow-sm flex items-center transition-colors">
            <FilePlus className="w-4 h-4 mr-2" /> Nuevo (F2)
          </button>
          <button onClick={() => setIsSearchModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold shadow-sm flex items-center transition-colors">
            <Search className="w-4 h-4 mr-2" /> Cargar/Editar Pedido
          </button>
        </div>
      </div>

      {isEditMode && (
         <div className="mb-2 px-3 py-2 bg-red-600 text-white font-bold rounded flex justify-between items-center shadow-sm">
            <span>MODIFICANDO PEDIDO: {originalOrder?.code}</span>
            <button onClick={handleNewOrder} className="hover:text-red-200 bg-red-700 px-2 py-1 rounded text-[10px]">DESCARTAR CAMBIOS</button>
         </div>
      )}

      {/* SECCIÓN CLIENTE */}
      <div className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 relative">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Cod / Buscar Cliente</label>
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-4 h-4 text-slate-400" />
              <input 
                ref={clientInputRef}
                autoFocus
                className="w-full pl-8 pr-2 py-1 border border-slate-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="RUC o Nombre..." 
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                onKeyDown={handleClientKeyDown}
              />
              {searchedClients.length > 0 && clientSearch && (
                <div className="absolute top-full left-0 w-[400px] bg-white border border-slate-300 shadow-xl rounded z-50 mt-1 overflow-hidden">
                  {searchedClients.map((c, i) => (
                    <div key={c.id} onMouseDown={() => handleSelectClient(c)} className={`p-2 cursor-pointer border-b border-slate-100 ${highlightedClientIdx === i ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.doc_number}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Razón Social</label>
            <input className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800 bg-slate-50 outline-none" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">RUC/DNI</label>
            <input className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-mono font-bold text-slate-800 bg-slate-50 outline-none" value={clientDoc} onChange={e => setClientDoc(e.target.value)} />
          </div>
          
          <div className="col-span-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Lista Precio</label>
                <select className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800 outline-none" value={priceListId} onChange={e => setPriceListId(e.target.value)}>
                  <option value="">-- General --</option>
                  {dbPriceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Forma Pago</label>
                <div className="flex gap-1">
                  <button onClick={handleUpdateCartPrices} className="bg-blue-100 text-blue-700 px-2 rounded hover:bg-blue-200" title="Actualizar precios del carrito">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <select className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800 outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="CONTADO">CONTADO</option>
                    <option value="CREDITO">CRÉDITO</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección de Entrega</label>
          <div className="flex relative">
            <input className="flex-1 py-1 px-2 border border-slate-300 rounded text-sm text-slate-700 bg-slate-50 outline-none" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
            {selectedClient?.branches && selectedClient.branches.length > 0 && (
              <button onClick={() => setShowBranchSelector(!showBranchSelector)} className="absolute right-0 h-full px-3 border-l border-slate-300 text-blue-600 hover:bg-blue-50 flex items-center">
                <MapPin className="w-4 h-4 mr-1" /><ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showBranchSelector && selectedClient && (
              <div className="absolute top-full right-0 w-[400px] bg-white border border-slate-300 shadow-xl rounded mt-1 z-50 overflow-hidden">
                <div className="bg-slate-100 p-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">Seleccionar Sucursal</div>
                <div className="max-h-48 overflow-y-auto">
                  {[selectedClient.address, ...(selectedClient.branches || [])].map((addr, i) => (
                    <div key={i} onClick={() => { setClientAddress(addr); setShowBranchSelector(false); }} className="p-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex gap-2 text-sm text-slate-700">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                      <span className={clientAddress === addr ? 'font-bold text-blue-800' : ''}>{addr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ENTRADA DE PRODUCTOS */}
      <div className="bg-white border border-slate-300 shadow-sm flex flex-col flex-1 rounded-t-lg overflow-hidden">
        
        <div className="bg-blue-50 border-b border-blue-200 p-2 flex gap-2 items-end">
          <div className="flex-1 relative">
            <label className="block text-[10px] font-bold text-blue-800 mb-1">Producto (Buscar por Código o Nombre)</label>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-4 h-4 text-blue-400" />
              <input 
                ref={productInputRef}
                className="w-full pl-8 pr-2 py-1.5 border border-blue-300 rounded text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none uppercase transition-shadow"
                placeholder="PISTOLEAR O ESCRIBIR..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                onKeyDown={handleProductKeyDown}
              />
              {searchedProducts.length > 0 && productSearch && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-2xl rounded mt-1 z-50 max-h-60 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-600">
                      <tr><th className="p-2">Código</th><th className="p-2">Producto</th><th className="p-2 text-right">Precio Und</th><th className="p-2 text-right text-blue-600">Stock Real</th></tr>
                    </thead>
                    <tbody>
                      {searchedProducts.map((p, i) => (
                        <tr key={p.id} onMouseDown={() => handleSelectProduct(p)} className={`cursor-pointer text-sm border-b border-slate-50 ${highlightedIndex === i ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
                          <td className="p-2 font-mono font-bold text-blue-800">{p.sku}</td>
                          <td className="p-2 text-slate-800">{p.name}</td>
                          <td className="p-2 text-right text-slate-600">S/ {Number(p.price_unit).toFixed(2)}</td>
                          <td className={`p-2 text-right font-black ${p.current_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{p.current_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="w-20">
            <label className="block text-[10px] font-bold text-blue-800 mb-1 text-center">Cant.</label>
            <input 
              ref={qtyInputRef} 
              type="number" min="1" 
              className="w-full py-1.5 px-2 border border-blue-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              value={entryQty} 
              onChange={e => setEntryQty(Number(e.target.value))}
              onKeyDown={handleQtyKeyDown} 
            />
          </div>

          <div className="w-32 relative">
            <label className="block text-[10px] font-bold text-blue-800 mb-1">Unidad</label>
            <select className="w-full py-1.5 px-2 border border-blue-300 rounded text-sm font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={entryUnit} onChange={e => handleUnitChange(e.target.value)}>
              <option value={selectedProduct?.unit_type || 'UND'}>{selectedProduct?.unit_type || 'UND'} (Mínima)</option>
              {selectedProduct?.package_type && <option value={selectedProduct.package_type}>{selectedProduct.package_type} (Máxima)</option>}
            </select>
            <ChevronDown className="absolute right-2 top-7 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          <div className="w-28 relative">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio Unit.</label>
            <div className="relative">
                <input 
                    type="number" 
                    className="w-full py-1.5 pl-2 pr-6 border border-slate-300 rounded text-right text-sm font-bold bg-slate-100 text-slate-500 outline-none cursor-not-allowed" 
                    readOnly 
                    value={entryPrice.toFixed(2)} 
                />
                <Lock className="absolute right-2 top-2 w-3 h-3 text-slate-400" />
            </div>
          </div>

          <div className="w-20">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 text-right">% Dsc</label>
            <div className="relative">
                <input 
                    type="number" 
                    className="w-full py-1.5 pl-2 pr-5 border border-slate-300 rounded text-right text-sm font-bold bg-slate-100 text-slate-500 outline-none cursor-not-allowed" 
                    readOnly 
                    value={entryDiscount} 
                />
                <Lock className="absolute right-1 top-2 w-3 h-3 text-slate-400" />
            </div>
          </div>

          <div className="w-20 flex items-center justify-center pb-2">
            <label className="flex items-center gap-1 text-[11px] font-bold text-blue-800 cursor-pointer">
              <input type="checkbox" checked={entryBonus} onChange={e => {
                if (e.target.checked) setShowAdminAuthModal({ isOpen: true, action: () => setEntryBonus(true), targetName: 'Activar Bonificación Manual' });
                else setEntryBonus(false);
              }} />
              Bonif.
            </label>
          </div>

          <button onClick={() => { if(entryBonus) setShowAdminAuthModal({isOpen: true, action: executeAddToCart, targetName: 'Autorizar Regalo'}); else executeAddToCart(); }} disabled={!selectedProduct} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow disabled:opacity-50 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* GRILLA */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-300 shadow-sm">
              <tr>
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2 w-28">CÓDIGO</th>
                <th className="p-2">DESCRIPCIÓN PRODUCTO</th>
                <th className="p-2 text-center w-20">CANT</th>
                <th className="p-2 text-center w-24">UNIDAD</th>
                <th className="p-2 text-right w-24">PRECIO</th>
                <th className="p-2 text-right w-16">DSC %</th>
                <th className="p-2 text-right w-28">IMPORTE</th>
                <th className="p-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((item, idx) => (
                <tr key={item.id} className={item.is_bonus ? 'bg-orange-50/50' : 'hover:bg-slate-50'}>
                  <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-2 font-mono text-slate-700">{item.sku}</td>
                  <td className="p-2">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {item.name}
                      {item.auto_promo_id && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm flex items-center"><Zap className="w-3 h-3 mr-1"/> {item.promo_name}</span>}
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    {!item.is_bonus ? (
                      <input 
                        type="number" min="1"
                        className="w-16 text-center bg-white border border-slate-300 rounded px-1 py-1 font-bold outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.quantity}
                        onChange={e => handleCartQtyChange(item.id, Number(e.target.value))}
                      />
                    ) : (
                      <span className="font-black text-orange-600">{item.quantity}</span>
                    )}
                  </td>
                  <td className="p-2 text-center font-bold text-slate-500 uppercase">{item.unit_type}</td>
                  <td className="p-2 text-right font-medium">S/ {item.unit_price.toFixed(2)}</td>
                  <td className="p-2 text-right text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                  <td className="p-2 text-right font-black text-slate-900 text-sm">S/ {item.total_price.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <button onClick={() => {
                        let tempCart = cart.filter(c => c.id !== item.id);
                        applyPromotions(tempCart, priceListId);
                    }} disabled={!!item.auto_promo_id} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium italic border-dashed border-2 border-slate-200 mt-4 mx-4 rounded">
                    El pedido está vacío. Utilice el buscador superior para agregar productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER TOTALES */}
      <div className="bg-slate-100 border-t border-slate-300 mt-2 p-2 flex justify-between items-end gap-4 shrink-0 rounded-b-lg">
        <div className="flex flex-col justify-end">
          <button onClick={handlePreview} disabled={cart.length === 0} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm font-bold hover:bg-slate-50 flex items-center disabled:opacity-50 transition-colors">
            <Printer className="w-4 h-4 mr-2" /> Vista Previa
          </button>
          <div className="text-[10px] text-slate-500 mt-2 italic">
            * Los precios están bloqueados por sistema y se calculan según lista y unidad.<br/>
            * Las promociones (Bonificaciones) se recalcularán automáticamente al editar cantidades.<br/>
            * <b>Inventario Verificado:</b> El stock se descuenta usando la trazabilidad de los lotes reales.
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="bg-white border border-slate-300 shadow-sm rounded p-3 grid grid-cols-2 gap-x-6 gap-y-1 w-64">
             <div className="text-right text-slate-500 font-bold">Op. Gravada:</div>
             <div className="text-right font-mono text-slate-800 font-medium">{subtotal.toFixed(2)}</div>
             <div className="text-right text-slate-500 font-bold">IGV (18%):</div>
             <div className="text-right font-mono text-slate-800 font-medium">{igv.toFixed(2)}</div>
             <div className="col-span-2 border-t border-slate-200 my-1"></div>
             <div className="text-right text-slate-800 font-black text-sm self-center">TOTAL A PAGAR:</div>
             <div className="text-right font-black text-xl bg-slate-800 text-blue-400 px-2 rounded font-mono shadow-inner tracking-widest">
                {total.toFixed(2)}
             </div>
          </div>

          <button 
            onClick={handleSaveOrder} 
            disabled={cart.length === 0 || !clientName || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white w-36 h-20 rounded-lg shadow-lg flex flex-col items-center justify-center font-black transition-colors disabled:opacity-50 active:scale-95"
          >
             <Save className="w-6 h-6 mb-1" />
             {isEditMode ? 'SOBREESCRIBIR' : 'GUARDAR (F10)'}
          </button>
        </div>
      </div>

      {/* MODAL BÚSQUEDA DE PEDIDOS */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] border border-blue-500 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                 <h3 className="font-black flex items-center text-lg"><Search className="w-5 h-5 mr-2 text-blue-400" /> BÚSQUEDA DE PEDIDOS PENDIENTES</h3>
                 <button onClick={() => setIsSearchModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-4 bg-slate-50 border-b border-slate-200 relative">
                 <input
                    autoFocus
                    className="w-full border-2 border-slate-300 rounded p-4 text-xl font-bold focus:border-blue-500 outline-none transition-shadow"
                    placeholder="Escriba Nro Pedido (Ej. PE01), RUC o Cliente..."
                    value={orderSearchTerm}
                    onChange={e => setOrderSearchTerm(e.target.value)}
                 />
              </div>
              <div className="flex-1 overflow-auto bg-white relative">
                 <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200 shadow-sm">
                       <tr>
                          <th className="p-4">Documento</th>
                          <th className="p-4">Fecha</th>
                          <th className="p-4">Cliente</th>
                          <th className="p-4 text-right">Total</th>
                          <th className="p-4 text-center">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {searchedOrders.map(o => (
                          <tr key={o.id} className="hover:bg-blue-50 transition-colors">
                             <td className="p-4 font-bold text-blue-700 text-[15px]">{o.code}</td>
                             <td className="p-4 text-slate-600 font-medium text-[15px]">{new Date(o.created_at).toLocaleDateString()}</td>
                             <td className="p-4">
                                <div className="font-bold text-slate-800 text-[15px]">{o.client_name}</div>
                                <div className="text-[13px] text-slate-500">{o.client_doc_number}</div>
                             </td>
                             <td className="p-4 text-right font-black text-slate-900 text-[16px]">S/ {Number(o.total || 0).toFixed(2)}</td>
                             <td className="p-4 text-center flex justify-center gap-2">
                                <button onClick={() => setShowHistoryModal({ isOpen: true, order: o })} className="bg-white border border-slate-300 px-3 py-1.5 rounded text-[13px] font-bold text-slate-700 hover:bg-slate-100 shadow-sm flex items-center transition-all hover:border-slate-400" title="Ver Historial">
                                   H.
                                </button>
                                <button onClick={() => loadOrder(o)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow flex items-center justify-center transition-colors">
                                   <Edit className="w-4 h-4 mr-2" /> Editar
                                </button>
                             </td>
                          </tr>
                       ))}
                       {searchedOrders.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-base font-bold">No hay pedidos pendientes.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {showHistoryModal.isOpen && showHistoryModal.order && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh] w-full max-w-2xl border border-blue-500 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                 <h3 className="font-black flex items-center text-lg"><Eye className="w-5 h-5 mr-2 text-blue-400" /> Historial de Pedido: {showHistoryModal.order.code}</h3>
                 <button onClick={() => setShowHistoryModal({ isOpen: false, order: null })} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-auto bg-white p-4">
                 <table className="w-full text-left text-sm border-collapse border border-slate-200">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                       <tr>
                          <th className="p-3 border-b border-slate-200">Fecha</th>
                          <th className="p-3 border-b border-slate-200">Acción</th>
                          <th className="p-3 border-b border-slate-200">Usuario</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr className="hover:bg-slate-50">
                          <td className="p-3 border-b border-slate-100">{new Date(showHistoryModal.order.created_at).toLocaleString()}</td>
                          <td className="p-3 border-b border-slate-100 font-bold text-green-700">CREADO</td>
                          <td className="p-3 border-b border-slate-100 italic">Sistema</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ADMIN */}
      {showAdminAuthModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h3 className="font-black text-slate-800 text-lg mb-1 flex items-center">Autorización Requerida</h3>
            <p className="text-sm text-slate-500 mb-4 pb-4 border-b border-slate-100">Ingrese credencial para: <strong className="text-slate-800">{showAdminAuthModal.targetName}</strong></p>
            <input
               type="password" placeholder="••••••••"
               className="w-full border-2 border-slate-200 rounded-lg p-3 mb-4 text-center text-2xl tracking-[0.5em] focus:border-blue-500 outline-none transition-shadow"
               value={adminPwd} onChange={e => setAdminPwd(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') verifyAdmin(); if (e.key === 'Escape') setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' }); }}
            />
            <div className="flex gap-2">
               <button onClick={() => setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' })} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
               <button onClick={verifyAdmin} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold shadow hover:bg-blue-700 transition-colors">Autorizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

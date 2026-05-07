import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, SaleItem, Client, Sale, Batch } from '../types';
import { ShoppingCart, Search, Trash2, CheckCircle2, X, Plus, Minus, CreditCard, Banknote, HelpCircle, AlertTriangle, ShieldCheck, User, Zap, Loader2, Printer, Check, ScanLine, Tag, Package, Hash, Keyboard, Smartphone, Lock, Unlock, Clock, BrainCircuit } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';
import { allocateBatchesFIFO } from '../utils/productUtils';

export const POS: React.FC = () => {
   const store = useStore();
   const { currentUser, currentPosSession } = store;

   const barcodeInputRef = useRef<HTMLInputElement>(null);
   const checkoutInputRef = useRef<HTMLInputElement>(null);
   const openingAmountRef = useRef<HTMLInputElement>(null);
   
   const [isSaving, setIsSaving] = useState(false);
   const [isLoadingClient, setIsLoadingClient] = useState(false);

   const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void }>({
       isOpen: false, type: 'info', title: '', message: ''
   });

   const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
       setDialog({ isOpen: true, type, title, message, onConfirm });
   };
   const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

   // --- CASH SESSION LOGIC ---
   const [isOpeningSession, setIsOpeningSession] = useState(false);
   const [openingAmount, setOpeningAmount] = useState<string>('');
   const [showShiftModal, setShowShiftModal] = useState(false);

   const handleOpenSession = async () => {
       if (isOpeningSession) return;
       const amt = parseFloat(openingAmount);
       if (isNaN(amt) || amt < 0) {
           showDialog('error', 'Error', 'Ingrese un monto inicial válido.');
           return;
       }
       setIsOpeningSession(true);
       try {
           await store.openPosSession(amt, currentUser?.id || '00000000-0000-0000-0000-000000000000');
           setOpeningAmount('');
           setTimeout(() => barcodeInputRef.current?.focus(), 100);
       } catch (err: any) {
           showDialog('error', 'Error', `No se pudo abrir el turno: ${err.message}`);
       } finally {
           setIsOpeningSession(false);
       }
   };

   // Shift Calculations
   const calculateShiftData = () => {
       if (!currentPosSession) return { cash: 0, card: 0, yape: 0, transfer: 0, credit: 0, totalIncome: 0, expected: 0 };
       const sales = store.sales.filter(s => 
           new Date(s.created_at) >= new Date(currentPosSession.open_time) && 
           s.seller_id === currentUser?.id
       );
       
       let cash = 0, card = 0, yape = 0, transfer = 0, credit = 0;
       
       sales.forEach(s => {
           if (s.status === 'canceled') return;
           if (s.payment_method === 'CONTADO' || s.payment_method === 'EFECTIVO') cash += Number(s.total);
           else if (s.payment_method === 'TARJETA') card += Number(s.total);
           else if (s.payment_method === 'YAPE' || s.payment_method === 'PLIN') yape += Number(s.total);
           else if (s.payment_method === 'TRANSFERENCIA') transfer += Number(s.total);
           else if (s.payment_method === 'CREDITO') credit += Number(s.total);
       });

       const totalIncome = cash + card + yape + transfer;
       const expected = currentPosSession.system_opening_amount + cash;

       return { cash, card, yape, transfer, credit, totalIncome, expected };
   };

   const shiftData = calculateShiftData();

   const handleCloseSession = () => {
        if (!currentPosSession) return;
        showDialog('confirm', 'Cerrar Turno', '¿Está seguro que desea cerrar su turno actual? Se bloqueará el terminal y se inyectará el monto en el Flujo de Caja Global.', async () => {
            setIsSaving(true);
            try {
                await store.closePosSession(currentPosSession.id, {
                    declared_cash: shiftData.expected,
                    declared_vouchers: shiftData.card,
                    declared_transfers: shiftData.yape + shiftData.transfer,
                    declared_total: shiftData.expected + shiftData.card + shiftData.yape + shiftData.transfer,
                    declared_others: 0,
                    close_observation: 'Cierre desde terminal POS'
                }, currentUser?.id || '00000000-0000-0000-0000-000000000000');
                setShowShiftModal(false);
            } catch (err: any) {
                showDialog('error', 'Error', `Fallo al cerrar turno: ${err.message}`);
            } finally {
                setIsSaving(false);
            }
        });
   };

   // --- MASTER DATA ---
   const [dbCompany, setDbCompany] = useState<any>(null); 
   const [dbSeries, setDbSeries] = useState<any[]>([]);
   const [dbSellers, setDbSellers] = useState<any[]>([]);
   
   const [docType, setDocType] = useState<'FACTURA' | 'BOLETA'>('BOLETA');
   const [series, setSeries] = useState('');
   const [docNumber, setDocNumber] = useState('');

   // Feature Toggles
   const [rememberPrices, setRememberPrices] = useState(false);

   useEffect(() => {
       const fetchMasters = async () => {
           try {
               const [compRes, serRes, sellRes] = await Promise.all([
                   supabase.from('company_config').select('*').limit(1).maybeSingle(),
                   supabase.from('document_series').select('*').eq('is_active', true).order('series'),
                   supabase.from('sellers').select('*').eq('is_active', true)
               ]);
               
               if (compRes.data) setDbCompany(compRes.data);
               if (sellRes.data) setDbSellers(sellRes.data);
               if (serRes.data) {
                   setDbSeries(serRes.data);
                   const initialBoleta = serRes.data.find((s: any) => s.type === 'BOLETA');
                   if (initialBoleta) {
                       setSeries(initialBoleta.series);
                       setDocNumber(String(initialBoleta.current_number + 1).padStart(8, '0'));
                   }
               }
           } catch (e) { console.error("Error cargando maestros:", e); }
       };
       fetchMasters();
   }, []);

   const fetchLiveSeries = async () => {
       const { data } = await supabase.from('document_series').select('*').eq('is_active', true);
       if (data) {
           setDbSeries(data);
           const current = data.find(s => s.type === docType && s.series === series);
           if (current) {
               setDocNumber(String(current.current_number + 1).padStart(8, '0'));
           }
       }
   };

   // --- MODOS & STATE ---
   const [presentationMode, setPresentationMode] = useState<'UND' | 'PKG'>('UND');
   const [clientData, setClientData] = useState<Partial<Client>>({ id: '', name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
   const [clientSearch, setClientSearch] = useState('');
   
   const [productSearch, setProductSearch] = useState('');
   const [searchedProducts, setSearchedProducts] = useState<(Product & { current_stock: number })[]>([]);
   const [selectedIndex, setSelectedIndex] = useState(-1);
   const [isSearchingProd, setIsSearchingProd] = useState(false);
   
   const [cart, setCart] = useState<SaleItem[]>([]);

   // --- CHECKOUT STATE ---
   const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
   const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'YAPE' | 'TRANSFERENCIA'>('EFECTIVO');
   const [amountTendered, setAmountTendered] = useState<string>('');

   const grandTotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
   const subtotal = grandTotal / (1 + (Number(dbCompany?.igv_percent || 18) / 100));
   const igv = grandTotal - subtotal;

   const changeDue = (Number(amountTendered) || 0) - grandTotal;
   
   // Focus lock
   useEffect(() => {
      const handleClick = (e: MouseEvent) => {
         if (!currentPosSession) return;
         if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT') {
            if (isCheckoutOpen) {
                checkoutInputRef.current?.focus();
            } else if (!dialog.isOpen && !showShiftModal) {
                barcodeInputRef.current?.focus();
            }
         }
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
   }, [isCheckoutOpen, dialog.isOpen, currentPosSession, showShiftModal]);

   useEffect(() => {
       if (isCheckoutOpen) {
           setTimeout(() => checkoutInputRef.current?.focus(), 100);
           if (checkoutPaymentMethod !== 'EFECTIVO') setAmountTendered(grandTotal.toFixed(2));
           else setAmountTendered('');
       }
   }, [isCheckoutOpen, checkoutPaymentMethod, grandTotal]);

   // Grid Product Search
   useEffect(() => {
       const timer = setTimeout(async () => {
           if (productSearch.trim() === '') {
               setSearchedProducts([]);
               setSelectedIndex(-1);
               return;
           }
           setIsSearchingProd(true);
           setSelectedIndex(-1);
           try {
               let query = supabase.from('products').select('*').eq('is_active', true).limit(20);
               if (productSearch.length >= 2) {
                   query = query.or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%,barcode.ilike.%${productSearch}%`);
               }
               const { data: pData } = await query;
               
               if (pData && pData.length > 0) {
                   const enriched = pData.map(p => ({ ...p, current_stock: Number(p.stock || 100) }));
                   setSearchedProducts(enriched);
                   if (productSearch.length >= 2) setSelectedIndex(0); 
               } else { setSearchedProducts([]); }
           } catch (error) { console.error(error); } finally { setIsSearchingProd(false); }
       }, 300);
       return () => clearTimeout(timer);
   }, [productSearch]);

   const allocateFast = async (productId: string, requiredUnits: number) => {
       const { data } = await supabase.from('batches').select('*').eq('product_id', productId).gt('quantity_current', 0).order('expiration_date', { ascending: true });
       return allocateBatchesFIFO(requiredUnits, data as Batch[] || []);
   };

   // --- HOTKEYS & KEYBOARD NAVIGATION ---
   const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
       if (e.key === 'F2') { e.preventDefault(); resetPOS(); document.getElementById('client-search-input')?.focus(); return; }
       if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0 && !isSaving) setIsCheckoutOpen(true); return; }
       if (e.key === 'F9') { e.preventDefault(); setPresentationMode(prev => prev === 'UND' ? 'PKG' : 'UND'); return; }
       if (e.key === 'F10') { e.preventDefault(); setShowShiftModal(true); return; }
       
       if (e.key === 'ArrowDown') {
           e.preventDefault();
           if (searchedProducts.length > 0) setSelectedIndex(prev => (prev + 1) % searchedProducts.length);
       } else if (e.key === 'ArrowUp') {
           e.preventDefault();
           if (searchedProducts.length > 0) setSelectedIndex(prev => (prev - 1 + searchedProducts.length) % searchedProducts.length);
       } else if (e.key === 'Enter') {
           e.preventDefault();
           const code = e.currentTarget.value.trim();
           
           if (!code) {
               if (searchedProducts.length > 0 && selectedIndex >= 0) {
                   await addProductToCart(searchedProducts[selectedIndex]);
                   setProductSearch(''); setSelectedIndex(-1);
               } else if (cart.length > 0) {
                   setIsCheckoutOpen(true); 
               }
               return;
           }

           if (searchedProducts.length > 0 && selectedIndex >= 0 && code.length < 5) {
               await addProductToCart(searchedProducts[selectedIndex]);
               setProductSearch(''); setSelectedIndex(-1);
               return;
           }
           
           setIsSearchingProd(true);
           try {
               const { data: pData } = await supabase.from('products').select('*').or(`barcode.eq.${code},sku.eq.${code}`).eq('is_active', true).limit(1).maybeSingle();
               
               if (pData) {
                   await addProductToCart(pData as Product);
                   setProductSearch(''); setSelectedIndex(-1);
                   if (barcodeInputRef.current) barcodeInputRef.current.value = '';
               } else {
                   if (searchedProducts.length > 0) {
                       await addProductToCart(searchedProducts[0]);
                       setProductSearch(''); setSelectedIndex(-1);
                   } else {
                       showDialog('warning', 'No Encontrado', `No se encontró el producto: ${code}`);
                   }
               }
           } catch (err) {
               console.error(err);
           } finally {
               setIsSearchingProd(false);
           }
       }
   };

   // Client Search Handler
   const handleClientSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
       if (e.key === 'Enter') {
           e.preventDefault();
           const doc = clientSearch.trim();
           if (!doc) {
               setClientData({ id: '', name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
               setDocType('BOLETA');
               const seriesObj = dbSeries.find(s => s.type === 'BOLETA');
               if (seriesObj) {
                   setSeries(seriesObj.series);
                   setDocNumber(String(seriesObj.current_number + 1).padStart(8, '0'));
               }
               barcodeInputRef.current?.focus();
               return;
           }

           setIsLoadingClient(true);
           try {
               const newDocType = doc.length === 11 ? 'FACTURA' : 'BOLETA';
               setDocType(newDocType);
               const seriesObj = dbSeries.find(s => s.type === newDocType);
               if (seriesObj) {
                   setSeries(seriesObj.series);
                   setDocNumber(String(seriesObj.current_number + 1).padStart(8, '0'));
               }

               const { data: existingClient } = await supabase.from('clients').select('*').eq('doc_number', doc).maybeSingle();
               if (existingClient) {
                   setClientData({ id: existingClient.id, name: existingClient.name, doc_number: existingClient.doc_number, address: existingClient.address, doc_type: existingClient.doc_type });
                   barcodeInputRef.current?.focus();
                   return;
               }

               if (dbCompany && dbCompany.api_dni_ruc_url) {
                   let baseUrl = dbCompany.api_dni_ruc_url.trim();
                   if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
                   if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                   
                   const endpointPath = newDocType === 'BOLETA' ? '/v1/reniec/dni' : '/v1/sunat/ruc/full';
                   const url = `${baseUrl}${endpointPath}?numero=${doc}`;
                   const proxyUrl = `/api/external-query?url=${encodeURIComponent(url)}&token=${encodeURIComponent(dbCompany.api_dni_ruc_token || '')}`;
                   
                   const response = await fetch(proxyUrl);
                   if (response.ok) {
                       const data = await response.json();
                       let name = ''; let address = '';
                       if (newDocType === 'BOLETA') {
                           name = data.full_name || data.nombre || `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
                       } else {
                           name = data.nombre || data.razonSocial || data.razon_social || data.denominacion || '';
                           address = (data.direccion || data.direccion_fisica || '').trim();
                       }
                       
                       setClientData({
                           id: '',
                           name: name.toUpperCase() || 'CLIENTE NUEVO API',
                           doc_number: doc,
                           address: address,
                           doc_type: newDocType === 'FACTURA' ? 'RUC' : 'DNI'
                       });
                       barcodeInputRef.current?.focus();
                       return;
                   }
               }
               
               setClientData({
                   id: '',
                   name: newDocType === 'FACTURA' ? 'CLIENTE CON RUC' : 'CLIENTE CON DNI',
                   doc_number: doc,
                   address: '',
                   doc_type: newDocType === 'FACTURA' ? 'RUC' : 'DNI'
               });
               barcodeInputRef.current?.focus();
           } catch (error) {
               console.error("Error buscando cliente", error);
           } finally {
               setIsLoadingClient(false);
           }
       }
   };

   // Checkout Handlers
   const handleCheckoutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
       if (e.key === 'Escape') {
           e.preventDefault();
           setIsCheckoutOpen(false);
           setTimeout(() => barcodeInputRef.current?.focus(), 100);
       } else if (e.key === 'Enter') {
           e.preventDefault();
           if (checkoutPaymentMethod === 'EFECTIVO' && (Number(amountTendered) < grandTotal)) {
               showDialog('warning', 'Monto Inválido', 'El monto recibido es menor al total.');
               return;
           }
           executeSaveSale();
       } else if (e.key === 'F8') {
           e.preventDefault();
           if (checkoutPaymentMethod === 'EFECTIVO' && (Number(amountTendered) < grandTotal)) {
               showDialog('warning', 'Monto Inválido', 'El monto recibido es menor al total.');
               return;
           }
           executeSaveSale();
       }
   };

   const addProductToCart = async (prod: Product) => {
       const isPkgMode = presentationMode === 'PKG';
       const conversionFactor = isPkgMode ? Number(prod.package_content || 1) : 1;
       
       if (isPkgMode && (!prod.package_type || conversionFactor <= 1)) {
           showDialog('warning', 'Presentación', `El producto ${prod.name} no tiene empaque.`);
       }

       const realUnitName = (isPkgMode && prod.package_type && conversionFactor > 1) 
           ? `${prod.package_type.toUpperCase()} / ${conversionFactor}` 
           : `${(prod.unit_type || 'UND').toUpperCase()} / 1`;
           
       const baseConversion = (isPkgMode && prod.package_type && conversionFactor > 1) ? conversionFactor : 1;
       
       const existingIndex = cart.findIndex(item => item.product_id === prod.id && item.selected_unit === realUnitName);
       
       let price = Number(prod.price_unit || 0);
       if (isPkgMode && prod.package_type && conversionFactor > 1) price = Number(prod.price_package || (prod.price_unit * conversionFactor));

       // RPC: Fetch Historical Price if toggle is ON and we have a valid client UUID
       if (rememberPrices && clientData.id && clientData.id !== '') {
           try {
               const { data, error } = await supabase.rpc('get_client_last_product_price', {
                   p_client_id: clientData.id,
                   p_product_id: prod.id
               });
               if (!error && data !== null) {
                   const historicalPrice = Number(data);
                   // Si está en modo paquete, ajustamos el precio histórico
                   price = isPkgMode ? historicalPrice * conversionFactor : historicalPrice;
               }
           } catch (e) { console.error("Error fetching historical price:", e); }
       }

       if (existingIndex >= 0) {
           const newCart = [...cart];
           const item = newCart[existingIndex];
           const newQty = Number(item.quantity_presentation) + 1;
           const newBaseQty = newQty * baseConversion;
           
           const allocations = await allocateFast(prod.id, newBaseQty);
           
           newCart[existingIndex] = {
               ...item,
               quantity_presentation: newQty,
               quantity_base: newBaseQty,
               total_price: newQty * Number(item.unit_price), // Keeps the price it was added with
               batch_allocations: allocations
           };
           setCart(newCart);
       } else {
           const allocations = await allocateFast(prod.id, baseConversion);
           const newItem: SaleItem = {
               id: crypto.randomUUID(), sale_id: '', product_id: prod.id, product_sku: prod.sku,
               product_name: prod.name, selected_unit: realUnitName, quantity_presentation: 1,
               quantity_base: baseConversion, unit_price: price, total_price: price,
               discount_percent: 0, discount_amount: 0, is_bonus: false, batch_allocations: allocations, product: prod
           };
           setCart([...cart, newItem]);
       }
   };

   const handleQtyChange = async (index: number, delta: number) => {
       const newCart = [...cart];
       const item = newCart[index];
       const newQty = Number(item.quantity_presentation) + delta;
       
       if (newQty <= 0) {
           newCart.splice(index, 1);
           setCart(newCart);
           return;
       }

       const isPkg = item.selected_unit.includes('/') && !item.selected_unit.startsWith('UND');
       const conversionFactor = isPkg ? parseInt(item.selected_unit.split('/')[1].trim() || '1') : 1;
       const newBaseQty = newQty * conversionFactor; 
       
       const allocations = await allocateFast(item.product_id, newBaseQty);

       newCart[index] = {
           ...item,
           quantity_presentation: newQty,
           quantity_base: newBaseQty,
           total_price: newQty * Number(item.unit_price),
           batch_allocations: allocations
       };
       setCart(newCart);
   };

   const removeFromCart = (index: number) => {
       const newCart = [...cart];
       newCart.splice(index, 1);
       setCart(newCart);
       setTimeout(() => barcodeInputRef.current?.focus(), 100);
   };

   const resetPOS = () => {
       setCart([]);
       setProductSearch('');
       setSelectedIndex(-1);
       setClientSearch('');
       setClientData({ id: '', name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
       setDocType('BOLETA');
       setIsCheckoutOpen(false);
       setAmountTendered('');
       const activeBoletaSeries = dbSeries.find(s => s.type === 'BOLETA');
       if (activeBoletaSeries) { 
          setSeries(activeBoletaSeries.series); 
          setDocNumber(String(activeBoletaSeries.current_number + 1).padStart(8, '0')); 
       }
       document.getElementById('client-search-input')?.focus();
   };

   const executeSaveSale = async () => {
       if (cart.length === 0) return;
       if (!series || !docNumber) { showDialog('error', 'Error', "No hay serie asignada."); return; }

       const posSeller = dbSellers.find(s => s.name.toUpperCase().includes('POS') || s.name.toUpperCase().includes('CAJA'));

       const newSaleData: any = {
          id: crypto.randomUUID(), 
          document_type: docType,
          series: series,
          number: docNumber,
          payment_method: checkoutPaymentMethod === 'EFECTIVO' ? 'CONTADO' : checkoutPaymentMethod,
          payment_status: 'PAID',
          balance: 0,
          client_id: clientData.id || undefined,
          client_name: clientData.name || 'CLIENTE VARIOS',
          client_ruc: clientData.doc_number || '00000000',
          client_address: clientData.address || '',
          seller_id: posSeller ? posSeller.id : currentUser?.id,
          subtotal, igv, total: grandTotal,
          status: 'completed', dispatch_status: 'pending', delivery_mode: 'EXPRESS_MISMO_DIA', 
          created_at: new Date().toISOString(),
          items: cart, sunat_status: 'PENDING',
          notes: checkoutPaymentMethod !== 'EFECTIVO' ? `PAGADO CON: ${checkoutPaymentMethod}` : `EFECTIVO - RECIBIDO: ${amountTendered} - VUELTO: ${changeDue}`
       };

       setIsSaving(true);
       setIsCheckoutOpen(false);

       try {
          const { data, error } = await supabase.rpc('process_sale_transaction', { p_sale_data: newSaleData });
          if (error) throw error;
          
          if (data && data.success) {
             const realNumber = data.real_number;
             newSaleData.number = realNumber;
             await fetchLiveSeries();
             try { await PdfEngine.openDocument(newSaleData as Sale, docType, dbCompany); } catch(e) {}
             resetPOS();
          }
       } catch (err: any) { 
          showDialog('error', 'Error Crítico', err.message);
          setIsCheckoutOpen(true);
       } finally { 
          setIsSaving(false); 
          setTimeout(() => barcodeInputRef.current?.focus(), 100);
       }
   };

   // --- DIALOG COMPONENT ---
   const renderDialog = () => {
       if (!dialog.isOpen) return null;
       return (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                     <div className={`p-4 border-b flex items-center gap-3 ${dialog.type === 'error' ? 'bg-red-50 text-red-700' : dialog.type === 'success' ? 'bg-emerald-50 text-emerald-700' : dialog.type === 'confirm' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700'}`}>
                         {dialog.type === 'error' && <AlertTriangle className="w-6 h-6" />}
                         {dialog.type === 'success' && <ShieldCheck className="w-6 h-6" />}
                         {dialog.type === 'confirm' && <HelpCircle className="w-6 h-6" />}
                         {dialog.type === 'info' && <CheckCircle2 className="w-6 h-6" />}
                         <h3 className="font-bold text-lg">{dialog.title}</h3>
                     </div>
                     <div className="p-6 text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                         {dialog.message}
                     </div>
                     <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                         {dialog.type === 'confirm' && (
                             <button type="button" onClick={() => { closeDialog(); setTimeout(() => barcodeInputRef.current?.focus(), 100); }} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors">
                                 Cancelar
                             </button>
                         )}
                         <button
                             type="button"
                             onClick={() => {
                                 if (dialog.onConfirm) dialog.onConfirm();
                                 closeDialog();
                                 if (!isCheckoutOpen && !showShiftModal) setTimeout(() => barcodeInputRef.current?.focus(), 100);
                             }}
                             className={`px-5 py-2.5 font-bold rounded-lg text-white transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                         >
                             {dialog.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                         </button>
                     </div>
                 </div>
             </div>
       );
   };

   // --- RENDER ENFORCER ---
   if (!currentPosSession) {
       return (
           <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center p-4">
               {renderDialog()}
               <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 animate-in zoom-in duration-300">
                   <div className="flex justify-center mb-4"><Lock className="w-16 h-16 text-rose-500" /></div>
                   <h2 className="text-2xl font-black text-slate-800 text-center mb-2 uppercase tracking-wide">Terminal Bloqueado</h2>
                   <p className="text-slate-500 text-center text-sm mb-8">Debe aperturar su turno de caja para poder emitir comprobantes en el Punto de Venta.</p>
                   
                   <label className="block text-sm font-bold text-slate-700 mb-2">Fondo Inicial de Caja (S/)</label>
                   <input
                       ref={openingAmountRef}
                       type="number"
                       step="0.10"
                       className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-4 text-3xl font-black text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-center mb-6"
                       placeholder="0.00"
                       value={openingAmount}
                       onChange={(e) => setOpeningAmount(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter') handleOpenSession(); }}
                       autoFocus
                   />
                   
                   <button
                       onClick={handleOpenSession}
                       disabled={isOpeningSession || openingAmount === ''}
                       className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                   >
                       {isOpeningSession ? <Loader2 className="w-6 h-6 animate-spin" /> : <Unlock className="w-6 h-6" />}
                       APERTURAR TURNO POS
                   </button>
               </div>
           </div>
       );
   }

   return (
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8 bg-slate-100 font-sans overflow-hidden">
         
         {/* HEADER / TOP BAR */}
         <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between shadow-md shrink-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                <button onClick={resetPOS} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 text-sm transition-colors">
                    <Plus className="w-4 h-4"/> Nueva Venta (F2)
                </button>

                {/* Cliente Inline Input */}
                <div className="flex-1 max-w-xl relative flex items-center bg-slate-800 rounded-lg border border-slate-700 focus-within:border-blue-500 transition-colors">
                    <div className="pl-3"><Search className="w-5 h-5 text-slate-400" /></div>
                    <input
                        id="client-search-input"
                        type="text"
                        placeholder="Ingresar DNI/RUC y presionar Enter..."
                        className="w-full bg-transparent border-none text-white text-sm font-bold px-3 py-2.5 outline-none placeholder-slate-500"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        onKeyDown={handleClientSearchKeyDown}
                    />
                    {isLoadingClient && <div className="pr-3"><Loader2 className="w-5 h-5 text-blue-400 animate-spin" /></div>}
                </div>

                <button 
                    onClick={() => setRememberPrices(!rememberPrices)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 border ${rememberPrices ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                    title="Recordar Precio Histórico por Cliente"
                >
                    <BrainCircuit className="w-4 h-4"/> Recordar Precio
                </button>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={() => setShowShiftModal(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 shadow">
                    <Clock className="w-4 h-4 text-emerald-400"/> Arqueo (F10)
                </button>
            </div>
         </div>

         {/* MAIN CONTENT SPLIT */}
         <div className="flex-1 flex overflow-hidden">
            {/* LADO IZQUIERDO: PRODUCTOS Y BUSQUEDA */}
            <div className="flex-1 flex flex-col bg-white border-r border-slate-200">
                {/* Buscador / Lector */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> F8: Cobrar</span>
                            <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> ↑/↓: Navegar</span>
                            <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> F9: Alternar Empaque</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <ScanLine className="h-6 w-6 text-blue-600" />
                            </div>
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                className="block w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-300 rounded-xl text-lg font-bold text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                placeholder="ESCANEAR CÓDIGO DE BARRAS O BUSCAR..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                onKeyDown={handleBarcodeScan}
                                autoFocus
                            />
                            {isSearchingProd && (
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Toggle Modos */}
                        <button 
                            onClick={() => { setPresentationMode(prev => prev === 'UND' ? 'PKG' : 'UND'); barcodeInputRef.current?.focus(); }}
                            className={`shrink-0 flex flex-col items-center justify-center h-[60px] px-6 rounded-xl border-2 transition-colors duration-200 active:scale-95 ${presentationMode === 'PKG' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'}`}
                        >
                            <div className="text-[9px] font-black uppercase tracking-widest mb-0.5">Modo (F9)</div>
                            {presentationMode === 'PKG' ? (
                                <div className="flex items-center gap-1"><Package className="w-5 h-5"/> <span className="font-bold text-sm">CAJA</span></div>
                            ) : (
                                <div className="flex items-center gap-1"><Hash className="w-5 h-5"/> <span className="font-bold text-sm">UNIDAD</span></div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Grid de Productos */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-100/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {searchedProducts.map((prod, idx) => (
                            <button
                                key={prod.id}
                                onClick={() => { addProductToCart(prod); barcodeInputRef.current?.focus(); }}
                                className={`flex flex-col text-left bg-white border rounded-xl p-3 transition-all duration-150 group active:scale-95 shadow-sm hover:shadow-md ${selectedIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}
                            >
                                <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight flex-1 mb-2">
                                    {prod.name}
                                </div>
                                <div className="flex items-end justify-between w-full mt-auto">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">
                                        {presentationMode === 'PKG' && prod.package_type ? `${prod.package_type} x${prod.package_content}` : prod.unit_type}
                                    </div>
                                    <div className="text-base font-black text-emerald-600">
                                        S/ {presentationMode === 'PKG' && prod.package_type ? Number(prod.price_package || prod.price_unit * (prod.package_content || 1)).toFixed(2) : Number(prod.price_unit || 0).toFixed(2)}
                                    </div>
                                </div>
                            </button>
                        ))}
                        {searchedProducts.length === 0 && productSearch.length >= 2 && !isSearchingProd && (
                            <div className="col-span-full py-12 text-center text-slate-400 font-medium">
                                No se encontraron productos. Verifique el código o nombre.
                            </div>
                        )}
                        {searchedProducts.length === 0 && productSearch.length < 2 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                                <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                                <p className="text-lg font-medium">Buscador Activo</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* LADO DERECHO: TICKET Y COBRO */}
            <div className="w-[380px] bg-white flex flex-col shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] z-10">
                {/* Info Cliente & Header Ticket */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1"><Printer className="w-4 h-4 text-slate-500"/> TICKET {docType}</h2>
                            <div className="text-xs text-slate-500 font-mono tracking-wider">{series}-{docNumber}</div>
                        </div>
                        <button onClick={resetPOS} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Limpiar Venta (F2)">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                        <div className="bg-blue-50 p-1.5 rounded-md mt-0.5"><User className="w-4 h-4 text-blue-600" /></div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{clientData.doc_type} {clientData.doc_number}</div>
                            <div className="text-xs font-bold text-slate-800 truncate">{clientData.name}</div>
                        </div>
                    </div>
                </div>

                {/* Lista de Items */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-wider">CARRITO VACÍO</p>
                        </div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2 shadow-sm hover:border-blue-300 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="font-bold text-xs text-slate-700 leading-tight flex-1">{item.product_name}</span>
                                    <button onClick={() => removeFromCart(idx)} className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center bg-slate-50 rounded border border-slate-200 p-0.5">
                                        <button onClick={() => { handleQtyChange(idx, -1); barcodeInputRef.current?.focus(); }} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded active:scale-95"><Minus className="w-3 h-3"/></button>
                                        <span className="w-8 text-center font-bold text-sm text-slate-800 select-none">{item.quantity_presentation}</span>
                                        <button onClick={() => { handleQtyChange(idx, 1); barcodeInputRef.current?.focus(); }} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded active:scale-95"><Plus className="w-3 h-3"/></button>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{item.selected_unit}</div>
                                        <div className="font-black text-sm text-emerald-600">S/ {Number(item.total_price).toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Totales & Cobrar */}
                <div className="bg-slate-50 p-4 border-t border-slate-200">
                    <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-slate-500 text-xs font-bold">
                            <span>SUBTOTAL</span><span>S/ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-xs font-bold">
                            <span>IGV (18%)</span><span>S/ {igv.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-end pt-2 border-t border-slate-200 mt-2">
                            <span className="text-sm font-black text-slate-800 tracking-widest">TOTAL</span>
                            <span className="text-3xl leading-none font-black text-emerald-600">S/ {grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { if (cart.length > 0) setIsCheckoutOpen(true); }}
                        disabled={cart.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-xl py-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Banknote className="w-6 h-6" /> COBRAR (F8)
                    </button>
                </div>
            </div>
         </div>

         {/* --- CHECKOUT MODAL --- */}
         {isCheckoutOpen && (
             <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsCheckoutOpen(false); }}>
                 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
                     <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <h2 className="text-xl font-black text-slate-800 tracking-widest flex items-center gap-2">
                             <Banknote className="w-6 h-6 text-emerald-600" /> RESUMEN DE COBRO
                         </h2>
                         <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50">
                             <X className="w-6 h-6" />
                         </button>
                     </div>
                     <div className="p-6 flex flex-col gap-6">
                         {/* Total a Pagar */}
                         <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                             <span className="text-emerald-700 font-bold uppercase tracking-widest mb-1 text-xs">Total a Pagar</span>
                             <span className="text-5xl font-black text-emerald-600">S/ {grandTotal.toFixed(2)}</span>
                         </div>

                         {/* Metodos de Pago */}
                         <div className="grid grid-cols-4 gap-3">
                             {[
                                { id: 'EFECTIVO', icon: Banknote, label: 'Efectivo' },
                                { id: 'TARJETA', icon: CreditCard, label: 'Tarjeta' },
                                { id: 'YAPE', icon: Smartphone, label: 'Yape/Plin' },
                                { id: 'TRANSFERENCIA', icon: Zap, label: 'Transf.' }
                             ].map(method => {
                                 const Icon = method.icon;
                                 const isSelected = checkoutPaymentMethod === method.id;
                                 return (
                                     <button
                                         key={method.id}
                                         onClick={() => {
                                             setCheckoutPaymentMethod(method.id as any);
                                             if (method.id !== 'EFECTIVO') setAmountTendered(grandTotal.toFixed(2));
                                             else setAmountTendered('');
                                             checkoutInputRef.current?.focus();
                                         }}
                                         className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                                     >
                                         <Icon className="w-6 h-6 mb-1" />
                                         <span className="font-bold text-[10px] tracking-wide uppercase">{method.label}</span>
                                     </button>
                                 );
                             })}
                         </div>

                         {/* Input de Monto */}
                         <div className="flex gap-4 items-end">
                             <div className="flex-1">
                                 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Monto Recibido</label>
                                 <div className="relative">
                                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">S/</span>
                                     <input
                                         ref={checkoutInputRef}
                                         type="number"
                                         step="0.10"
                                         value={amountTendered}
                                         onChange={(e) => setAmountTendered(e.target.value)}
                                         onKeyDown={handleCheckoutKeyDown}
                                         className="w-full bg-white border-2 border-slate-300 rounded-xl pl-10 pr-4 py-3 text-2xl font-black text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                                         placeholder="0.00"
                                     />
                                 </div>
                             </div>
                             
                             {checkoutPaymentMethod === 'EFECTIVO' && changeDue >= 0 && amountTendered !== '' && (
                                 <div className="flex-1 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-end justify-center">
                                     <span className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-0.5">Vuelto</span>
                                     <span className="text-2xl font-black text-indigo-700">S/ {changeDue.toFixed(2)}</span>
                                 </div>
                             )}
                             {checkoutPaymentMethod === 'EFECTIVO' && changeDue < 0 && amountTendered !== '' && (
                                 <div className="flex-1 p-3 rounded-xl bg-rose-50 border border-rose-100 flex flex-col items-end justify-center">
                                     <span className="text-rose-600 font-bold uppercase tracking-widest text-[10px] mb-0.5">Falta</span>
                                     <span className="text-2xl font-black text-rose-700">S/ {Math.abs(changeDue).toFixed(2)}</span>
                                 </div>
                             )}
                         </div>

                         {/* Acciones */}
                         <button
                             onClick={executeSaveSale}
                             disabled={checkoutPaymentMethod === 'EFECTIVO' && (Number(amountTendered) < grandTotal)}
                             className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-xl py-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-3"
                         >
                             <CheckCircle2 className="w-6 h-6" /> CONFIRMAR Y EMITIR
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {/* --- SHIFT (F10) MODAL --- */}
         {showShiftModal && (
             <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
                     <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                         <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600"/> CONTROL DE TURNO</h2>
                         <button onClick={() => { setShowShiftModal(false); barcodeInputRef.current?.focus(); }} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5" /></button>
                     </div>
                     <div className="p-6">
                         <div className="space-y-3 mb-6">
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Apertura:</span>
                                 <span className="font-bold text-slate-800">{new Date(currentPosSession.open_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Fondo Inicial:</span>
                                 <span className="font-bold text-slate-800">S/ {currentPosSession.system_opening_amount.toFixed(2)}</span>
                             </div>
                             <div className="border-t border-slate-100 my-2 pt-2"></div>
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Ventas en Efectivo:</span>
                                 <span className="font-bold text-emerald-600">+ S/ {shiftData.cash.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Ventas Tarjeta:</span>
                                 <span className="font-bold text-blue-600">+ S/ {shiftData.card.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Ventas Yape/Plin:</span>
                                 <span className="font-bold text-indigo-600">+ S/ {(shiftData.yape + shiftData.transfer).toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="font-bold text-slate-500">Créditos Otorgados:</span>
                                 <span className="font-bold text-orange-600">S/ {shiftData.credit.toFixed(2)}</span>
                             </div>
                             <div className="border-t border-slate-200 my-2 pt-3"></div>
                             <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                 <span className="font-black text-emerald-800 text-sm">ESPERADO EN CAJÓN</span>
                                 <span className="font-black text-emerald-600 text-xl">S/ {shiftData.expected.toFixed(2)}</span>
                             </div>
                         </div>
                         <button
                             onClick={handleCloseSession}
                             disabled={isSaving}
                             className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                         >
                             {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                             CERRAR TURNO Y ARQUEAR
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {/* --- DIALOG --- */}
         {renderDialog()}

         {isSaving && !dialog.isOpen && !showShiftModal && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex flex-col items-center justify-center">
               <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
               <h2 className="text-xl font-black text-white tracking-widest">PROCESANDO...</h2>
            </div>
         )}
      </div>
   );
};

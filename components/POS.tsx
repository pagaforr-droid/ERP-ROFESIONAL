import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, SaleItem, Client, Sale, Batch } from '../types';
import { ShoppingCart, Search, Trash2, CheckCircle2, X, Plus, Minus, CreditCard, Banknote, HelpCircle, AlertTriangle, ShieldCheck, User, Zap, Loader2, Printer, Check, ScanLine, Tag, Package, Hash, Keyboard } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';
import { allocateBatchesFIFO } from '../utils/productUtils';

export const POS: React.FC = () => {
   const { users, currentUser } = useStore();

   const barcodeInputRef = useRef<HTMLInputElement>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [isLoadingClient, setIsLoadingClient] = useState(false);

   const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void }>({
       isOpen: false, type: 'info', title: '', message: ''
   });

   const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
       setDialog({ isOpen: true, type, title, message, onConfirm });
   };
   const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

   // --- MASTER DATA ---
   const [dbCompany, setDbCompany] = useState<any>(null); 
   const [dbSeries, setDbSeries] = useState<any[]>([]);
   
   const [docType, setDocType] = useState<'FACTURA' | 'BOLETA'>('BOLETA');
   const [series, setSeries] = useState('');
   const [docNumber, setDocNumber] = useState('');

   useEffect(() => {
       const fetchMasters = async () => {
           try {
               const [compRes, serRes] = await Promise.all([
                   supabase.from('company_config').select('*').limit(1).maybeSingle(),
                   supabase.from('document_series').select('*').eq('is_active', true).order('series')
               ]);
               
               if (compRes.data) setDbCompany(compRes.data);
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
   const [clientData, setClientData] = useState<Partial<Client>>({ name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
   
   const [productSearch, setProductSearch] = useState('');
   const [searchedProducts, setSearchedProducts] = useState<(Product & { current_stock: number })[]>([]);
   const [selectedIndex, setSelectedIndex] = useState(-1);
   const [isSearchingProd, setIsSearchingProd] = useState(false);
   
   const [cart, setCart] = useState<SaleItem[]>([]);
   const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
   
   // Focus lock
   useEffect(() => {
      const handleClick = (e: MouseEvent) => {
         if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT') {
            barcodeInputRef.current?.focus();
         }
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
   }, []);

   // Grid Product Search
   useEffect(() => {
       const timer = setTimeout(async () => {
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
                   if (productSearch.length >= 2) setSelectedIndex(0); // Auto-select first item if searching
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
       if (e.key === 'F2') { e.preventDefault(); resetPOS(); return; }
       if (e.key === 'F4') { e.preventDefault(); handleFastClient(); return; }
       if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0 && !isSaving) executeSaveSale(); return; }
       if (e.key === 'F9') { e.preventDefault(); setPresentationMode(prev => prev === 'UND' ? 'PKG' : 'UND'); return; }
       
       if (e.key === 'ArrowDown') {
           e.preventDefault();
           if (searchedProducts.length > 0) {
               setSelectedIndex(prev => (prev + 1) % searchedProducts.length);
           }
       } else if (e.key === 'ArrowUp') {
           e.preventDefault();
           if (searchedProducts.length > 0) {
               setSelectedIndex(prev => (prev - 1 + searchedProducts.length) % searchedProducts.length);
           }
       } else if (e.key === 'Enter') {
           e.preventDefault();
           const code = e.currentTarget.value.trim();
           
           if (!code) {
               if (searchedProducts.length > 0 && selectedIndex >= 0) {
                   await addProductToCart(searchedProducts[selectedIndex]);
                   setProductSearch('');
                   setSelectedIndex(-1);
               } else if (cart.length > 0) {
                   executeSaveSale(); 
               }
               return;
           }

           if (searchedProducts.length > 0 && selectedIndex >= 0 && code.length < 5) {
               // Si tipeó algo corto y tiene algo seleccionado en la lista
               await addProductToCart(searchedProducts[selectedIndex]);
               setProductSearch('');
               setSelectedIndex(-1);
               return;
           }
           
           setIsSearchingProd(true);
           try {
               const { data: pData } = await supabase.from('products').select('*').or(`barcode.eq.${code},sku.eq.${code}`).eq('is_active', true).limit(1).maybeSingle();
               
               if (pData) {
                   await addProductToCart(pData as Product);
                   setProductSearch('');
                   setSelectedIndex(-1);
                   if (barcodeInputRef.current) barcodeInputRef.current.value = '';
               } else {
                   if (searchedProducts.length > 0) {
                       await addProductToCart(searchedProducts[0]);
                       setProductSearch('');
                       setSelectedIndex(-1);
                   } else {
                       showDialog('warning', 'No Encontrado', `No se encontró el producto con código: ${code}`);
                   }
               }
           } catch (err) {
               console.error(err);
           } finally {
               setIsSearchingProd(false);
           }
       }
   };

   const addProductToCart = async (prod: Product) => {
       const isPkgMode = presentationMode === 'PKG';
       const conversionFactor = isPkgMode ? Number(prod.package_content || 1) : 1;
       
       if (isPkgMode && (!prod.package_type || conversionFactor <= 1)) {
           showDialog('warning', 'Presentación', `El producto ${prod.name} no tiene configuración de empaque. Se agregará por unidad.`);
       }

       const realUnitName = (isPkgMode && prod.package_type && conversionFactor > 1) 
           ? `${prod.package_type.toUpperCase()} / ${conversionFactor}` 
           : `${(prod.unit_type || 'UND').toUpperCase()} / 1`;
           
       const baseConversion = (isPkgMode && prod.package_type && conversionFactor > 1) ? conversionFactor : 1;
       
       const existingIndex = cart.findIndex(item => item.product_id === prod.id && item.selected_unit === realUnitName);
       
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
               total_price: newQty * Number(item.unit_price),
               batch_allocations: allocations
           };
           setCart(newCart);
       } else {
           let price = Number(prod.price_unit || 0);
           if (isPkgMode && prod.package_type && conversionFactor > 1) {
               price = Number(prod.price_package || (prod.price_unit * conversionFactor));
           }
           
           const allocations = await allocateFast(prod.id, baseConversion);
           
           const newItem: SaleItem = {
               id: crypto.randomUUID(),
               sale_id: '',
               product_id: prod.id,
               product_sku: prod.sku,
               product_name: prod.name,
               selected_unit: realUnitName,
               quantity_presentation: 1,
               quantity_base: baseConversion,
               unit_price: price,
               total_price: price,
               discount_percent: 0,
               discount_amount: 0,
               is_bonus: false,
               batch_allocations: allocations,
               product: prod
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

   const subtotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0) / (1 + (Number(dbCompany?.igv_percent || 18) / 100));
   const igv = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0) - subtotal;
   const grandTotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

   const resetPOS = () => {
       setCart([]);
       setProductSearch('');
       setSelectedIndex(-1);
       setClientData({ name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
       setDocType('BOLETA');
       const activeBoletaSeries = dbSeries.find(s => s.type === 'BOLETA');
       if (activeBoletaSeries) { 
          setSeries(activeBoletaSeries.series); 
          setDocNumber(String(activeBoletaSeries.current_number + 1).padStart(8, '0')); 
       }
       setTimeout(() => barcodeInputRef.current?.focus(), 100);
   };

   const handleFastClient = async () => {
       const doc = prompt("Ingrese DNI o RUC del cliente (Vacío = PUBLICO GENERAL):");
       if (doc === null) return;
       
       if (doc.trim() === '') {
           setClientData({ name: 'CLIENTE VARIOS', doc_number: '00000000', address: '', doc_type: 'DNI' });
           setDocType('BOLETA');
           const seriesObj = dbSeries.find(s => s.type === 'BOLETA');
           if (seriesObj) {
               setSeries(seriesObj.series);
               setDocNumber(String(seriesObj.current_number + 1).padStart(8, '0'));
           }
           setTimeout(() => barcodeInputRef.current?.focus(), 100);
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
               setClientData({ name: existingClient.name, doc_number: existingClient.doc_number, address: existingClient.address, doc_type: existingClient.doc_type });
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
                   let name = '';
                   let address = '';
                   if (newDocType === 'BOLETA') {
                       name = data.full_name || data.nombre || `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
                   } else {
                       name = data.nombre || data.razonSocial || data.razon_social || data.denominacion || '';
                       address = (data.direccion || data.direccion_fisica || '').trim();
                   }
                   
                   setClientData({
                       name: name.toUpperCase() || 'CLIENTE NUEVO API',
                       doc_number: doc,
                       address: address,
                       doc_type: newDocType === 'FACTURA' ? 'RUC' : 'DNI'
                   });
                   return;
               }
           }
           
           setClientData({
               name: newDocType === 'FACTURA' ? 'CLIENTE CON RUC' : 'CLIENTE CON DNI',
               doc_number: doc,
               address: '',
               doc_type: newDocType === 'FACTURA' ? 'RUC' : 'DNI'
           });
       } catch (error) {
           console.error("Error buscando cliente", error);
       } finally {
           setIsLoadingClient(false);
           setTimeout(() => barcodeInputRef.current?.focus(), 100);
       }
   };

   const executeSaveSale = async () => {
       if (cart.length === 0) return;
       if (!series || !docNumber) { showDialog('error', 'Error', "No hay serie asignada."); return; }

       const newSaleData: any = {
          id: crypto.randomUUID(), 
          document_type: docType,
          series: series,
          number: docNumber, // temporal
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
          balance: paymentMethod === 'CREDITO' ? grandTotal : 0,
          client_name: clientData.name || 'CLIENTE VARIOS',
          client_ruc: clientData.doc_number || '00000000',
          client_address: clientData.address || '',
          seller_id: currentUser?.id,
          subtotal,
          igv,
          total: grandTotal,
          status: 'completed',
          dispatch_status: 'pending', 
          delivery_mode: 'EXPRESS_MISMO_DIA', 
          created_at: new Date().toISOString(),
          items: cart, 
          sunat_status: 'PENDING'
       };

       setIsSaving(true);

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
       } finally { 
          setIsSaving(false); 
          setTimeout(() => barcodeInputRef.current?.focus(), 100);
       }
   };

   return (
      <div className="flex h-[calc(100vh-4rem)] -m-6 lg:-m-8 bg-slate-900 text-white font-sans overflow-hidden">
         
         {/* --- DIALOG --- */}
         {dialog.isOpen && (
             <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                 <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
                     <div className={`p-4 border-b border-slate-700 flex items-center gap-3 ${dialog.type === 'error' ? 'text-red-400' : dialog.type === 'success' ? 'text-emerald-400' : 'text-blue-400'}`}>
                         {dialog.type === 'error' && <AlertTriangle className="w-6 h-6" />}
                         {dialog.type === 'success' && <ShieldCheck className="w-6 h-6" />}
                         {dialog.type === 'confirm' && <HelpCircle className="w-6 h-6" />}
                         {dialog.type === 'info' && <CheckCircle2 className="w-6 h-6" />}
                         <h3 className="font-bold text-lg">{dialog.title}</h3>
                     </div>
                     <div className="p-6 text-slate-300 text-base whitespace-pre-wrap leading-relaxed">
                         {dialog.message}
                     </div>
                     <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-3">
                         {dialog.type === 'confirm' && (
                             <button type="button" onClick={() => { closeDialog(); setTimeout(() => barcodeInputRef.current?.focus(), 100); }} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors">
                                 Cancelar
                             </button>
                         )}
                         <button
                             type="button"
                             onClick={() => {
                                 if (dialog.onConfirm) dialog.onConfirm();
                                 closeDialog();
                                 setTimeout(() => barcodeInputRef.current?.focus(), 100);
                             }}
                             className={`px-6 py-3 font-bold rounded-lg text-white transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                         >
                             {dialog.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {isSaving && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
               <Loader2 className="w-20 h-20 text-blue-500 animate-spin mb-6" />
               <h2 className="text-3xl font-black text-white tracking-widest">PROCESANDO...</h2>
            </div>
         )}

         {/* LADO IZQUIERDO: PRODUCTOS Y BUSQUEDA */}
         <div className="flex-1 flex flex-col bg-slate-800 border-r border-slate-700 relative">
            {/* Buscador / Lector */}
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> F2: Limpiar</span>
                        <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> F4: Cliente</span>
                        <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> F8: Cobrar</span>
                        <span className="flex items-center gap-1"><Keyboard className="w-4 h-4"/> ↑/↓: Navegar</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <ScanLine className="h-8 w-8 text-blue-500" />
                        </div>
                        <input
                            ref={barcodeInputRef}
                            type="text"
                            className="block w-full pl-16 pr-4 py-6 bg-slate-800 border-2 border-slate-600 rounded-2xl text-2xl text-white placeholder-slate-500 focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                            placeholder="ESCANEÉ CÓDIGO O BUSQUE POR NOMBRE..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            onKeyDown={handleBarcodeScan}
                            autoFocus
                        />
                        {isSearchingProd && (
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Toggle Modos */}
                    <button 
                        onClick={() => { setPresentationMode(prev => prev === 'UND' ? 'PKG' : 'UND'); barcodeInputRef.current?.focus(); }}
                        className={`shrink-0 flex flex-col items-center justify-center h-20 w-32 rounded-2xl border-2 transition-colors duration-200 active:scale-95 ${presentationMode === 'PKG' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-700/50 border-slate-600 text-slate-400'}`}
                    >
                        <div className="text-[10px] font-black uppercase tracking-wider mb-1">Modo Venta (F9)</div>
                        {presentationMode === 'PKG' ? (
                            <div className="flex items-center gap-2"><Package className="w-6 h-6"/> <span className="font-bold text-lg">CAJA</span></div>
                        ) : (
                            <div className="flex items-center gap-2"><Hash className="w-6 h-6"/> <span className="font-bold text-lg">UNIDAD</span></div>
                        )}
                    </button>
                </div>
            </div>

            {/* Grid de Productos */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {searchedProducts.map((prod, idx) => (
                        <button
                            key={prod.id}
                            onClick={() => { addProductToCart(prod); barcodeInputRef.current?.focus(); }}
                            className={`flex flex-col text-left bg-slate-700/50 hover:bg-slate-600 border-2 rounded-xl p-4 transition-all duration-150 group active:scale-95 ${selectedIndex === idx ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-600 hover:border-slate-500'}`}
                        >
                            <div className={`h-28 w-full bg-slate-800 rounded-lg mb-3 flex items-center justify-center border transition-colors ${selectedIndex === idx ? 'border-blue-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                {prod.image_url ? (
                                    <img src={prod.image_url} alt={prod.name} className="h-full w-full object-contain rounded-lg" />
                                ) : (
                                    <Tag className={`h-10 w-10 transition-colors ${selectedIndex === idx ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-400'}`} />
                                )}
                            </div>
                            <div className="text-sm font-bold text-slate-200 line-clamp-2 leading-tight flex-1">
                                {prod.name}
                            </div>
                            <div className="mt-3 flex items-end justify-between w-full">
                                <div className="text-xs text-slate-400 font-medium">
                                    {presentationMode === 'PKG' && prod.package_type ? `${prod.package_type} x${prod.package_content}` : prod.unit_type}
                                </div>
                                <div className="text-lg font-black text-emerald-400">
                                    S/ {presentationMode === 'PKG' && prod.package_type ? Number(prod.price_package || prod.price_unit * (prod.package_content || 1)).toFixed(2) : Number(prod.price_unit || 0).toFixed(2)}
                                </div>
                            </div>
                        </button>
                    ))}
                    {searchedProducts.length === 0 && productSearch.length >= 2 && !isSearchingProd && (
                        <div className="col-span-full py-12 text-center text-slate-400">
                            No se encontraron productos. Verifique el código o nombre.
                        </div>
                    )}
                    {searchedProducts.length === 0 && productSearch.length < 2 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
                            <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-xl font-medium">Escanee un producto o use el buscador.</p>
                            <p className="text-sm mt-2">La venta rápida ajustará las cantidades automáticamente.</p>
                        </div>
                    )}
                </div>
            </div>
         </div>

         {/* LADO DERECHO: TICKET Y COBRO */}
         <div className="w-[450px] bg-slate-900 flex flex-col shrink-0">
            {/* Header Ticket */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2"><Printer className="w-5 h-5 text-slate-500"/> TICKET {docType}</h2>
                    <div className="text-sm text-slate-400 font-mono mt-1 tracking-wider">{series}-{docNumber}</div>
                </div>
                <button onClick={resetPOS} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Limpiar Venta (F2)">
                    <Trash2 className="w-6 h-6" />
                </button>
            </div>

            {/* Lista de Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-900/50">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <ScanLine className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-medium">Esperando productos...</p>
                    </div>
                ) : (
                    cart.map((item, idx) => (
                        <div key={idx} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col gap-2 shadow-sm">
                            <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-sm leading-tight flex-1">{item.product_name}</span>
                                <button onClick={() => removeFromCart(idx)} className="text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 p-1 rounded transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-1">
                                    <button onClick={() => { handleQtyChange(idx, -1); barcodeInputRef.current?.focus(); }} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-700 rounded-md active:scale-95"><Minus className="w-4 h-4"/></button>
                                    <span className="w-12 text-center font-bold text-lg select-none">{item.quantity_presentation}</span>
                                    <button onClick={() => { handleQtyChange(idx, 1); barcodeInputRef.current?.focus(); }} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-700 rounded-md active:scale-95"><Plus className="w-4 h-4"/></button>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 font-mono">{item.selected_unit} x S/ {Number(item.unit_price).toFixed(2)}</div>
                                    <div className="font-black text-lg text-emerald-400">S/ {Number(item.total_price).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer de Cobro */}
            <div className="bg-slate-950 p-4 border-t border-slate-800">
                {/* Cliente */}
                <div className="mb-4">
                    <button onClick={handleFastClient} disabled={isLoadingClient} className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl p-3 transition-colors disabled:opacity-50">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-500/20 p-2 rounded-lg">
                                {isLoadingClient ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> : <User className="w-5 h-5 text-blue-400" />}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <div className="text-xs text-slate-400 font-bold uppercase">{clientData.doc_type} {clientData.doc_number}</div>
                                <div className="text-sm font-bold text-white truncate w-full pr-2">{clientData.name}</div>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded tracking-widest shrink-0">F4</div>
                    </button>
                </div>

                {/* Totales */}
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-slate-400 text-sm font-medium">
                        <span>SUBTOTAL</span>
                        <span>S/ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-sm font-medium">
                        <span>IGV (18%)</span>
                        <span>S/ {igv.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-800 mt-2">
                        <span className="text-xl font-bold text-white tracking-widest">TOTAL</span>
                        <span className="text-[40px] leading-none font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">S/ {grandTotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Boton Pagar */}
                <button
                    onClick={executeSaveSale}
                    disabled={cart.length === 0 || isSaving}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed text-slate-950 font-black text-2xl py-5 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.4)] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                    <Banknote className="w-8 h-8" /> COBRAR (F8)
                </button>
            </div>
         </div>
      </div>
   );
};

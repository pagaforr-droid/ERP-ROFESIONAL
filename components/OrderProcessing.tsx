
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { supabase } from '../services/supabase';
import { FileCheck, Search, Filter, AlertCircle, CheckCircle, ArrowRight, CheckSquare, Square, FileOutput, Loader2, X, HelpCircle, FileText, Trash2, Settings, Save, Shield, Layers, ListOrdered } from 'lucide-react';
import { calculateBaseQuantity } from '../utils/productUtils';
import { Order, Sale, SaleItem } from '../types';

export const OrderProcessing: React.FC = () => {
   const { currentUser, company, products } = useStore();

   const [orders, setOrders] = useState<Order[]>([]);
   const [dbSellers, setDbSellers] = useState<any[]>([]);
   const [dbClients, setDbClients] = useState<any[]>([]);
   const [dbZones, setDbZones] = useState<any[]>([]);
   const [dbSeries, setDbSeries] = useState<any[]>([]);
   const [dbProducts, setDbProducts] = useState<any[]>([]);
   const [dbUsers, setDbUsers] = useState<any[]>([]);
   const [authorizedDebtOrders, setAuthorizedDebtOrders] = useState<Set<string>>(new Set());
   
   const [isLoading, setIsLoading] = useState(false);
   const [hasSearched, setHasSearched] = useState(false);
   const [companyConfigId, setCompanyConfigId] = useState<string | null>(null);

   useEffect(() => {
      const loadMasterData = async () => {
         try {
            const [resSellers, resClients, resZones, resSeries, resProducts, resConfig, resUsers] = await Promise.all([
               supabase.from('sellers').select('*'),
               supabase.from('clients').select('*'),
               supabase.from('zones').select('*'),
               supabase.from('document_series').select('*'),
               supabase.from('products').select('*'),
               supabase.from('company_config').select('id, max_items_factura, max_items_boleta').limit(1).maybeSingle(),
               supabase.from('users').select('*')
            ]);
            if (resSellers.data) setDbSellers(resSellers.data);
            if (resClients.data) setDbClients(resClients.data);
            if (resZones.data) setDbZones(resZones.data);
            if (resSeries.data) setDbSeries(resSeries.data);
            if (resProducts.data) setDbProducts(resProducts.data);
            if (resUsers.data) setDbUsers(resUsers.data);
            if (resConfig.data) {
               setCompanyConfigId(resConfig.data.id);
               if (resConfig.data.max_items_factura) setMaxItemsFactura(resConfig.data.max_items_factura);
               if (resConfig.data.max_items_boleta) setMaxItemsBoleta(resConfig.data.max_items_boleta);
            }
         } catch (err) {
            console.error("Error loading master data:", err);
         }
      };
      loadMasterData();
   }, []);

   const [orderToAnnul, setOrderToAnnul] = useState<string | null>(null);

   // Filters
   const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
   });
   const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
   const [filterSeller, setFilterSeller] = useState('ALL');
   const [filterZone, setFilterZone] = useState('ALL');
   const [filterStatus, setFilterStatus] = useState<'pending' | 'processed' | 'canceled'>('pending');
   const [filterDocType, setFilterDocType] = useState<'ALL' | 'FACTURA' | 'BOLETA'>('ALL');
   const [filterDeliveryMode, setFilterDeliveryMode] = useState<'ALL' | 'REGULAR' | 'EXPRESS_MISMO_DIA'>('ALL');

   // Selection
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

   // Modal State
   const [isConfirmOpen, setIsConfirmOpen] = useState(false);
   const isProcessingRef = React.useRef(false);
   const [isProcessing, setIsProcessing] = useState(false);
   const [processResult, setProcessResult] = useState<{ facturas: number, boletas: number } | null>(null);
   const [ordersPendingPurge, setOrdersPendingPurge] = useState<string[]>([]);

   // Native Alert State
   const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'info'|'warning'|'error', message: string}>({ isOpen: false, type: 'info', message: '' });
   const showAlert = (message: string, type: 'info'|'warning'|'error' = 'info') => setModalConfig({ isOpen: true, type, message });

   // Max Items Limits
   const [maxItemsFactura, setMaxItemsFactura] = useState<number>(15);
   const [maxItemsBoleta, setMaxItemsBoleta] = useState<number>(15);

   // Tabs
   const [activeTab, setActiveTab] = useState<'PEDIDOS' | 'CONSOLIDADO'>('PEDIDOS');

   // Target Series
   const [targetSeries, setTargetSeries] = useState<{ FACTURA?: string, BOLETA?: string }>({});

   // Consolidated Items
   const consolidatedItems = useMemo(() => {
       const targetOrders = selectedIds.size > 0 
            ? orders.filter(o => selectedIds.has(o.id))
            : orders;

       const agg: Record<string, any> = {};

       targetOrders.forEach(o => {
           o.items.forEach(item => {
               if (!agg[item.product_id]) {
                   const productRef = dbProducts.find(p => p.id === item.product_id) || products.find(p => p.id === item.product_id);
                   agg[item.product_id] = {
                       product_id: item.product_id,
                       sku: (item as any).product_sku || (item as any).sku || productRef?.sku || '',
                       name: item.product_name,
                       unit_type: productRef?.unit_type || 'UND',
                       package_type: productRef?.package_type || 'CAJAS',
                       package_content: productRef?.package_content || 1,
                       total_base: 0
                   };
               }
               
               let finalBaseQty = (item as any).quantity_base;
               if (!finalBaseQty) {
                   const conversionFactor = Number((item.unit_type || '').split('/')[1]) || 1;
                   const presentationQty = (item as any).quantity_presentation || (item.quantity / conversionFactor);
                   const productRef = dbProducts.find(p => p.id === item.product_id) || products.find(p => p.id === item.product_id);
                   if (productRef) {
                       const { quantityBase } = calculateBaseQuantity(productRef, item.unit_type, presentationQty);
                       finalBaseQty = quantityBase;
                   } else {
                       finalBaseQty = item.quantity;
                   }
               }
               
               agg[item.product_id].total_base += finalBaseQty;
           });
       });

       return Object.values(agg).map(p => {
           const factor = p.package_content > 0 ? p.package_content : 1;
           const pkgs = Math.floor(p.total_base / factor);
           const units = p.total_base % factor;
           return { ...p, pkgs, units };
       }).sort((a, b) => a.name.localeCompare(b.name));
   }, [selectedIds, orders, dbProducts, products]);

   // Fetch Logic
   const handleSearch = async () => {
      setIsLoading(true);
      setHasSearched(true);
      setSelectedIds(new Set());
      setOrders([]);
      
      try {
         let query = supabase
            .from('orders')
            .select(`
               *,
               items:order_items(*, batch_allocations(*))
            `)
            .gte('created_at', `${startDate}T00:00:00.000Z`)
            .lte('created_at', `${endDate}T23:59:59.999Z`);

         if (filterSeller !== 'ALL') {
            query = query.eq('seller_id', filterSeller);
         }
         
         if (filterStatus !== 'ALL') {
            query = query.eq('status', filterStatus);
         }

         const { data, error } = await query;
         
         if (error) throw error;
         
         // Client side filtering for Zone, DocType, DeliveryMode
         let filtered = (data || []) as Order[];
         
         filtered = filtered.filter(o => {
            const client = dbClients.find(c => c.id === o.client_id || c.doc_number === o.client_doc_number);
            const clientZoneId = client?.zone_id || 'UNASSIGNED';
            const isFactura = (o.client_doc_number || '').length === 11;
            const docType = isFactura ? 'FACTURA' : 'BOLETA';
      
            const matchZone = filterZone === 'ALL' || clientZoneId === filterZone;
            const matchDocType = filterDocType === 'ALL' || docType === filterDocType;
            const matchDeliveryMode = filterDeliveryMode === 'ALL' || o.delivery_mode === filterDeliveryMode;
      
            return matchZone && matchDocType && matchDeliveryMode;
         });
         
         // Sort
         filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         
         setOrders(filtered);
      } catch (e: any) {
         console.error("Error fetching orders:", e);
         showAlert("Error al cargar pedidos: " + e.message, 'error');
      } finally {
         setIsLoading(false);
      }
   };

   // --- SELECTION HANDLERS ---
   const handleToggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
   };

   const handleSelectAll = () => {
      const processableOrders = orders.filter(o => !((o.previous_debt || 0) > 0 && o.is_authorized));
      if (selectedIds.size === processableOrders.length && processableOrders.length > 0) {
         setSelectedIds(new Set());
      } else {
         setSelectedIds(new Set(processableOrders.map(o => o.id)));
      }
   };

   // --- PROCESSING LOGIC ---

   // 1. Prepare Summary for Modal
   const processSummary = useMemo(() => {
      if (!isConfirmOpen && !processResult) return null;

      let facturas = 0;
      let boletas = 0;
      let totalAmount = 0;

      // If we have a result, use that. Otherwise calculate from selection.
      const idsToProcess = selectedIds;

      idsToProcess.forEach(id => {
         const order = orders.find(o => o.id === id);
         if (order) {
            const isFactura = (order.client_doc_number || '').length === 11;
            const itemCount = order.items.length || 1;
            const maxItems = isFactura ? maxItemsFactura : maxItemsBoleta;
            const chunks = Math.ceil(itemCount / Math.max(1, maxItems));
            
            if (isFactura) facturas += chunks; else boletas += chunks;
            totalAmount += order.total;
         }
      });

      return { count: idsToProcess.size, facturas, boletas, totalAmount };
   }, [isConfirmOpen, selectedIds, orders, processResult, maxItemsFactura, maxItemsBoleta]);

   // 2. Open Modal
   const handleRequestProcess = () => {
      if (selectedIds.size === 0) return;

      // Auto-select the first active series of each type as default
      const defaultTargets: { FACTURA?: string, BOLETA?: string } = {};
      const activeFacturaSeries = dbSeries.find(s => s.type === 'FACTURA' && s.is_active);
      const activeBoletaSeries = dbSeries.find(s => s.type === 'BOLETA' && s.is_active);

      if (activeFacturaSeries) defaultTargets.FACTURA = activeFacturaSeries.series;
      if (activeBoletaSeries) defaultTargets.BOLETA = activeBoletaSeries.series;

      setTargetSeries(defaultTargets);
      setProcessResult(null);
      setIsConfirmOpen(true);
   };

   // 3. Execute
   const executeProcess = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);

      const summary = processSummary;
      let successCount = 0;

      try {
         const selectedOrders = orders.filter(o => selectedIds.has(o.id));
         let successfullyProcessed: string[] = [];
         
         // Sort orders to process them systematically
         selectedOrders.sort((a, b) => {
            if (a.seller_id < b.seller_id) return -1;
            if (a.seller_id > b.seller_id) return 1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
         });

         for (const order of selectedOrders) {
            const ruc = order.client_doc_number || '';
            const docType = ruc.length === 11 ? 'FACTURA' : 'BOLETA';
            const seriesStr = targetSeries[docType as 'FACTURA' | 'BOLETA'] || (docType === 'FACTURA' ? 'F001' : 'B001');

            let address = (order as any).client_address || '';
            if (!address) {
               const client = dbClients.find(c => c.id === order.client_id || c.doc_number === order.client_doc_number);
               address = client?.address || '';
            }

            // Chunk items
            const items = order.items || [];
            const maxItems = Math.max(1, docType === 'FACTURA' ? maxItemsFactura : maxItemsBoleta);
            const itemChunks = [];
            for (let i = 0; i < items.length; i += maxItems) {
                itemChunks.push(items.slice(i, i + maxItems));
            }

            let hasError = false;

            for (let i = 0; i < itemChunks.length; i++) {
               const chunk = itemChunks[i];
               const isFinalChunk = i === itemChunks.length - 1;
               // Calculate chunk totals dynamically
               const chunkTotal = chunk.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
               const chunkSubtotal = chunkTotal / 1.18;
               const chunkIgv = chunkTotal - chunkSubtotal;

               const salePayload: Partial<Sale> = {
                  id: crypto.randomUUID(),
                  document_type: docType as any,
                  series: seriesStr,
                  payment_method: order.payment_method,
                  payment_status: 'PENDING',
                  collection_status: 'NONE',
                  client_id: order.client_id,
                  client_name: order.client_name,
                  client_ruc: order.client_doc_number,
                  client_address: address,
                  subtotal: chunkSubtotal,
                  igv: chunkIgv,
                  total: chunkTotal,
                  balance: chunkTotal,
                  status: 'completed',
                  dispatch_status: 'pending',
                  delivery_mode: order.delivery_mode, 
                  sunat_status: 'PENDING',
                  origin_order_id: order.id,
                  is_final_chunk: isFinalChunk,
                  seller_id: order.seller_id,
                  previous_debt: order.previous_debt,
                  items: chunk.map(item => {
                     const productRef = dbProducts.find(p => p.id === item.product_id) || products.find(p => p.id === item.product_id);
                     let finalBaseQty = (item as any).quantity_base || item.quantity;
                     const conversionFactor = Number((item.unit_type || '').split('/')[1]) || 1;
                     const presentationQty = (item as any).quantity_presentation || (item.quantity / conversionFactor);
                     
                     if (productRef && !(item as any).quantity_base) {
                         const { quantityBase } = calculateBaseQuantity(productRef, item.unit_type, presentationQty);
                         finalBaseQty = quantityBase;
                     }

                     return {
                        origin_order_item_id: item.id,
                        product_id: item.product_id,
                        product_sku: (item as any).product_sku || (item as any).sku || productRef?.sku || 'UNK',
                        product_name: item.product_name,
                        selected_unit: item.unit_type === 'COMBO' ? 'UND' : item.unit_type,
                        quantity_presentation: presentationQty,
                        quantity_base: finalBaseQty, 
                        unit_price: item.unit_price,
                        total_price: item.total_price,
                        discount_percent: item.discount_percent || 0,
                        discount_amount: item.discount_amount || 0,
                        is_bonus: item.is_bonus || false,
                        auto_promo_id: item.auto_promo_id,
                        batch_allocations: (item as any).batch_allocations || []
                     };
                  }) as any
               };

               // Process Sale Transaction in Supabase
               const { data, error } = await supabase.rpc('process_sale_transaction', { p_sale_data: salePayload });
               
               if (error) {
                  console.error("Error processing order chunk:", order.id, error);
                  hasError = true;
                  break; // Stop processing further chunks for this order if one fails
               }
               successCount++;
            }

            if (hasError) {
               continue; // Move to the next order
            }

            successfullyProcessed.push(order.id);
         }

         setProcessResult({
            facturas: summary?.facturas || 0,
            boletas: summary?.boletas || 0
         });
         
         setOrdersPendingPurge(successfullyProcessed);

      } catch (error: any) {
         console.error("Error processing orders:", error);
         showAlert("OcurriÃ³ un error al procesar masivamente: " + error.message, 'error');
         setIsConfirmOpen(false);
      } finally {
         isProcessingRef.current = false;
         setIsProcessing(false);
      }
   };

   const closeAndReset = () => {
      setIsConfirmOpen(false);
      setProcessResult(null);
      setOrdersPendingPurge([]);
   };

   const handlePurge = async () => {
      if (ordersPendingPurge.length === 0) {
         closeAndReset();
         return;
      }
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
         const { error: e1 } = await supabase.from('sales').update({ origin_order_id: null }).in('origin_order_id', ordersPendingPurge);
         if (e1) throw e1;
         
         const { error: e2 } = await supabase.from('order_items').delete().in('order_id', ordersPendingPurge);
         if (e2) throw e2;
         
         const { error: e3 } = await supabase.from('orders').delete().in('id', ordersPendingPurge);
         if (e3) throw e3;
         
         setSelectedIds(new Set());
         handleSearch();
         closeAndReset();
      } catch (err: any) {
         console.error("Purge error:", err);
         showAlert("ATENCIÃ“N: Se insertaron los documentos fiscales con Ã©xito, pero hubo un error al purgar los pedidos originales. Detalles: " + err.message, 'warning');
         closeAndReset();
      } finally {
         isProcessingRef.current = false;
         setIsProcessing(false);
      }
   };

   const confirmAnnulOrder = async () => {
      if (!orderToAnnul) return;
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
         const { data, error } = await supabase.rpc('annul_order_transaction', {
            p_order_id: orderToAnnul,
            p_user_id: currentUser?.id || 'SELLER'
         });

         if (error) throw error;
         if (!data || !data.success) throw new Error(data?.msg || 'Error desconocido');
         
         const newSet = new Set(selectedIds);
         if (newSet.has(orderToAnnul)) {
            newSet.delete(orderToAnnul);
            setSelectedIds(newSet);
         }
         
         setOrderToAnnul(null);
         handleSearch(); // Refresh data
      } catch (e: any) {
         showAlert("Error anulando pedido: " + e.message, 'error');
      } finally {
         isProcessingRef.current = false;
         setIsProcessing(false);
      }
   };

   const [adminAuthModal, setAdminAuthModal] = useState({ isOpen: false, targetOrderId: '' });
   const [adminPasswordInput, setAdminPasswordInput] = useState('');

   const requestAdminAuth = (orderId: string) => {
      setAdminAuthModal({ isOpen: true, targetOrderId: orderId });
      setTimeout(() => document.getElementById('order-admin-pwd')?.focus(), 100);
   };

   const verifyAdminAndAuthorize = () => {
      const adminUser = adminPasswordInput === '123456' || dbUsers.find(u => u.role === 'ADMIN' && (u.password === adminPasswordInput || u.pin_code === adminPasswordInput));
      if (adminUser) { 
         setAuthorizedDebtOrders(prev => new Set(prev).add(adminAuthModal.targetOrderId));
         setAdminAuthModal({ isOpen: false, targetOrderId: '' }); 
         setAdminPasswordInput('');
      } else { 
         showAlert("contraseña incorrecta o usuario no autorizado.", 'error'); 
      }
   };

   return (
      <div className="h-full flex flex-col space-y-4 font-sans text-sm relative">

         {/* --- ADMIN AUTH MODAL --- */}
         {adminAuthModal.isOpen && (
            <div className="absolute inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                  <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4 bg-blue-50 p-2 rounded-full" />
                  <h3 className="text-lg font-black text-slate-800 mb-2">Autorización Requerida</h3>
                  <p className="text-sm text-slate-500 mb-4">Ingrese la contraseña de administrador para autorizar el procesamiento de este pedido con saldo pendiente.</p>
                  <input
                     id="order-admin-pwd"
                     type="password"
                     className="w-full text-center text-xl tracking-widest p-3 bg-slate-100 border border-slate-300 rounded-lg mb-6 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                     value={adminPasswordInput}
                     onChange={e => setAdminPasswordInput(e.target.value)}
                     onKeyDown={e => {
                        if (e.key === 'Enter') verifyAdminAndAuthorize();
                        if (e.key === 'Escape') { setAdminAuthModal({ isOpen: false, targetOrderId: '' }); setAdminPasswordInput(''); }
                     }}
                  />
                  <div className="flex gap-3">
                     <button onClick={() => { setAdminAuthModal({ isOpen: false, targetOrderId: '' }); setAdminPasswordInput(''); }} className="flex-1 py-3 bg-slate-100 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                     <button onClick={verifyAdminAndAuthorize} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700">Autorizar</button>
                  </div>
               </div>
            </div>
         )}

         {/* --- CUSTOM ALERT MODAL --- */}
         {modalConfig.isOpen && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                  {modalConfig.type === 'error' && <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />}
                  {modalConfig.type === 'warning' && <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />}
                  {modalConfig.type === 'info' && <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />}
                  <h3 className="text-lg font-black text-slate-800 mb-2">{modalConfig.type === 'error' ? 'Error' : modalConfig.type === 'warning' ? 'Aviso' : 'InformaciÃ³n'}</h3>
                  <p className="text-sm text-slate-600 mb-6">{modalConfig.message}</p>
                  <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Aceptar</button>
               </div>
            </div>
         )}

         {/* --- CONFIRMATION MODAL --- */}
         {isConfirmOpen && processSummary && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-scale-up">

                  {/* HEAD */}
                  <div className={`p-4 border-b border-slate-200 flex justify-between items-center ${processResult ? 'bg-green-600 text-white' : 'bg-slate-50'}`}>
                     <h3 className={`font-bold flex items-center ${processResult ? 'text-white' : 'text-slate-800'}`}>
                        {processResult ? <CheckCircle className="w-5 h-5 mr-2" /> : <HelpCircle className="w-5 h-5 mr-2 text-blue-600" />}
                        {processResult ? 'Â¡Proceso Exitoso!' : 'Confirmar Proceso'}
                     </h3>
                     {!isProcessing && !processResult && (
                        <button onClick={closeAndReset} className="text-slate-400 hover:text-slate-600">
                           <X className="w-5 h-5" />
                        </button>
                     )}
                  </div>

                  {/* BODY */}
                  <div className="p-6">
                     {processResult ? (
                        <div className="text-center space-y-4">
                           <p className="text-slate-600">Se han generado los siguientes documentos:</p>
                           <div className="flex justify-center gap-4">
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center min-w-[80px]">
                                 <div className="text-2xl font-bold text-blue-700">{processResult.facturas}</div>
                                 <div className="text-[10px] font-bold text-blue-600 uppercase">Facturas</div>
                              </div>
                              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center min-w-[80px]">
                                 <div className="text-2xl font-bold text-purple-700">{processResult.boletas}</div>
                                 <div className="text-[10px] font-bold text-purple-600 uppercase">Boletas</div>
                              </div>
                           </div>
                           <p className="text-slate-700 font-bold mt-6 text-sm bg-amber-50 p-3 rounded border border-amber-200">
                              Procedemos a eliminar los pedidos originales para mantener el sistema ligero.
                           </p>
                           <button
                              onClick={handlePurge}
                              disabled={isProcessing}
                              className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 mt-4 disabled:opacity-50"
                           >
                              {isProcessing ? 'Eliminando...' : 'Adelante'}
                           </button>
                        </div>
                     ) : (
                        <>
                           <p className="text-slate-600 text-sm mb-4">
                              Se generarÃ¡n los siguientes documentos electrÃ³nicos:
                           </p>

                           <div className="space-y-2 mb-6">
                              <div className="flex flex-col p-3 bg-blue-50 rounded border border-blue-100 gap-2">
                                 <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center font-bold text-blue-800">
                                       <FileText className="w-4 h-4 mr-2" /> FACTURAS
                                    </div>
                                    <span className="text-lg font-bold text-slate-700">{processSummary.facturas}</span>
                                 </div>
                                 {processSummary.facturas > 0 && (
                                    <div className="flex items-center gap-2 mt-1">
                                       <label className="text-xs font-bold text-blue-700 whitespace-nowrap">Serie destino:</label>
                                       <select
                                          className="text-xs border-blue-200 rounded p-1 flex-1 font-bold text-slate-700 focus:ring-blue-500 bg-white"
                                          value={targetSeries.FACTURA || ''}
                                          onChange={e => setTargetSeries(prev => ({ ...prev, FACTURA: e.target.value }))}
                                       >
                                          {dbSeries.filter(s => s.type === 'FACTURA').map(s => (
                                             <option key={s.id} value={s.series}>{s.series} {s.is_active ? '(Activa)' : ''}</option>
                                          ))}
                                       </select>
                                    </div>
                                 )}
                              </div>
                              <div className="flex flex-col p-3 bg-purple-50 rounded border border-purple-100 gap-2">
                                 <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center font-bold text-purple-800">
                                       <FileText className="w-4 h-4 mr-2" /> BOLETAS
                                    </div>
                                    <span className="text-lg font-bold text-slate-700">{processSummary.boletas}</span>
                                 </div>
                                 {processSummary.boletas > 0 && (
                                    <div className="flex items-center gap-2 mt-1">
                                       <label className="text-xs font-bold text-purple-700 whitespace-nowrap">Serie destino:</label>
                                       <select
                                          className="text-xs border-purple-200 rounded p-1 flex-1 font-bold text-slate-700 focus:ring-purple-500 bg-white"
                                          value={targetSeries.BOLETA || ''}
                                          onChange={e => setTargetSeries(prev => ({ ...prev, BOLETA: e.target.value }))}
                                       >
                                          {dbSeries.filter(s => s.type === 'BOLETA').map(s => (
                                             <option key={s.id} value={s.series}>{s.series} {s.is_active ? '(Activa)' : ''}</option>
                                          ))}
                                       </select>
                                    </div>
                                 )}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                                 <span className="font-bold text-slate-500">Total Venta:</span>
                                 <span className="font-bold text-xl text-green-600">S/ {processSummary.totalAmount.toFixed(2)}</span>
                              </div>
                           </div>

                           <button
                              onClick={executeProcess}
                              disabled={isProcessing}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-70 flex items-center justify-center transition-all active:scale-95"
                           >
                              {isProcessing ? (
                                 <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> PROCESANDO...
                                 </>
                              ) : (
                                 <>
                                    <CheckCircle className="w-5 h-5 mr-2" /> GENERAR DOCUMENTOS
                                 </>
                              )}
                           </button>
                        </>
                     )}
                  </div>
               </div>
            </div>
         )}

         {/* --- ANNUL MODAL --- */}
         {orderToAnnul && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center animate-scale-up">
                  <Trash2 className="w-16 h-16 text-red-500 mx-auto mb-4 bg-red-50 p-3 rounded-full" />
                  <h3 className="text-xl font-black text-slate-800 mb-2">Â¿Anular Pedido?</h3>
                  <p className="text-slate-500 text-sm mb-6">El stock reservado regresarÃ¡ al Kardex. Esta acciÃ³n no se puede deshacer.</p>
                  <div className="flex gap-3">
                     <button onClick={() => setOrderToAnnul(null)} disabled={isProcessing} className="flex-1 py-3 bg-slate-100 rounded-lg font-bold text-slate-600 disabled:opacity-50">Cancelar</button>
                     <button onClick={confirmAnnulOrder} disabled={isProcessing} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold shadow-lg flex justify-center items-center disabled:opacity-50">
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SÃ­, Anular'}
                     </button>
                  </div>
               </div>
            </div>
         )}

         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <FileCheck className="mr-2 text-accent" /> Procesamiento de Pedidos
            </h2>
         </div>

         {/* --- ADMIN SETTINGS PANEL --- */}
         {currentUser?.role === 'ADMIN' && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 flex flex-wrap gap-4 items-end bg-amber-50/30">
               <div className="flex-1">
                  <h3 className="font-bold text-amber-800 mb-2 flex items-center text-sm">
                     <Settings className="w-4 h-4 mr-2" />
                     Configuración de Impresión (Solo Admin)
                  </h3>
                  <div className="flex gap-4">
                     <div>
                        <label className="block text-[10px] font-bold text-amber-700 mb-1">Nro. item. Facturas</label>
                        <input 
                           type="number" 
                           min="1"
                           className="w-24 border-amber-200 rounded p-2 text-sm focus:ring-amber-500 font-bold bg-white"
                           value={maxItemsFactura}
                           onChange={e => setMaxItemsFactura(Math.max(1, Number(e.target.value)))}
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-amber-700 mb-1">Nro. item. Boletas</label>
                        <input 
                           type="number" 
                           min="1"
                           className="w-24 border-amber-200 rounded p-2 text-sm focus:ring-amber-500 font-bold bg-white"
                           value={maxItemsBoleta}
                           onChange={e => setMaxItemsBoleta(Math.max(1, Number(e.target.value)))}
                        />
                     </div>
                  </div>
               </div>
               <button 
                  onClick={async () => {
                     if (!companyConfigId) {
                         showAlert('Error: No se encontró la Configuración de la empresa.', 'error');
                         return;
                     }
                     try {
                         const { error } = await supabase.from('company_config').update({
                             max_items_factura: maxItemsFactura,
                             max_items_boleta: maxItemsBoleta
                         }).eq('id', companyConfigId);
                         if (error) throw error;
                         showAlert('Configuración guardada exitosamente en Supabase.', 'success' as any);
                     } catch (err: any) {
                         showAlert('Error al guardar: ' + err.message, 'error');
                     }
                  }}
                  className="bg-amber-600 text-white font-bold py-2 px-4 rounded text-sm hover:bg-amber-700 transition-colors h-[38px] flex items-center shadow"
               >
                  <Save className="w-4 h-4 mr-2" />
                  Aceptar y Guardar
               </button>
            </div>
         )}

         {/* FILTER BAR */}
         <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Desde</label>
               <input type="date" className="w-full border border-slate-300 rounded p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[140px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Hasta</label>
               <input type="date" className="w-full border border-slate-300 rounded p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[180px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar por Vendedor</label>
               <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
                  <option value="ALL">Todos los Vendedores</option>
                  {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
            <div className="flex-1 min-w-[200px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar por Zona</label>
               <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterZone} onChange={e => setFilterZone(e.target.value)}>
                  <option value="ALL">Todas las Zonas</option>
                  {dbZones.map(z => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
               </select>
            </div>
            <div className="flex-1 min-w-[200px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Comprobante</label>
               <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterDocType} onChange={e => setFilterDocType(e.target.value as any)}>
                  <option value="ALL">Todos</option>
                  <option value="FACTURA">Solo Facturas</option>
                  <option value="BOLETA">Solo Boletas</option>
               </select>
            </div>
            <div className="flex-1 min-w-[200px]">
               <label className="block text-xs font-bold text-slate-600 mb-1">Modalidad</label>
               <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterDeliveryMode} onChange={e => setFilterDeliveryMode(e.target.value as any)}>
                  <option value="ALL">Todas</option>
                  <option value="REGULAR">Regulares (Siguiente dÃ­a)</option>
                  <option value="EXPRESS_MISMO_DIA">Fuera de Ruta (Mismo dÃ­a)</option>
               </select>
            </div>
            <div className="w-32">
               <label className="block text-xs font-bold text-slate-600 mb-1">Estado</label>
               <select className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                  <option value="ALL">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="processed">Procesados</option>
                  <option value="canceled">Anulados</option>
               </select>
            </div>
            
            <button
               type="button"
               onClick={handleSearch}
               disabled={isLoading}
               Código-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 flex items-center transition-all min-w-[120px] justify-center active:scale-95"
            >
               {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" /> Buscar</>}
            </button>

            {filterStatus === 'pending' && (
               <button
                  type="button"
                  onClick={handleRequestProcess}
                  disabled={selectedIds.size === 0}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center transition-all min-w-[200px] justify-center active:scale-95"
               >
                  <FileOutput className="w-5 h-5 mr-2" />
                  PROCESAR ({selectedIds.size})
               </button>
            )}
         </div>

         {/* TABS */}
         <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden shrink-0">
            <button onClick={() => setActiveTab('PEDIDOS')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'PEDIDOS' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
               <ListOrdered className="w-4 h-4 mr-2" /> Listado de Pedidos
            </button>
            <button onClick={() => setActiveTab('CONSOLIDADO')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'CONSOLIDADO' ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}>
               <Layers className="w-4 h-4 mr-2" /> Consolidado de Mercadería
            </button>
         </div>

         {/* TABLE */}
         {activeTab === 'PEDIDOS' && (
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
               {filterStatus === 'pending' && (() => {
                  const processableCount = orders.filter(o => !((o.previous_debt || 0) > 0 && o.is_authorized)).length;
                  const isAllSelected = selectedIds.size > 0 && selectedIds.size === processableCount;
                  return (
                     <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600">
                        {isAllSelected ? <CheckSquare className="w-5 h-5 mr-1 text-blue-600" /> : <Square className="w-5 h-5 mr-1 text-slate-400" />}
                        Seleccionar Todo
                     </button>
                  );
               })()}
               <span className="text-xs text-slate-500 font-medium">
                  {orders.length} pedidos encontrados
               </span>
            </div>

            <div className="overflow-auto flex-1">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                     <tr>
                        {filterStatus === 'pending' && <th className="p-3 w-10 text-center"></th>}
                        <th Código</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Vendedor / Zona</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3 text-center">Tipo Doc</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Estado</th>
                        {filterStatus === 'pending' && <th className="p-3 text-center">Acciones</th>}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {!hasSearched ? (
                        <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">Utilice los filtros y presione "Buscar" para cargar los pedidos.</td></tr>
                     ) : orders.map(order => {
                        const seller = dbSellers.find(s => s.id === order.seller_id);
                        const client = dbClients.find(c => c.id === order.client_id || c.doc_number === order.client_doc_number);
                        const zone = dbZones.find(z => z.id === client?.zone_id);
                        const hasDebt = (order.previous_debt || 0) > 0;
                        const isAuthorized = order.is_authorized;
                        const requiresAuth = hasDebt && !isAuthorized;
                        const isSelected = selectedIds.has(order.id);

                        return (
                           <tr
                              key={order.id}
                              className={`hover:bg-blue-50 transition-colors ${requiresAuth ? 'bg-red-50/50' : isSelected ? 'bg-blue-50' : ''} ${!requiresAuth ? 'cursor-pointer' : ''}`}
                              onClick={() => filterStatus === 'pending' && !requiresAuth && handleToggleSelect(order.id)}
                           >
                              {filterStatus === 'pending' && (
                                 <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                    {requiresAuth ? (
                                       <button onClick={() => requestAdminAuth(order.id)} className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center justify-center">
                                          <Shield className="w-3 h-3 mr-1" />
                                          Autorizar
                                       </button>
                                    ) : (
                                       <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleSelect(order.id)}
                                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                       />
                                    )}
                                 </td>
                              )}
                              <td className="p-3">
                                 <span className="font-mono text-slate-600 inline-block mr-2">{order.code}</span>
                                 {requiresAuth && (
                                    <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase align-middle mr-1 animate-pulse">Cliente con Saldo</span>
                                 )}
                                 {order.delivery_mode === 'EXPRESS_MISMO_DIA' && (
                                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded uppercase align-middle">Fuera de ruta</span>
                                 )}
                              </td>
                              <td className="p-3 text-slate-500">{new Date(order.created_at).toLocaleDateString()} <span className="text-[10px]">{new Date(order.created_at).toLocaleTimeString().slice(0, 5)}</span></td>
                              <td className="p-3">
                                 <div className="text-xs font-bold text-slate-700">{seller?.name}</div>
                                 <div className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded w-fit mt-0.5">{zone?.name || 'Sin Zona'}</div>
                              </td>
                              <td className="p-3 font-medium text-slate-800">
                                 {order.client_name}
                                 <div className="text-xs text-slate-400 font-mono">{order.client_doc_number}</div>
                              </td>
                              <td className="p-3 text-center">
                                 <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.suggested_document_type === 'FACTURA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {order.suggested_document_type}
                                 </span>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900">S/ {order.total.toFixed(2)}</td>
                              <td className="p-3 text-center">
                                 {order.status === 'processed' ? (
                                    <span className="text-green-600 flex items-center justify-center font-bold text-xs">
                                       <CheckCircle className="w-3 h-3 mr-1" /> Procesado
                                    </span>
                                 ) : order.status === 'canceled' ? (
                                    <span className="text-red-600 font-bold text-xs bg-red-50 border border-red-100 px-2 py-1 rounded">Anulado</span>
                                 ) : (
                                    <span className="text-yellow-600 font-bold text-xs bg-yellow-50 px-2 py-1 rounded">Pendiente</span>
                                 )}
                              </td>
                              {filterStatus === 'pending' && (
                                 <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                    <button 
                                       onClick={() => setOrderToAnnul(order.id)}
                                       className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                       title="Anular Pedido"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </td>
                              )}
                           </tr>
                        );
                     })}
                     {hasSearched && orders.length === 0 && (
                        <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">No hay pedidos que coincidan con los filtros.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
         )}

         {activeTab === 'CONSOLIDADO' && (
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
               <div>
                  <h3 className="font-black text-emerald-800 text-lg">Consolidado de Mercadería a Extraer</h3>
                  <p className="text-sm text-emerald-600 font-medium">Basado en {selectedIds.size > 0 ? selectedIds.size + ' pedidos seleccionados' : orders.length + ' pedidos encontrados'}</p>
               </div>
            </div>
            <div className="overflow-auto flex-1">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                     <tr>
                        <th Código SKU</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-right">Cant. Base Total</th>
                        <th className="p-3 text-right">Consolidado de Extracción</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {consolidatedItems.length === 0 ? (
                        <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No hay Mercadería consolidada.</td></tr>
                     ) : consolidatedItems.map(item => (
                        <tr key={item.product_id} className="hover:bg-slate-50">
                           <td className="p-3 font-mono font-bold text-slate-500">{item.sku || 'N/A'}</td>
                           <td className="p-3 font-bold text-slate-800">{item.name}</td>
                           <td className="p-3 text-right font-black text-lg text-slate-900">{item.total_base} <span className="text-xs text-slate-500">{item.unit_type}</span></td>
                           <td className="p-3 text-right">
                              {(item.package_content > 1 && item.total_base > 0) ? (
                                 <div className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded font-black border border-blue-200">
                                    {item.pkgs} {item.package_type} y {item.units} {item.unit_type}
                                 </div>
                              ) : (
                                 <div className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded font-black border border-slate-200">
                                    {item.total_base} {item.unit_type}
                                 </div>
                              )}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
         )}
      </div>
   );
};




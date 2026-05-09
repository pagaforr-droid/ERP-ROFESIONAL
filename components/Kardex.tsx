import React, { useState, useMemo, useEffect } from 'react';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Product, Batch, Purchase, Sale, DispatchLiquidation } from '../types';
import { useStore } from '../services/store';
import { Package, ArrowUpRight, ArrowDownLeft, Search, Filter, Calendar, BarChart3, FileText, Layers, RefreshCw, Printer, AlertTriangle, ArrowUpDown, FileDown, Plus, DollarSign, Hash, Briefcase, CheckCircle, Eye, Settings, Trash2, X, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ViewTab = 'INVENTORY' | 'MOVEMENTS' | 'BATCHES' | 'ANALYTICS' | 'RESERVATIONS';

interface Movement {
  id: string;
  date: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  docType: string;
  docNumber: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reference: string;
}

export const Kardex: React.FC = () => {
  const { currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('INVENTORY');
  const [isDataVisible, setIsDataVisible] = useState(false); // ESTADO DE RENDIMIENTO
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // --- ESTADOS SUPABASE ---
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbBatches, setDbBatches] = useState<Batch[]>([]);
  const [dbSuppliers, setDbSuppliers] = useState<any[]>([]);
  const [dbPurchases, setDbPurchases] = useState<Purchase[]>([]);
  const [dbSales, setDbSales] = useState<Sale[]>([]);
  const [dbLiquidations, setDbLiquidations] = useState<DispatchLiquidation[]>([]);
  const [dbPendingOrders, setDbPendingOrders] = useState<any[]>([]);
  const [dbTransfers, setDbTransfers] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterSeller, setFilterSeller] = useState('ALL');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // --- NATIVE MODALS ---
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'info'|'warning'|'error', message: string}>({ isOpen: false, type: 'info', message: '' });
  const showAlert = (message: string, type: 'info'|'warning'|'error' = 'info') => setModalConfig({ isOpen: true, type, message });

  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({ isOpen: false, message: '', onConfirm: () => {} });
  const requestConfirm = (message: string, onConfirm: () => void) => setConfirmConfig({ isOpen: true, message, onConfirm });

  useEffect(() => {
     fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
     if (!USE_MOCK_DB) {
        setIsLoading(true);
        try {
           const [pRes, bRes, sRes, ordersRes, usersRes] = await Promise.all([
              supabase.from('products').select('*').eq('is_active', true),
              supabase.from('batches').select('*').gt('quantity_current', 0),
              supabase.from('suppliers').select('*'),
              supabase.from('orders').select('*, items:order_items(*)').eq('status', 'pending'),
              supabase.from('profiles').select('id, full_name, email')
           ]);
           if (pRes.data) setDbProducts(pRes.data as Product[]);
           if (bRes.data) setDbBatches(bRes.data as Batch[]);
           if (sRes.data) setDbSuppliers(sRes.data);
           if (ordersRes.data) setDbPendingOrders(ordersRes.data as any[]);
           if (usersRes.data) setDbUsers(usersRes.data);
        } catch (error) {
           console.error("Error sincronizando Kardex Físico:", error);
        } finally {
           setIsLoading(false);
        }
     }
  };

  const fetchMovementsData = async () => {
     if (!USE_MOCK_DB) {
        setIsLoading(true);
        try {
           const [purRes, salRes, liqRes, transRes] = await Promise.all([
              supabase.from('purchases').select('*, items:purchase_items(*)').gte('issue_date', dateFrom).lte('issue_date', dateTo),
              supabase.from('sales').select('*, items:sale_items(*)').gte('created_at', `${dateFrom}T00:00:00.000Z`).lte('created_at', `${dateTo}T23:59:59.999Z`),
              supabase.from('dispatch_liquidations').select('*, documents:liquidation_documents(*)').gte('date', `${dateFrom}T00:00:00.000Z`).lte('date', `${dateTo}T23:59:59.999Z`),
              supabase.from('transfer_documents').select('*, items:transfer_items(*)').gte('created_at', `${dateFrom}T00:00:00.000Z`).lte('created_at', `${dateTo}T23:59:59.999Z`)
           ]);
           if (purRes.data) setDbPurchases(purRes.data as any[]);
           if (salRes.data) setDbSales(salRes.data as any[]);
           if (liqRes.data) setDbLiquidations(liqRes.data as any[]);
           if (transRes.data) setDbTransfers(transRes.data as any[]);
        } catch (error) {
           console.error("Error sincronizando Movimientos:", error);
        } finally {
           setIsLoading(false);
        }
     }
  };

  // Keep an alias to not break existing buttons immediately
  const fetchMasterData = fetchInventoryData;

  const handleRecalculateKardex = async () => {
     if (currentUser?.role !== 'ADMIN') {
        showAlert("Acceso denegado: Solo el Administrador puede recalcular el Kardex.", "error");
        return;
     }
     
     requestConfirm("⚠️ ADVERTENCIA: Esta es una operación de base de datos intensiva.\n\nRecalculará el Stock Físico de TODOS los productos basándose estrictamente en su historial de entradas y salidas.\n\n¿Estás seguro de continuar?", async () => {
         setIsRecalculating(true);
         try {
            const { error } = await supabase.rpc('admin_recalculate_kardex');
            if (error) throw error;
            
            showAlert("¡Éxito! El Kardex ha sido recalculado matemáticamente.", "info");
            await fetchMasterData(); // Recargar datos frescos
         } catch (err: any) {
            console.error("Error al recalcular Kardex:", err);
            showAlert("Error al recalcular Kardex: " + err.message, "error");
         } finally {
            setIsRecalculating(false);
         }
     });
  };

  const filteredPendingOrders = useMemo(() => {
      return dbPendingOrders.filter(order => filterSeller === 'ALL' || order.seller_id === filterSeller);
  }, [dbPendingOrders, filterSeller]);

  const toggleAllOrders = () => {
      if (selectedOrders.size === filteredPendingOrders.length && filteredPendingOrders.length > 0) {
          setSelectedOrders(new Set());
      } else {
          setSelectedOrders(new Set(filteredPendingOrders.map(o => o.id)));
      }
  };

  const toggleOrderSelection = (id: string) => {
      const newSet = new Set(selectedOrders);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedOrders(newSet);
  };

  const handleAnnulOrder = async (orderId?: string) => {
      const ordersToAnnul = orderId ? [orderId] : Array.from(selectedOrders);
      if (ordersToAnnul.length === 0) {
          showAlert("Por favor, selecciona al menos un pedido para anular.", "warning");
          return;
      }

      requestConfirm(`¿Estás seguro que deseas anular ${ordersToAnnul.length === 1 ? 'este pedido pendiente' : `estos ${ordersToAnnul.length} pedidos pendientes`}? Las reservas de stock se liberarán inmediatamente.`, async () => {
          setIsProcessing(true);
          let hasError = false;
          try {
             for (const id of ordersToAnnul) {
                 const { error } = await supabase.rpc('annul_order_transaction', {
                    p_order_id: id,
                    p_user_id: currentUser?.id || 'SELLER'
                 });
                 if (error) { hasError = true; break; }
             }
             if (hasError) throw new Error("Algunos pedidos no pudieron anularse.");
             showAlert("Pedido(s) anulado(s) exitosamente. Stock liberado.", "info");
             setSelectedOrders(new Set());
             await fetchMasterData();
          } catch (e: any) {
             showAlert("Error anulando pedido(s): " + e.message, "error");
          } finally {
             setIsProcessing(false);
          }
      });
  };

  // --- FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState<'CENTRAL'|'MERMAS'>('CENTRAL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // --- SORTING ---
  const [sortField, setSortField] = useState<'sku'|'name'|'category'|'supplier'|'stock'|'value'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Cuando cambian los filtros, ocultamos los datos hasta que presione Mostrar
  const handleFilterChange = (setter: Function, value: any) => {
     setter(value);
     setIsDataVisible(false);
  };

  // --- DATA COMPUTATION ---

  // 1. INVENTORY SUMMARY (Snapshot)
  const inventorySnapshot = useMemo(() => {
    return (dbProducts || []).map(p => {
       const productBatches = (dbBatches || []).filter(b => b.product_id === p.id && b.quantity_current > 0 && 
           (filterWarehouse === 'CENTRAL' ? b.warehouse_id !== 'MERMAS' : b.warehouse_id === 'MERMAS')
       );
       const totalStock = productBatches.reduce((acc, b) => acc + (b.quantity_current || 0), 0);
       const totalValue = filterWarehouse === 'MERMAS' ? 0 : productBatches.reduce((acc, b) => acc + ((b.quantity_current || 0) * (b.cost || 0)), 0);
       const avgCost = filterWarehouse === 'MERMAS' ? 0 : (totalStock > 0 ? totalValue / totalStock : (p.last_cost || 0));

       const factor = (p.package_content || 0) > 0 ? p.package_content : 1;
       const stockPackages = Math.floor(totalStock / factor);
       const remainingBase = totalStock % factor;

       return {
          ...p,
          totalStock,
          stockPackages,
          remainingBase,
          avgCost,
          totalValue,
          supplierName: (dbSuppliers || []).find(s => s.id === p.supplier_id)?.name || 'Varios'
       };
    }).filter(p => {
       const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
       const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
       const matchSup = filterSupplier === 'ALL' || p.supplier_id === filterSupplier;
       return matchSearch && matchCat && matchSup;
    }).sort((a,b) => {
       let valA: string | number = '';
       let valB: string | number = '';
       if (sortField === 'sku') { valA = a.sku || ''; valB = b.sku || ''; }
       if (sortField === 'name') { valA = a.name || ''; valB = b.name || ''; }
       if (sortField === 'category') { valA = a.category || ''; valB = b.category || ''; }
       if (sortField === 'supplier') { valA = a.supplierName || ''; valB = b.supplierName || ''; }
       if (sortField === 'stock') { valA = a.totalStock; valB = b.totalStock; }
       if (sortField === 'value') { valA = a.totalValue; valB = b.totalValue; }
       
       if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
       if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
       return 0;
    });
  }, [dbProducts, dbBatches, dbSuppliers, searchTerm, filterCategory, filterSupplier, sortField, sortOrder, filterWarehouse]);

  // 2. MOVEMENTS (Timeline)
  const movements = useMemo(() => {
     const list: Movement[] = [];

     (dbPurchases || []).forEach(p => {
        if (!p.issue_date || p.issue_date < dateFrom || p.issue_date > dateTo) return;
        (p.items || []).forEach(item => {
           const prod = (dbProducts || []).find(x => x.id === item.product_id);
           if (!prod) return;
           
           // Filtros Universales para Movimientos
           if (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(prod.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return;
           if (filterCategory !== 'ALL' && prod.category !== filterCategory) return;
           if (filterSupplier !== 'ALL' && prod.supplier_id !== filterSupplier) return;

           const isCreditNote = p.document_type === 'NOTA_CREDITO' || p.document_type === 'NOTA CREDITO';
           list.push({
              id: `PUR-${p.id}-${item.product_id}`,
              date: p.issue_date, type: isCreditNote ? 'OUT' : 'IN', docType: p.document_type || 'COMPRA', docNumber: p.document_number || 'S/N',
              productName: prod.name || 'Desconocido', sku: prod.sku || 'S/N', quantity: item.quantity_base || 0,
              unitPrice: (item.quantity_base || 0) > 0 ? (item.total_cost || 0) / item.quantity_base : 0, 
              total: item.total_cost || 0, reference: p.supplier_name || 'Desconocido'
           });
        });
     });

     (dbSales || []).forEach(s => {
        const date = (s.created_at || new Date().toISOString()).split('T')[0];
        if (date < dateFrom || date > dateTo) return;
        (s.items || []).forEach(item => {
           const prod = (dbProducts || []).find(x => x.id === item.product_id);
           if (!prod) return;

           // Filtros Universales para Movimientos
           if (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(prod.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return;
           if (filterCategory !== 'ALL' && prod.category !== filterCategory) return;
           if (filterSupplier !== 'ALL' && prod.supplier_id !== filterSupplier) return;

           const isCreditNote = s.document_type === 'NOTA_CREDITO' || s.document_type === 'NOTA CREDITO';
           list.push({
              id: `SALE-${s.id}-${item.id}`,
              date: date, type: isCreditNote ? 'IN' : 'OUT', docType: s.document_type || 'VENTA', docNumber: `${s.series || ''}-${s.number || ''}`,
              productName: prod.name || 'Desconocido', sku: prod.sku || 'S/N', quantity: item.quantity_base || 0, 
              unitPrice: (item.quantity_base || 0) > 0 ? (item.total_price || 0) / item.quantity_base : 0,
              total: item.total_price || 0, reference: s.client_name || 'Desconocido'
           });
        });
     });

     (dbLiquidations || []).forEach(liq => {
        const date = (liq.date || new Date().toISOString()).split('T')[0];
        if (date < dateFrom || date > dateTo) return;
        (liq.documents || []).forEach(doc => {
           if (doc.action === 'PARTIAL_RETURN' || doc.action === 'VOID') {
              const sale = (dbSales || []).find(s => s.id === doc.sale_id);
              if (doc.action === 'VOID' && sale) {
                 (sale.items || []).forEach(item => {
                    const prod = (dbProducts || []).find(x => x.id === item.product_id);
                    if (!prod) return;
                    if (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(prod.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return;
                    if (filterCategory !== 'ALL' && prod.category !== filterCategory) return;
                    if (filterSupplier !== 'ALL' && prod.supplier_id !== filterSupplier) return;

                    list.push({
                       id: `VOID-${doc.sale_id}-${item.id}`,
                       date, type: 'IN', docType: 'ANULACION', docNumber: `${sale.series || ''}-${sale.number || ''}`,
                       productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: 'REINGRESO ALMACEN'
                    });
                 });
              }
               // PARTIAL_RETURN ya es manejado por dbSales al generar una NOTA_CREDITO
           }
        });
     });

     (dbTransfers || []).forEach(t => {
   const date = (t.created_at || new Date().toISOString()).split('T')[0];
   (t.items || []).forEach((item: any) => {
      const prod = (dbProducts || []).find(x => x.id === item.product_id);
      if (!prod) return;
      if (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(prod.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return;
      if (filterCategory !== 'ALL' && prod.category !== filterCategory) return;
      if (filterSupplier !== 'ALL' && prod.supplier_id !== filterSupplier) return;
      
      list.push({
         id: `TRF-OUT-${t.id}-${item.id}`,
         date, type: 'OUT', docType: 'TRASLADO', docNumber: t.document_number || 'MERMA/DAÑO',
         productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: `A: ${t.dest_warehouse_id}`
      });
      list.push({
         id: `TRF-IN-${t.id}-${item.id}`,
         date, type: 'IN', docType: 'TRASLADO', docNumber: t.document_number || 'MERMA/DAÑO',
         productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: `DE: ${t.origin_warehouse_id}`
      });
   });
});

     return list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dbSales, dbPurchases, dbLiquidations, dbTransfers, dbProducts, dateFrom, dateTo, searchTerm, filterCategory, filterSupplier]);

  const analyticsData = useMemo(() => {
     const byCategory: Record<string, number> = {};
     const bySupplier: Record<string, number> = {};
     inventorySnapshot.forEach(p => {
        byCategory[p.category || 'OTROS'] = (byCategory[p.category || 'OTROS'] || 0) + (p.totalValue || 0);
        bySupplier[p.supplierName || 'OTROS'] = (bySupplier[p.supplierName || 'OTROS'] || 0) + (p.totalValue || 0);
     });
     const catChart = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
     const supChart = Object.entries(bySupplier).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
     return { catChart, supChart, totalValuation: inventorySnapshot.reduce((acc, i) => acc + (i.totalValue || 0), 0) };
  }, [inventorySnapshot]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  const uniqueCategories = Array.from(new Set((dbProducts || []).map(p => p.category).filter(Boolean))).sort() as string[];

  const handleSort = (field: 'sku'|'name'|'category'|'supplier'|'stock'|'value') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder(field === 'name' || field === 'sku' ? 'asc' : 'desc'); }
  };

  const currentTotalValuation = useMemo(() => inventorySnapshot.reduce((a,b)=>a+(b.totalValue || 0), 0), [inventorySnapshot]);

  const exportExcel = () => {
    const dataToExport = activeTab === 'MOVEMENTS' ? movements.map(m => ({
      "Fecha": m.date, "Tipo": m.type, "Documento": `${m.docType} ${m.docNumber}`, "Producto": m.productName, "SKU": m.sku,
      "Cantidad": m.quantity, "P. Unitario": m.unitPrice, "Total": m.total, "Referencia": m.reference
    })) : inventorySnapshot.map(p => ({
      "Código SKU": p.sku || '', "Producto": p.name || '', "Categoría": p.category || '', "Marca": p.brand || '', "Proveedor": p.supplierName || '',
      "Stock Total (Base)": p.totalStock || 0, "Unidad Medida": p.unit_type || '', "Stock Empaques": p.stockPackages || 0, 
      "Costo Prom. Unit": parseFloat((p.avgCost || 0).toFixed(4)), "Valorización Total": parseFloat((p.totalValue || 0).toFixed(2)),
      "Estado": (p.totalStock || 0) <= (p.min_stock || 0) ? 'BAJO STOCK' : 'OPTIMO'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'MOVEMENTS' ? "Kardex_Movimientos" : "Kardex_Inventario");
    XLSX.writeFile(workbook, `Reporte_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18); doc.setTextColor(40, 40, 40); 
    doc.text(activeTab === 'MOVEMENTS' ? "Reporte de Movimientos (Kardex)" : "Reporte de Inventario Valorizado", 14, 22);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 14, 30);

    if (activeTab === 'MOVEMENTS') {
       const tableColumn = ["Fecha", "Tipo", "Documento", "Producto", "SKU", "Cant", "Total"];
       const tableRows = movements.map(m => [
         m.date, m.type === 'IN' ? 'INGRESO' : 'SALIDA', `${m.docType} ${m.docNumber}`, m.productName, m.sku, m.quantity.toString(), `S/ ${m.total.toFixed(2)}`
       ]);
       autoTable(doc, { head: [tableColumn], body: tableRows, startY: 38, theme: 'grid', styles: { fontSize: 8 } });
    } else {
       doc.text(`Total Capital Valorizado: S/ ${(currentTotalValuation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 36);
       const tableColumn = ["SKU", "Producto", "Categoría / Marca", "Proveedor", "Stock Total", "Costo Prom", "Valor Total"];
       const tableRows = inventorySnapshot.map(p => [
         p.sku || '', p.name || '', `${p.category || '-'} / ${p.brand || '-'}`, p.supplierName || '', `${p.totalStock || 0} ${p.unit_type || 'U'} ${p.stockPackages > 0 ? `(${p.stockPackages} CJ)` : ''}`, `S/ ${(p.avgCost || 0).toFixed(2)}`, `S/ ${(p.totalValue || 0).toFixed(2)}`
       ]);
       autoTable(doc, {
         head: [tableColumn], body: tableRows, startY: 48, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
         headStyles: { fillColor: [30, 41, 59] }, alternateRowStyles: { fillColor: [248, 250, 252] },
         columnStyles: { 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] } }
       });
    }
    doc.save(`Reporte_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-sans text-slate-800 relative">
       {/* --- CUSTOM ALERT MODAL --- */}
       {modalConfig.isOpen && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                {modalConfig.type === 'error' && <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />}
                {modalConfig.type === 'warning' && <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />}
                {modalConfig.type === 'info' && <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />}
                <h3 className="text-lg font-black text-slate-800 mb-2">{modalConfig.type === 'error' ? 'Error' : modalConfig.type === 'warning' ? 'Aviso' : 'Información'}</h3>
                <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap">{modalConfig.message}</p>
                <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Aceptar</button>
             </div>
          </div>
       )}

       {/* --- CUSTOM CONFIRM MODAL --- */}
       {confirmConfig.isOpen && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-800 mb-2">Confirmar Acción</h3>
                <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap">{confirmConfig.message}</p>
                <div className="flex gap-3">
                   <button onClick={() => setConfirmConfig({...confirmConfig, isOpen: false})} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                   <button onClick={() => { setConfirmConfig({...confirmConfig, isOpen: false}); confirmConfig.onConfirm(); }} className="flex-1 py-2 bg-amber-600 text-white rounded-lg font-bold shadow-lg hover:bg-amber-700">Sí, continuar</button>
                </div>
             </div>
          </div>
       )}
       {/* ENCABEZADO */}
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600 shadow-inner">
                <Package className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-900">Centro de Control de Inventario</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kardex, Lotes y Valorización de Activos</p>
             </div>
          </div>
          <div className="flex gap-2">
             {currentUser?.role === 'ADMIN' && (
                <button onClick={handleRecalculateKardex} disabled={isRecalculating} className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-red-200 font-bold text-sm disabled:opacity-50" title="Auditoría: Recalcular matemática del stock">
                   <Settings className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} /> {isRecalculating ? 'Recalculando...' : 'Recalcular Kardex'}
                </button>
             )}
             <button 
                onClick={() => {
                   if (activeTab === 'MOVEMENTS') {
                      fetchInventoryData().then(() => fetchMovementsData());
                   } else {
                      fetchInventoryData();
                   }
                }} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200 font-bold text-sm"
             >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin text-orange-600' : ''}`} /> Sincronizar
             </button>
             <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center transition-colors text-sm">
                <FileDown className="w-4 h-4 mr-2" /> Excel
             </button>
             <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center transition-colors text-sm">
                <Printer className="w-4 h-4 mr-2" /> PDF
             </button>
          </div>
       </div>

       {/* TABS */}
       <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
          <button onClick={() => {setActiveTab('INVENTORY'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'INVENTORY' ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Layers className="w-4 h-4 mr-2" /> 1. Inventario Físico
          </button>
          <button onClick={() => {setActiveTab('MOVEMENTS'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'MOVEMENTS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <ArrowUpDown className="w-4 h-4 mr-2" /> 2. Kardex Movimientos
          </button>
          <button onClick={() => {setActiveTab('BATCHES'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'BATCHES' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Calendar className="w-4 h-4 mr-2" /> 3. Lotes y Vencimientos
          </button>
          <button onClick={() => {setActiveTab('ANALYTICS'); setIsDataVisible(true);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'ANALYTICS' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <BarChart3 className="w-4 h-4 mr-2" /> 4. Reportes y Capital
          </button>
          <button onClick={() => {setActiveTab('RESERVATIONS'); setIsDataVisible(true);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'RESERVATIONS' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Trash2 className="w-4 h-4 mr-2" /> 5. Reservas (Pedidos)
          </button>
       </div>

       {/* BARRA DE FILTROS UNIVERSAL (VISIBLE EN INVENTORY, MOVEMENTS Y BATCHES) */}
       {activeTab !== 'ANALYTICS' && (
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end flex-1">
               <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Buscador Universal</label>
                  <div className="relative">
                     <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                     <input className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold focus:border-orange-500 outline-none transition-colors" placeholder="Buscar por SKU o Nombre..." value={searchTerm} onChange={e => handleFilterChange(setSearchTerm, e.target.value)} />
                  </div>
               </div>
               
               <div className="w-48">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Ubicación Lógica</label>
                  <select className={`w-full border-2 p-2.5 rounded-lg text-sm font-bold focus:outline-none transition-colors ${filterWarehouse === 'MERMAS' ? 'bg-red-50 text-red-700 border-red-300 focus:border-red-500' : 'bg-slate-50 text-slate-800 border-slate-200 focus:border-orange-500'}`} value={filterWarehouse} onChange={e => handleFilterChange(setFilterWarehouse, e.target.value as any)}>
                     <option value="CENTRAL">📦 ALMACÉN CENTRAL</option>
                     <option value="MERMAS">⚠️ CUARENTENA / MERMAS</option>
                  </select>
               </div>
               
               <div className="w-48">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
                  <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:border-orange-500 outline-none" value={filterCategory} onChange={e => handleFilterChange(setFilterCategory, e.target.value)}>
                     <option value="ALL">Todas las Familias</option>
                     {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
               </div>
               
               <div className="w-56">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Proveedor Origen</label>
                  <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:border-orange-500 outline-none" value={filterSupplier} onChange={e => handleFilterChange(setFilterSupplier, e.target.value)}>
                     <option value="ALL">Todos los Proveedores</option>
                     {(dbSuppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>

               {/* SELECTOR DE FECHAS (SOLO PARA MOVIMIENTOS) */}
               {activeTab === 'MOVEMENTS' && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border-2 border-slate-200 h-[44px]">
                     <Calendar className="w-4 h-4 text-slate-400" />
                     <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer" value={dateFrom} onChange={e => handleFilterChange(setDateFrom, e.target.value)} />
                     <span className="text-slate-300 font-bold">-</span>
                     <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer" value={dateTo} onChange={e => handleFilterChange(setDateTo, e.target.value)} />
                  </div>
               )}
            </div>

            {/* BOTÓN MOSTRAR (GATILLO DE DATOS) */}
            <button 
               onClick={() => {
                  if (activeTab === 'MOVEMENTS') {
                     fetchMovementsData().then(() => setIsDataVisible(true));
                  } else {
                     setIsDataVisible(true);
                  }
               }} 
               className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-black shadow-md flex items-center transition-all active:scale-95 text-sm h-[44px] ml-4"
            >
               <Eye className="w-4 h-4 mr-2" /> MOSTRAR DATOS
            </button>
         </div>
       )}

       <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          
          {/* PANTALLA DE BLOQUEO DE RENDIMIENTO */}
          {!isDataVisible && activeTab !== 'ANALYTICS' ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20">
                <Search className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Esperando Parámetros</h3>
                <p className="text-slate-400 font-medium mt-2">Seleccione los filtros arriba y haga clic en "MOSTRAR DATOS" para cargar la información.</p>
             </div>
          ) : null}

          {/* TAB: INVENTORY */}
          {activeTab === 'INVENTORY' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm border-b border-slate-200">
                       <tr>
                          <th className="p-4 w-28 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('sku')}>
                             <div className="flex items-center">Código {sortField === 'sku' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('name')}>
                             <div className="flex items-center">Producto {sortField === 'name' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('category')}>
                             <div className="flex items-center">Categoría / Marca {sortField === 'category' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('stock')}>
                             <div className="flex items-center justify-end">Stock Total Base {sortField === 'stock' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 text-right">Costo Promedio (Base)</th>
                          <th className="p-4 text-right text-blue-700 cursor-pointer hover:bg-slate-200 transition-colors bg-blue-50/30 border-l border-blue-100" onClick={() => handleSort('value')}>
                             <div className="flex items-center justify-end">Capital Inmovilizado {sortField === 'value' && <ArrowUpDown className="w-3 h-3 ml-1 text-blue-500" />}</div>
                          </th>
                          <th className="p-4 text-center">Salud de Stock</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {isLoading && inventorySnapshot.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-orange-500"/> Sincronizando Activos...</td></tr>
                      ) : inventorySnapshot.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">No se encontraron productos con los filtros actuales.</td></tr>
                      ) : inventorySnapshot.map(p => (
                         <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-4 font-mono font-bold text-slate-500">{p.sku}</td>
                            <td className="p-4">
                               <div className="font-black text-slate-800 text-base">{p.name}</div>
                               <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center"><Briefcase className="w-3 h-3 mr-1" /> {p.supplierName}</div>
                            </td>
                            <td className="p-4">
                               <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600 border border-slate-200 mr-2">{p.category || 'SIN CAT'}</span>
                               <span className="text-xs text-slate-500 font-bold">{p.brand}</span>
                            </td>
                            <td className="p-4 text-right">
                               <div className="font-black text-slate-900 text-lg">
                                  {p.totalStock} <span className="text-xs text-slate-400 font-bold ml-1">{p.unit_type || 'U'}</span>
                               </div>
                               {/* ETIQUETA VISUAL DE CAJAS/UNIDADES */}
                               {((p.package_content || 1) > 1) && (p.totalStock || 0) > 0 && (
                                  <div className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100 shadow-sm">
                                     {p.stockPackages} {p.package_type || 'CAJAS'} y {p.remainingBase} {p.unit_type || 'UND'}
                                  </div>
                               )}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-500">S/ {(p.avgCost || 0).toFixed(4)}</td>
                            <td className="p-4 text-right font-black text-blue-700 bg-blue-50/10 border-l border-blue-50 text-lg">S/ {(p.totalValue || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="p-4 text-center">
                               {(p.totalStock || 0) <= 0 ? (
                                  <span className="flex items-center justify-center text-red-600 text-[10px] font-black bg-red-100 px-3 py-1 rounded-full border border-red-200 shadow-sm">
                                     <AlertTriangle className="w-3 h-3 mr-1" /> AGOTADO
                                  </span>
                               ) : (p.totalStock || 0) <= (p.min_stock || 0) ? (
                                  <span className="flex items-center justify-center text-orange-600 text-[10px] font-black bg-orange-100 px-3 py-1 rounded-full border border-orange-200 shadow-sm animate-pulse">
                                     <AlertTriangle className="w-3 h-3 mr-1" /> STOCK BAJO
                                  </span>
                               ) : (
                                  <span className="flex items-center justify-center text-green-600 text-[10px] font-black bg-green-100 px-3 py-1 rounded-full border border-green-200 shadow-sm">
                                     <CheckCircle className="w-3 h-3 mr-1" /> ÓPTIMO
                                  </span>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-800 text-white font-black sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                      <tr>
                         <td colSpan={5} className="p-4 text-right uppercase tracking-wider text-xs text-slate-400">Capitalización Total en Almacén:</td>
                         <td className="p-4 text-right text-emerald-400 text-xl border-l border-slate-700">S/ {inventorySnapshot.reduce((a,b)=>a+(b.totalValue||0), 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          )}

          {/* TAB: MOVEMENTS (KARDEX) */}
          {activeTab === 'MOVEMENTS' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                      <tr>
                         <th className="p-4 w-32">Fecha (UTC)</th>
                         <th className="p-4 w-28 text-center">Naturaleza</th>
                         <th className="p-4">Documento Origen</th>
                         <th className="p-4">Producto Movilizado</th>
                         <th className="p-4 text-right">Cant. Base</th>
                         <th className="p-4 text-right">P. Unitario</th>
                         <th className="p-4 text-right">Importe Total</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {isLoading && movements.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500"/> Sincronizando Movimientos...</td></tr>
                      ) : movements.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">No hay movimientos registrados con estos filtros.</td></tr>
                      ) : movements.map((m, idx) => (
                         <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-500 font-mono text-xs font-bold">{m.date}</td>
                            <td className="p-4 text-center">
                               {m.type === 'IN' ? (
                                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-[9px] font-black flex items-center justify-center w-full border border-green-200 shadow-sm">
                                     <ArrowDownLeft className="w-3 h-3 mr-1" /> INGRESO
                                  </span>
                               ) : (
                                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-[9px] font-black flex items-center justify-center w-full border border-red-200 shadow-sm">
                                     <ArrowUpRight className="w-3 h-3 mr-1" /> SALIDA
                                  </span>
                               )}
                            </td>
                            <td className="p-4">
                               <div className="font-bold text-slate-800">{m.docType} {m.docNumber}</div>
                               <div className="text-[10px] text-slate-500 font-bold mt-0.5 truncate max-w-[200px]">{m.reference}</div>
                            </td>
                            <td className="p-4">
                               <div className="font-bold text-slate-900">{m.productName}</div>
                               <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {m.sku}</div>
                            </td>
                            <td className={`p-4 text-right font-black text-lg ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                               {m.type === 'IN' ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-500">
                               {(m?.unitPrice || 0) > 0 ? `S/ ${(m.unitPrice || 0).toFixed(2)}` : '-'}
                            </td>
                            <td className="p-4 text-right font-black text-slate-800">
                               {(m?.total || 0) > 0 ? `S/ ${(m.total || 0).toFixed(2)}` : '-'}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}

          {/* TAB: BATCHES (LOTES) */}
          {activeTab === 'BATCHES' && (
             <div className="flex-1 overflow-auto p-6 bg-slate-50">
                {isLoading && (dbBatches || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 font-bold"><RefreshCw className="w-8 h-8 animate-spin mb-4 text-purple-500"/> Sincronizando Lotes...</div>
                ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {(dbProducts || []).filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())).map(product => {
                         const batches = (dbBatches || []).filter(b => b.product_id === product.id && b.quantity_current > 0 && (filterWarehouse === 'CENTRAL' ? b.warehouse_id !== 'MERMAS' : b.warehouse_id === 'MERMAS')).sort((a,b) => new Date(a.expiration_date || '2099-01-01').getTime() - new Date(b.expiration_date || '2099-01-01').getTime());
                         if (batches.length === 0) return null;

                         return (
                            <div key={product.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                               <div className="bg-slate-900 p-4 text-white">
                                  <div className="flex justify-between items-start">
                                     <div className="pr-4">
                                        <h4 className="font-black text-sm leading-tight line-clamp-2">{product.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1">{product.sku}</p>
                                     </div>
                                     <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-black shadow-inner whitespace-nowrap">
                                        {batches.reduce((a,b)=>a+(b.quantity_current||0),0)} Und
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="p-4 space-y-3 flex-1 bg-slate-50 overflow-y-auto max-h-[300px]">
                                  {batches.map(batch => {
                                     const expDate = batch.expiration_date ? new Date(batch.expiration_date) : null;
                                     const daysLeft = (expDate && !isNaN(expDate.getTime())) ? Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 999;
                                     const isExpiring = daysLeft < 45; 
                                     const isCritical = daysLeft < 15;

                                     return (
                                        <div key={batch.id} className={`p-3 rounded-xl border-2 transition-colors flex justify-between items-center ${isCritical ? 'bg-red-50 border-red-200 shadow-sm' : isExpiring ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                                           <div>
                                              <div className="font-black text-slate-800 flex items-center text-sm">
                                                 <Hash className="w-3 h-3 mr-1 text-slate-400"/> {batch.code}
                                              </div>
                                              {batch.expiration_date ? (
                                                 <div className={`text-[10px] mt-1 font-bold flex items-center ${isCritical ? 'text-red-600' : isExpiring ? 'text-orange-600' : 'text-slate-500'}`}>
                                                    <Calendar className="w-3 h-3 mr-1"/> Vence: {batch.expiration_date} ({daysLeft}d)
                                                 </div>
                                              ) : (
                                                 <div className="text-[10px] mt-1 font-bold text-slate-400 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Sin Vencimiento</div>
                                              )}
                                           </div>
                                           <div className="text-right flex flex-col items-end">
                                              <div className="font-black text-xl text-slate-900">{batch.quantity_current}</div>
                                              <div className="text-[9px] text-slate-400 font-bold mb-2">Ingresó: {batch.quantity_initial}</div>
                                           </div>
                                        </div>
                                     );
                                  })}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'ANALYTICS' && (
             <div className="flex-1 overflow-auto p-8 bg-slate-50 animate-fade-in-up">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                   <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden border border-slate-800">
                      <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-24 h-24" /></div>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Valorización de Almacén Central</p>
                      <h3 className="text-4xl font-black tracking-tighter">S/ {(analyticsData.totalValuation || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                   </div>
                   <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-slate-200">
                      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Productos Activos en Catálogo</p>
                      <h3 className="text-4xl font-black text-blue-600 tracking-tighter">{inventorySnapshot.length}</h3>
                   </div>
                   <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-red-100">
                      <p className="text-red-500 text-xs font-black uppercase tracking-widest mb-2">Productos Críticos (Bajo Stock)</p>
                      <h3 className="text-4xl font-black text-red-600 tracking-tighter">{inventorySnapshot.filter(p => p.totalStock <= (p.min_stock || 0)).length}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-96">
                   <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col">
                      <h4 className="font-black text-slate-800 mb-6 text-center uppercase tracking-wider text-sm">Distribución de Capital por Categoría</h4>
                      <div className="flex-1">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie data={analyticsData.catChart} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                                  {analyticsData.catChart.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                               </Pie>
                               <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} />
                               <Legend />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col">
                      <h4 className="font-black text-slate-800 mb-6 text-center uppercase tracking-wider text-sm">Top Inversión por Proveedor</h4>
                      <div className="flex-1">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.supChart} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                               <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                               <XAxis type="number" hide />
                               <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 10, fill: '#475569', fontWeight: 'bold'}} />
                               <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                               <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                                  {analyticsData.supChart.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                               </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {/* TAB: RESERVATIONS (PEDIDOS PENDIENTES) */}
          {activeTab === 'RESERVATIONS' && (
             <div className="flex-1 overflow-auto p-6 bg-slate-50 animate-fade-in-up">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-5xl mx-auto">
                   <div className="flex items-center justify-between mb-6">
                      <div>
                         <h3 className="text-lg font-black text-slate-800 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-red-500" /> Pedidos Pendientes (Guardando Stock)</h3>
                         <p className="text-slate-500 text-xs mt-1">Estos pedidos tienen el stock reservado en el Kardex físico. Anúlalos para liberar la mercadería.</p>
                      </div>
                      <div className="flex gap-4 items-center">
                         <div className="w-64">
                            <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold focus:border-red-500 outline-none text-slate-600 bg-slate-50" value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
                               <option value="ALL">👤 Todos los Vendedores</option>
                               {Array.from(new Set(dbPendingOrders.map(o => o.seller_id))).map(sid => {
                                  const u = dbUsers.find(x => x.id === sid);
                                  return <option key={sid} value={sid}>{u?.full_name || u?.email || sid}</option>
                               })}
                            </select>
                         </div>
                         <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg font-black text-sm border border-red-100">{filteredPendingOrders.length} Pedidos</div>
                      </div>
                   </div>

                   {filteredPendingOrders.length > 0 && (
                      <div className="flex justify-between items-center mb-4 bg-slate-100 p-3 rounded-xl border border-slate-200">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                               checked={selectedOrders.size > 0 && selectedOrders.size === filteredPendingOrders.length}
                               onChange={toggleAllOrders}
                            />
                            <span className="font-bold text-slate-700 text-sm">Seleccionar Todos ({filteredPendingOrders.length})</span>
                         </label>
                         {selectedOrders.size > 0 && (
                            <button onClick={() => handleAnnulOrder()} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center shadow-sm disabled:opacity-50">
                               {isProcessing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                               Anular {selectedOrders.size} Selección
                            </button>
                         )}
                      </div>
                   )}
                   
                   <div className="space-y-4">
                      {filteredPendingOrders.length === 0 ? (
                         <div className="text-center p-8 text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            No hay pedidos pendientes reteniendo stock para este filtro.
                         </div>
                      ) : filteredPendingOrders.map(order => {
                         const seller = dbUsers.find(u => u.id === order.seller_id);
                         const sellerName = seller?.full_name || seller?.email || 'Vendedor Desconocido';
                         
                         return (
                         <div key={order.id} className={`border-2 rounded-xl overflow-hidden shadow-sm transition-all ${selectedOrders.has(order.id) ? 'border-red-400 bg-red-50/10' : 'border-slate-200 hover:shadow-md'}`}>
                            <div className={`p-4 border-b flex justify-between items-center cursor-pointer transition-colors ${selectedOrders.has(order.id) ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`} onClick={() => toggleOrderSelection(order.id)}>
                               <div className="flex items-center gap-4">
                                  <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" checked={selectedOrders.has(order.id)} readOnly />
                                  <div>
                                     <div className="font-black text-slate-800">{order.code} - {order.client_name}</div>
                                     <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                                        <span><Calendar className="w-3 h-3 inline mr-1"/>{new Date(order.created_at).toLocaleString()}</span>
                                        <span className="font-bold text-slate-600"><Briefcase className="w-3 h-3 inline mr-1 text-blue-500"/>{sellerName}</span>
                                     </div>
                                  </div>
                               </div>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); handleAnnulOrder(order.id); }}
                                  disabled={isProcessing}
                                  className="bg-white text-red-600 hover:bg-red-600 hover:text-white border border-red-200 px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center disabled:opacity-50 shadow-sm"
                               >
                                  {isProcessing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                  Anular Individual
                               </button>
                            </div>
                            <div className="p-4 bg-white">
                               <table className="w-full text-xs text-left">
                                  <thead>
                                     <tr className="text-slate-400 border-b border-slate-100">
                                        <th className="pb-2">Producto</th>
                                        <th className="pb-2">SKU Original</th>
                                        <th className="pb-2 text-right">Cant. Total</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                     {(order.items || []).map((item: any, idx: number) => {
                                        const prodDef = dbProducts.find(p => p.id === item.product_id);
                                        const skuStr = prodDef?.sku || item.product_sku || 'N/A';
                                        
                                        return (
                                        <tr key={idx}>
                                           <td className="py-2 font-bold text-slate-700">{item.product_name}</td>
                                           <td className="py-2 text-slate-500 font-mono bg-slate-50 px-2 rounded">{skuStr}</td>
                                           <td className="py-2 text-right font-black text-red-600">{item.quantity_base || item.quantity} UND</td>
                                        </tr>
                                     )})}
                                  </tbody>
                               </table>
                            </div>
                         </div>
                      )})}
                   </div>
                </div>
             </div>
          )}

       </div>
    </div>
  );
};

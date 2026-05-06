import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BarChart3, PieChart, Calendar, Download, Printer, Filter, TrendingUp, DollarSign, Users, Target, Layers, ShoppingBag, MapPin, X, FileDown, Edit3, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Client, Zone, Seller, Supplier, Product, Quota } from '../types';

// --- HELPER FUNCTIONS ---
const getWorkingDaysInRange = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    let count = 0;
    const curDate = new Date(start);
    while (curDate <= end) {
        if (curDate.getDay() !== 0) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count === 0 ? 1 : count;
};

const getWorkingDaysPassed = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);
    const now = new Date();
    if (isNaN(start.getTime())) return 1;
    if (start > now) return 0;
    const limit = now > end ? end : now;
    let count = 0;
    const curDate = new Date(start);
    while (curDate <= limit) {
        if (curDate.getDay() !== 0) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count === 0 ? 1 : count;
};

type Dimension = 'SELLER' | 'CLIENT' | 'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'ZONE' | 'MONTH';
type Tab = 'HISTORICAL' | 'PROJECTION' | 'SELLER_ADVANCE' | 'COMPANY_ADVANCE';

interface AggregatedRow {
  id: string;
  label: string;
  value: number;
  cost: number;
  margin: number;
  clients: Set<string>;
  itemsSold: number;
  percentage: number; 
}

export const StrategicReports: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  // --- SUPABASE DATA STATES ---
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<Tab>('HISTORICAL');
  const [viewType, setViewType] = useState<'TABLE' | 'CHART'>('TABLE');
  
  // --- DATE FILTERS ---
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  
  // --- DIMENSIONAL FILTERS (DRILL-DOWN) ---
  const [filterSeller, setFilterSeller] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterZone, setFilterZone] = useState('');

  // --- CONFIG ---
  const [groupBy, setGroupBy] = useState<Dimension>('SELLER');
  const [projectionGoal, setProjectionGoal] = useState<number>(50000);

  // --- FETCH DATA FROM SUPABASE ---
  const fetchData = async () => {
     setIsLoading(true);
     try {
        const startDate = `${dateFrom}T00:00:00.000Z`;
        const endDate = `${dateTo}T23:59:59.999Z`;

        const [salesRes, clientsRes, zonesRes, sellersRes, suppliersRes, productsRes, quotasRes] = await Promise.all([
           supabase.from('sales').select('*, items:sale_items(*)').gte('created_at', startDate).lte('created_at', endDate),
           supabase.from('clients').select('*'),
           supabase.from('zones').select('*'),
           supabase.from('sellers').select('*'),
           supabase.from('suppliers').select('*'),
           supabase.from('products').select('*'),
           supabase.from('quotas').select('*')
        ]);

        if (salesRes.data) setSales(salesRes.data);
        if (clientsRes.data) setClients(clientsRes.data);
        if (zonesRes.data) setZones(zonesRes.data);
        if (sellersRes.data) setSellers(sellersRes.data);
        if (suppliersRes.data) setSuppliers(suppliersRes.data);
        if (productsRes.data) setProducts(productsRes.data);
        if (quotasRes.data) setQuotas(quotasRes.data);

     } catch (err) {
        console.error("Error fetching report data", err);
     } finally {
        setIsLoading(false);
     }
  };

  useEffect(() => {
     fetchData();
  }, [dateFrom, dateTo]); // Refetch when dates change

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[], [products]);

  // --- DYNAMIC PROJECTION GOAL ---
  const dynamicProjectionGoal = useMemo(() => {
     const periodStr = dateFrom.substring(0, 7);
     let matchedQuotas = quotas.filter(q => q.period === periodStr);
     
     if (filterSeller) matchedQuotas = matchedQuotas.filter(q => q.seller_id === filterSeller);
     
     // CRITICAL FIX: To avoid double counting, we must choose which target_type to sum based on filters
     if (filterSupplier) {
         matchedQuotas = matchedQuotas.filter(q => q.target_type === 'SUPPLIER' && q.target_id === filterSupplier);
     } else if (filterCategory) {
         matchedQuotas = matchedQuotas.filter(q => q.target_type === 'CATEGORY' && q.target_id === filterCategory);
     } else {
         // If no specific target filter, sum only GLOBAL quotas
         matchedQuotas = matchedQuotas.filter(q => q.target_type === 'GLOBAL');
     }
     
     const total = matchedQuotas.reduce((acc, q) => acc + q.amount, 0);
     return total > 0 ? total : projectionGoal;
  }, [quotas, dateFrom, filterSeller, filterSupplier, filterCategory, projectionGoal]);

  // --- ENGINE: CORE AGGREGATION LOGIC ---
  const processedData = useMemo(() => {
    const validSales = sales.filter(s => s.status !== 'canceled');

    const groups: Record<string, AggregatedRow> = {};
    const uniqueClientsGlobal = new Set<string>();
    let totalGlobalSales = 0;
    let totalGlobalCost = 0;

    validSales.forEach(sale => {
       const client = clients.find(c => c.id === sale.client_id) || clients.find(c => c.doc_number === sale.client_ruc);
       const zone = zones.find(z => z.id === client?.zone_id);
       const seller = sellers.find(s => s.id === zone?.assigned_seller_id);

       const matchesSeller = !filterSeller || zone?.assigned_seller_id === filterSeller;
       const matchesZone = !filterZone || zone?.id === filterZone;
       
       if (!matchesSeller || !matchesZone) return;

       if (sale.items && Array.isArray(sale.items)) {
           sale.items.forEach((item: any) => {
              const product = products.find(p => p.id === item.product_id);
              
              if (filterSupplier && product?.supplier_id !== filterSupplier) return;
              if (filterCategory && product?.category !== filterCategory) return;
              
              let key = 'UNKNOWN';
              let label = 'Otros';

              switch (groupBy) {
                 case 'SELLER':
                    key = seller?.id || 'DIRECT';
                    label = seller?.name || 'VENTA DIRECTA';
                    break;
                 case 'CLIENT':
                    key = client?.id || sale.client_ruc;
                    label = sale.client_name;
                    break;
                 case 'SUPPLIER':
                    const sup = suppliers.find(s => s.id === product?.supplier_id);
                    key = sup?.id || 'UNKNOWN';
                    label = sup?.name || 'SIN PROVEEDOR';
                    break;
                 case 'CATEGORY':
                    key = product?.category || 'OTROS';
                    label = product?.category || 'OTROS';
                    break;
                 case 'BRAND':
                    key = product?.brand || 'OTROS';
                    label = product?.brand || 'OTROS';
                    break;
                 case 'ZONE':
                    key = zone?.id || 'UNKNOWN';
                    label = zone?.name || 'SIN ZONA';
                    break;
                 case 'MONTH':
                    const d = new Date(sale.created_at);
                    key = `${d.getFullYear()}-${d.getMonth()}`;
                    label = d.toLocaleString('es-PE', { month: 'long', year: 'numeric' }).toUpperCase();
                    break;
              }

              const itemSaleValue = item.total_price || 0;
              const itemCostValue = (product?.last_cost || 0) * (item.quantity_base || 0);
              
              if (!groups[key]) {
                 groups[key] = { id: key, label, value: 0, cost: 0, margin: 0, clients: new Set(), itemsSold: 0, percentage: 0 };
              }

              groups[key].value += itemSaleValue;
              groups[key].cost += itemCostValue;
              groups[key].itemsSold += item.quantity_presentation || 0;
              groups[key].clients.add(sale.client_ruc);

              uniqueClientsGlobal.add(sale.client_ruc);
              totalGlobalSales += itemSaleValue;
              totalGlobalCost += itemCostValue;
           });
       }
    });

    const result = Object.values(groups).map(g => ({
       ...g,
       margin: g.value - g.cost,
       percentage: totalGlobalSales > 0 ? (g.value / totalGlobalSales) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    return {
       rows: result,
       kpis: {
          totalSales: totalGlobalSales,
          totalCost: totalGlobalCost,
          grossMargin: totalGlobalSales - totalGlobalCost,
          uniqueClients: uniqueClientsGlobal.size,
          itemsSold: result.reduce((acc, r) => acc + r.itemsSold, 0)
       }
    };
  }, [sales, filterSeller, filterSupplier, filterCategory, filterZone, groupBy, clients, products, sellers, zones, suppliers]);

  // --- PROJECTION ENGINE ---
  const projectionData = useMemo(() => {
     if (activeTab !== 'PROJECTION') return null;

     const currentMonthSales = processedData.kpis.totalSales; 
     const totalDaysInRange = getWorkingDaysInRange(dateFrom, dateTo);
     const daysPassed = getWorkingDaysPassed(dateFrom, dateTo);
     
     const dailyRunRate = daysPassed > 0 ? currentMonthSales / daysPassed : 0;
     const projectedSales = dailyRunRate * totalDaysInRange;
     const percentageOfGoal = (projectedSales / dynamicProjectionGoal) * 100;

     return {
        currentSales: currentMonthSales,
        daysPassed,
        totalDays: totalDaysInRange,
        dailyAverage: dailyRunRate,
        projectedTotal: projectedSales,
        gap: dynamicProjectionGoal - projectedSales,
        percentage: percentageOfGoal,
        goalUsed: dynamicProjectionGoal
     };

  }, [processedData, dateFrom, dateTo, dynamicProjectionGoal, activeTab]);

  // --- SELLER ADVANCE ENGINE ---
  const sellerAdvanceData = useMemo(() => {
     if (activeTab !== 'SELLER_ADVANCE') return [];

     // FIXED: Calculate total working days in the month, safely parsing dates without UTC offsets
     const [yearStr, monthStr] = dateFrom.split('-');
     const year = parseInt(yearStr, 10);
     const month = parseInt(monthStr, 10);
     
     const firstDayOfMonth = `${yearStr}-${monthStr}-01`;
     const lastDay = new Date(year, month, 0).getDate();
     const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
     
     const totalDaysInMonth = getWorkingDaysInRange(firstDayOfMonth, endOfMonth);
     
     let daysPassed = getWorkingDaysPassed(firstDayOfMonth, dateTo);
     if (daysPassed === 0) daysPassed = 1;

     let remainingDays = totalDaysInMonth - daysPassed;
     if (remainingDays <= 0) remainingDays = 1; // Prevenir división por cero

     const validSales = sales.filter(s => s.status !== 'canceled');

     return sellers.map(seller => {
        const sellerZones = zones.filter(z => z.assigned_seller_id === seller.id).map(z => z.id);
        
        let globalSales = 0;
        const supplierSalesMap: Record<string, number> = {};

        validSales.forEach(s => {
           const c = clients.find(cl => cl.id === s.client_id || cl.doc_number === s.client_ruc);
           if (c && sellerZones.includes(c.zone_id)) {
               if (s.items && Array.isArray(s.items)) {
                  s.items.forEach((item: any) => {
                     const product = products.find(p => p.id === item.product_id);
                     if (product && product.supplier_id) {
                        supplierSalesMap[product.supplier_id] = (supplierSalesMap[product.supplier_id] || 0) + (item.total_price || 0);
                     }
                     globalSales += (item.total_price || 0);
                  });
               }
           }
        });

        const periodStr = dateFrom.substring(0, 7);
        const globalQuotaRow = quotas.find(q => q.seller_id === seller.id && q.period === periodStr && q.target_type === 'GLOBAL');
        const globalQuota = globalQuotaRow?.amount || 0;

        const globalProjected = (globalSales / daysPassed) * totalDaysInMonth;
        const globalProjPct = globalQuota > 0 ? (globalProjected / globalQuota) * 100 : 0;
        const globalPct = globalQuota > 0 ? (globalSales / globalQuota) * 100 : 0;
        const globalDailyRequired = globalQuota > globalSales ? (globalQuota - globalSales) / remainingDays : 0;

        const supplierRows: any[] = [];
        suppliers.forEach(supplier => {
           const quotaRow = quotas.find(q => q.seller_id === seller.id && q.period === periodStr && q.target_type === 'SUPPLIER' && q.target_id === supplier.id);
           const assignedQuota = quotaRow?.amount || 0;
           const currentSales = supplierSalesMap[supplier.id] || 0;
           
           if (assignedQuota > 0 || currentSales > 0) {
              const projected = (currentSales / daysPassed) * totalDaysInMonth;
              const projPct = assignedQuota > 0 ? (projected / assignedQuota) * 100 : 0;
              const currentPct = assignedQuota > 0 ? (currentSales / assignedQuota) * 100 : 0;
              const dailyRequired = assignedQuota > currentSales ? (assignedQuota - currentSales) / remainingDays : 0;
              
              supplierRows.push({
                 supplierId: supplier.id,
                 supplierName: supplier.name,
                 assignedQuota,
                 currentSales,
                 currentPct,
                 projected,
                 projPct,
                 gap: assignedQuota - projected,
                 dailyRequired
              });
           }
        });

        return {
           seller,
           globalQuota,
           globalSales,
           globalPct,
           globalProjected,
           globalProjPct,
           globalGap: globalQuota - globalProjected,
           globalDailyRequired,
           suppliers: supplierRows.sort((a,b) => b.currentSales - a.currentSales)
        };
     }).sort((a, b) => b.globalSales - a.globalSales);
  }, [sales, activeTab, dateFrom, dateTo, sellers, zones, clients, quotas, suppliers, products]);

   // --- COMPANY ADVANCE ENGINE ---
   const companyAdvanceData = useMemo(() => {
      if (activeTab !== 'COMPANY_ADVANCE') return null;
 
      const [yearStr, monthStr] = dateFrom.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      
      const firstDayOfMonth = `${yearStr}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      
      const totalDaysInMonth = getWorkingDaysInRange(firstDayOfMonth, endOfMonth);
      
      let daysPassed = getWorkingDaysPassed(firstDayOfMonth, dateTo);
      if (daysPassed === 0) daysPassed = 1;
 
      let remainingDays = totalDaysInMonth - daysPassed;
      if (remainingDays <= 0) remainingDays = 1;
 
      const validSales = sales.filter(s => s.status !== 'canceled');
 
      let globalSales = 0;
      const supplierSalesMap: Record<string, number> = {};
      const categorySalesMap: Record<string, number> = {};
      const sellerContributionMap: Record<string, number> = {};
 
      validSales.forEach(s => {
          const c = clients.find(cl => cl.id === s.client_id || cl.doc_number === s.client_ruc);
          const z = zones.find(zn => zn.id === c?.zone_id);
          const sId = z?.assigned_seller_id || 'UNKNOWN';
          
          if (s.items && Array.isArray(s.items)) {
             s.items.forEach((item: any) => {
                const product = products.find(p => p.id === item.product_id);
                const itemTotal = item.total_price || 0;
                
                if (product) {
                   if (product.supplier_id) {
                      supplierSalesMap[product.supplier_id] = (supplierSalesMap[product.supplier_id] || 0) + itemTotal;
                   }
                   if (product.category) {
                      categorySalesMap[product.category] = (categorySalesMap[product.category] || 0) + itemTotal;
                   }
                }
                globalSales += itemTotal;
                sellerContributionMap[sId] = (sellerContributionMap[sId] || 0) + itemTotal;
             });
          }
      });
 
      const periodStr = dateFrom.substring(0, 7);
      
      const globalQuotaRow = quotas.find(q => !q.seller_id && q.period === periodStr && q.target_type === 'GLOBAL');
      const globalQuota = globalQuotaRow?.amount || 0;
 
      const globalProjected = (globalSales / daysPassed) * totalDaysInMonth;
      const globalProjPct = globalQuota > 0 ? (globalProjected / globalQuota) * 100 : 0;
      const globalPct = globalQuota > 0 ? (globalSales / globalQuota) * 100 : 0;
      const globalDailyRequired = globalQuota > globalSales ? (globalQuota - globalSales) / remainingDays : 0;
 
      const supplierRows: any[] = [];
      suppliers.forEach(supplier => {
         const quotaRow = quotas.find(q => !q.seller_id && q.period === periodStr && q.target_type === 'SUPPLIER' && q.target_id === supplier.id);
         const assignedQuota = quotaRow?.amount || 0;
         const currentSales = supplierSalesMap[supplier.id] || 0;
         
         if (assignedQuota > 0 || currentSales > 0) {
            const projected = (currentSales / daysPassed) * totalDaysInMonth;
            const projPct = assignedQuota > 0 ? (projected / assignedQuota) * 100 : 0;
            const currentPct = assignedQuota > 0 ? (currentSales / assignedQuota) * 100 : 0;
            const dailyRequired = assignedQuota > currentSales ? (assignedQuota - currentSales) / remainingDays : 0;
            
            supplierRows.push({
               id: supplier.id, name: supplier.name, type: 'Proveedor',
               assignedQuota, currentSales, currentPct, projected, projPct,
               gap: assignedQuota - projected, dailyRequired
            });
         }
      });
      
      const categoryRows: any[] = [];
      categories.forEach(cat => {
         const quotaRow = quotas.find(q => !q.seller_id && q.period === periodStr && q.target_type === 'CATEGORY' && q.target_id === cat);
         const assignedQuota = quotaRow?.amount || 0;
         const currentSales = categorySalesMap[cat] || 0;
         
         if (assignedQuota > 0 || currentSales > 0) {
            const projected = (currentSales / daysPassed) * totalDaysInMonth;
            const projPct = assignedQuota > 0 ? (projected / assignedQuota) * 100 : 0;
            const currentPct = assignedQuota > 0 ? (currentSales / assignedQuota) * 100 : 0;
            const dailyRequired = assignedQuota > currentSales ? (assignedQuota - currentSales) / remainingDays : 0;
            
            categoryRows.push({
               id: cat, name: cat, type: 'Categoría',
               assignedQuota, currentSales, currentPct, projected, projPct,
               gap: assignedQuota - projected, dailyRequired
            });
         }
      });
 
      const topContributors = Object.entries(sellerContributionMap)
         .map(([sId, amount]) => {
            const seller = sellers.find(s => s.id === sId);
            return {
               sellerName: seller?.name || 'Venta Directa',
               amount,
               percentageOfGlobal: globalSales > 0 ? (amount / globalSales) * 100 : 0
            };
         })
         .sort((a, b) => b.amount - a.amount);
 
      return {
         globalQuota, globalSales, globalPct, globalProjected, globalProjPct,
         globalGap: globalQuota - globalProjected, globalDailyRequired,
         detailedRows: [...supplierRows, ...categoryRows].sort((a,b) => b.currentSales - a.currentSales),
         topContributors
      };
   }, [sales, activeTab, dateFrom, dateTo, quotas, suppliers, categories, products, sellers, clients, zones]);

  // --- EXPORT LOGIC ---
  const handleExportExcel = () => {
    if (activeTab === 'SELLER_ADVANCE') {
        const flatData: any[] = [];
        sellerAdvanceData.forEach(row => {
            flatData.push({
                'Vendedor': row.seller.name,
                'Proveedor / Meta': 'META GLOBAL',
                'Cuota Mes (S/)': row.globalQuota.toFixed(2),
                'Venta Actual (S/)': row.globalSales.toFixed(2),
                'Avance %': row.globalPct.toFixed(2),
                'Proy. Cierre (S/)': row.globalProjected.toFixed(2),
                'Proj. %': row.globalProjPct.toFixed(2),
                'Req. Diario (S/)': row.globalDailyRequired.toFixed(2)
            });
            row.suppliers.forEach((sup: any) => {
               flatData.push({
                'Vendedor': row.seller.name,
                'Proveedor / Meta': sup.supplierName,
                'Cuota Mes (S/)': sup.assignedQuota.toFixed(2),
                'Venta Actual (S/)': sup.currentSales.toFixed(2),
                'Avance %': sup.currentPct.toFixed(2),
                'Proy. Cierre (S/)': sup.projected.toFixed(2),
                'Proj. %': sup.projPct.toFixed(2),
                'Req. Diario (S/)': sup.dailyRequired.toFixed(2)
               });
            });
        });
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Avance Vendedores");
        XLSX.writeFile(wb, `Avance_Vendedores_${dateFrom}_al_${dateTo}.xlsx`);
    } else if (activeTab === 'COMPANY_ADVANCE' && companyAdvanceData) {
        const flatData: any[] = [];
        flatData.push({
            'Segmento': 'META GLOBAL EMPRESA',
            'Tipo': 'Global',
            'Cuota Mes (S/)': companyAdvanceData.globalQuota.toFixed(2),
            'Venta Actual (S/)': companyAdvanceData.globalSales.toFixed(2),
            'Avance %': companyAdvanceData.globalPct.toFixed(2),
            'Proy. Cierre (S/)': companyAdvanceData.globalProjected.toFixed(2),
            'Proj. %': companyAdvanceData.globalProjPct.toFixed(2),
            'Req. Diario (S/)': companyAdvanceData.globalDailyRequired.toFixed(2)
        });
        companyAdvanceData.detailedRows.forEach((row: any) => {
            flatData.push({
                'Segmento': row.name,
                'Tipo': row.type,
                'Cuota Mes (S/)': row.assignedQuota.toFixed(2),
                'Venta Actual (S/)': row.currentSales.toFixed(2),
                'Avance %': row.currentPct.toFixed(2),
                'Proy. Cierre (S/)': row.projected.toFixed(2),
                'Proj. %': row.projPct.toFixed(2),
                'Req. Diario (S/)': row.dailyRequired.toFixed(2)
            });
        });
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Empresa");
        
        const wsContrib = XLSX.utils.json_to_sheet(companyAdvanceData.topContributors.map((c: any) => ({
            'Vendedor': c.sellerName,
            'Aporte (S/)': c.amount.toFixed(2),
            'Participación (%)': c.percentageOfGlobal.toFixed(2)
        })));
        XLSX.utils.book_append_sheet(wb, wsContrib, "Aportantes");

        XLSX.writeFile(wb, `Resumen_Empresa_${dateFrom}_al_${dateTo}.xlsx`);
    } else {
        const ws = XLSX.utils.json_to_sheet(processedData.rows.map(r => ({
          'Segmento': r.label,
          'Ventas (S/)': r.value.toFixed(2),
          'Costo Aprox (S/)': r.cost.toFixed(2),
          'Margen Bruto (S/)': r.margin.toFixed(2),
          'Participación (%)': r.percentage.toFixed(2),
          'Cant. Items': r.itemsSold,
          'Cobertura (Clientes)': r.clients.size
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Estratégico");
        XLSX.writeFile(wb, `Reporte_${groupBy}_${dateFrom}_al_${dateTo}.xlsx`);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Professional Header
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138); // Blue 900
    doc.text("ERP PROFESIONAL - REPORTE DE BUSINESS INTELLIGENCE", 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    
    if (activeTab === 'SELLER_ADVANCE') {
        doc.text(`Módulo: Avance Detallado por Vendedor y Proveedor`, 14, 28);
        doc.setFontSize(9);
        doc.text(`Periodo evaluado: ${dateFrom} al ${dateTo}`, 14, 34);

        const body: any[] = [];
        sellerAdvanceData.forEach(row => {
            body.push([
                { content: row.seller.name, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
                { content: `S/ ${row.globalQuota.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `S/ ${row.globalSales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [29, 78, 216] } },
                { content: `${row.globalPct.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `S/ ${row.globalProjected.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `${row.globalProjPct.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `S/ ${row.globalDailyRequired.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [217, 119, 6] } },
            ]);
            row.suppliers.forEach((sup: any) => {
               body.push([
                   '',
                   sup.supplierName,
                   sup.assignedQuota > 0 ? `S/ ${sup.assignedQuota.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : '-',
                   `S/ ${sup.currentSales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
                   `${sup.currentPct.toFixed(1)}%`,
                   `S/ ${sup.projected.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
                   `${sup.projPct.toFixed(1)}%`,
                   `S/ ${sup.dailyRequired.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
               ]);
            });
        });

        autoTable(doc, {
            startY: 40,
            head: [['Vendedor', 'Proveedor', 'Cuota (S/)', 'Venta (S/)', 'Avance %', 'Proy. Cierre', 'Proy %', 'Req. Diario']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138], textColor: 255 }, 
            styles: { fontSize: 7, cellPadding: 1 },
            columnStyles: {
               0: { cellWidth: 32 },
               1: { cellWidth: 32 },
            }
        });
        
        doc.save(`Avance_Vendedores_${dateFrom}_al_${dateTo}.pdf`);

    } else if (activeTab === 'COMPANY_ADVANCE' && companyAdvanceData) {
        doc.text(`Módulo: Resumen de Ventas Empresa`, 14, 28);
        doc.setFontSize(9);
        doc.text(`Periodo evaluado: ${dateFrom} al ${dateTo}`, 14, 34);

        const body: any[] = [];
        body.push([
            { content: 'META GLOBAL EMPRESA', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [30, 58, 138], textColor: 255 } },
            `S/ ${companyAdvanceData.globalQuota.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
            `S/ ${companyAdvanceData.globalSales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
            `${companyAdvanceData.globalPct.toFixed(1)}%`,
            `S/ ${companyAdvanceData.globalProjected.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
            `S/ ${companyAdvanceData.globalDailyRequired.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
        ]);

        companyAdvanceData.detailedRows.forEach((row: any) => {
            body.push([
                row.name,
                row.type,
                row.assignedQuota > 0 ? `S/ ${row.assignedQuota.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : '-',
                `S/ ${row.currentSales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
                `${row.currentPct.toFixed(1)}%`,
                `S/ ${row.projected.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`,
                `S/ ${row.dailyRequired.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
            ]);
        });

        autoTable(doc, {
            startY: 40,
            head: [['Segmento', 'Tipo', 'Cuota (S/)', 'Venta (S/)', 'Avance %', 'Proy. Cierre', 'Req. Diario']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138], textColor: 255 }, 
            styles: { fontSize: 7, cellPadding: 1 }
        });
        
        doc.save(`Resumen_Empresa_${dateFrom}_al_${dateTo}.pdf`);
    } else {
        doc.text(`Módulo: Análisis Histórico por ${groupBy}`, 14, 28);
        doc.setFontSize(9);
        doc.text(`Periodo evaluado: ${dateFrom} al ${dateTo}`, 14, 34);
        doc.text(`Total Ventas: S/ ${processedData.kpis.totalSales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 14, 40);
        
        autoTable(doc, {
          startY: 45,
          head: [['Segmento', 'Ventas (S/)', 'Margen (S/)', 'Part. %', 'Cobertura']],
          body: processedData.rows.map(r => [
             r.label, 
             `S/ ${r.value.toFixed(2)}`, 
             `S/ ${r.margin.toFixed(2)}`, 
             `${r.percentage.toFixed(1)}%`,
             r.clients.size
          ]),
          theme: 'grid',
          headStyles: { fillColor: [30, 58, 138], textColor: 255 }, 
        });
        
        doc.save(`Reporte_${groupBy}_${dateFrom}_al_${dateTo}.pdf`);
    }
  };

  return (
    <div className="h-full flex flex-col font-sans text-slate-800 space-y-4">
      {/* HEADER & TOP FILTERS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
         <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
            <h2 className="text-2xl font-black flex items-center text-slate-800 tracking-tight">
               <BarChart3 className="mr-3 w-8 h-8 text-blue-600" /> Reportes & BI
            </h2>
            <div className="flex items-center gap-3">
               <button onClick={fetchData} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center font-bold">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
               </button>
               <button onClick={handleExportExcel} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
                  <FileDown className="w-4 h-4 mr-2" /> Excel
               </button>
               <button onClick={handleExportPDF} className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
                  <Printer className="w-4 h-4 mr-2" /> PDF
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="col-span-1 lg:col-span-2 flex gap-2">
               <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Desde</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:border-blue-500 outline-none" />
               </div>
               <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hasta</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:border-blue-500 outline-none" />
               </div>
            </div>

            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agrupar Por</label>
               <select value={groupBy} onChange={e => setGroupBy(e.target.value as Dimension)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-bold text-blue-800 bg-blue-50 focus:border-blue-500 outline-none">
                  <option value="SELLER">Vendedor</option>
                  <option value="CLIENT">Cliente</option>
                  <option value="SUPPLIER">Proveedor (Marca)</option>
                  <option value="CATEGORY">Categoría</option>
                  <option value="BRAND">Línea/Sub-Marca</option>
                  <option value="ZONE">Zona Geográfica</option>
                  <option value="MONTH">Mes (Histórico)</option>
               </select>
            </div>

            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Filtro: Vendedor</label>
               <select value={filterSeller} onChange={e => setFilterSeller(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:border-blue-500 outline-none bg-slate-50">
                  <option value="">-- Todos --</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
            
            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Filtro: Proveedor</label>
               <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:border-blue-500 outline-none bg-slate-50">
                  <option value="">-- Todos --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Filtro: Categoría</label>
               <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:border-blue-500 outline-none bg-slate-50">
                  <option value="">-- Todas --</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center text-slate-400 mb-2">
               <DollarSign className="w-5 h-5 mr-2 text-blue-500" />
               <h4 className="text-xs font-bold uppercase tracking-widest">Venta Total</h4>
            </div>
            <div className="text-3xl font-black text-slate-800">S/ {processedData.kpis.totalSales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center text-slate-400 mb-2">
               <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" />
               <h4 className="text-xs font-bold uppercase tracking-widest">Margen Bruto</h4>
            </div>
            <div className="text-3xl font-black text-emerald-600">S/ {processedData.kpis.grossMargin.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs font-bold text-emerald-400 mt-1">
               {processedData.kpis.totalSales > 0 ? ((processedData.kpis.grossMargin / processedData.kpis.totalSales) * 100).toFixed(1) : 0}% de la venta
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center text-slate-400 mb-2">
               <Users className="w-5 h-5 mr-2 text-amber-500" />
               <h4 className="text-xs font-bold uppercase tracking-widest">Cobertura</h4>
            </div>
            <div className="text-3xl font-black text-slate-800">{processedData.kpis.uniqueClients} <span className="text-lg font-medium text-slate-400">clientes</span></div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center text-slate-400 mb-2">
               <ShoppingBag className="w-5 h-5 mr-2 text-purple-500" />
               <h4 className="text-xs font-bold uppercase tracking-widest">Volumen</h4>
            </div>
            <div className="text-3xl font-black text-slate-800">{processedData.kpis.itemsSold.toLocaleString()} <span className="text-lg font-medium text-slate-400">ítems</span></div>
         </div>
      </div>

      {/* TABS & CONTENT */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="flex border-b border-slate-200 bg-slate-50">
            <button onClick={() => setActiveTab('HISTORICAL')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'HISTORICAL' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
               Análisis Histórico
            </button>
            <button onClick={() => setActiveTab('PROJECTION')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'PROJECTION' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
               Proyección del Mes
            </button>
            <button onClick={() => setActiveTab('SELLER_ADVANCE')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'SELLER_ADVANCE' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
               Avance por Vendedor
            </button>
            <button onClick={() => setActiveTab('COMPANY_ADVANCE')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'COMPANY_ADVANCE' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
               Resumen Ventas Empresa
            </button>
         </div>

         <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
            {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" />
                  <p className="font-bold">Cargando datos desde Supabase...</p>
               </div>
            ) : activeTab === 'HISTORICAL' ? (
               <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                           <th className="p-4 border-b border-slate-200">Segmento ({groupBy})</th>
                           <th className="p-4 border-b border-slate-200 text-right">Venta (S/)</th>
                           <th className="p-4 border-b border-slate-200 text-right">Margen (S/)</th>
                           <th className="p-4 border-b border-slate-200 text-right">Part. %</th>
                           <th className="p-4 border-b border-slate-200 text-center">Cobertura</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {processedData.rows.map(r => (
                           <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="p-4 font-bold text-slate-800">{r.label}</td>
                              <td className="p-4 text-right font-mono text-blue-700 font-bold">
                                 {r.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-right font-mono text-emerald-600 font-bold">
                                 {r.margin.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-right">
                                 <div className="flex items-center justify-end">
                                    <span className="font-mono text-slate-500 text-xs mr-2">{r.percentage.toFixed(1)}%</span>
                                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                       <div className="h-full bg-blue-500" style={{ width: `${r.percentage}%` }}></div>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4 text-center font-bold text-amber-600">
                                 {r.clients.size} cli
                              </td>
                           </tr>
                        ))}
                        {processedData.rows.length === 0 && (
                           <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">No hay datos para esta combinación de filtros.</td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            ) : activeTab === 'PROJECTION' && projectionData ? (
               <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-blue-900/5 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                     <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center">
                        <Target className="w-8 h-8 mr-3 text-blue-600" /> Proyección de Cierre de Mes
                     </h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Venta Actual</div>
                           <div className="text-3xl font-mono font-black text-blue-700">S/ {projectionData.currentSales.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Promedio Diario</div>
                           <div className="text-3xl font-mono font-black text-slate-700">S/ {projectionData.dailyAverage.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</div>
                           <div className="text-xs text-slate-400 mt-1">en {projectionData.daysPassed} días laborados</div>
                        </div>
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center">
                           <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Proyección Cierre</div>
                           <div className="text-3xl font-mono font-black text-indigo-700">S/ {projectionData.projectedTotal.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</div>
                           <div className="text-xs text-indigo-400 mt-1">en {projectionData.totalDays} días totales</div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex justify-between items-end">
                           <div>
                              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Meta Asignada (Cuotas)</div>
                              <div className="text-xl font-bold text-slate-800">S/ {projectionData.goalUsed.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cumplimiento Proyectado</div>
                              <div className={`text-2xl font-black ${projectionData.percentage >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                 {projectionData.percentage.toFixed(1)}%
                              </div>
                           </div>
                        </div>
                        <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                           {/* Goal line */}
                           <div className="absolute top-0 bottom-0 left-[100%] w-1 bg-slate-800 z-10" style={{ left: '100%' }}></div>
                           <div className={`h-full transition-all duration-1000 ${projectionData.percentage >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(projectionData.percentage, 100)}%` }}></div>
                        </div>
                        {projectionData.gap > 0 ? (
                           <div className="text-sm font-bold text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-center">
                              <AlertCircle className="w-5 h-5 mr-2" />
                              Faltarían S/ {projectionData.gap.toLocaleString('es-PE', { minimumFractionDigits: 0 })} para llegar a la meta proyectada.
                           </div>
                        ) : (
                           <div className="text-sm font-bold text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center">
                              <Target className="w-5 h-5 mr-2" />
                              ¡Proyección supera la meta por S/ {Math.abs(projectionData.gap).toLocaleString('es-PE', { minimumFractionDigits: 0 })}!
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            ) : activeTab === 'SELLER_ADVANCE' ? (
               <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                           <th className="p-4 border-b border-slate-200">Vendedor / Proveedor</th>
                           <th className="p-4 border-b border-slate-200 text-right">Cuota Mes (S/)</th>
                           <th className="p-4 border-b border-slate-200 text-right">Venta Actual (S/)</th>
                           <th className="p-4 border-b border-slate-200 text-right">Avance %</th>
                           <th className="p-4 border-b border-slate-200 text-right">Proy. Cierre (S/)</th>
                           <th className="p-4 border-b border-slate-200 text-right">Proj. %</th>
                           <th className="p-4 border-b border-slate-200 text-right text-amber-700">Req. Diario (S/)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {sellerAdvanceData.map(row => (
                           <React.Fragment key={row.seller.id}>
                              <tr className="bg-slate-50 border-t-2 border-slate-200">
                                 <td className="p-4 font-black text-blue-900 uppercase flex items-center">
                                    <Users className="w-4 h-4 mr-2 text-blue-500" /> {row.seller.name}
                                 </td>
                                 <td className="p-4 text-right font-mono font-bold text-slate-700">{row.globalQuota > 0 ? row.globalQuota.toLocaleString('es-PE', { minimumFractionDigits: 0 }) : '-'}</td>
                                 <td className="p-4 text-right font-mono font-black text-blue-700">{row.globalSales.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                 <td className="p-4 text-right">
                                    <div className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 font-black text-xs">
                                       {row.globalPct.toFixed(1)}%
                                    </div>
                                 </td>
                                 <td className="p-4 text-right font-mono font-bold text-indigo-700">{row.globalProjected.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                 <td className="p-4 text-right">
                                    <div className={`inline-block px-2 py-1 rounded font-black text-xs ${row.globalProjPct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                       {row.globalProjPct.toFixed(1)}%
                                    </div>
                                 </td>
                                 <td className="p-4 text-right font-mono font-bold text-amber-600">
                                    {row.globalDailyRequired.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                                 </td>
                              </tr>
                              {row.suppliers.map((sup: any) => (
                                 <tr key={sup.supplierId} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 pl-12 font-medium text-slate-600 flex items-center text-xs">
                                       <Layers className="w-3 h-3 mr-2 text-slate-400" /> {sup.supplierName}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-500 text-xs">{sup.assignedQuota > 0 ? sup.assignedQuota.toLocaleString('es-PE', { minimumFractionDigits: 0 }) : '-'}</td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-700 text-xs">{sup.currentSales.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                    <td className="p-3 text-right">
                                       <span className="text-slate-500 font-bold text-xs">{sup.currentPct.toFixed(1)}%</span>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-500 text-xs">{sup.projected.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                    <td className="p-3 text-right">
                                       <span className={`font-bold text-xs ${sup.projPct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{sup.projPct.toFixed(1)}%</span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-amber-600 text-xs">
                                       {sup.dailyRequired.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                                    </td>
                                 </tr>
                              ))}
                           </React.Fragment>
                        ))}
                        {sellerAdvanceData.length === 0 && (
                           <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400">No hay metas asignadas ni ventas en este periodo.</td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            ) : activeTab === 'COMPANY_ADVANCE' && companyAdvanceData ? (
               <div className="space-y-6 max-w-6xl mx-auto">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                     <div className="flex-1">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Meta Global de Empresa</div>
                        <div className="text-4xl font-black text-slate-800">S/ {companyAdvanceData.globalQuota > 0 ? companyAdvanceData.globalQuota.toLocaleString('es-PE', { minimumFractionDigits: 0 }) : 'Sin Meta'}</div>
                        <div className="mt-4 flex items-center gap-4 text-sm font-bold">
                           <div className="text-slate-500">Venta Actual: <span className="text-blue-600">S/ {companyAdvanceData.globalSales.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span></div>
                           <div className="text-slate-500">Proyección: <span className="text-indigo-600">S/ {companyAdvanceData.globalProjected.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span></div>
                           <div className="text-slate-500">Req. Diario: <span className="text-amber-600">S/ {companyAdvanceData.globalDailyRequired.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span></div>
                        </div>
                     </div>
                     <div className="w-48 text-right">
                        <div className="text-sm font-bold text-slate-500 mb-1">Avance Actual</div>
                        <div className="text-3xl font-black text-blue-600">{companyAdvanceData.globalPct.toFixed(1)}%</div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                           <h3 className="font-bold text-slate-800">Desglose de Metas (Proveedores y Categorías)</h3>
                        </div>
                        <div className="overflow-auto max-h-[400px]">
                           <table className="w-full text-left text-sm">
                              <thead className="bg-white text-slate-500 font-bold sticky top-0 shadow-sm">
                                 <tr>
                                    <th className="p-3 border-b border-slate-200">Segmento</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Cuota (S/)</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Venta (S/)</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Avance %</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Proy. Cierre</th>
                                    <th className="p-3 border-b border-slate-200 text-right text-amber-600">Req. Diario</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {companyAdvanceData.detailedRows.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                       <td className="p-3">
                                          <div className="font-bold text-slate-700">{row.name}</div>
                                          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{row.type}</div>
                                       </td>
                                       <td className="p-3 text-right font-mono text-slate-500">{row.assignedQuota > 0 ? row.assignedQuota.toLocaleString('es-PE', { minimumFractionDigits: 0 }) : '-'}</td>
                                       <td className="p-3 text-right font-mono font-bold text-blue-700">{row.currentSales.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                       <td className="p-3 text-right font-bold text-slate-600">{row.currentPct.toFixed(1)}%</td>
                                       <td className="p-3 text-right font-mono text-indigo-600">{row.projected.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                       <td className="p-3 text-right font-mono font-bold text-amber-600">{row.dailyRequired.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</td>
                                    </tr>
                                 ))}
                                 {companyAdvanceData.detailedRows.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No hay metas específicas asignadas ni ventas generadas.</td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                           <h3 className="font-bold text-slate-800">Top Aportantes (Vendedores)</h3>
                        </div>
                        <div className="overflow-auto max-h-[400px]">
                           <table className="w-full text-left text-sm">
                              <tbody className="divide-y divide-slate-100">
                                 {companyAdvanceData.topContributors.map((c: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                       <td className="p-3">
                                          <div className="font-bold text-slate-700 flex items-center">
                                             <span className="w-5 text-slate-400 text-xs">{idx + 1}.</span> {c.sellerName}
                                          </div>
                                       </td>
                                       <td className="p-3 text-right font-mono font-bold text-blue-700">
                                          {c.amount.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                                       </td>
                                       <td className="p-3 text-right font-bold text-emerald-600 text-xs">
                                          {c.percentageOfGlobal.toFixed(1)}%
                                       </td>
                                    </tr>
                                 ))}
                                 {companyAdvanceData.topContributors.length === 0 && (
                                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-medium">Sin datos de aportantes.</td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
               </div>
            ) : null}
         </div>
      </div>
    </div>
  );
};

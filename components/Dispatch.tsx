import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Truck, CheckCircle, Package, Calendar, User, FileText, Printer, X } from 'lucide-react';
import { Sale, Product } from '../types';

interface ExtendedSale extends Sale {
  sellerName: string;
  zoneName: string;
  totalWeight: number;
}

export const Dispatch: React.FC = () => {
  const { sales, vehicles, createDispatch, updateSaleStatus, drivers, clients, zones, sellers, products, suppliers } = useStore();
  
  // State
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  
  const [showPickingList, setShowPickingList] = useState(false);

  // --- DATA PREPARATION ---
  
  // 1. Enrich Sales with Territory Info and Weight
  const enrichedSales: ExtendedSale[] = useMemo(() => {
    return sales
      .filter(s => s.dispatch_status === 'pending')
      .map(sale => {
        const client = clients.find(c => c.doc_number === sale.client_ruc);
        const zone = zones.find(z => z.id === client?.zone_id);
        const seller = sellers.find(s => s.id === zone?.assigned_seller_id);
        
        // Calculate Weight
        const weight = sale.items.reduce((acc, item) => {
           const prod = products.find(p => p.id === item.product_id);
           // item.quantity_base is total units. weight is per unit.
           return acc + (item.quantity_base * (prod?.weight || 0));
        }, 0);

        return {
          ...sale,
          sellerName: seller?.name || 'V. GENERAL',
          zoneName: zone?.name || 'SIN ZONA',
          totalWeight: weight
        };
      });
  }, [sales, clients, zones, sellers, products]);

  // 2. Sort Logic: Date -> Seller -> Zone
  const sortedSales = useMemo(() => {
    return [...enrichedSales].sort((a, b) => {
       // 1. Date (Oldest first)
       const dateA = new Date(a.created_at).getTime();
       const dateB = new Date(b.created_at).getTime();
       if (dateA !== dateB) return dateA - dateB;
       
       // 2. Seller
       if (a.sellerName < b.sellerName) return -1;
       if (a.sellerName > b.sellerName) return 1;
       
       // 3. Zone
       if (a.zoneName < b.zoneName) return -1;
       if (a.zoneName > b.zoneName) return 1;
       
       return 0;
    });
  }, [enrichedSales]);

  // 3. Calculate Totals for Selection
  const selectedTotals = useMemo(() => {
     const selected = sortedSales.filter(s => selectedSaleIds.includes(s.id));
     const totalMoney = selected.reduce((acc, s) => acc + s.total, 0);
     const totalWeight = selected.reduce((acc, s) => acc + s.totalWeight, 0);
     const totalItems = selected.reduce((acc, s) => acc + s.items.length, 0);
     return { totalMoney, totalWeight, totalItems, count: selected.length };
  }, [sortedSales, selectedSaleIds]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const isOverweight = selectedVehicle ? selectedTotals.totalWeight > selectedVehicle.capacity_kg : false;

  // --- HANDLERS ---

  const handleToggleSale = (id: string) => {
    setSelectedSaleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedSaleIds.length === sortedSales.length) {
      setSelectedSaleIds([]);
    } else {
      setSelectedSaleIds(sortedSales.map(s => s.id));
    }
  };

  const handleGenerateRoute = () => {
    if (selectedSaleIds.length === 0) return;
    setShowPickingList(true);
  };

  const confirmDispatch = () => {
    if (!selectedVehicleId) { alert("Seleccione un vehículo primero."); return; }
    
    createDispatch({
      id: crypto.randomUUID(),
      code: `HR-${Math.floor(Math.random() * 10000)}`,
      vehicle_id: selectedVehicleId,
      status: 'pending',
      date: new Date().toISOString(),
      sale_ids: selectedSaleIds
    });

    updateSaleStatus(selectedSaleIds, 'assigned');
    setSelectedSaleIds([]);
    setSelectedVehicleId('');
    setShowPickingList(false);
    alert("¡Hoja de Ruta creada! El inventario ha sido comprometido para despacho.");
  };

  // --- PICKING LIST ALGORITHM ---
  const pickingList = useMemo(() => {
     const selected = sortedSales.filter(s => selectedSaleIds.includes(s.id));
     
     // 1. Aggregate Products
     const aggregation = new Map<string, number>(); // ProductID -> TotalBaseQty
     
     selected.forEach(sale => {
        sale.items.forEach(item => {
           const current = aggregation.get(item.product_id) || 0;
           aggregation.set(item.product_id, current + item.quantity_base);
        });
     });

     // 2. Build Hierarchy Objects
     const rows: any[] = [];
     aggregation.forEach((totalQty, productId) => {
        const prod = products.find(p => p.id === productId);
        if (!prod) return;
        const supplier = suppliers.find(s => s.id === prod.supplier_id);
        
        // Calculate Boxes and Loose Units
        const factor = prod.package_content || 1;
        const boxes = Math.floor(totalQty / factor);
        const units = totalQty % factor;

        rows.push({
           productId: prod.id,
           productName: prod.name,
           sku: prod.sku,
           supplierName: supplier?.name || 'OTROS',
           category: prod.category || 'VARIOS',
           subcategory: prod.subcategory || '-',
           totalQty,
           boxes,
           units,
           unitType: prod.unit_type,
           packageType: prod.package_type
        });
     });

     // 3. Sort Hierarchy: Supplier -> Category -> SubCategory -> Name
     return rows.sort((a, b) => {
        if (a.supplierName !== b.supplierName) return a.supplierName.localeCompare(b.supplierName);
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
        return a.productName.localeCompare(b.productName);
     });

  }, [selectedSaleIds, sortedSales, products, suppliers]);

  // --- RENDER ---

  if (showPickingList) {
    // PREVIEW MODE
    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-4 overflow-hidden">
         <div className="bg-white shadow-lg rounded-lg flex flex-col h-full max-w-5xl mx-auto w-full border border-slate-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-800 text-white rounded-t-lg">
               <div>
                  <h2 className="text-xl font-bold flex items-center">
                     <FileText className="mr-2" /> Hoja de Ruta y Picking
                  </h2>
                  <p className="text-xs text-slate-300">
                     {selectedTotals.count} Documentos | Peso Total: {selectedTotals.totalWeight.toFixed(2)} Kg
                  </p>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center">
                     <Printer className="w-4 h-4 mr-2" /> Imprimir
                  </button>
                  <button onClick={() => setShowPickingList(false)} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded font-bold flex items-center">
                     <X className="w-4 h-4 mr-2" /> Cerrar
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto p-8 bg-white print:p-0">
               {/* 1. HEADER PRINT */}
               <div className="mb-6 border-b pb-4">
                  <h1 className="text-2xl font-bold text-slate-900 uppercase">Lista de Picking Consolidada</h1>
                  <div className="flex justify-between mt-2 text-sm text-slate-600">
                     <p><strong>Fecha Generación:</strong> {new Date().toLocaleString()}</p>
                     <p><strong>Vehículo Asignado:</strong> {selectedVehicle ? `${selectedVehicle.plate} (${selectedVehicle.brand})` : 'NO ASIGNADO'}</p>
                  </div>
               </div>

               {/* 2. PICKING TABLE */}
               <div className="mb-8">
                  <h3 className="font-bold text-lg mb-2 bg-slate-100 p-2 border-l-4 border-slate-800">1. CONSOLIDADO DE PRODUCTOS (PICKING)</h3>
                  <table className="w-full text-sm border border-slate-300">
                     <thead className="bg-slate-200 text-slate-800 font-bold">
                        <tr>
                           <th className="p-2 border border-slate-300 text-left">Producto</th>
                           <th className="p-2 border border-slate-300 text-center w-24">Cajas</th>
                           <th className="p-2 border border-slate-300 text-center w-24">Unidades</th>
                           <th className="p-2 border border-slate-300 text-center w-24">Check</th>
                        </tr>
                     </thead>
                     <tbody>
                        {pickingList.map((item, idx) => {
                           const showHeader = idx === 0 || pickingList[idx-1].supplierName !== item.supplierName || pickingList[idx-1].category !== item.category;
                           return (
                              <React.Fragment key={item.productId}>
                                 {showHeader && (
                                    <tr>
                                       <td colSpan={4} className="bg-slate-100 font-bold text-slate-700 p-1 pl-2 text-xs uppercase border border-slate-300">
                                          {item.supplierName} - {item.category} {item.subcategory !== '-' ? `- ${item.subcategory}` : ''}
                                       </td>
                                    </tr>
                                 )}
                                 <tr>
                                    <td className="p-2 border border-slate-300">
                                       <div className="font-bold text-slate-800">{item.productName}</div>
                                       <div className="text-xs text-slate-500 font-mono">SKU: {item.sku}</div>
                                    </td>
                                    <td className="p-2 border border-slate-300 text-center font-bold text-lg text-slate-900">
                                       {item.boxes > 0 ? item.boxes : '-'}
                                       <span className="text-[9px] block font-normal text-slate-500">{item.boxes > 0 ? item.packageType : ''}</span>
                                    </td>
                                    <td className="p-2 border border-slate-300 text-center font-bold text-lg text-slate-900">
                                       {item.units > 0 ? item.units : '-'}
                                       <span className="text-[9px] block font-normal text-slate-500">{item.units > 0 ? item.unitType : ''}</span>
                                    </td>
                                    <td className="p-2 border border-slate-300 text-center">
                                       <div className="w-6 h-6 border-2 border-slate-400 rounded mx-auto"></div>
                                    </td>
                                 </tr>
                              </React.Fragment>
                           );
                        })}
                     </tbody>
                  </table>
               </div>

               {/* 3. SALES SUMMARY BY SELLER */}
               <div className="break-before-page">
                  <h3 className="font-bold text-lg mb-2 bg-slate-100 p-2 border-l-4 border-slate-800">2. RESUMEN DE DOCUMENTOS POR VENDEDOR</h3>
                  <table className="w-full text-sm border border-slate-300">
                     <thead className="bg-slate-200 text-slate-800 font-bold">
                        <tr>
                           <th className="p-2 border border-slate-300">Vendedor</th>
                           <th className="p-2 border border-slate-300">Cliente / Zona</th>
                           <th className="p-2 border border-slate-300">Documento</th>
                           <th className="p-2 border border-slate-300 text-right">Peso (Kg)</th>
                           <th className="p-2 border border-slate-300 text-right">Importe</th>
                        </tr>
                     </thead>
                     <tbody>
                        {sortedSales.filter(s => selectedSaleIds.includes(s.id)).map(sale => (
                           <tr key={sale.id}>
                              <td className="p-2 border border-slate-300 font-bold text-xs">{sale.sellerName}</td>
                              <td className="p-2 border border-slate-300">
                                 <div className="font-bold">{sale.client_name}</div>
                                 <div className="text-xs italic">{sale.zoneName}</div>
                              </td>
                              <td className="p-2 border border-slate-300 text-center">
                                 {sale.document_type === 'FACTURA' ? 'FAC' : 'BOL'} {sale.series}-{sale.number}
                              </td>
                              <td className="p-2 border border-slate-300 text-right">{sale.totalWeight.toFixed(2)}</td>
                              <td className="p-2 border border-slate-300 text-right">{sale.total.toFixed(2)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 print:hidden">
               <div className="flex-1 text-slate-500 text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> 
                  Revise que el picking coincida con el stock físico antes de confirmar.
               </div>
               <button onClick={confirmDispatch} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg flex items-center">
                  CONFIRMAR Y GENERAR HOJA DE RUTA
               </button>
            </div>
         </div>
         <style>{`
            @media print {
               @page { size: A4; margin: 10mm; }
               body * { visibility: hidden; }
               .fixed, .fixed * { visibility: visible; }
               .fixed { position: absolute; left: 0; top: 0; background: white; z-index: 9999; overflow: visible; }
               .print\\:hidden { display: none !important; }
               .break-before-page { page-break-before: always; }
            }
         `}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 font-sans">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Truck className="mr-2 h-6 w-6 text-slate-700" /> Programación de Despacho y Rutas
        </h2>
      </div>

      <div className="flex gap-6 h-full overflow-hidden">
        
        {/* LEFT PANEL: CONFIG & SUMMARY */}
        <div className="w-80 flex flex-col gap-4">
           {/* 1. Vehicle Selector */}
           <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">1. Asignar Unidad de Transporte</label>
              <select 
                 className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50 font-medium"
                 value={selectedVehicleId}
                 onChange={e => setSelectedVehicleId(e.target.value)}
              >
                 <option value="">-- Seleccionar Vehículo --</option>
                 {vehicles.map(v => {
                    const d = drivers.find(x => x.id === v.driver_id);
                    return <option key={v.id} value={v.id}>{v.plate} - {d?.name.split(' ')[0]} ({v.capacity_kg}Kg)</option>
                 })}
              </select>

              {/* Weight Meter */}
              {selectedVehicle && (
                 <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex justify-between text-xs mb-1">
                       <span className="font-bold text-slate-600">Ocupación de Carga</span>
                       <span className={`font-bold ${isOverweight ? 'text-red-600' : 'text-slate-900'}`}>
                          {selectedTotals.totalWeight.toFixed(1)} / {selectedVehicle.capacity_kg} Kg
                       </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                       <div 
                          className={`h-2.5 rounded-full ${isOverweight ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min((selectedTotals.totalWeight / selectedVehicle.capacity_kg) * 100, 100)}%` }}
                       ></div>
                    </div>
                    {isOverweight && <div className="text-[10px] text-red-500 font-bold mt-1 text-center">¡EXCESO DE PESO!</div>}
                 </div>
              )}
           </div>

           {/* 2. Selection Summary */}
           <div className="bg-white p-4 rounded-lg shadow border border-slate-200 flex-1 flex flex-col">
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">2. Resumen de Selección</label>
              <div className="space-y-4 flex-1">
                 <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-500">Documentos</span>
                    <span className="text-lg font-bold text-slate-800">{selectedTotals.count}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-500">Peso Total</span>
                    <span className="text-lg font-bold text-slate-800">{selectedTotals.totalWeight.toFixed(2)} Kg</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-500">Valor (S/)</span>
                    <span className="text-lg font-bold text-green-700">{selectedTotals.totalMoney.toFixed(2)}</span>
                 </div>
              </div>

              <button 
                 onClick={handleGenerateRoute}
                 disabled={selectedTotals.count === 0}
                 className="w-full mt-4 bg-slate-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:shadow-none flex items-center justify-center transition-all"
              >
                 <Package className="w-5 h-5 mr-2" /> GENERAR PICKING
              </button>
           </div>
        </div>

        {/* RIGHT PANEL: LIST */}
        <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <h3 className="font-bold text-slate-700">Documentos Pendientes</h3>
                 <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold">{sortedSales.length} Disp.</span>
              </div>
              <button onClick={handleSelectAll} className="text-blue-600 text-xs font-bold hover:underline">
                 {selectedSaleIds.length === sortedSales.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
              </button>
           </div>
           
           <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-xs uppercase">
                    <tr>
                       <th className="p-3 w-10 text-center">
                          <input type="checkbox" checked={selectedSaleIds.length > 0 && selectedSaleIds.length === sortedSales.length} onChange={handleSelectAll} />
                       </th>
                       <th className="p-3">Emisión (Hora)</th>
                       <th className="p-3">Vendedor</th>
                       <th className="p-3">Zona / Cliente</th>
                       <th className="p-3 text-center">Documento</th>
                       <th className="p-3 text-right">Peso (Kg)</th>
                       <th className="p-3 text-right">Total</th>
                       <th className="p-3 w-40">Observación</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {sortedSales.map((sale) => (
                       <tr 
                          key={sale.id} 
                          className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedSaleIds.includes(sale.id) ? 'bg-blue-50' : ''}`}
                          onClick={() => handleToggleSale(sale.id)}
                       >
                          <td className="p-3 text-center">
                             <input type="checkbox" checked={selectedSaleIds.includes(sale.id)} onChange={() => handleToggleSale(sale.id)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="p-3">
                             <div className="text-slate-800 font-medium">{new Date(sale.created_at).toLocaleDateString()}</div>
                             <div className="text-xs text-slate-500 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {new Date(sale.created_at).toLocaleTimeString()}</div>
                          </td>
                          <td className="p-3">
                             <div className="flex items-center text-slate-700 font-bold text-xs bg-slate-200 px-2 py-1 rounded w-fit">
                                <User className="w-3 h-3 mr-1" /> {sale.sellerName}
                             </div>
                          </td>
                          <td className="p-3">
                             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">{sale.zoneName}</div>
                             <div className="font-bold text-slate-800">{sale.client_name}</div>
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600 font-bold">
                             {sale.document_type === 'FACTURA' ? 'FAC' : 'BOL'} <br/> {sale.series}-{sale.number}
                          </td>
                          <td className="p-3 text-right">
                             <span className="font-bold text-slate-700">{sale.totalWeight.toFixed(2)}</span>
                          </td>
                          <td className="p-3 text-right font-bold text-green-700">
                             S/ {sale.total.toFixed(2)}
                          </td>
                          <td className="p-3 text-xs text-slate-500 italic truncate max-w-[150px]">
                             {sale.observation || '-'}
                          </td>
                       </tr>
                    ))}
                    {sortedSales.length === 0 && (
                       <tr><td colSpan={8} className="p-10 text-center text-slate-400">No hay documentos pendientes de despacho.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Truck, CheckCircle, Package, Calendar, User, FileText, Printer, X, Activity, MapPin, AlertTriangle, PlayCircle } from 'lucide-react';
import { Sale, Product } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfEngine } from './PdfEngine';

interface ExtendedSale extends Sale {
   sellerName: string;
   zoneName: string;
   totalWeight: number;
}

export const Dispatch: React.FC = () => {
   const { sales, vehicles, createDispatch, updateSaleStatus, drivers, clients, zones, sellers, products, suppliers, company, currentUser, dispatchSheets } = useStore();

   const [activeTab, setActiveTab] = useState<'PROGRAMAR' | 'EN_RUTA'>('PROGRAMAR');
   const [filterDeliveryMode, setFilterDeliveryMode] = useState<'ALL' | 'REGULAR' | 'EXPRESS_MISMO_DIA'>('ALL');
   const [selectedVehicleId, setSelectedVehicleId] = useState('');
   const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);

   const [showPickingList, setShowPickingList] = useState(false);
   const [activePrintTab, setActivePrintTab] = useState<'picking' | 'sellers' | 'guia'>('picking');
   const [isPrinting, setIsPrinting] = useState(false);

   // --- DATA PREPARATION ---

   // 1. Enrich Sales with Territory Info and Weight
   const enrichedSales: ExtendedSale[] = useMemo(() => {
      return sales
         .filter(s => s.dispatch_status === 'pending' && (filterDeliveryMode === 'ALL' || s.delivery_mode === filterDeliveryMode))
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
   }, [sales, clients, zones, sellers, products, filterDeliveryMode]);

   // 2. Sort Logic: Zone -> Seller -> Date (Desc) -> Document
   const sortedSales = useMemo(() => {
      return [...enrichedSales].sort((a, b) => {
         // 1. Zone
         if (a.zoneName < b.zoneName) return -1;
         if (a.zoneName > b.zoneName) return 1;

         // 2. Seller
         if (a.sellerName < b.sellerName) return -1;
         if (a.sellerName > b.sellerName) return 1;

         // 3. Date (Newest first)
         const dateA = new Date(a.created_at).getTime();
         const dateB = new Date(b.created_at).getTime();
         if (dateA !== dateB) return dateB - dateA;

         // 4. Document
         const docA = `${a.series}-${a.number}`;
         const docB = `${b.series}-${b.number}`;
         return docA.localeCompare(docB);
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
         code: 'TBD', // Let the store auto-generate it using the active GUIA series
         vehicle_id: selectedVehicleId,
         status: 'in_transit',
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
      const aggregation = new Map<string, { qty: number, weight: number, amount: number }>();

      selected.forEach(sale => {
         sale.items.forEach(item => {
            const current = aggregation.get(item.product_id) || { qty: 0, weight: 0, amount: 0 };
            const prod = products.find(p => p.id === item.product_id);
            const itemWeight = prod ? (prod.weight * item.quantity_base / (prod.package_content || 1)) : 0;

            aggregation.set(item.product_id, {
               qty: current.qty + item.quantity_base,
               weight: current.weight + itemWeight,
               amount: current.amount + item.total_price
            });
         });
      });

      // 2. Build Hierarchy Objects
      const rows: any[] = [];
      aggregation.forEach((data, productId) => {
         const prod = products.find(p => p.id === productId);
         if (!prod) return;
         const supplier = suppliers.find(s => s.id === prod.supplier_id);

         // Calculate Boxes and Loose Units
         const factor = prod.package_content || 1;
         const boxes = Math.floor(data.qty / factor);
         const units = data.qty % factor;

         rows.push({
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            supplierName: supplier?.name || 'OTROS',
            category: prod.category || 'VARIOS',
            subcategory: prod.subcategory || '-',
            totalQty: data.qty,
            boxes,
            units,
            unitType: prod.unit_type,
            packageType: prod.package_type,
            totalWeight: data.weight,
            totalAmount: data.amount
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

   const generatePickingPDF = () => {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const companyName = doc.splitTextToSize(company.name, 60);
      doc.text(companyName, 10, 18);

      const offset = companyName.length * 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`RUC: ${company.ruc}`, 10, 18 + offset);
      doc.text(`ALMC. PRINCIPAL`, 10, 22 + offset);

      // Title
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("CONSOLIDADO DE MERCADERÍA", pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(8);
      doc.text("NRO PLLA: 0001 - PENDIENTE", pageWidth / 2, 22, { align: 'center' });

      // Vehicle Box
      doc.setDrawColor(150);
      doc.roundedRect((pageWidth / 2) - 30, 25, 60, 14, 2, 2);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      const drv = selectedVehicle?.driver_id ? drivers.find(d => d.id === selectedVehicle.driver_id)?.name : 'NO ASIGNADO';
      doc.text(`CORREDOR: ${selectedVehicle ? 'ASIGNADO' : 'POR ASIGNAR'}`, (pageWidth / 2) - 27, 29);
      doc.text(`CHOFER: ${drv}`, (pageWidth / 2) - 27, 33);
      doc.text(`VEHÍCULO: ${selectedVehicle ? selectedVehicle.plate : 'NO ASIGNADO'}`, (pageWidth / 2) - 27, 37);

      // Right Info
      doc.setFontSize(8);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 10, 18, { align: 'right' });
      doc.text(`Hora: ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 10, 22, { align: 'right' });
      doc.text(`Día: ${new Date().toLocaleDateString('es-PE', { weekday: 'long' }).toUpperCase()}`, pageWidth - 10, 26, { align: 'right' });
      doc.text(`Usuario: U:${currentUser?.id.slice(0, 4) || '0011'}`, pageWidth - 10, 30, { align: 'right' });

      // Build Table Data
      const tableBody: any[] = [];
      let currentSupplier = '';
      let currentCategory = '';

      pickingList.forEach((item, idx) => {
         const showSupplier = idx === 0 || pickingList[idx - 1].supplierName !== item.supplierName;
         const showCategory = idx === 0 || showSupplier || pickingList[idx - 1].category !== item.category;

         if (showSupplier) {
            tableBody.push([{ content: item.supplierName.toUpperCase(), colSpan: 8, styles: { fontStyle: 'bold', fontSize: 10, fillColor: [240, 240, 240], cellPadding: { top: 2, bottom: 2, left: 4 } } }]);
         }
         if (showCategory) {
            tableBody.push([{ content: item.category, colSpan: 8, styles: { fontStyle: 'bold', fontSize: 8, textColor: [100, 100, 100], cellPadding: { left: 10 } } }]);
         }

         tableBody.push([
            { content: item.sku, styles: { fontStyle: 'bold', fontSize: 7, halign: 'left' } },
            { content: item.productName, styles: { fontStyle: 'bold', fontSize: 7 } },
            { content: item.boxes > 0 ? `${item.boxes} CJ` : '-', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
            { content: item.units > 0 ? `${item.units} ${item.unitType === 'UND' || item.unitType === 'BOTELLA' ? 'BOT' : item.unitType.slice(0, 3)}` : '-', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
            { content: item.totalWeight > 0 ? item.totalWeight.toFixed(2) : '-', styles: { halign: 'right' } },
            { content: item.totalAmount > 0 ? item.totalAmount.toFixed(2) : '-', styles: { halign: 'right' } },
            '',
            ''
         ]);
      });

      autoTable(doc, {
         startY: 44,
         theme: 'plain',
         head: [['CÓDIGO', 'NOMBRE DE PRODUCTO', 'CAJAS', 'UNIDADES', 'PESO', 'IMPORTE', 'DEV.', 'V°B°']],
         body: tableBody,
         headStyles: {
            fillColor: [255, 255, 255],
            textColor: 0,
            fontStyle: 'bold',
            fontSize: 7,
            lineWidth: { bottom: 0.5 },
            lineColor: 0
         },
         styles: {
            fontSize: 7,
            cellPadding: 1.5
         },
         margin: { left: 10, right: 10 },
         columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 69 },
            2: { cellWidth: 15 },
            3: { cellWidth: 20 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
            6: { cellWidth: 20 },
            7: { cellWidth: 11 }
         },
         willDrawCell: function (data) {
            // Add lines for Devolution and Check
            if (data.section === 'body' && typeof data.cell.raw === 'string' && data.cell.raw === '') {
               if (data.column.index === 6) {
                  doc.setDrawColor(0);
                  doc.setLineWidth(0.1);
                  doc.line(data.cell.x + 2, data.cell.y + data.cell.height - 2, data.cell.x + data.cell.width - 2, data.cell.y + data.cell.height - 2);
               }
               if (data.column.index === 7) {
                  doc.setDrawColor(0);
                  doc.setLineWidth(0.3);
                  doc.rect(data.cell.x + 4, data.cell.y + 1.5, 3, 3);
               }
            }
         }
      });

      window.open(doc.output('bloburl'), '_blank');
   };

   const generateSellerExtractPDF = () => {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const companyName = doc.splitTextToSize(company.name, 60);
      doc.text(companyName, 10, 18);

      const offset = companyName.length * 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`RUC: ${company.ruc}`, 10, 18 + offset);
      doc.text(`ALMC. PRINCIPAL`, 10, 22 + offset);

      // Title
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("ESTRACTO POR VENDEDOR", pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(8);
      doc.text("NRO PLLA: 0001 - PENDIENTE", pageWidth / 2, 22, { align: 'center' });

      // Vehicle Box
      doc.setDrawColor(150);
      doc.roundedRect((pageWidth / 2) - 30, 25, 60, 14, 2, 2);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      const drv = selectedVehicle?.driver_id ? drivers.find(d => d.id === selectedVehicle.driver_id)?.name : 'NO ASIGNADO';
      doc.text(`CORREDOR: ${selectedVehicle ? 'ASIGNADO' : 'POR ASIGNAR'}`, (pageWidth / 2) - 27, 29);
      doc.text(`CHOFER: ${drv}`, (pageWidth / 2) - 27, 33);
      doc.text(`VEHÍCULO: ${selectedVehicle ? selectedVehicle.plate : 'NO ASIGNADO'}`, (pageWidth / 2) - 27, 37);

      // Right Info
      doc.setFontSize(8);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 10, 18, { align: 'right' });
      doc.text(`Hora: ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 10, 22, { align: 'right' });
      doc.text(`Día: ${new Date().toLocaleDateString('es-PE', { weekday: 'long' }).toUpperCase()}`, pageWidth - 10, 26, { align: 'right' });
      doc.text(`Usuario: U:${currentUser?.id.slice(0, 4) || '0011'}`, pageWidth - 10, 30, { align: 'right' });

      const tableBody: any[] = [];
      const selectedActiveSales = sortedSales.filter(s => selectedSaleIds.includes(s.id));
      const uniqueSellersMap = Array.from(new Set(selectedActiveSales.map(s => s.sellerName)));

      uniqueSellersMap.forEach(seller => {
         const sellerSales = selectedActiveSales.filter(s => s.sellerName === seller);
         const totalImporte = sellerSales.reduce((sum, s) => sum + s.total, 0);
         const uniqueClients = new Set(sellerSales.map(s => s.client_ruc)).size;

         const sellerObj = sellers.find(s => s.name === seller);
         const sellerIdDisplay = sellerObj?.id.replace(/\D/g, '').padStart(4, '0') || '0001';

         // Seller Header Row
         tableBody.push([
            { content: `${sellerIdDisplay} - ${seller}`, colSpan: 5, styles: { fontStyle: 'bold', fontSize: 10, textColor: 0, cellPadding: { top: 6, bottom: 2 } } }
         ]);

         // Columns Header Row
         tableBody.push([
            { content: 'DOCUMENTO', styles: { fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255], textColor: 0, lineWidth: { top: 1, bottom: 1 }, lineColor: 0 } },
            { content: 'CLIENTE / DIRECCIÓN', styles: { fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255], textColor: 0, lineWidth: { top: 1, bottom: 1 }, lineColor: 0 } },
            { content: 'F. PAGO', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255], textColor: 0, lineWidth: { top: 1, bottom: 1 }, lineColor: 0 } },
            { content: 'IMPORTE', styles: { halign: 'right', fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255], textColor: 0, lineWidth: { top: 1, bottom: 1 }, lineColor: 0 } },
            { content: 'ESTADO', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255], textColor: 0, lineWidth: { top: 1, bottom: 1 }, lineColor: 0 } }
         ]);

         // Sales Rows
         sellerSales.forEach(sale => {
            const client = clients.find(c => c.doc_number === sale.client_ruc);
            const clientCode = client?.id.replace(/\D/g, '').padStart(6, '0') || sale.client_ruc.slice(0, 6) || '000000';
            const fPago = sale.payment_method.slice(0, 3) === 'EFE' ? 'CON' : sale.payment_method.slice(0, 3);
            const docTypeStr = sale.document_type === 'FACTURA' ? 'FA' : 'BO';

            tableBody.push([
               { content: `${docTypeStr}/${sale.series}-${sale.number}`, styles: { fontStyle: 'bold' } },
               { content: `${clientCode} ${sale.client_name}\n${sale.client_address || sale.zoneName}`, styles: { fontStyle: 'normal' } },
               { content: fPago.toUpperCase(), styles: { halign: 'center', fontStyle: 'bold', textColor: [80, 80, 80] } },
               { content: sale.total.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
               '' // ESTADO Checkbox
            ]);
         });

         // Footer Row
         tableBody.push([
            { content: 'RESUMEN:', styles: { fontStyle: 'bold', fontSize: 8, textColor: 0, lineWidth: { top: 1, bottom: 0.5 }, lineColor: 0, cellPadding: { top: 2, bottom: 2 } } },
            { content: `${uniqueClients} CLIENTES | ${sellerSales.length} COMPROBANTES`, styles: { fontStyle: 'bold', fontSize: 8, textColor: 0, lineWidth: { top: 1, bottom: 0.5 }, lineColor: 0, cellPadding: { top: 2, bottom: 2 } } },
            { content: 'TOTAL:', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8, textColor: 0, lineWidth: { top: 1, bottom: 0.5 }, lineColor: 0, cellPadding: { top: 2, bottom: 2 } } },
            { content: `S/ ${totalImporte.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: 0, lineWidth: { top: 1, bottom: 0.5 }, lineColor: 0, cellPadding: { top: 2, bottom: 2 } } },
            { content: '', styles: { lineWidth: { top: 1, bottom: 0.5 }, lineColor: 0 } }
         ]);
      });

      autoTable(doc, {
         startY: 44,
         theme: 'plain',
         body: tableBody,
         styles: {
            fontSize: 7,
            cellPadding: 1.5
         },
         margin: { left: 10, right: 10 },
         columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 85 },
            2: { cellWidth: 20 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 }
         },
         willDrawCell: function (data) {
            // Draw Checkbox in the ESTADO column (index 4)
            if (data.column.index === 4 && typeof data.cell.raw === 'string' && data.cell.raw === '') {
               // Only draw if it's a sale row (not a header or summary row, which spans multiple or has text)
               // The sale rows have bold document numbers in collumn 0, we can just check if row doesn't have colSpan and isn't header.
               if (!data.row.cells[0].colSpan && data.row.cells[0].raw && (data.row.cells[0].raw as string).includes('/')) {
                  doc.setDrawColor(0);
                  doc.setLineWidth(0.3);
                  doc.rect(data.cell.x + 10, data.cell.y + 1.5, 3, 3);
               }
            }
         }
      });

      window.open(doc.output('bloburl'), '_blank');
   };

   // --- NEW: MONITOR TAB LOGIC ---
   const activeDispatches = useMemo(() => {
      return dispatchSheets.filter(ds => ds.status === 'in_transit');
   }, [dispatchSheets]);

   const generateConsolidatedGuidePDF = async () => {
       // Mocking a DispatchSheet that represents the Consolidated Guide
       const consolidatedId = `CONSOL-${new Date().getTime()}`;
       
       let guiaItems: any[] = [];
       const selectedDocs = sortedSales.filter(s => selectedSaleIds.includes(s.id));
       
       selectedDocs.forEach(sale => {
          sale.items.forEach(item => {
             const prod = products.find(p => p.id === item.product_id);
             const existingItem = guiaItems.find(gi => gi.product_id === item.product_id);
             if (existingItem) {
                existingItem.quantity += item.quantity_base;
             } else {
                guiaItems.push({
                   product_id: item.product_id,
                   product: prod,
                   quantity: item.quantity_base,
                   unit_price: 0,
                });
             }
          });
       });

       const firstTrackedSale = selectedDocs.find(s => s.guide_transporter_id || s.guide_driver_id) || selectedDocs[0];

       const consolidatedPayload = {
           id: consolidatedId,
           code: `0001-${new Date().getTime().toString().slice(-6)}`,
           date: new Date().toISOString(),
           vehicle_id: selectedVehicleId,
           status: 'pending',
           sale_ids: selectedSaleIds,
           items: guiaItems,
           client_name: 'Documentos Itinerantes',
           motivo: 'Traslado por Emisor (Consolidado)',
           guide_transporter_id: firstTrackedSale?.guide_transporter_id || '',
           guide_driver_id: firstTrackedSale?.guide_driver_id || '',
           guide_vehicle_id: firstTrackedSale?.guide_vehicle_id || selectedVehicleId || ''
       };

       try {
           setIsPrinting(true);
           await PdfEngine.openDocument(consolidatedPayload, 'GUIA_CONSOLIDADA', company);
       } catch (error) {
           console.error("Failed to generate PDF:", error);
           alert("Hubo un error al generar el documento PDF.");
       } finally {
           setIsPrinting(false);
       }
   };

   // --- RENDER ---

   if (showPickingList) {
      // PREVIEW MODE
      return (
         <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-4 overflow-hidden">
            <div className="bg-white shadow-lg rounded-lg flex flex-col h-full max-w-5xl mx-auto w-full border border-slate-300">
               {/* Header */}
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-800 text-white rounded-t-lg print:hidden">
                  <div>
                     <h2 className="text-xl font-bold flex items-center">
                        <FileText className="mr-2" /> Hoja de Ruta y Picking
                     </h2>
                     <p className="text-xs text-slate-300">
                        {selectedTotals.count} Documentos | Peso Total: {selectedTotals.totalWeight.toFixed(2)} Kg
                     </p>
                  </div>

                  {/* View Toggles */}
                  <div className="flex bg-slate-900 rounded p-1">
                     <button
                        onClick={() => setActivePrintTab('picking')}
                        className={`px-4 py-1.5 rounded text-sm font-bold ${activePrintTab === 'picking' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                        1. Consolidado Picking
                     </button>
                     <button
                        onClick={() => setActivePrintTab('sellers')}
                        className={`px-4 py-1.5 rounded text-sm font-bold ${activePrintTab === 'sellers' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                        2. Estracto por Vendedor
                     </button>
                     <button
                        onClick={() => setActivePrintTab('guia')}
                        className={`px-4 py-1.5 rounded text-sm font-bold ${activePrintTab === 'guia' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-emerald-400'}`}
                     >
                        3. Guía de Remisión Consolidada
                     </button>
                  </div>

                  <div className="flex gap-2">
                     <button onClick={() => {
                        if (activePrintTab === 'picking') generatePickingPDF();
                        else if (activePrintTab === 'sellers') generateSellerExtractPDF();
                        else generateConsolidatedGuidePDF();
                     }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center shadow">
                        <Printer className="w-4 h-4 mr-2" /> GENERAR PDF EXACTO
                     </button>
                     <button onClick={() => setShowPickingList(false)} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded font-bold flex items-center">
                        <X className="w-4 h-4 mr-2" /> Cerrar
                     </button>
                     <button onClick={confirmDispatch} className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded font-bold shadow-lg flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" /> CONFIRMAR Y CREAR RUTA
                     </button>
                  </div>
               </div>

               <style>{`
                  @media print {
                     @page {
                        size: A4 portrait;
                        margin: 1cm;
                     }
                     body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                     }
                     table {
                        page-break-inside: auto;
                     }
                     tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                     }
                     td, th {
                        page-break-inside: avoid;
                     }
                     .print-container {
                        width: 100% !important;
                        max-width: none !important;
                     }
                  }
               `}</style>

               <div className="flex-1 overflow-auto bg-white print:p-0 print-container">
                  {/* --- PAGE 1: CONSOLIDADO DE MERCADERIA --- */}
                  {activePrintTab === 'picking' && (
                     <div className="p-8 print:p-0" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px' }}>
                        {/* HEADER */}
                        <div className="grid grid-cols-3 gap-4 mb-2 text-black pb-2 border-b-[3px] border-black print:border-b-[4px]">
                           {/* Left */}
                           <div className="space-y-1">
                              <h1 className="font-black text-[15px] leading-tight uppercase tracking-tight">{company.name}</h1>
                              <p className="font-bold text-[11px] text-gray-800">RUC: {company.ruc}</p>
                              <p className="font-bold text-[10px] text-gray-800 pt-3">ALMC. PRINCIPAL</p>
                           </div>
                           {/* Center */}
                           <div className="text-center flex flex-col items-center">
                              <h2 className="font-black text-[14px] uppercase tracking-wide mb-1">CONSOLIDADO DE MERCADERÍA</h2>
                              <p className="font-bold text-[10px] text-gray-900 uppercase mb-3">NRO PLLA: 0001 - PENDIENTE</p>
                              <div className="inline-block text-left px-4 py-1.5 rounded-xl border-[1.5px] border-gray-400">
                                 <p className="font-bold uppercase text-[9px] mb-1 text-gray-500 flex justify-between gap-4">
                                    <span>CORREDOR:</span> <span className="text-black font-extrabold">{selectedVehicle ? 'ASIGNADO' : 'POR ASIGNAR'}</span>
                                 </p>
                                 <p className="font-bold uppercase text-[9px] mb-1 text-gray-500 flex justify-between gap-4">
                                    <span>CHOFER:</span> <span className="text-black font-extrabold">{selectedVehicle?.driver_id ? drivers.find(d => d.id === selectedVehicle.driver_id)?.name : 'NO ASIGNADO'}</span>
                                 </p>
                                 <p className="font-bold uppercase text-[9px] text-gray-500 flex justify-between gap-4">
                                    <span>VEHÍCULO:</span> <span className="text-black font-extrabold">{selectedVehicle ? `${selectedVehicle.plate}` : 'NO ASIGNADO'}</span>
                                 </p>
                              </div>
                           </div>
                           {/* Right */}
                           <div className="text-right space-y-0.5 text-[9px]">
                              <div className="flex justify-end gap-2"><span className="text-gray-500">Fecha:</span> <span className="font-bold text-black">{new Date().toLocaleDateString('es-PE')}</span></div>
                              <div className="flex justify-end gap-2"><span className="text-gray-500">Hora:</span> <span className="font-bold text-black">{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span></div>
                              <div className="flex justify-end gap-2"><span className="text-gray-500">Día:</span> <span className="font-bold text-black uppercase">{new Date().toLocaleDateString('es-PE', { weekday: 'long' })}</span></div>
                              <div className="flex justify-end gap-2"><span className="text-gray-500">Página:</span> <span className="font-bold text-black">1</span></div>
                              <div className="flex justify-end gap-2 pt-2"><span className="text-gray-500">Usuario:</span> <span className="font-bold text-black">U:{currentUser?.id.slice(0, 4) || '0011'}</span></div>
                           </div>
                        </div>

                        {/* TABLE */}
                        <table className="w-full text-black text-left border-collapse mt-1" style={{ tableLayout: 'fixed' }}>
                           <colgroup>
                              <col style={{ width: '42%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '12%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '11%' }} />
                              <col style={{ width: '12%' }} />
                              <col style={{ width: '6%' }} />
                           </colgroup>
                           <thead>
                              <tr className="border-b-2 border-black text-[9px] uppercase text-black">
                                 <th className="py-2 pl-2 font-extrabold tracking-wide">CÓDIGO / NOMBRE DE PRODUCTO</th>
                                 <th className="py-2 text-center font-extrabold tracking-wide">CAJAS</th>
                                 <th className="py-2 text-center font-extrabold tracking-wide">UNIDADES</th>
                                 <th className="py-2 text-right font-extrabold tracking-wide text-[8px]">PESO(KG)</th>
                                 <th className="py-2 pr-2 text-right font-extrabold tracking-wide text-[8px]">IMPORTE</th>
                                 <th className="py-2 text-center font-extrabold tracking-wide text-[8px]">DEVOLUCIÓN</th>
                                 <th className="py-2 text-center font-extrabold tracking-wide">V°B°</th>
                              </tr>
                           </thead>
                           <tbody>
                              {pickingList.map((item, idx) => {
                                 const showSupplier = idx === 0 || pickingList[idx - 1].supplierName !== item.supplierName;
                                 const showCategory = idx === 0 || showSupplier || pickingList[idx - 1].category !== item.category;

                                 return (
                                    <React.Fragment key={item.productId}>
                                       {showSupplier && (
                                          <tr>
                                             <td colSpan={7} className="pt-6 pb-2 font-black text-[11px] uppercase text-black border-b-[1.5px] border-dashed border-gray-300">
                                                ■ {item.supplierName}
                                             </td>
                                          </tr>
                                       )}
                                       {showCategory && (
                                          <tr>
                                             <td colSpan={7} className="pt-4 pb-1 font-bold pl-4 text-[10px] text-gray-700 uppercase">
                                                {item.category}
                                             </td>
                                          </tr>
                                       )}
                                       <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                          <td className="py-1.5 pl-2 pr-2 align-top">
                                             <div className="flex items-start gap-1">
                                                <span className="font-bold text-black text-[8px] min-w-[35px] whitespace-nowrap tracking-tighter pt-0.5">{item.sku}</span>
                                                <span className="uppercase text-black font-bold text-[9px] print:text-[8px] leading-[1.1] break-words">{item.productName}</span>
                                             </div>
                                          </td>
                                          <td className="py-1.5 text-center font-extrabold text-black text-[11px] whitespace-nowrap">
                                             {item.boxes > 0 ? `${item.boxes} CJ` : '-'}
                                          </td>
                                          <td className="py-1.5 text-center font-extrabold text-black text-[11px] whitespace-nowrap">
                                             {item.units > 0 ? `${item.units} ${item.unitType === 'UND' || item.unitType === 'BOTELLA' ? 'BOT' : item.unitType.slice(0, 3)}` : '-'}
                                          </td>
                                          <td className="py-1.5 text-right font-medium text-black text-[8px] pr-4 whitespace-nowrap">
                                             {item.totalWeight > 0 ? item.totalWeight.toFixed(2) : '-'}
                                          </td>
                                          <td className="py-1.5 text-right font-bold text-black text-[8px] pr-2 whitespace-nowrap">
                                             {item.totalAmount > 0 ? item.totalAmount.toFixed(2) : '-'}
                                          </td>
                                          <td className="py-1.5 text-center px-4 align-middle">
                                             <div className="border-b border-black w-full mt-2"></div>
                                          </td>
                                          <td className="py-1.5 text-center align-middle">
                                             <div className="w-3.5 h-3.5 border-[1.5px] border-black mx-auto mt-0.5"></div>
                                          </td>
                                       </tr>
                                    </React.Fragment>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>
                  )}

                  {/* --- PAGE 2: SALES SUMMARY BY SELLER --- */}
                  {activePrintTab === 'sellers' && (
                     <React.Fragment>
                        <div className="p-8 print:p-0" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px' }}>
                           {/* HEADER 2 */}
                           <div className="grid grid-cols-3 gap-4 mb-4 text-black pb-2 border-b-[3px] border-black print:border-b-[4px]">
                              {/* Left */}
                              <div className="space-y-1">
                                 <h1 className="font-black text-[15px] leading-tight uppercase tracking-tight">{company.name}</h1>
                                 <p className="font-bold text-[11px] text-gray-800">RUC: {company.ruc}</p>
                                 <p className="font-bold text-[10px] text-gray-800 pt-3">ALMC. PRINCIPAL</p>
                              </div>
                              {/* Center */}
                              <div className="text-center flex flex-col items-center">
                                 <h2 className="font-black text-[13px] uppercase tracking-wide mb-1 px-4 leading-[1.15]">CONSOLIDADO DE DOCUMENTOS<br />PRE-LIQUIDACIÓN</h2>
                                 <p className="font-bold text-[10px] text-gray-900 uppercase mb-2">NRO PLLA: 0001 - PENDIENTE</p>
                                 <div className="inline-block text-left px-4 py-1.5 rounded-xl border-[1.5px] border-gray-400">
                                    <p className="font-bold uppercase text-[9px] mb-1 text-gray-500 flex justify-between gap-4">
                                       <span>CORREDOR:</span> <span className="text-black font-extrabold">{selectedVehicle ? 'ASIGNADO' : 'POR ASIGNAR'}</span>
                                    </p>
                                    <p className="font-bold uppercase text-[9px] mb-1 text-gray-500 flex justify-between gap-4">
                                       <span>CHOFER:</span> <span className="text-black font-extrabold">{selectedVehicle?.driver_id ? drivers.find(d => d.id === selectedVehicle.driver_id)?.name : 'NO ASIGNADO'}</span>
                                    </p>
                                    <p className="font-bold uppercase text-[9px] text-gray-500 flex justify-between gap-4">
                                       <span>VEHÍCULO:</span> <span className="text-black font-extrabold">{selectedVehicle ? `${selectedVehicle.plate}` : 'NO ASIGNADO'}</span>
                                    </p>
                                 </div>
                              </div>
                              {/* Right */}
                              <div className="text-right space-y-0.5 text-[9px]">
                                 <div className="flex justify-end gap-2"><span className="text-gray-500">Fecha:</span> <span className="font-bold text-black">{new Date().toLocaleDateString('es-PE')}</span></div>
                                 <div className="flex justify-end gap-2"><span className="text-gray-500">Hora:</span> <span className="font-bold text-black">{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                 <div className="flex justify-end gap-2"><span className="text-gray-500">Día:</span> <span className="font-bold text-black uppercase">{new Date().toLocaleDateString('es-PE', { weekday: 'long' })}</span></div>
                                 <div className="flex justify-end gap-2"><span className="text-gray-500">Página:</span> <span className="font-bold text-black">1</span></div>
                                 <div className="flex justify-end gap-2 pt-2"><span className="text-gray-500">Usuario:</span> <span className="font-bold text-black">U:{currentUser?.id.slice(0, 4) || '0011'}</span></div>
                              </div>
                           </div>

                           <div className="w-full text-black">
                              {Array.from(new Set(sortedSales.filter(s => selectedSaleIds.includes(s.id)).map(s => s.sellerName))).map(seller => {
                                 const sellerSales = sortedSales.filter(s => selectedSaleIds.includes(s.id) && s.sellerName === seller);
                                 const totalImporte = sellerSales.reduce((sum, s) => sum + s.total, 0);
                                 const uniqueClients = new Set(sellerSales.map(s => s.client_ruc)).size;

                                 // find the seller object to get their id/code
                                 const sellerObj = sellers.find(s => s.name === seller);
                                 const sellerIdDisplay = sellerObj?.id.replace(/\D/g, '').padStart(4, '0') || '0001';

                                 return (
                                    <div key={seller} className="mb-8 break-inside-avoid">
                                       {/* Seller Header */}
                                       <div className="text-black font-extrabold uppercase tracking-widest text-[12px] mb-2 pt-2 border-t-[1.5px] border-black">
                                          {sellerIdDisplay} - {seller}
                                       </div>

                                       <table className="w-full text-left border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
                                          <colgroup>
                                             <col style={{ width: '22%' }} />
                                             <col style={{ width: '40%' }} />
                                             <col style={{ width: '12%' }} />
                                             <col style={{ width: '14%' }} />
                                             <col style={{ width: '12%' }} />
                                          </colgroup>
                                          <thead>
                                             <tr className="border-y-[3px] border-black uppercase text-black font-extrabold text-[9px]">
                                                <th className="py-1.5 pl-2">DOCUMENTO</th>
                                                <th className="py-1.5">CLIENTE / DIRECCIÓN</th>
                                                <th className="py-1.5 text-center">F. PAGO</th>
                                                <th className="py-1.5 text-right">IMPORTE</th>
                                                <th className="py-1.5 text-center pr-2">ESTADO</th>
                                             </tr>
                                          </thead>
                                          <tbody className="align-middle">
                                             {sellerSales.map(sale => {
                                                const client = clients.find(c => c.doc_number === sale.client_ruc);
                                                const clientCode = client?.id.replace(/\D/g, '').padStart(6, '0') || sale.client_ruc.slice(0, 6) || '000000';
                                                return (
                                                   <tr key={sale.id} className="border-b-[1px] border-dashed border-gray-300">
                                                      <td className="py-1.5 font-bold text-black uppercase whitespace-nowrap pl-2 align-top">
                                                         {sale.document_type === 'FACTURA' ? 'FA' : 'BO'}/{sale.series}-{sale.number}
                                                      </td>
                                                      <td className="py-1.5 pr-2 align-top">
                                                         <div className="font-bold text-black uppercase leading-tight text-[9px]">
                                                            <span className="text-black mr-1">{clientCode}</span>
                                                            <span className="tracking-tight">{sale.client_name}</span>
                                                         </div>
                                                         <div className="text-[7.5px] text-gray-700 font-bold uppercase mt-0.5 tracking-tight leading-[1] break-words">
                                                            {sale.client_address || sale.zoneName}
                                                         </div>
                                                      </td>
                                                      <td className="py-1.5 text-center font-bold text-gray-700 uppercase text-[9px] align-top">
                                                         {sale.payment_method.slice(0, 3) === 'EFE' ? 'CON' : sale.payment_method.slice(0, 3)}
                                                      </td>
                                                      <td className="py-1.5 text-right font-extrabold text-black text-[11px] whitespace-nowrap">
                                                         {sale.total.toFixed(2)}
                                                      </td>
                                                      <td className="py-1.5 text-center align-middle pr-2">
                                                         <div className="w-4 h-4 border-[1.5px] border-black mx-auto mt-0.5"></div>
                                                      </td>
                                                   </tr>
                                                );
                                             })}
                                          </tbody>
                                       </table>

                                       {/* Footer */}
                                       <div className="flex border-t-[3px] border-b-[2px] border-black mt-0 py-1.5 font-extrabold uppercase text-[10px] text-black items-center">
                                          <div className="w-[20%] tracking-widest pl-2 whitespace-nowrap">RESUMEN:</div>
                                          <div className="w-[42%] text-left whitespace-nowrap">{uniqueClients} CLIENTES | {sellerSales.length} COMPROBANTES</div>
                                          <div className="w-[12%] text-center text-black whitespace-nowrap">TOTAL:</div>
                                          <div className="w-[14%] text-right text-[12px] tracking-wide pr-1 whitespace-nowrap">S/ {totalImporte.toFixed(2)}</div>
                                          <div className="w-[12%] text-center"></div>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     </React.Fragment>
                  )}

                  {/* --- PAGE 3: GUIA CONSOLIDADA (PREVIEW) --- */}
                  {activePrintTab === 'guia' && (
                     <div className="p-12 flex flex-col items-center justify-center h-full min-h-[500px] text-slate-500">
                        <FileText className="w-24 h-24 mb-6 text-slate-300" />
                        <h2 className="text-2xl font-black text-slate-700 mb-2">Guía de Remisión Consolidada</h2>
                        <p className="text-center max-w-lg mb-8">Esta opción generará un documento oficial que consolida toda la mercadería de la lista seleccionada en una sola <b>Guía de Remisión</b> (Tipo Remitente) para el traslado en la misma unidad de transporte.</p>
                        
                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl max-w-lg w-full text-amber-800 text-sm">
                           <h3 className="font-bold flex items-center mb-2"><AlertTriangle className="w-4 h-4 mr-2" /> Excepción Legal (SUNAT)</h3>
                           <p className="mb-2">Al generar una Guía de Remisión Consolidada, deberás adjuntar copias físicas o virtuales de todas las Facturas o Boletas individuales que componen el reparto.</p>
                           <p>Presiona <b>GENERAR PDF EXACTO</b> en la barra superior para emitir el comprobante final.</p>
                        </div>
                     </div>
                  )}

               </div>
               <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 print:hidden">
                  <div className="flex-1 text-slate-500 text-sm flex items-center">
                     <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                     Revise que el picking coincida con el stock físico antes de confirmar.
                  </div>
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
         </div >
      );
   }

   return (
      <div className="flex flex-col h-full space-y-4 font-sans">
         <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 flex items-center mb-0">
               <Truck className="mr-2 h-6 w-6 text-slate-700" /> Control de Despacho y Rutas
            </h2>
            <div className="flex bg-slate-100 rounded-lg p-1">
               <button
                  onClick={() => setActiveTab('PROGRAMAR')}
                  className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'PROGRAMAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                     }`}
               >
                  Programar Salidas
               </button>
               <button
                  onClick={() => setActiveTab('EN_RUTA')}
                  className={`px-6 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'EN_RUTA' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                     }`}
               >
                  <Activity className="w-4 h-4" /> Monitoreo En Ruta
                  {activeDispatches.length > 0 && (
                     <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{activeDispatches.length}</span>
                  )}
               </button>
            </div>
         </div>

         {activeTab === 'PROGRAMAR' ? (
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

                  {/* Modality Filter */}
                  <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                     <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Modalidad de Pedido</label>
                     <select
                        className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50 font-medium"
                        value={filterDeliveryMode}
                        onChange={e => setFilterDeliveryMode(e.target.value as any)}
                     >
                        <option value="ALL">Todas las Modalidades</option>
                        <option value="REGULAR">Regulares (Siguiente día)</option>
                        <option value="EXPRESS_MISMO_DIA">Fuera de Ruta (Mismo día)</option>
                     </select>
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

               {/* RIGHT PANEL: DOCUMENT SELECTION */}
               <div className="flex-1 bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col min-w-0">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700">2. Seleccionar Documentos a Despachar</h3>
                     <div className="text-sm font-medium text-slate-500">
                        {selectedTotals.count} seleccionados / S/ {selectedTotals.totalMoney.toFixed(2)}
                     </div>
                  </div>

                  <div className="flex-1 overflow-auto border border-slate-200 rounded">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0 shadow-sm">
                           <tr>
                              <th className="p-2 border-b"><input type="checkbox" onChange={handleSelectAll} checked={selectedSaleIds.length === sortedSales.length && sortedSales.length > 0} className="w-4 h-4" /></th>
                              <th className="p-2 border-b">Documento</th>
                              <th className="p-2 border-b">Cliente</th>
                              <th className="p-2 border-b">Zona</th>
                              <th className="p-2 border-b">Vendedor</th>
                              <th className="p-2 border-b text-right">Peso</th>
                              <th className="p-2 border-b text-right">Importe</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {sortedSales.length === 0 ? (
                              <tr><td colSpan={7} className="p-8 text-center text-slate-400">No hay documentos pendientes para despachar.</td></tr>
                           ) : (
                              sortedSales.map(sale => {
                                 const isSelected = selectedSaleIds.includes(sale.id);
                                 return (
                                    <tr key={sale.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : ''}`} onClick={() => handleToggleSale(sale.id)}>
                                       <td className="p-2"><input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 cursor-pointer" /></td>
                                       <td className="p-2 font-bold text-slate-700">
                                          {sale.document_type.substring(0, 3)} {sale.series}-{sale.number}
                                          {sale.delivery_mode === 'EXPRESS_MISMO_DIA' && (
                                             <span className="block text-[9px] bg-red-100 text-red-700 font-bold px-1 py-0.5 rounded uppercase mt-0.5 w-max">Fuera de Ruta</span>
                                          )}
                                       </td>
                                       <td className="p-2 text-slate-700 truncate max-w-[200px]" title={sale.client_name}>{sale.client_name}</td>
                                       <td className="p-2 text-slate-500 text-xs font-semibold">{sale.zoneName}</td>
                                       <td className="p-2 text-slate-500 text-xs">{sale.sellerName.split(' ')[0]}</td>
                                       <td className="p-2 text-right font-medium text-slate-600">{sale.totalWeight > 0 ? `${sale.totalWeight.toFixed(1)} Kg` : '-'}</td>
                                       <td className="p-2 text-right font-bold text-emerald-600">S/ {sale.total.toFixed(2)}</td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         ) : (
            // --- EN_RUTA MONITOR TAB ---
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
               {activeDispatches.length === 0 ? (
                  <div className="bg-white flex-1 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                     <CheckCircle className="w-16 h-16 text-green-200 mb-4" />
                     <h3 className="text-xl font-bold mb-2">Sin Rutas Activas</h3>
                     <p>Actualmente no hay unidades de transporte con estado "En Ruta".</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto pb-4">
                     {activeDispatches.map(ds => {
                        const v = vehicles.find(x => x.id === ds.vehicle_id);
                        const d = drivers.find(x => x.id === v?.driver_id);
                        const routeSales = sales.filter(s => ds.sale_ids.includes(s.id));

                        const completed = routeSales.filter(s => ['delivered', 'failed', 'partial'].includes(s.dispatch_status)).length;
                        const total = routeSales.length;
                        const progress = total > 0 ? (completed / total) * 100 : 0;
                        const hasIncidences = routeSales.some(s => s.dispatch_status === 'failed' || s.dispatch_status === 'partial');

                        return (
                           <div key={ds.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                              <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                                 <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{ds.code} <span className="text-xs font-normal text-slate-500 ml-1">({new Date(ds.date).toLocaleDateString()})</span></h3>
                                    <div className="text-xs text-slate-500 font-bold flex items-center mt-1">
                                       <Truck className="w-3 h-3 mr-1" /> {v?.plate} | <User className="w-3 h-3 ml-2 mr-1" /> {d?.name.split(' ')[0]}
                                    </div>
                                 </div>
                                 <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center shadow-sm">
                                    <PlayCircle className="w-3 h-3 mr-1 animate-pulse" /> EN RUTA
                                 </div>
                              </div>

                              <div className="mb-4 flex-1">
                                 <div className="flex justify-between text-sm mb-1 font-bold">
                                    <span className="text-slate-600">Avance de Reparto</span>
                                    <span className="text-slate-800">{completed} / {total} doc</span>
                                 </div>
                                 <div className="w-full bg-slate-100 rounded-full h-3 mb-1 shadow-inner overflow-hidden border border-slate-200">
                                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-1000 ease-in-out relative" style={{ width: `${progress}%` }}>
                                       <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                    </div>
                                 </div>
                                 <div className="text-[10px] text-slate-500 text-right">{progress.toFixed(0)}% Completado</div>
                              </div>

                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-auto">
                                 {hasIncidences ? (
                                    <div className="flex items-start text-amber-700">
                                       <AlertTriangle className="w-4 h-4 mr-2" />
                                       <div className="text-xs font-medium">Se han reportado incidencias (Entregas parciales o locales cerrados) durante esta ruta.</div>
                                    </div>
                                 ) : (
                                    <div className="flex items-start text-emerald-600">
                                       <CheckCircle className="w-4 h-4 mr-2" />
                                       <div className="text-xs font-medium">Sin incidencias reportadas por el momento. El reparto transcurre con normalidad.</div>
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         )}
      </div>
   );
};
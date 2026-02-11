import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { ShoppingBag, Plus, Trash2, Calendar, DollarSign, Package, CheckSquare, Save, CreditCard, AlertTriangle, Search, FileText, Loader2, XCircle, CheckCircle, Clock, Edit, List } from 'lucide-react';
import { PurchaseItem, Purchase } from '../types';

// Simple Toast Component
interface ToastProps {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => (
  <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded shadow-lg border-l-4 min-w-[300px] animate-fade-in-down bg-white ${type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
    {type === 'error' ? <XCircle className="w-6 h-6 text-red-500 mr-3" /> : <CheckCircle className="w-6 h-6 text-green-500 mr-3" />}
    <div className="flex-1">
      <h4 className={`font-bold text-sm ${type === 'error' ? 'text-red-800' : 'text-green-800'}`}>
        {type === 'error' ? 'Error' : 'Éxito'}
      </h4>
      <p className="text-xs text-slate-600">{message}</p>
    </div>
    <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600">
      <XCircle className="w-4 h-4" />
    </button>
  </div>
);

export const Purchases: React.FC = () => {
  const { products, suppliers, warehouses, purchases, createPurchase, updatePurchase } = useStore();
  
  const [activeTab, setActiveTab] = useState<'FORM' | 'LIST'>('LIST');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: 'error' | 'success' }>>([]);

  // === HEADER STATE ===
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [docType, setDocType] = useState('FACTURA');
  const [docNumber, setDocNumber] = useState('');
  
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]); // Default Today
  const [accountingDate, setAccountingDate] = useState(new Date().toISOString().split('T')[0]); 
  const [paymentCondition, setPaymentCondition] = useState('CONTADO');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [currency, setCurrency] = useState<'PEN'|'USD'>('PEN');
  const [exchangeRate, setExchangeRate] = useState(3.750); // Mock
  const [observation, setObservation] = useState('');
  
  const [calculateByTotal, setCalculateByTotal] = useState(false); // UI Toggle logic
  const [pricesIncludeIgv, setPricesIncludeIgv] = useState(true); // Input cost behavior

  // === LINE ITEM STATE ===
  const [selectedProduct, setSelectedProduct] = useState('');
  const [unitType, setUnitType] = useState<'UND'|'PKG'>('PKG'); // Default Box
  const [quantity, setQuantity] = useState<number>(1);
  
  // Three-way binding states
  const [inputCost, setInputCost] = useState<number>(0);       // Unit Cost (Displayed based on pricesIncludeIgv)
  const [inputSubtotal, setInputSubtotal] = useState<number>(0); // Total Value (Ex-Tax)
  const [inputTotal, setInputTotal] = useState<number>(0);       // Total Import (Inc-Tax)

  const [batchCode, setBatchCode] = useState('');
  const [expiry, setExpiry] = useState('');
  const [isBonus, setIsBonus] = useState(false);

  const [cart, setCart] = useState<PurchaseItem[]>([]);

  // Helper: Show Toast
  const showToast = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // Update Due Date based on condition
  useEffect(() => {
    if (paymentCondition === 'CONTADO') {
      setDueDate(issueDate);
    } else {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30); // Simple +30 default
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, [issueDate, paymentCondition]);

  // === CALCULATORS ===
  
  const handleUnitCostChange = (val: number) => {
    setInputCost(val);
    const qty = quantity || 1;
    let unitVal = 0;
    let unitPrice = 0;
    if (pricesIncludeIgv) {
      unitPrice = val;
      unitVal = val / 1.18;
    } else {
      unitVal = val;
      unitPrice = val * 1.18;
    }
    const subTotal = unitVal * qty;
    const total = unitPrice * qty;
    setInputSubtotal(parseFloat(subTotal.toFixed(2)));
    setInputTotal(parseFloat(total.toFixed(2)));
  };

  const handleSubtotalChange = (val: number) => {
    setInputSubtotal(val);
    const qty = quantity || 1;
    const total = val * 1.18;
    const unitVal = val / qty;
    const unitPrice = total / qty;
    setInputTotal(parseFloat(total.toFixed(2)));
    if (pricesIncludeIgv) {
      setInputCost(parseFloat(unitPrice.toFixed(4)));
    } else {
      setInputCost(parseFloat(unitVal.toFixed(4)));
    }
  };

  const handleTotalChange = (val: number) => {
    setInputTotal(val);
    const qty = quantity || 1;
    const subTotal = val / 1.18;
    const unitPrice = val / qty;
    const unitVal = subTotal / qty;
    setInputSubtotal(parseFloat(subTotal.toFixed(2)));
    if (pricesIncludeIgv) {
      setInputCost(parseFloat(unitPrice.toFixed(4)));
    } else {
      setInputCost(parseFloat(unitVal.toFixed(4)));
    }
  };

  useEffect(() => {
    handleUnitCostChange(inputCost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  useEffect(() => {
    if (!selectedProduct) return;
    const p = products.find(x => x.id === selectedProduct);
    if (!p) return;
    const factor = unitType === 'PKG' ? (p.package_content || 1) : 1;
    let baseCost = p.last_cost * factor; 
    if (pricesIncludeIgv) baseCost = baseCost * 1.18;
    handleUnitCostChange(parseFloat(baseCost.toFixed(4)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, unitType, products, pricesIncludeIgv]);


  const handleAddLine = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) { showToast("Seleccione un producto.", "error"); return; }
    if (isNaN(quantity) || quantity <= 0) { showToast("Cantidad inválida.", "error"); return; }
    
    const finalBatchCode = batchCode.trim() ? batchCode.toUpperCase().trim() : 'SIN LOTE';
    const finalExpiry = expiry || new Date().toISOString().split('T')[0];

    const p = products.find(x => x.id === selectedProduct);
    if (!p) return;

    const factor = unitType === 'PKG' ? (p.package_content || 1) : 1;
    const baseQty = Number(quantity) * factor;
    
    let unitPrice = 0; 
    let unitValue = 0;

    if (!isBonus) {
       if (pricesIncludeIgv) {
         unitPrice = inputCost;
         unitValue = inputCost / 1.18;
       } else {
         unitValue = inputCost;
         unitPrice = inputCost * 1.18;
       }
    }

    const totalLineValue = isBonus ? 0 : inputSubtotal; 
    const totalLineCost = isBonus ? 0 : inputTotal;

    const newItem: PurchaseItem = {
      product_id: selectedProduct,
      unit_type: unitType,
      quantity_presentation: Number(quantity),
      quantity_base: Number(baseQty),
      factor: factor,
      unit_value: unitValue,
      unit_price: unitPrice,
      total_value: totalLineValue,
      total_cost: totalLineCost,
      batch_code: finalBatchCode,
      expiration_date: finalExpiry,
      is_bonus: isBonus
    };

    setCart(prevCart => [...prevCart, newItem]);
    
    // Reset Line
    setQuantity(1); setIsBonus(false); setBatchCode(''); setExpiry(''); setSelectedProduct(''); 
    setInputCost(0); setInputSubtotal(0); setInputTotal(0);
  };

  const handleSave = async (status: 'PENDING' | 'PAID') => {
    if (!supplierId) { showToast("Falta seleccionar el Proveedor.", "error"); return; }
    if (!docNumber) { showToast("Falta ingresar el Número de Documento.", "error"); return; }
    if (cart.length === 0) { showToast("El carrito de compras está vacío.", "error"); return; }

    setIsProcessing(true);

    // Simulate API Delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const subtotal = cart.reduce((acc, item) => acc + item.total_value, 0);
    const total = cart.reduce((acc, item) => acc + item.total_cost, 0);
    const igv = total - subtotal;
    const supplier = suppliers.find(s => s.id === supplierId);

    const purchaseData: Purchase = {
      id: editingId || crypto.randomUUID(),
      supplier_id: supplier!.id,
      supplier_name: supplier!.name,
      warehouse_id: warehouseId,
      document_type: docType,
      document_number: docNumber,
      issue_date: issueDate,
      entry_date: entryDate,
      due_date: dueDate,
      accounting_date: accountingDate,
      observation: observation,
      currency: currency,
      exchange_rate: exchangeRate,
      subtotal: subtotal,
      igv: igv,
      total: total,
      payment_status: status,
      items: cart
    };

    if (editingId) {
      // UPDATE Logic (with Kardex Reversion)
      const success = updatePurchase(purchaseData);
      if (success) {
        showToast("Compra actualizada y Kardex rectificado correctamente.", "success");
        resetForm();
        setActiveTab('LIST');
      } else {
        showToast("No se puede editar: Los lotes de esta compra ya han sido vendidos.", "error");
      }
    } else {
      // CREATE Logic
      createPurchase(purchaseData);
      showToast(status === 'PAID' ? "Compra registrada y PAGADA." : "Compra registrada como PENDIENTE.", "success");
      resetForm();
    }
    
    setIsProcessing(false);
  };

  const resetForm = () => {
    setCart([]); setDocNumber(''); setSupplierId(''); setObservation('');
    setEditingId(null);
    setIssueDate(new Date().toISOString().split('T')[0]);
  };

  const handleEdit = (p: Purchase) => {
    if (p.payment_status === 'PAID') return; // Only pending for this demo logic, or allow if you want
    setEditingId(p.id);
    setSupplierId(p.supplier_id);
    setWarehouseId(p.warehouse_id);
    setDocType(p.document_type);
    setDocNumber(p.document_number);
    setIssueDate(p.issue_date);
    setEntryDate(p.entry_date);
    setAccountingDate(p.accounting_date || p.issue_date);
    setObservation(p.observation || '');
    setCurrency(p.currency);
    setCart(p.items);
    setActiveTab('FORM');
    showToast("Modo Edición: Se revertirá el stock anterior al guardar.", "success");
  };

  const sumTotalValue = cart.reduce((acc, item) => acc + item.total_value, 0); 
  const sumTotalImport = cart.reduce((acc, item) => acc + item.total_cost, 0); 
  const sumIgv = sumTotalImport - sumTotalValue;

  return (
    <div className="flex flex-col h-full space-y-3 font-sans text-xs relative">
      
      {/* --- TOAST CONTAINER --- */}
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}

      {/* --- LOADING OVERLAY --- */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg">
          <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Procesando Compra...</h3>
          <p className="text-slate-500 mt-2">Actualizando Kardex y Lotes</p>
        </div>
      )}

      {/* --- TABS --- */}
      <div className="flex space-x-1 bg-slate-200 p-1 rounded-t-lg w-fit">
        <button 
          onClick={() => { if(!editingId) setActiveTab('LIST'); else if(confirm("Salir de edición?")) { resetForm(); setActiveTab('LIST'); } }}
          className={`px-4 py-2 rounded font-bold flex items-center ${activeTab === 'LIST' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
        >
          <List className="w-4 h-4 mr-2" /> Historial Compras
        </button>
        <button 
          onClick={() => setActiveTab('FORM')}
          className={`px-4 py-2 rounded font-bold flex items-center ${activeTab === 'FORM' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
        >
          {editingId ? <><Edit className="w-4 h-4 mr-2" /> Editando Compra</> : <><Plus className="w-4 h-4 mr-2" /> Nuevo Registro</>}
        </button>
      </div>

      {activeTab === 'LIST' ? (
        <div className="bg-white p-4 rounded-b-lg shadow border border-slate-300 flex-1 overflow-auto">
           <table className="w-full text-left border-collapse">
             <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
               <tr>
                 <th className="p-3">F. Emisión</th>
                 <th className="p-3">Documento</th>
                 <th className="p-3">Proveedor</th>
                 <th className="p-3 text-right">Total</th>
                 <th className="p-3 text-center">Estado</th>
                 <th className="p-3"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {purchases.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay compras registradas.</td></tr>}
               {purchases.map(p => (
                 <tr key={p.id} className="hover:bg-slate-50">
                   <td className="p-3 text-slate-600">{p.issue_date}</td>
                   <td className="p-3 font-medium text-slate-800">{p.document_type} {p.document_number}</td>
                   <td className="p-3 text-slate-600">{p.supplier_name}</td>
                   <td className="p-3 text-right font-bold text-slate-900">
                     {p.currency === 'USD' ? '$' : 'S/'} {p.total.toFixed(2)}
                   </td>
                   <td className="p-3 text-center">
                     <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.payment_status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                       {p.payment_status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                     </span>
                   </td>
                   <td className="p-3 text-right">
                      {p.payment_status === 'PENDING' ? (
                        <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-end">
                          <Edit className="w-4 h-4 mr-1" /> Editar
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Cerrado</span>
                      )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      ) : (
        <>
          {/* === HEADER CARD === */}
          <div className="bg-white p-3 rounded shadow-sm border border-slate-300">
            {/* Top Row: Type, Series, Supplier, Warehouse */}
            <div className="flex flex-wrap gap-4 mb-2">
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700 w-16">Tipo Doc:</label>
                  <select className="border border-slate-300 p-1 rounded bg-slate-50 w-24" value={docType} onChange={e => setDocType(e.target.value)}>
                    <option value="FACTURA">FACTURA</option>
                    <option value="BOLETA">BOLETA</option>
                    <option value="GUIA">GUIA</option>
                  </select>
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Nro:</label>
                  <input className="border border-slate-300 p-1 rounded w-32 font-bold" value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="F001-00001" />
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Moneda:</label>
                  <select className="border border-slate-300 p-1 rounded w-20" value={currency} onChange={e => setCurrency(e.target.value as any)}>
                    <option value="PEN">SOLES</option>
                    <option value="USD">DOLAR</option>
                  </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                  <label className="font-bold text-slate-700">TC:</label>
                  <input className="border border-slate-300 p-1 rounded w-16 text-right bg-slate-50" value={exchangeRate} readOnly />
              </div>
            </div>

            {/* Dates Row */}
            <div className="flex flex-wrap gap-4 mb-2 border-t border-slate-100 pt-2">
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700 w-16">F. Emisión:</label>
                  <input type="date" className="border border-slate-300 p-1 rounded" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Vencimiento:</label>
                  <input type="date" className="border border-slate-300 p-1 rounded" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">F. Ingreso:</label>
                  <input type="date" className="border border-slate-300 p-1 rounded bg-blue-50" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">F. Contable:</label>
                  <input type="date" className="border border-slate-300 p-1 rounded" value={accountingDate} onChange={e => setAccountingDate(e.target.value)} />
              </div>
            </div>

            {/* Supplier & Warehouse Row */}
            <div className="flex flex-wrap gap-4 mb-2 border-t border-slate-100 pt-2">
              <div className="flex-1 flex items-center gap-2 min-w-[300px]">
                  <label className="font-bold text-slate-700 w-16">Proveedor:</label>
                  <select className="flex-1 border border-slate-300 p-1 rounded bg-yellow-50" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    <option value="">-- Seleccionar Proveedor --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.ruc} | {s.name}</option>)}
                  </select>
              </div>
              <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Almacén:</label>
                  <select className="border border-slate-300 p-1 rounded" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
              </div>
            </div>
            
            {/* Obs & Checks */}
            <div className="flex items-center gap-4 border-t border-slate-100 pt-2">
                <div className="flex-1 flex items-center gap-2">
                  <label className="font-bold text-slate-700 w-16">Glosa/Obs:</label>
                  <input className="flex-1 border border-slate-300 p-1 rounded" value={observation} onChange={e => setObservation(e.target.value)} />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center text-slate-700 cursor-pointer select-none">
                      <input type="checkbox" className="mr-1" checked={pricesIncludeIgv} onChange={e => setPricesIncludeIgv(e.target.checked)} />
                      Precios incluyen IGV
                  </label>
                  <label className="flex items-center text-slate-700 cursor-pointer select-none">
                      <input type="checkbox" className="mr-1" checked={calculateByTotal} onChange={e => setCalculateByTotal(e.target.checked)} />
                      Calc. Base Total
                  </label>
                </div>
            </div>
          </div>

          {/* === GRID ENTRY BAR === */}
          <div className="bg-slate-200 p-2 rounded border border-slate-300 grid grid-cols-12 gap-2 items-end shadow-inner">
            {/* Product */}
            <div className="col-span-3">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Producto</label>
                <select 
                  className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                >
                  <option value="">-- Seleccionar --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} | {p.name}</option>)}
                </select>
            </div>

            {/* Qty */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Cant.</label>
                <input type="number" className="w-full border border-slate-300 rounded p-1.5 text-center font-bold" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
            {/* Unit */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Unidad</label>
                <select className="w-full border border-slate-300 rounded p-1.5 text-[10px]" value={unitType} onChange={e => setUnitType(e.target.value as any)}>
                    <option value="PKG">CAJA</option>
                    <option value="UND">UND</option>
                </select>
            </div>

            {/* Cost (Shortened) */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-right whitespace-nowrap overflow-hidden">
                    {pricesIncludeIgv ? 'P.Unit' : 'V.Unit'}
                </label>
                <input 
                    type="number" 
                    className={`w-full border border-slate-300 rounded p-1.5 text-right font-bold text-[10px] ${isBonus ? 'bg-slate-300 text-slate-500' : 'bg-white'}`} 
                    value={isBonus ? 0 : inputCost} 
                    onChange={e => handleUnitCostChange(Number(e.target.value))} 
                    disabled={isBonus}
                />
            </div>

            {/* Subtotal (Valor Venta) */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-right text-green-700">SubTotal</label>
                <input 
                    type="number" 
                    className={`w-full border border-green-300 rounded p-1.5 text-right font-bold text-[10px] ${isBonus ? 'bg-slate-300 text-slate-500' : 'bg-white text-green-800'}`} 
                    value={isBonus ? 0 : inputSubtotal} 
                    onChange={e => handleSubtotalChange(Number(e.target.value))} 
                    disabled={isBonus}
                    placeholder="Val Vta"
                />
            </div>

            {/* Total (Importe Total) */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-right text-blue-700">Total</label>
                <input 
                    type="number" 
                    className={`w-full border border-blue-300 rounded p-1.5 text-right font-bold text-[10px] ${isBonus ? 'bg-slate-300 text-slate-500' : 'bg-white text-blue-800'}`} 
                    value={isBonus ? 0 : inputTotal} 
                    onChange={e => handleTotalChange(Number(e.target.value))} 
                    disabled={isBonus}
                    placeholder="Total"
                />
            </div>

            {/* Batch */}
            <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Lote</label>
                <input className="w-full border border-slate-300 rounded p-1.5 uppercase placeholder:text-slate-400 text-[10px]" placeholder="-" value={batchCode} onChange={e => setBatchCode(e.target.value)} />
            </div>
            {/* Expiry */}
            <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Vencimiento</label>
                <div className="flex gap-1">
                    <input type="date" className="w-full border border-slate-300 rounded p-1.5 text-[10px]" value={expiry} onChange={e => setExpiry(e.target.value)} />
                    <div className="flex items-center bg-white px-1 border border-slate-300 rounded">
                      <input type="checkbox" checked={isBonus} onChange={e => setIsBonus(e.target.checked)} title="Bonificación" />
                    </div>
                </div>
            </div>

            {/* Add Button */}
            <div className="col-span-1">
                <button type="button" onClick={handleAddLine} className="w-full bg-slate-800 text-white p-1.5 rounded hover:bg-slate-700 flex justify-center shadow">
                  <Plus className="w-4 h-4" />
                </button>
            </div>
          </div>

          {/* === DATA TABLE === */}
          <div className="flex-1 bg-white border border-slate-300 rounded overflow-hidden shadow-sm flex flex-col">
            <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 text-[11px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-8 text-center bg-slate-100">...</th>
                    <th className="p-2 w-10 text-center bg-slate-100">#</th>
                    <th className="p-2 w-20 bg-slate-100">Código</th>
                    <th className="p-2 bg-slate-100">Producto</th>
                    <th className="p-2 w-16 text-right bg-slate-100">Cant.</th>
                    <th className="p-2 w-16 text-center bg-slate-100">Psnt</th>
                    <th className="p-2 w-12 text-center bg-slate-100">Fct</th>
                    <th className="p-2 w-20 text-right bg-slate-100 text-blue-800">Imp Unit</th>
                    <th className="p-2 w-20 text-right bg-slate-100 text-green-800">Uni Val</th>
                    <th className="p-2 w-24 text-right bg-slate-100 text-green-800">ValVta Tot</th>
                    <th className="p-2 w-24 text-right bg-slate-100 text-blue-800">Imp Tot</th>
                    <th className="p-2 w-8 bg-slate-100"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item, idx) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={idx} className={`hover:bg-blue-50 text-[11px] ${item.is_bonus ? 'bg-yellow-50' : ''}`}>
                        <td className="p-2 text-center text-slate-400"><FileText className="w-3 h-3" /></td>
                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-mono text-slate-600">{p?.sku}</td>
                        <td className="p-2 font-medium text-slate-900 truncate max-w-[200px]">{p?.name}</td>
                        <td className="p-2 text-right font-bold">{item.quantity_presentation.toFixed(2)}</td>
                        <td className="p-2 text-center">{item.unit_type}</td>
                        <td className="p-2 text-center text-slate-500">{item.factor}</td>
                        <td className="p-2 text-right text-blue-700 font-mono">{item.unit_price.toFixed(4)}</td>
                        <td className="p-2 text-right text-green-700 font-mono">{item.unit_value.toFixed(4)}</td>
                        <td className="p-2 text-right font-bold text-green-900">{item.total_value.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold text-blue-900">{item.total_cost.toFixed(2)}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                        </td>
                    </tr>
                  );
                })}
                {cart.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-10 text-center text-slate-400 italic">
                          No hay items ingresados. Use la barra superior para agregar productos.
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
          
          {/* === FOOTER TOTALS === */}
          <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 flex items-center gap-2">
                <button className="px-4 py-2 bg-slate-200 border border-slate-300 rounded text-slate-700 text-xs font-bold hover:bg-slate-300">Receptor Electrónico</button>
                <button className="px-4 py-2 bg-slate-200 border border-slate-300 rounded text-slate-700 text-xs font-bold hover:bg-slate-300">Calcular Precio</button>
                <button className="px-4 py-2 bg-slate-200 border border-slate-300 rounded text-slate-700 text-xs font-bold hover:bg-slate-300">Const. Detracción</button>
              </div>
              <div className="col-span-4 bg-white border border-slate-300 rounded p-2 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-600 font-bold">Val. Afecto:</span>
                    <span className="font-mono">{sumTotalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-600 font-bold">Val. Inafecto:</span>
                    <span className="font-mono">0.00</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-600 font-bold">IGV (18%):</span>
                    <span className="font-mono">{sumIgv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 text-sm">
                    <span className="text-slate-800 font-bold">TOTAL FINAL:</span>
                    <span className="font-bold text-slate-900 font-mono">{sumTotalImport.toFixed(2)}</span>
                  </div>
              </div>
          </div>

          {/* Save Buttons */}
          <div className="flex justify-end gap-2">
            <button onClick={() => handleSave('PENDING')} className="bg-slate-600 text-white px-6 py-2 rounded hover:bg-slate-700 font-bold shadow-sm">
                Guardar Pendiente
            </button>
            <button onClick={() => handleSave('PAID')} className={`bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold shadow-sm ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!!editingId}>
                Procesar y Pagar
            </button>
          </div>
        </>
      )}
    </div>
  );
};
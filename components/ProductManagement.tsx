import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product } from '../types';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Search, Save, Plus, ArrowLeft, Barcode, DollarSign, Upload, Download, Truck, RefreshCw, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export const ProductManagement: React.FC = () => {
  const {
    products: mockProducts, suppliers: mockSuppliers, 
    addProduct: mockAddProduct, updateProduct: mockUpdateProduct,
    categories, subcategories, brands, unitTypes, packageTypes,
    addCategory, addSubcategory, addBrand, addUnitType, addPackageType
  } = useStore();
  
  const [realProducts, setRealProducts] = useState<Product[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // --- ESTADOS PARA ALTA RÁPIDA DE PROVEEDOR ---
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ ruc: '', name: '' });
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    if (!USE_MOCK_DB) {
      setIsLoading(true);
      const { data: pData } = await supabase.from('products').select('*').order('name');
      if (pData) setRealProducts(pData as Product[]);
      
      const { data: sData } = await supabase.from('suppliers').select('*').order('name');
      if (sData) setRealSuppliers(sData);
      setIsLoading(false);
    }
  };

  const products = USE_MOCK_DB ? mockProducts : realProducts;
  const suppliers = USE_MOCK_DB ? mockSuppliers : realSuppliers;

  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'PRECIOS'>('DETALLE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const initialFormState: Partial<Product> = {
    sku: '', barcode: '', name: '',
    unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 12,
    line: '', category: '', subcategory: '', brand: '',
    supplier_id: '',
    weight: 0, volume: 0, tax_igv: 18, tax_isc: 0,
    min_stock: 10, last_cost: 0, profit_margin: 30, price_unit: 0, price_package: 0,
    is_active: true, allow_sell: true
  };

  const [formData, setFormData] = useState<Partial<Product>>(initialFormState);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (p: Product) => {
    setFormData({ ...p });
    setActiveTab('DETALLE');
    setViewMode('DETAIL');
  };

  const handleNew = () => {
    const nextCode = String(products.length + 1000).padStart(6, '0');
    setFormData({ ...initialFormState, sku: nextCode, barcode: nextCode });
    setActiveTab('DETALLE');
    setViewMode('DETAIL');
  };

 // --- GUARDADO ESTRICTO DE PRODUCTO ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || formData.sku.trim() === '') {
      alert("El código de producto no puede estar vacío");
      return;
    }

    const duplicate = products.find(p => p.sku === formData.sku && p.id !== formData.id);
    if (duplicate) {
      alert(`Ya existe un producto con el código ${formData.sku}. Ingrese un código único.`);
      return;
    }

    setIsSaving(true);

    try {
      if (USE_MOCK_DB) {
        if (formData.id) mockUpdateProduct(formData as Product);
        else mockAddProduct({ ...formData, id: crypto.randomUUID() } as Product);
        setViewMode('LIST');
      } else {
        // Clonamos los datos para limpiarlos antes de enviarlos
        const payload: any = { ...formData };
        
        // BLINDAJE UUID: Si no hay proveedor, debe ser estrictamente null, no un texto vacío ""
        if (!payload.supplier_id || payload.supplier_id === '') {
           payload.supplier_id = null;
        }

        if (formData.id) {
          const { data, error } = await supabase.from('products').update(payload).eq('id', formData.id).select();
          if (error) throw error;
          if (data && data.length > 0) {
             setRealProducts(prev => prev.map(p => p.id === formData.id ? data[0] as Product : p));
             mockUpdateProduct(data[0] as Product); 
          }
        } else {
          const newId = crypto.randomUUID();
          payload.id = newId;
          const { data, error } = await supabase.from('products').insert([payload]).select();
          if (error) throw error;
          if (data && data.length > 0) {
             setRealProducts(prev => [...prev, data[0] as Product]);
             mockAddProduct(data[0] as Product);
          }
        }
        setViewMode('LIST');
      }
    } catch (err: any) {
      alert("Error de Base de Datos: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };
 // --- ALTA RÁPIDA DE PROVEEDOR ---
  const handleQuickSupplierSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;
    setIsSavingSupplier(true);

    try {
       const payload = {
          id: crypto.randomUUID(),
          ruc: newSupplier.ruc || '00000000000',
          name: newSupplier.name.toUpperCase()
       };

       const { data, error } = await supabase.from('suppliers').insert([payload]).select();
       if (error) throw error;

       if (data && data.length > 0) {
          const createdSupplier = data[0];
          // Añadimos el proveedor a la lista y lo seleccionamos automáticamente
          setRealSuppliers(prev => [...prev, createdSupplier]);
          setFormData(prev => ({ ...prev, supplier_id: createdSupplier.id }));
          
          setIsSupplierModalOpen(false);
          setNewSupplier({ ruc: '', name: '' });
       }
    } catch (err: any) {
       alert("Error creando proveedor: " + err.message);
    } finally {
       setIsSavingSupplier(false);
    }
  };

  // --- IMPORTACIÓN MASIVA OPTIMIZADA (BULK INSERT) ---
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let skippedCount = 0;
        const newProductsToInsert: any[] = [];

        data.forEach((row: any) => {
          const skuStr = String(row.sku || row.SKU || row.codigo || row.Codigo || '').trim();
          if (!skuStr) { skippedCount++; return; }

          // Evitar duplicados contra el estado actual
          if (products.find(p => p.sku === skuStr)) { skippedCount++; return; }

          let foundSupplierId = null;
          const supplierStr = String(row.supplier || row.proveedor || row.Proveedor || '').trim();
          if (supplierStr) {
            const supp = suppliers.find(s => s.name.toLowerCase() === supplierStr.toLowerCase() || s.id === supplierStr);
            if (supp) foundSupplierId = supp.id;
          }

          const baseCost = Number(row.last_cost || row.costo || 0);
          const margin = Number(row.profit_margin || row.margen || 30);
          const factor = Number(row.package_content || row.factor || 1);
          
          let unitPrice = Number(row.price_unit || row.precio_unidad || 0);
          let pkgPrice = Number(row.price_package || row.precio_caja || 0);

          if (unitPrice === 0 && baseCost > 0) {
             unitPrice = parseFloat((baseCost * (1 + (margin / 100))).toFixed(2));
             if (pkgPrice === 0) pkgPrice = parseFloat((unitPrice * factor * 0.95).toFixed(2));
          }

          newProductsToInsert.push({
            id: crypto.randomUUID(),
            sku: skuStr,
            barcode: String(row.barcode || row.Barcode || row.codigo_barras || skuStr),
            name: String(row.name || row.Name || row.nombre || row.Nombre || 'Sin Nombre').toUpperCase(),
            unit_type: String(row.unit_type || row.unidad || 'BOTELLA').toUpperCase(),
            package_type: String(row.package_type || row.empaque || 'CAJA').toUpperCase(),
            package_content: factor,
            line: String(row.line || row.linea || '').toUpperCase(),
            category: String(row.category || row.categoria || '').toUpperCase(),
            subcategory: String(row.subcategory || row.subcategoria || '').toUpperCase(),
            brand: String(row.brand || row.marca || '').toUpperCase(),
            supplier_id: foundSupplierId,
            weight: Number(row.weight || row.peso || 0),
            volume: Number(row.volume || row.volumen || 0),
            tax_igv: Number(row.tax_igv || row.igv || 18),
            tax_isc: Number(row.tax_isc || row.isc || 0),
            min_stock: Number(row.min_stock || row.stock_minimo || 10),
            last_cost: baseCost,
            profit_margin: margin,
            price_unit: unitPrice,
            price_package: pkgPrice,
            is_active: true,
            allow_sell: true
          });
        });

        if (newProductsToInsert.length > 0) {
           if (USE_MOCK_DB) {
              newProductsToInsert.forEach(p => mockAddProduct(p as Product));
           } else {
              const { error } = await supabase.from('products').insert(newProductsToInsert);
              if (error) throw error;
           }
           await fetchCatalog(); // Recargar todo para asegurar consistencia
        }

        alert(`Importación Masiva Exitosa.\n✅ Agregados: ${newProductsToInsert.length}\n⚠️ Omitidos (Duplicados/Sin Código): ${skippedCount}`);

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error: any) {
        alert("Error crítico en importación masiva: " + error.message);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExport = () => {
    let exportData = products.map(p => {
      const supp = suppliers.find(s => s.id === p.supplier_id);
      return {
        codigo: p.sku, codigo_barras: p.barcode, nombre: p.name,
        unidad: p.unit_type, empaque: p.package_type, factor: p.package_content,
        linea: p.line, categoria: p.category, subcategoria: p.subcategory, marca: p.brand, proveedor: supp ? supp.name : '',
        peso: p.weight, volumen: p.volume, igv: p.tax_igv, isc: p.tax_isc, stock_minimo: p.min_stock,
        costo: p.last_cost, margen: p.profit_margin, precio_unidad: p.price_unit, precio_caja: p.price_package
      };
    });

    if (exportData.length === 0) {
      exportData = [{
        codigo: 'EX-001', codigo_barras: 'EX-001', nombre: 'PRODUCTO EJEMPLO', unidad: 'BOTELLA', empaque: 'CAJA', factor: 12,
        linea: 'LICORES', categoria: 'WHISKY', subcategoria: 'ESCOCES', marca: 'EJEMPLO', proveedor: 'PROVEEDOR SAC', peso: 1, volumen: 0.75,
        igv: 18, isc: 0, stock_minimo: 5, costo: 100, margen: 30, precio_unidad: 130, precio_caja: 1482
      } as any];
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "Modelo_Productos_Maestro.xlsx");
  };

  // Pricing Calculation Helper (Mantiene lógica original)
  const calculatePrices = () => {
    const cost = Number(formData.last_cost) || 0;
    const margin = Number(formData.profit_margin) || 0;
    const factor = Number(formData.package_content) || 1;

    const unitPrice = cost * (1 + (margin / 100));
    const pkgPrice = unitPrice * factor * 0.95; // 5% discount default

    setFormData(prev => ({
      ...prev,
      price_unit: parseFloat(unitPrice.toFixed(2)),
      price_package: parseFloat(pkgPrice.toFixed(2))
    }));
  };

  if (viewMode === 'DETAIL') {
    return (
      <div className="flex flex-col h-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden relative">
        <div className="bg-slate-700 text-white p-3 flex justify-between items-center shadow-md z-10">
          <h2 className="font-bold text-sm flex items-center">
            {formData.id ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'} - <span className="ml-2 text-blue-300 font-mono">{formData.sku || 'SIN CÓDIGO'}</span>
          </h2>
          <button onClick={() => !isSaving && setViewMode('LIST')} disabled={isSaving} className="bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded text-xs font-bold border border-slate-500 disabled:opacity-50 transition-colors">
            <ArrowLeft className="w-4 h-4 inline mr-1" /> Volver al Catálogo
          </button>
        </div>

        <div className="flex bg-slate-200 border-b border-slate-300 z-10 shadow-sm">
          <button
            onClick={() => setActiveTab('DETALLE')}
            className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'DETALLE' ? 'bg-white border-t-4 border-blue-600 text-blue-800' : 'text-slate-600 hover:bg-slate-300 border-t-4 border-transparent'}`}
          >
            1. Detalle General y Jerarquía
          </button>
          <button
            onClick={() => setActiveTab('PRECIOS')}
            className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'PRECIOS' ? 'bg-white border-t-4 border-emerald-600 text-emerald-800' : 'text-slate-600 hover:bg-slate-300 border-t-4 border-transparent'}`}
          >
            2. Costos y Estructura de Precios
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <form id="product-form" onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6 pb-20">

            <div className="grid grid-cols-12 gap-4 bg-white p-5 rounded-lg shadow-sm border border-slate-200">
              <div className="col-span-8">
                <label className="block text-xs font-bold text-slate-700 mb-1">NOMBRE DEL PRODUCTO</label>
                <input
                  className="w-full border border-slate-300 p-2.5 rounded text-sm uppercase text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">CÓDIGO INTERNO (SKU)</label>
                <input className="w-full border border-slate-300 p-2.5 rounded text-sm font-mono font-bold bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} required />
              </div>
              <div className="col-span-2 relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">CÓDIGO DE BARRAS</label>
                <div className="relative">
                  <Barcode className="absolute left-2.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full border border-slate-300 p-2.5 pl-9 rounded text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {activeTab === 'DETALLE' && (
              <div className="space-y-6 animate-fade-in">
                {/* MATRIZ DE JERARQUÍA Y PESO */}
                <fieldset className="border-l-4 border-blue-500 bg-white p-5 rounded shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Estructura Base y Peso (Kardex)</h3>
                  <div className="grid grid-cols-12 gap-6 items-end">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">UND Mínima de Venta</label>
                      <div className="flex">
                        <select className="w-full border border-slate-300 p-2 rounded-l text-sm font-bold text-slate-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.unit_type} onChange={e => setFormData({ ...formData, unit_type: e.target.value })}>
                          <option value="">Sel...</option>
                          {unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <button type="button" onClick={() => {
                          const val = prompt('Nueva Unidad Base:');
                          if (val) { addUnitType(val.toUpperCase()); setFormData({ ...formData, unit_type: val.toUpperCase() }) }
                        }} className="bg-slate-800 text-white px-2 rounded-r hover:bg-slate-700"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    {/* ENLACE DIRECTO DE PESO A LA UNIDAD BASE */}
                    <div className="col-span-3 relative">
                      <div className="absolute -top-3 left-0 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Atado a {formData.unit_type || 'UND'}</div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 mt-2">Peso Unitario (Kg)</label>
                      <input type="number" step="0.001" className="w-full border border-slate-300 p-2 rounded text-sm text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.weight} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Empaque Mayor</label>
                      <div className="flex">
                        <select className="w-full border border-slate-300 p-2 rounded-l text-sm font-bold text-slate-900 bg-purple-50 focus:ring-2 focus:ring-purple-500 outline-none" value={formData.package_type} onChange={e => setFormData({ ...formData, package_type: e.target.value })}>
                          <option value="">Sel...</option>
                          {packageTypes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button type="button" onClick={() => {
                          const val = prompt('Nuevo Empaque:');
                          if (val) { addPackageType(val.toUpperCase()); setFormData({ ...formData, package_type: val.toUpperCase() }) }
                        }} className="bg-slate-800 text-white px-2 rounded-r hover:bg-slate-700"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Unidades x Empaque</label>
                      <div className="relative">
                         <input type="number" className="w-full border border-slate-300 p-2 pl-8 rounded text-sm text-center font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" value={formData.package_content} onChange={e => setFormData({ ...formData, package_content: Number(e.target.value) })} />
                         <span className="absolute left-3 top-2 text-slate-400 font-bold">X</span>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* CLASIFICACIÓN Y PROVEEDOR */}
                <div className="grid grid-cols-2 gap-6">
                  <fieldset className="bg-white p-5 rounded shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Clasificación de Catálogo</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Línea de Negocio</label>
                        <select className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900" value={formData.line} onChange={e => setFormData({ ...formData, line: e.target.value })}>
                          <option value="">Seleccione...</option>
                          <option value="LICORES">LICORES</option>
                          <option value="BEBIDAS">BEBIDAS</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-bold text-slate-600">Categoría</label>
                             <button type="button" onClick={() => {
                               const val = prompt('Nueva Categoría:');
                               if (val) { addCategory(val.toUpperCase()); setFormData({ ...formData, category: val.toUpperCase() }) }
                             }} className="bg-slate-100 text-blue-600 font-bold hover:bg-slate-200 px-2 py-0.5 rounded text-[10px]">Añadir</button>
                           </div>
                           <select className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                             <option value="">Sel...</option>
                             {categories.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                         </div>
                         <div>
                           <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-bold text-slate-600">Sub-Categoría</label>
                             <button type="button" onClick={() => {
                               const val = prompt('Nueva Sub-Cat:');
                               if (val) { addSubcategory(val.toUpperCase()); setFormData({ ...formData, subcategory: val.toUpperCase() }) }
                             }} className="bg-slate-100 text-blue-600 font-bold hover:bg-slate-200 px-2 py-0.5 rounded text-[10px]">Añadir</button>
                           </div>
                           <select className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.subcategory} onChange={e => setFormData({ ...formData, subcategory: e.target.value })}>
                             <option value="">Sel...</option>
                             {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                           </select>
                         </div>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="bg-white p-5 rounded shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Origen y Configuración</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Proveedor Principal</label>
                        <div className="flex">
                           <select className="w-full border border-slate-300 p-2 rounded-l text-sm text-slate-900 font-medium bg-amber-50" value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}>
                             <option value="">Seleccione Proveedor...</option>
                             {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                           {/* BOTÓN ALTA RÁPIDA PROVEEDOR */}
                           <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="bg-amber-600 text-white px-3 rounded-r hover:bg-amber-700 flex items-center justify-center font-bold text-xs shadow-inner" title="Alta Rápida de Proveedor">
                              <Truck className="w-4 h-4 mr-1" /> NUEVO
                           </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-bold text-slate-600">Marca</label>
                             <button type="button" onClick={() => {
                               const val = prompt('Nueva Marca:');
                               if (val) { addBrand(val.toUpperCase()); setFormData({ ...formData, brand: val.toUpperCase() }) }
                             }} className="bg-slate-100 text-blue-600 font-bold hover:bg-slate-200 px-2 py-0.5 rounded text-[10px]">Añadir</button>
                           </div>
                           <select className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })}>
                             <option value="">Sel...</option>
                             {brands.map(b => <option key={b} value={b}>{b}</option>)}
                           </select>
                         </div>
                         <div className="flex flex-col justify-end space-y-2 pb-1">
                           <label className="flex items-center text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-1.5 rounded border border-slate-200">
                             <input type="checkbox" className="mr-3 h-4 w-4 text-emerald-600 rounded" checked={formData.allow_sell} onChange={e => setFormData({ ...formData, allow_sell: e.target.checked })} />
                             Permitir Venta (Visible POS)
                           </label>
                           <label className="flex items-center text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-1.5 rounded border border-slate-200">
                             <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600 rounded" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                             Producto Activo
                           </label>
                         </div>
                      </div>
                    </div>
                  </fieldset>
                </div>
              </div>
            )}

            {activeTab === 'PRECIOS' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium flex items-start shadow-sm">
                  <span className="text-xl mr-3">💡</span>
                  <div>
                     <strong>Regla de Negocio:</strong> El costo base que ingreses se considera para 1 <strong className="uppercase">{formData.unit_type || 'UNIDAD'}</strong>. Al recalcular, el sistema proyectará automáticamente el precio de venta de la caja multiplicado por el factor de contenido.
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                  {/* COSTOS */}
                  <div className="col-span-5 bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 border-b pb-2 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-slate-500"/> Estructura de Costos</h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Costo Base / {formData.unit_type || 'UND'} (Inc. IGV)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <input type="number" step="0.01" className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold text-lg focus:border-emerald-500 focus:ring-0 outline-none transition-colors" value={formData.last_cost} onChange={e => setFormData({ ...formData, last_cost: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Margen Ganancia Esperado (%)</label>
                        <div className="relative">
                           <input type="number" step="1" className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold text-lg focus:border-emerald-500 outline-none" value={formData.profit_margin} onChange={e => setFormData({ ...formData, profit_margin: Number(e.target.value) })} />
                           <span className="absolute right-4 top-3 font-bold text-slate-400">%</span>
                        </div>
                      </div>
                      <button type="button" onClick={calculatePrices} className="w-full bg-emerald-100 text-emerald-800 border border-emerald-200 py-3 rounded-lg text-sm font-bold hover:bg-emerald-200 hover:shadow-md transition-all active:scale-95 flex justify-center items-center">
                        <RefreshCw className="w-4 h-4 mr-2" /> RECALCULAR PROYECCIÓN
                      </button>
                    </div>
                  </div>

                  {/* PRECIOS FINALES */}
                  <div className="col-span-7 bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 border-b pb-2">Precios Finales de Venta al Público</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Precio x {formData.unit_type || 'Unidad'}</label>
                        <div className="relative">
                           <span className="absolute left-3 top-3 text-blue-800 font-bold">S/</span>
                           <input type="number" step="0.01" className="w-full border-2 border-blue-200 pl-8 p-3 rounded-lg text-2xl font-black text-blue-900 bg-white focus:border-blue-500 outline-none" value={formData.price_unit} onChange={e => setFormData({ ...formData, price_unit: Number(e.target.value) })} />
                        </div>
                        <p className="text-[10px] text-blue-600 mt-2 font-medium text-center">Unidad Mínima de Despacho</p>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <label className="block text-xs font-bold text-purple-800 mb-2 uppercase">Precio x {formData.package_type || 'Empaque'} (x{formData.package_content || 1})</label>
                        <div className="relative">
                           <span className="absolute left-3 top-3 text-purple-800 font-bold">S/</span>
                           <input type="number" step="0.01" className="w-full border-2 border-purple-200 pl-8 p-3 rounded-lg text-2xl font-black text-purple-900 bg-white focus:border-purple-500 outline-none" value={formData.price_package} onChange={e => setFormData({ ...formData, price_package: Number(e.target.value) })} />
                        </div>
                        <p className="text-[10px] text-purple-600 mt-2 font-medium text-center">Aplica descuento sugerido del 5%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* BOTTOM ACTION BAR ESTÁTICA */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
           <div className="text-xs font-bold text-slate-500">
             Asegúrese de revisar la proyección de precios antes de guardar.
           </div>
           <button type="submit" form="product-form" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-600/30 flex items-center transition-all active:scale-95 disabled:opacity-50">
             {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
             {isSaving ? 'GUARDANDO EN NUBE...' : 'GUARDAR PRODUCTO'}
           </button>
        </div>

        {/* MODAL ALTA RÁPIDA PROVEEDOR */}
        {isSupplierModalOpen && (
           <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                <div className="bg-amber-600 p-4 text-white flex justify-between items-center">
                   <h3 className="font-bold flex items-center"><Truck className="mr-2 w-5 h-5" /> Nuevo Proveedor Rápido</h3>
                   <button onClick={() => !isSavingSupplier && setIsSupplierModalOpen(false)} className="hover:text-amber-200"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleQuickSupplierSave} className="p-6 space-y-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-1">RUC (Opcional)</label>
                     <input className="w-full border border-slate-300 p-2.5 rounded outline-none focus:ring-2 focus:ring-amber-500" value={newSupplier.ruc} onChange={e => setNewSupplier({...newSupplier, ruc: e.target.value})} placeholder="11 o 8 dígitos" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-1">Razón Social / Nombre Comercial *</label>
                     <input required className="w-full border border-slate-300 p-2.5 rounded uppercase outline-none focus:ring-2 focus:ring-amber-500 font-bold" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} placeholder="Ej. DISTRIBUIDORA DEL SUR" />
                   </div>
                   <button type="submit" disabled={isSavingSupplier} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow mt-2 disabled:opacity-50 flex justify-center items-center">
                     {isSavingSupplier ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                     Guardar y Seleccionar
                   </button>
                </form>
             </div>
           </div>
        )}
      </div>
    );
  }

  // --- VISTA DE LISTADO ---
  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 flex items-center">
          <Barcode className="w-6 h-6 mr-2 text-blue-600" /> Catálogo de Productos
        </h2>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv, .xlsx" className="hidden" />
          <button onClick={fetchCatalog} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200" title="Sincronizar con la Nube">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors text-sm font-bold">
            <Download className="w-4 h-4 mr-2" /> Exportar / Plantilla
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors text-sm font-bold disabled:opacity-50">
            {isImporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {isImporting ? 'Cargando BD...' : 'Carga Masiva Excel'}
          </button>
          <button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center shadow-md transition-colors text-sm font-bold shadow-blue-600/30">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg text-slate-800 shadow-inner focus:border-blue-500 outline-none font-medium"
              placeholder="Buscar por nombre, código SKU o marca..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 font-black uppercase text-[10px] tracking-wider shadow-sm z-10">
              <tr>
                <th className="p-4 border-b border-slate-200">Código Interno</th>
                <th className="p-4 border-b border-slate-200">Producto y Jerarquía</th>
                <th className="p-4 border-b border-slate-200">Marca / Categoría</th>
                <th className="p-4 border-b border-slate-200 text-right">Precio Base</th>
                <th className="p-4 border-b border-slate-200 text-right">Precio Mayor</th>
                <th className="p-4 border-b border-slate-200 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && products.length === 0 ? (
                 <tr><td colSpan={6} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"/> Sincronizando Catálogo...</td></tr>
              ) : filteredProducts.length === 0 ? (
                 <tr><td colSpan={6} className="p-12 text-center text-slate-500 font-bold">No hay productos que coincidan con la búsqueda.</td></tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => handleEdit(p)}>
                    <td className="p-4 font-mono font-bold text-slate-700">{p.sku}</td>
                    <td className="p-4">
                       <div className="font-bold text-slate-900 text-base">{p.name}</div>
                       <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase flex items-center">
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{p.unit_type}</span>
                          <span className="mx-1">→</span>
                          <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded flex items-center">
                            {p.package_type} <X className="w-2.5 h-2.5 mx-0.5" /> {p.package_content}
                          </span>
                       </div>
                    </td>
                    <td className="p-4">
                       <div className="font-bold text-slate-700">{p.brand || '-'}</div>
                       <div className="text-xs text-slate-400">{p.category || 'SIN CATEGORÍA'}</div>
                    </td>
                    <td className="p-4 text-right">
                       <div className="font-black text-slate-800">S/ {p.price_unit.toFixed(2)}</div>
                       <div className="text-[10px] text-slate-400 font-bold">x {p.unit_type}</div>
                    </td>
                    <td className="p-4 text-right">
                       <div className="font-black text-emerald-700">S/ {p.price_package.toFixed(2)}</div>
                       <div className="text-[10px] text-emerald-600/60 font-bold">x {p.package_type}</div>
                    </td>
                    <td className="p-4 text-center">
                       {p.is_active ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">ACTIVO</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">INACTIVO</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

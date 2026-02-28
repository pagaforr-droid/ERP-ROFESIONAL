
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Product } from '../types';
import { Search, Save, Plus, ArrowLeft, Barcode, DollarSign } from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const { products, suppliers, addProduct, updateProduct } = useStore();
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'PRECIOS'>('DETALLE');

  const [searchTerm, setSearchTerm] = useState('');

  const initialFormState: Partial<Product> = {
    sku: '', barcode: '', name: '',
    unit_type: 'BOTELLA', package_type: 'CAJA', package_content: 1,
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
    setViewMode('DETAIL');
  };

  const handleNew = () => {
    // Auto generate code for demo
    const nextCode = String(products.length + 1000).padStart(6, '0');
    setFormData({ ...initialFormState, sku: nextCode, barcode: nextCode });
    setViewMode('DETAIL');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || formData.sku.trim() === '') {
      alert("El código de producto no puede estar vacío");
      return;
    }

    // Check duplicates
    const duplicate = products.find(p => p.sku === formData.sku && p.id !== formData.id);
    if (duplicate) {
      alert(`Ya existe un producto con el código ${formData.sku}. Por favor ingrese un código único.`);
      return;
    }

    if (formData.id) {
      updateProduct(formData as Product);
    } else {
      addProduct({ ...formData, id: crypto.randomUUID() } as Product);
    }
    setViewMode('LIST');
  };

  // Pricing Calculation Helper
  const calculatePrices = () => {
    const cost = Number(formData.last_cost) || 0;
    const margin = Number(formData.profit_margin) || 0;
    const factor = Number(formData.package_content) || 1;

    // Cost is now GROSS (Inc IGV)
    const unitPrice = cost * (1 + (margin / 100));
    const pkgPrice = unitPrice * factor * 0.95; // 5% discount on boxes rule of thumb

    setFormData(prev => ({
      ...prev,
      price_unit: parseFloat(unitPrice.toFixed(2)),
      price_package: parseFloat(pkgPrice.toFixed(2))
    }));
  };

  if (viewMode === 'DETAIL') {
    return (
      <div className="flex flex-col h-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-700 text-white p-3 flex justify-between items-center">
          <h2 className="font-bold text-sm flex items-center">
            {formData.id ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'} - {formData.sku}
          </h2>
          <button onClick={() => setViewMode('LIST')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded text-xs border border-slate-500">
            <ArrowLeft className="w-4 h-4 inline mr-1" /> Volver
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-200 border-b border-slate-300">
          <button
            onClick={() => setActiveTab('DETALLE')}
            className={`px-4 py-3 text-sm font-bold ${activeTab === 'DETALLE' ? 'bg-white border-t-2 border-blue-600 text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
          >
            Detalle General
          </button>
          <button
            onClick={() => setActiveTab('PRECIOS')}
            className={`px-4 py-3 text-sm font-bold ${activeTab === 'PRECIOS' ? 'bg-white border-t-2 border-blue-600 text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
          >
            Costos y Precios
          </button>
          <button className="px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed">Datos Secundarios</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">

            {/* Header Data */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <label className="block text-xs font-bold text-slate-700 mb-1">NOMBRE DEL PRODUCTO</label>
                <input
                  className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900 font-medium"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">CÓDIGO</label>
                <input className="w-full border border-slate-300 p-2 rounded text-sm font-mono bg-white text-slate-800" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} required />
              </div>
              <div className="col-span-2 relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">CÓDIGO BARRAS</label>
                <div className="relative">
                  <Barcode className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full border border-slate-300 p-2 pl-8 rounded text-sm font-mono text-slate-900"
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {activeTab === 'DETALLE' && (
              <>
                {/* Presentation Group */}
                <fieldset className="border border-slate-300 p-4 rounded bg-slate-50">
                  <legend className="text-xs font-bold text-slate-700 px-2 bg-slate-50">PRESENTACIÓN Y UNIDADES</legend>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Psnt UND (Base)</label>
                      <select
                        className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900"
                        value={formData.unit_type}
                        onChange={e => setFormData({ ...formData, unit_type: e.target.value })}
                      >
                        <option value="BOTELLA">BOTELLA</option>
                        <option value="UNIDAD">UNIDAD</option>
                        <option value="LATA">LATA</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Psnt EMP (Empaque)</label>
                      <select
                        className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900"
                        value={formData.package_type}
                        onChange={e => setFormData({ ...formData, package_type: e.target.value })}
                      >
                        <option value="CAJA">CAJA</option>
                        <option value="PAQUETE">PAQUETE</option>
                        <option value="DISPLAY">DISPLAY</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Contiene (Factor)</label>
                      <input
                        type="number"
                        className="w-full border border-slate-300 p-2 rounded text-sm text-center font-bold text-slate-900"
                        value={formData.package_content}
                        onChange={e => setFormData({ ...formData, package_content: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Classification Group */}
                <fieldset className="border border-slate-300 p-4 rounded bg-slate-50">
                  <legend className="text-xs font-bold text-slate-700 px-2 bg-slate-50">CLASIFICACIÓN</legend>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Lín. Negocio</label>
                        <select className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900" value={formData.line} onChange={e => setFormData({ ...formData, line: e.target.value })}>
                          <option value="">Seleccione...</option>
                          <option value="LICORES">LICORES</option>
                          <option value="BEBIDAS">BEBIDAS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label>
                        <input className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Sub-Cat</label>
                        <input className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.subcategory} onChange={e => setFormData({ ...formData, subcategory: e.target.value })} />
                      </div>
                    </div>
                    <div className="col-span-6 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Proveedor</label>
                        <select className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900" value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}>
                          <option value="">Seleccione Proveedor...</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Marca</label>
                        <input className="w-full border border-slate-300 p-2 rounded text-sm uppercase text-slate-900" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Technical Data */}
                <fieldset className="border border-slate-300 p-4 rounded bg-slate-50">
                  <legend className="text-xs font-bold text-slate-700 px-2 bg-slate-50">DATOS TÉCNICOS</legend>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Peso Total (Kg)</label>
                      <input type="number" step="0.001" className="w-full border border-slate-300 p-2 rounded text-sm text-right text-slate-900" value={formData.weight} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Volumen (L)</label>
                      <input type="number" step="0.001" className="w-full border border-slate-300 p-2 rounded text-sm text-right text-slate-900" value={formData.volume} onChange={e => setFormData({ ...formData, volume: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">% IGV</label>
                      <input type="number" className="w-full border border-slate-300 p-2 rounded text-sm text-center text-slate-900" value={formData.tax_igv} onChange={e => setFormData({ ...formData, tax_igv: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">% ISC</label>
                      <input type="number" className="w-full border border-slate-300 p-2 rounded text-sm text-center text-slate-900" value={formData.tax_isc} onChange={e => setFormData({ ...formData, tax_isc: Number(e.target.value) })} />
                    </div>
                  </div>
                </fieldset>

                {/* Configuration */}
                <fieldset className="border border-slate-300 p-4 rounded bg-slate-50">
                  <legend className="text-xs font-bold text-slate-700 px-2 bg-slate-50">CONFIGURACIÓN</legend>
                  <div className="flex gap-6">
                    <label className="flex items-center text-sm font-medium text-slate-800">
                      <input type="checkbox" className="mr-2 h-4 w-4" checked={formData.allow_sell} onChange={e => setFormData({ ...formData, allow_sell: e.target.checked })} />
                      Permitir Venta
                    </label>
                    <label className="flex items-center text-sm font-medium text-slate-800">
                      <input type="checkbox" className="mr-2 h-4 w-4" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                      Activo
                    </label>
                  </div>
                </fieldset>
              </>
            )}

            {activeTab === 'PRECIOS' && (
              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 border border-yellow-200 rounded text-sm text-yellow-800 font-medium">
                  Nota: Los precios se sugieren basándose en el costo de la última compra.
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="border border-slate-200 p-4 rounded bg-white shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Estructura de Costos</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Costo Última Compra (Inc. IGV)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                          <input type="number" step="0.01" className="w-full pl-8 border p-2 rounded bg-slate-50 text-slate-900 font-medium" value={formData.last_cost} onChange={e => setFormData({ ...formData, last_cost: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Margen Ganancia %</label>
                        <input type="number" step="1" className="w-full border p-2 rounded text-slate-900" value={formData.profit_margin} onChange={e => setFormData({ ...formData, profit_margin: Number(e.target.value) })} />
                      </div>
                      <button onClick={calculatePrices} className="w-full bg-blue-100 text-blue-700 py-2 rounded text-sm font-bold hover:bg-blue-200 mt-2">
                        Recalcular Precios Sugeridos
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 p-4 rounded bg-white shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Precios de Venta (Inc. IGV)</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Precio {formData.unit_type} (Unidad)</label>
                        <input type="number" step="0.01" className="w-full border p-2 rounded text-lg font-bold text-green-700" value={formData.price_unit} onChange={e => setFormData({ ...formData, price_unit: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Precio {formData.package_type} (x {formData.package_content})</label>
                        <input type="number" step="0.01" className="w-full border p-2 rounded text-lg font-bold text-green-700" value={formData.price_package} onChange={e => setFormData({ ...formData, price_package: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t mt-4">
              <button type="submit" className="bg-accent hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow flex items-center">
                <Save className="w-4 h-4 mr-2" /> Guardar Producto
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Maestro de Productos</h2>
        <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2 rounded flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Nuevo
        </button>
      </div>

      <div className="bg-white rounded shadow border border-slate-200 flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 text-slate-400 w-4 h-4" />
            <input
              className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded text-slate-800 shadow-sm"
              placeholder="Buscar por nombre, código o categoría..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-200 text-slate-700 sticky top-0 font-bold">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Marca</th>
                <th className="p-3 text-center">Presentación</th>
                <th className="p-3 text-right">P. Unidad</th>
                <th className="p-3 text-right">P. Caja</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-t hover:bg-blue-50 cursor-pointer" onClick={() => handleEdit(p)}>
                  <td className="p-3 font-mono text-slate-600">{p.sku}</td>
                  <td className="p-3 font-medium text-slate-800">{p.name}</td>
                  <td className="p-3 text-slate-500">{p.brand}</td>
                  <td className="p-3 text-center text-xs">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">{p.unit_type}</span>
                    <span className="mx-1 text-slate-400">/</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">{p.package_type} x{p.package_content}</span>
                  </td>
                  <td className="p-3 text-right text-slate-700">S/ {p.price_unit.toFixed(2)}</td>
                  <td className="p-3 text-right text-slate-700">S/ {p.price_package.toFixed(2)}</td>
                  <td className="p-3 text-right text-accent font-medium">Editar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

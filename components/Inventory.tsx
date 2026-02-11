import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Package, Calendar, DollarSign, Hash } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { products, addBatch } = useStore();
  
  const [formData, setFormData] = useState({
    productId: '',
    code: '',
    quantity: 0,
    cost: 0,
    expirationDate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) return;

    addBatch({
      id: crypto.randomUUID(),
      product_id: formData.productId,
      code: formData.code,
      quantity_initial: formData.quantity,
      quantity_current: formData.quantity,
      cost: formData.cost,
      expiration_date: formData.expirationDate,
      created_at: new Date().toISOString()
    });

    alert("¡Lote recepcionado correctamente!");
    setFormData({
      productId: '',
      code: '',
      quantity: 0,
      cost: 0,
      expirationDate: ''
    });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center">
        <Package className="mr-2 h-5 w-5 text-accent" /> Ingreso de Mercadería (Recepción Lotes)
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Producto</label>
          <select 
            required
            className="mt-1 w-full border border-slate-300 rounded-md p-2 focus:ring-accent focus:border-accent"
            value={formData.productId}
            onChange={e => setFormData({...formData, productId: e.target.value})}
          >
            <option value="">Seleccionar Producto</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Código de Lote</label>
            <div className="relative mt-1">
              <Hash className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                required
                className="w-full border border-slate-300 rounded-md p-2 pl-8"
                placeholder="L-2024-XXX"
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Cantidad</label>
            <input 
              type="number" 
              required
              min="1"
              className="mt-1 w-full border border-slate-300 rounded-md p-2"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Costo Unitario</label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="number" 
                required
                step="0.01"
                min="0"
                className="w-full border border-slate-300 rounded-md p-2 pl-8"
                value={formData.cost}
                onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fecha de Vencimiento</label>
            <div className="relative mt-1">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date" 
                required
                className="w-full border border-slate-300 rounded-md p-2 pl-8"
                value={formData.expirationDate}
                onChange={e => setFormData({...formData, expirationDate: e.target.value})}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-md hover:bg-slate-800 transition-colors mt-6">
          Registrar Ingreso
        </button>
      </form>
    </div>
  );
};
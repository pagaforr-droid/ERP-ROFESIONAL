import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Building, Settings, FileText, Image, Save, Hash, Upload, RefreshCw, Trash2, Plus } from 'lucide-react';
import { DocumentSeries } from '../types';

export const CompanySettings: React.FC = () => {
  const { company: mockCompany, updateCompany: mockUpdateCompany } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'SERIES' | 'SUNAT'>('GENERAL');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Estados locales para la Nube
  const [formData, setFormData] = useState({
    ruc: '',
    name: '',
    address: '',
    igv_percent: 18,
    email: '',
    phone: '',
    sunat_provider: '',
    sunat_api_url: '',
    sunat_api_token: '',
    logo_url: ''
  });

  const [seriesList, setSeriesList] = useState<DocumentSeries[]>([]);
  const [seriesToDelete, setSeriesToDelete] = useState<string[]>([]);

  // --- SINCRONIZACIÓN INICIAL ---
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (USE_MOCK_DB) {
        setFormData({
          ruc: mockCompany.ruc || '',
          name: mockCompany.name || '',
          address: mockCompany.address || '',
          igv_percent: mockCompany.igv_percent || 18,
          email: mockCompany.email || '',
          phone: mockCompany.phone || '',
          sunat_provider: mockCompany.sunat_provider || '',
          sunat_api_url: mockCompany.sunat_api_url || '',
          sunat_api_token: mockCompany.sunat_api_token || '',
          logo_url: mockCompany.logo_url || ''
        });
        setSeriesList(mockCompany.series || []);
      } else {
        setIsLoading(true);
        try {
          // 1. Obtener Empresa
          const { data: compData, error: compErr } = await supabase.from('company_config').select('*').limit(1).single();
          if (compErr && compErr.code !== 'PGRST116') throw compErr; // PGRST116 es "No rows found"
          
          if (compData) {
            setCompanyId(compData.id);
            setFormData({
              ruc: compData.ruc || '',
              name: compData.name || '',
              address: compData.address || '',
              igv_percent: compData.igv_percent || 18,
              email: compData.email || '',
              phone: compData.phone || '',
              sunat_provider: compData.sunat_provider || '',
              sunat_api_url: compData.sunat_api_url || '',
              sunat_api_token: compData.sunat_api_token || '',
              logo_url: compData.logo_url || ''
            });

            // 2. Obtener Series
            const { data: serData, error: serErr } = await supabase.from('document_series').select('*').eq('company_id', compData.id).order('type');
            if (serErr) throw serErr;
            if (serData) setSeriesList(serData as DocumentSeries[]);
          }
        } catch (error: any) {
          console.error("Error cargando configuración:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchCompanyData();
  }, []);

  // --- GUARDADO: GENERAL & SUNAT ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (USE_MOCK_DB) {
        mockUpdateCompany(formData);
        alert('Datos simulados actualizados.');
      } else {
        if (companyId) {
          const { error } = await supabase.from('company_config').update(formData).eq('id', companyId);
          if (error) throw error;
        } else {
          // Si no existe la empresa, la creamos
          const newId = crypto.randomUUID();
          const { error } = await supabase.from('company_config').insert([{ ...formData, id: newId }]);
          if (error) throw error;
          setCompanyId(newId);
        }
        alert('Configuración guardada exitosamente en la Nube.');
      }
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- GUARDADO: SERIES Y CORRELATIVOS (BATCH) ---
  const handleSeriesSave = async () => {
    setIsSaving(true);
    try {
      if (USE_MOCK_DB) {
        alert("Series simuladas actualizadas (Solo local).");
      } else {
        if (!companyId) {
           alert("Primero debe guardar los Datos Generales de la empresa.");
           return;
        }

        // 1. Eliminar series borradas por el usuario
        if (seriesToDelete.length > 0) {
           const { error: delErr } = await supabase.from('document_series').delete().in('id', seriesToDelete);
           if (delErr) throw delErr;
           setSeriesToDelete([]);
        }

        // 2. Upsert (Insertar o Actualizar) las series actuales
        const seriesPayload = seriesList.map(s => ({
           id: s.id,
           company_id: companyId,
           type: s.type,
           series: s.series,
           current_number: s.current_number,
           is_active: s.is_active
        }));

        const { error: upsertErr } = await supabase.from('document_series').upsert(seriesPayload, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;

        alert("Series y correlativos sincronizados con la Nube.");
      }
    } catch (error: any) {
      alert("Error guardando series: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- MANEJO DE ESTADOS DE SERIES ---
  const handleSeriesUpdate = (id: string, field: keyof DocumentSeries, value: any) => {
    setSeriesList(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddSeries = () => {
    const newSeries: DocumentSeries = {
      id: crypto.randomUUID(),
      type: 'FACTURA',
      series: 'F001',
      current_number: 1,
      is_active: true
    };
    setSeriesList([...seriesList, newSeries]);
  };

  const handleRemoveSeries = (id: string) => {
    if (confirm('¿Seguro que desea eliminar esta serie? Podría afectar correlativos.')) {
      setSeriesList(prev => prev.filter(s => s.id !== id));
      if (!USE_MOCK_DB) setSeriesToDelete(prev => [...prev, id]);
    }
  };

  // --- LOGO UPLOAD (Base64) ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
         alert("El logo no debe pesar más de 2MB.");
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mr-2" /> Cargando Configuración...</div>;
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-800 flex items-center">
          <Settings className="mr-2 text-blue-600 w-6 h-6" /> Ajustes Globales del Sistema
        </h2>
      </div>

      {/* NAVEGACIÓN DE TABS */}
      <div className="flex bg-white rounded-t-xl border-b border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`flex-1 py-4 font-bold text-sm flex items-center justify-center transition-colors ${activeTab === 'GENERAL' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-b-4 border-transparent'}`}
        >
          <Building className="w-4 h-4 mr-2" /> Datos Generales
        </button>
        <button
          onClick={() => setActiveTab('SERIES')}
          className={`flex-1 py-4 font-bold text-sm flex items-center justify-center transition-colors ${activeTab === 'SERIES' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-b-4 border-transparent'}`}
        >
          <Hash className="w-4 h-4 mr-2" /> Series y Correlativos
        </button>
        <button
          onClick={() => setActiveTab('SUNAT')}
          className={`flex-1 py-4 font-bold text-sm flex items-center justify-center transition-colors ${activeTab === 'SUNAT' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-b-4 border-transparent'}`}
        >
          <FileText className="w-4 h-4 mr-2" /> Facturación Electrónica (API)
        </button>
      </div>

      <div className="flex-1 bg-white rounded-b-xl shadow-sm border border-slate-200 overflow-auto">
        
        {/* TAB 1: GENERAL */}
        {activeTab === 'GENERAL' && (
          <form onSubmit={handleSaveSettings} className="p-8 max-w-5xl mx-auto animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Logo Section */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="w-56 h-56 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center mb-4 overflow-hidden relative group shadow-inner">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <span className="text-xs font-bold uppercase tracking-wider">Sin Logotipo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-lg hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4 mr-2" /> Subir Imagen
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center font-medium">
                  Formato recomendado: PNG transparente.<br />Tamaño máximo: 2MB.
                </p>
                {formData.logo_url && (
                   <button type="button" onClick={() => setFormData({...formData, logo_url: ''})} className="mt-3 text-xs text-red-500 font-bold hover:underline">Quitar Logo</button>
                )}
              </div>

              {/* Form Data */}
              <div className="md:col-span-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">RUC de la Empresa *</label>
                    <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold focus:border-blue-500 outline-none transition-colors" value={formData.ruc} onChange={e => setFormData({ ...formData, ruc: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Razón Social / Nombre Comercial *</label>
                    <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold uppercase focus:border-blue-500 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Dirección Fiscal / Ubicación Principal *</label>
                  <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none transition-colors" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Teléfono de Contacto</label>
                    <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none transition-colors" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Email Corporativo</label>
                    <input type="email" className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none transition-colors" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div>
                     <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Porcentaje IGV Global (%)</label>
                     <p className="text-[10px] text-slate-500 max-w-xs">Este valor se usará por defecto para el cálculo de impuestos en todo el sistema.</p>
                  </div>
                  <div className="w-32 relative">
                    <input type="number" className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 text-center font-black text-lg focus:border-blue-500 outline-none transition-colors" value={formData.igv_percent} onChange={e => setFormData({ ...formData, igv_percent: Number(e.target.value) })} />
                    <span className="absolute right-3 top-3 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                    {isSaving ? 'Guardando...' : 'Guardar Datos Generales'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: SERIES Y CORRELATIVOS */}
        {activeTab === 'SERIES' && (
          <div className="p-8 max-w-4xl mx-auto animate-fade-in flex flex-col h-full">
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 mb-6 flex items-start shadow-sm">
              <div className="bg-amber-100 p-2.5 rounded-full mr-4 text-amber-700 shadow-inner">
                <Hash className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-black text-amber-900">Control de Series de Facturación</h4>
                  <button onClick={handleAddSeries} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm transition-colors">
                    <Plus className="w-4 h-4 mr-1" /> NUEVA SERIE
                  </button>
                </div>
                <p className="text-xs text-amber-800 font-medium">
                  Configure los correlativos exactos. <strong>Importante:</strong> Modificar el número actual alterará la emisión del próximo comprobante. Asegúrese de que coincidan con su historial de SUNAT.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
               <table className="w-full text-left text-sm border-collapse">
                 <thead className="bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-wider border-b border-slate-200">
                   <tr>
                     <th className="p-4">Tipo Comprobante</th>
                     <th className="p-4 w-32 text-center">Serie</th>
                     <th className="p-4 w-40 text-center">Correlativo Actual</th>
                     <th className="p-4 w-32 text-center">Estado</th>
                     <th className="p-4 w-16 text-center">Acción</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {seriesList.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">No hay series configuradas. Agregue una para empezar.</td></tr>
                   ) : seriesList.map(series => (
                     <tr key={series.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-3">
                         <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-3 text-slate-400" />
                            <select
                              className="w-full border-2 border-slate-200 focus:border-blue-500 p-2 rounded-lg font-bold text-slate-800 outline-none transition-colors"
                              value={series.type}
                              onChange={e => handleSeriesUpdate(series.id, 'type', e.target.value)}
                            >
                              <option value="FACTURA">FACTURA (01)</option>
                              <option value="BOLETA">BOLETA (03)</option>
                              <option value="GUIA">GUÍA DE REMISIÓN (09)</option>
                              <option value="NOTA_CREDITO">NOTA CRÉDITO (07)</option>
                              <option value="PEDIDO">TICKET / PEDIDO</option>
                            </select>
                         </div>
                       </td>
                       <td className="p-3">
                         <input
                           className="w-full border-2 border-slate-200 p-2 rounded-lg text-center font-mono font-black uppercase focus:border-blue-500 outline-none transition-colors"
                           value={series.series}
                           placeholder="F001"
                           onChange={e => handleSeriesUpdate(series.id, 'series', e.target.value.toUpperCase())}
                         />
                       </td>
                       <td className="p-3">
                         <input
                           type="number"
                           className="w-full border-2 border-slate-200 p-2 rounded-lg text-center font-mono font-black text-blue-700 focus:border-blue-500 outline-none transition-colors"
                           value={series.current_number}
                           onChange={e => handleSeriesUpdate(series.id, 'current_number', Number(e.target.value))}
                         />
                       </td>
                       <td className="p-3 text-center">
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" className="sr-only peer" checked={series.is_active} onChange={e => handleSeriesUpdate(series.id, 'is_active', e.target.checked)} />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                         </label>
                       </td>
                       <td className="p-3 text-center">
                         <button onClick={() => handleRemoveSeries(series.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar Serie">
                           <Trash2 className="w-5 h-5" />
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            <div className="flex justify-end mt-6">
               <button onClick={handleSeriesSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50">
                 {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                 {isSaving ? 'Sincronizando...' : 'Guardar Cambios de Series'}
               </button>
            </div>
          </div>
        )}

        {/* TAB 3: SUNAT */}
        {activeTab === 'SUNAT' && (
          <form onSubmit={handleSaveSettings} className="p-8 max-w-3xl mx-auto animate-fade-in">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 mb-8 flex items-start shadow-sm">
              <div className="bg-emerald-100 p-2.5 rounded-full mr-4 text-emerald-700 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-emerald-900 mb-1">Integración PSE / OSE</h4>
                <p className="text-xs text-emerald-800 font-medium">
                  Estas credenciales permitirán que el módulo de ventas envíe automáticamente las facturas y boletas a SUNAT. Mantenga este token en absoluta confidencialidad.
                </p>
              </div>
            </div>

            <div className="space-y-6 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Proveedor del Sistema Electrónico</label>
                <select
                  className="w-full border-2 border-slate-200 p-3 rounded-lg text-slate-900 font-bold bg-slate-50 focus:border-blue-500 outline-none transition-colors"
                  value={formData.sunat_provider}
                  onChange={e => setFormData({ ...formData, sunat_provider: e.target.value })}
                >
                  <option value="">-- Seleccionar Proveedor Autorizado --</option>
                  <option value="NUBEFACT">NubeFact</option>
                  <option value="APIPERU">API Perú</option>
                  <option value="FACTURADOR_PRO">Facturador PRO (Módulo Local)</option>
                  <option value="SUNAT">Facturación Directa SUNAT (Clave SOL)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">URL del Endpoint API (Ruta REST)</label>
                <input
                  type="url"
                  placeholder="https://api.proveedor.com/v1/facturacion"
                  className="w-full border-2 border-slate-200 p-3 rounded-lg text-blue-700 font-mono text-sm focus:border-blue-500 outline-none transition-colors"
                  value={formData.sunat_api_url}
                  onChange={e => setFormData({ ...formData, sunat_api_url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Token Privado (API Key)</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••••••••••••••••••"
                  className="w-full border-2 border-slate-200 p-3 rounded-lg text-slate-900 font-mono text-sm focus:border-blue-500 outline-none transition-colors"
                  value={formData.sunat_api_token}
                  onChange={e => setFormData({ ...formData, sunat_api_token: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaving ? 'Guardando...' : 'Guardar Credenciales Seguras'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Building, Settings, FileText, Image, Save, Hash, Upload } from 'lucide-react';
import { DocumentSeries } from '../types';

export const CompanySettings: React.FC = () => {
  const { company, updateCompany, updateSeries } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'SERIES'>('GENERAL');

  // Local state for the form
  const [formData, setFormData] = useState({
    ruc: company.ruc,
    name: company.name,
    address: company.address,
    igv_percent: company.igv_percent,
    email: company.email || '',
    phone: company.phone || '',
  });

  const handleGeneralSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    alert('Datos de la empresa actualizados correctamente.');
  };

  const handleSeriesUpdate = (series: DocumentSeries, field: keyof DocumentSeries, value: any) => {
    updateSeries({ ...series, [field]: value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateCompany({ logo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Settings className="mr-2 text-slate-600" /> Configuración de Empresa
        </h2>
      </div>

      <div className="flex bg-white rounded-t-lg border-b border-slate-200">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'GENERAL' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Building className="w-4 h-4 mr-2" /> Datos Generales
        </button>
        <button
          onClick={() => setActiveTab('SERIES')}
          className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'SERIES' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Hash className="w-4 h-4 mr-2" /> Series y Correlativos
        </button>
      </div>

      <div className="flex-1 bg-white rounded-b-lg shadow border border-t-0 border-slate-200 p-6 overflow-auto">
        {activeTab === 'GENERAL' ? (
          <form onSubmit={handleGeneralSave} className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Logo Section */}
              <div className="md:col-span-1 flex flex-col items-center">
                <div className="w-48 h-48 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative group">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Image className="w-12 h-12 mx-auto mb-2" />
                      <span className="text-xs">Sin Logotipo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer bg-white text-slate-800 px-3 py-1 rounded text-xs font-bold flex items-center">
                      <Upload className="w-3 h-3 mr-1" /> Cambiar
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Formato recomendado: PNG o JPG.<br />Tamaño máx: 2MB.
                </p>
              </div>

              {/* Form Data */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">RUC</label>
                    <input
                      required
                      className="w-full border border-slate-300 p-2 rounded text-slate-900 font-mono"
                      value={formData.ruc}
                      onChange={e => setFormData({ ...formData, ruc: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Comercial</label>
                    <input
                      required
                      className="w-full border border-slate-300 p-2 rounded text-slate-900"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Fiscal</label>
                  <input
                    required
                    className="w-full border border-slate-300 p-2 rounded text-slate-900"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                    <input
                      className="w-full border border-slate-300 p-2 rounded text-slate-900"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-slate-300 p-2 rounded text-slate-900"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Porcentaje IGV Default (%)</label>
                  <div className="w-32">
                    <input
                      type="number"
                      className="w-full border border-slate-300 p-2 rounded text-slate-900 text-right font-bold"
                      value={formData.igv_percent}
                      onChange={e => setFormData({ ...formData, igv_percent: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded font-bold flex items-center">
                    <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-50 p-4 rounded border border-yellow-200 mb-6 flex items-start">
              <div className="bg-yellow-100 p-2 rounded-full mr-3 text-yellow-700">
                <Hash className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-yellow-800 text-sm">Control de Series y Correlativos</h4>
                  <button
                    onClick={() => {
                      const newSeries: DocumentSeries = {
                        id: crypto.randomUUID(),
                        type: 'FACTURA',
                        series: 'F002',
                        current_number: 1,
                        is_active: false
                      };
                      store.addSeries(newSeries);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs font-bold"
                  >
                    + Nueva Serie
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Configure aquí las series de sus documentos electrónicos y el número actual (correlativo) desde el cual el sistema empezará a emitir.
                  Cualquier cambio afectará inmediatamente a los nuevos documentos generados.
                </p>
              </div>
            </div>

            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Tipo de Documento</th>
                  <th className="p-4 w-32">Serie</th>
                  <th className="p-4 w-40">Correlativo Actual</th>
                  <th className="p-4 w-32 text-center">Estado</th>
                  <th className="p-4 w-16 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {company.series.map(series => (
                  <tr key={series.id} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-800 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-slate-400" />
                      <select
                        className="w-full border border-transparent hover:border-slate-300 p-1 rounded font-bold text-slate-800 bg-transparent focus:bg-white outline-none"
                        value={series.type}
                        onChange={e => handleSeriesUpdate(series, 'type', e.target.value as any)}
                      >
                        <option value="FACTURA">FACTURA</option>
                        <option value="BOLETA">BOLETA</option>
                        <option value="GUIA">GUIA</option>
                        <option value="NOTA_CREDITO">NOTA_CREDITO</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <input
                        className="w-full border border-slate-300 p-1.5 rounded text-center font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                        value={series.series}
                        onChange={e => handleSeriesUpdate(series, 'series', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        className="w-full border border-slate-300 p-1.5 rounded text-center font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        value={series.current_number}
                        onChange={e => handleSeriesUpdate(series, 'current_number', Number(e.target.value))}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={series.is_active} onChange={e => handleSeriesUpdate(series, 'is_active', e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          if (confirm('¿Seguro que desea eliminar esta serie?')) {
                            store.removeSeries(series.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                        title="Eliminar Serie"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
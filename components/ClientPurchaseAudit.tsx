import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Client, Sale, Order, CollectionRecord, DispatchLiquidation } from '../types';
import { Search, MapPin, Phone, Mail, DollarSign, Calendar, Truck, FileText, FileX, CreditCard, ChevronDown, ChevronRight, CheckCircle, Package, AlertCircle, ArrowLeftRight } from 'lucide-react';

export const ClientPurchaseAudit: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELED'>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO'>('ALL');
  
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Search clients
  useEffect(() => {
    const searchClients = async () => {
      if (searchTerm.length < 3) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,doc_number.ilike.%${searchTerm}%`)
        .limit(10);
      
      if (data) setSearchResults(data);
    };

    const debounce = setTimeout(searchClients, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const fetchClientHistory = async (client: Client) => {
    setSelectedClient(client);
    setSearchTerm('');
    setSearchResults([]);
    setLoading(true);

    try {
      // Fetch Sales and NCs
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(*)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (salesData) setSales(salesData);

      // Fetch Orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersData) setOrders(ordersData);

    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'canceled': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status.toLowerCase()) {
      case 'completed': return 'Procesado';
      case 'canceled': return 'Anulado';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  const filteredSales = sales.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter.toLowerCase()) return false;
    if (docTypeFilter !== 'ALL' && s.document_type !== docTypeFilter) return false;
    if (dateRange.start && new Date(s.created_at) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(s.created_at) > new Date(dateRange.end + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            Auditoría 360 de Clientes
          </h2>
          <p className="text-sm text-slate-500 font-medium">Seguimiento exhaustivo de compras, despachos y pagos.</p>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-8 z-20">
        <div className="relative">
          <Search className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
          <input
            type="text"
            className="w-full bg-white border-2 border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-colors shadow-sm text-lg"
            placeholder="Buscar cliente por Nombre o RUC/DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
            {searchResults.map(client => (
              <button
                key={client.id}
                onClick={() => fetchClientHistory(client)}
                className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center group"
              >
                <div>
                  <div className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{client.name}</div>
                  <div className="text-sm text-slate-500 font-mono mt-1">{client.doc_number} • {client.business_type}</div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedClient && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* CLIENT SUMMARY */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 shrink-0 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-xl font-black text-slate-800 mb-2">{selectedClient.name}</h3>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded"><FileText className="w-4 h-4 text-slate-400" /> {selectedClient.doc_number}</div>
                <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {selectedClient.address}</div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
              <span className="text-slate-500 text-xs font-bold uppercase mb-1">Segmento</span>
              <span className="font-black text-slate-800 text-lg">{selectedClient.category || 'REGULAR'}</span>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col justify-center items-center">
              <span className="text-red-500 text-xs font-bold uppercase mb-1">Límite de Crédito</span>
              <span className="font-black text-red-700 text-xl">S/ {selectedClient.credit_limit.toFixed(2)}</span>
            </div>
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-3 mb-4 shrink-0 bg-white p-3 rounded-xl border border-slate-200">
            <input 
              type="date" 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-blue-500"
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
            />
            <span className="text-slate-400 self-center font-bold">a</span>
            <input 
              type="date" 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-blue-500"
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
            />

            <div className="w-px h-8 bg-slate-200 self-center mx-2"></div>

            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-blue-500"
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="COMPLETED">Procesados</option>
              <option value="CANCELED">Anulados</option>
            </select>

            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-blue-500"
              value={docTypeFilter}
              onChange={(e: any) => setDocTypeFilter(e.target.value)}
            >
              <option value="ALL">Todos los Documentos</option>
              <option value="FACTURA">Facturas</option>
              <option value="BOLETA">Boletas</option>
              <option value="NOTA_CREDITO">Notas de Crédito</option>
            </select>
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-white border border-slate-200 rounded-xl custom-scrollbar relative">
            {loading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
            
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs">Fecha</th>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs">Documento</th>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs">Estado</th>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs">Despacho</th>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs text-right">Total</th>
                  <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-wider text-xs text-right">Saldo</th>
                  <th className="px-6 py-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map(sale => {
                  const isExpanded = expandedDoc === sale.id;
                  const isAnulado = sale.status === 'canceled';
                  const isNC = sale.document_type === 'NOTA_CREDITO';
                  
                  return (
                    <React.Fragment key={sale.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${isAnulado ? 'opacity-70' : ''} ${isExpanded ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                          {new Date(sale.created_at).toLocaleDateString()}
                          <div className="text-[10px] text-slate-400">{new Date(sale.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isNC ? <ArrowLeftRight className="w-4 h-4 text-purple-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                            <span className="font-bold text-slate-800">{sale.document_type}</span>
                          </div>
                          <div className="font-mono text-xs text-slate-500 mt-1">{sale.series}-{sale.number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(sale.status)}`}>
                            {getStatusLabel(sale.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!isNC && sale.dispatch_status ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                              <Truck className={`w-4 h-4 ${sale.dispatch_status === 'delivered' || sale.dispatch_status === 'liquidated' ? 'text-green-500' : 'text-slate-400'}`} />
                              {sale.dispatch_status.toUpperCase()}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-black ${isNC ? 'text-purple-600' : 'text-slate-800'}`}>
                          {isNC ? '-' : ''}S/ {sale.total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-red-600">
                          {(!isNC && !isAnulado && (sale.balance ?? 0) > 0) ? `S/ ${(sale.balance ?? 0).toFixed(2)}` : <CheckCircle className="w-4 h-4 text-green-500 inline-block" />}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => setExpandedDoc(isExpanded ? null : sale.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                          </button>
                        </td>
                      </tr>
                      
                      {/* EXPANDED DETAILS */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-0 py-0 bg-slate-50 border-b-2 border-slate-200">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
                              
                              {/* ITEMS */}
                              <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Detalle de Productos</h4>
                                <div className="space-y-2">
                                  {sale.items && sale.items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                      <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-sm leading-tight">{item.product_name}</div>
                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.product_sku}</div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <div className="font-black text-slate-800 text-sm">{item.quantity_presentation} {item.selected_unit}</div>
                                        <div className="text-xs text-slate-500">S/ {item.total_price.toFixed(2)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* AUDIT TRACE */}
                              <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Trazabilidad Extendida</h4>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                  
                                  <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Método de Pago / Condición</div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                      <CreditCard className="w-4 h-4 text-slate-400" />
                                      {sale.payment_method}
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-100 pt-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Rastreo Logístico</div>
                                    {sale.dispatch_status ? (
                                      <div className="font-medium text-sm text-slate-700">
                                        Estado actual: <span className="font-bold text-slate-900">{sale.dispatch_status.toUpperCase()}</span>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-slate-500 italic">No asignado a despacho.</div>
                                    )}
                                  </div>

                                  {(sale.collection_status === 'COLLECTED' || sale.collection_status === 'PARTIAL' || sale.collection_status === 'REPORTED') && (
                                    <div className="border-t border-slate-100 pt-4">
                                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Auditoría de Pagos</div>
                                      <div className="bg-green-50 text-green-800 p-3 rounded-lg border border-green-200 text-sm font-medium">
                                        Documento presenta registro de cobranza. 
                                        <br/>Estado de pago: <span className="font-bold">{sale.collection_status}</span>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredSales.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <FileX className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="font-bold">No se encontraron documentos comerciales.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {!selectedClient && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Search className="w-20 h-20 mb-4 text-slate-200" />
          <p className="text-xl font-black text-slate-300">Busque un cliente para visualizar su auditoría.</p>
        </div>
      )}

    </div>
  );
};

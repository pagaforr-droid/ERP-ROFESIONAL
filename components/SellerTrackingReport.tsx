import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Seller, Order } from '../types';
import { Loader2, MapPin, Search, AlertTriangle, Route, Clock, Navigation, Flag, CheckCircle2, Navigation2 } from 'lucide-react';

export default function SellerTrackingReport() {
  const [dbSellers, setDbSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSellers = async () => {
      const { data } = await supabase.from('sellers').select('*').order('name');
      if (data) setDbSellers(data as Seller[]);
    };
    fetchSellers();
  }, []);

  const fetchTrackingData = async () => {
    if (!selectedSeller || !selectedDate) return;
    
    setIsLoading(true);
    setError('');
    try {
      const [year, month, day] = selectedDate.split('-');
      const startOfDay = new Date(Number(year), Number(month) - 1, Number(day));
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(Number(year), Number(month) - 1, Number(day));
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', selectedSeller)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      
      setOrders(data as Order[]);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar datos de seguimiento: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSeller && selectedDate) {
      fetchTrackingData();
    }
  }, [selectedSeller, selectedDate]);

  // Haversine formula to calculate distance between two coordinates in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  };

  const getGoogleMapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
  const getGoogleMapsRouteLink = (lat1: number, lng1: number, lat2: number, lng2: number) => 
    `https://www.google.com/maps/dir/${lat1},${lng1}/${lat2},${lng2}`;

  const formatTimeDifference = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
    return `00:${minutes.toString().padStart(2, '0')} hr`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  // Process data to include differences and flags
  const trackingNodes = useMemo(() => {
    return orders.map((order, index) => {
      const currentLoc = order.creation_location as {lat: number, lng: number, accuracy?: number} | null;
      let timeDiffMs = 0;
      let distanceKm = 0;
      let isFlagged = false;
      let prevLoc: {lat: number, lng: number, accuracy?: number} | null = null;
      
      if (index > 0) {
        const prevOrder = orders[index - 1];
        prevLoc = prevOrder.creation_location as {lat: number, lng: number, accuracy?: number} | null;
        
        timeDiffMs = new Date(order.created_at).getTime() - new Date(prevOrder.created_at).getTime();
        
        if (currentLoc && prevLoc) {
          distanceKm = calculateDistance(prevLoc.lat, prevLoc.lng, currentLoc.lat, currentLoc.lng);
          
          // FLAG LOGIC: If speed > 100 km/h (impossible in city/on foot)
          // Speed = Distance / Time. (Time in hours)
          const timeHours = timeDiffMs / (1000 * 60 * 60);
          if (timeHours > 0) {
            const speedKmH = distanceKm / timeHours;
            // Also flag if they moved a lot but took almost no time (e.g., > 1km in < 1 minute)
            if (speedKmH > 100 || (distanceKm > 0.5 && timeDiffMs < 60000)) {
              isFlagged = true;
            }
          }
        }
      }

      return {
        ...order,
        orderNumber: index + 1,
        timeDiffMs,
        distanceKm,
        isFlagged,
        prevLoc,
        currentLoc
      };
    });
  }, [orders]);

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans p-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Route className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Simulador de Ruta (Tracking GPS)</h1>
            <p className="text-sm text-slate-500 font-medium">Auditoría de ubicaciones de creación de pedidos en campo.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Vendedor</label>
            <select 
              className="bg-white border border-slate-300 text-slate-800 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              <option value="">-- Seleccione Vendedor --</option>
              {dbSellers.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Fecha</label>
            <input 
              type="date" 
              className="bg-white border border-slate-300 text-slate-800 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <button 
            onClick={fetchTrackingData}
            disabled={isLoading || !selectedSeller}
            className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg shadow disabled:opacity-50 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* RESULTADOS */}
      <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-500 font-bold tracking-widest uppercase text-sm">Rastreando ruta...</p>
          </div>
        ) : !selectedSeller ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Navigation2 className="w-16 h-16 mb-4 opacity-50" />
            <p className="font-bold text-lg">Seleccione un vendedor para ver su ruta.</p>
          </div>
        ) : trackingNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <p className="font-bold text-lg mb-2 text-slate-600">No hay pedidos registrados</p>
            <p className="text-sm">El vendedor no registró ningún pedido en esta fecha.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
            
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header Tabla Estilo Excel (como la idea del cliente) */}
                <div className="bg-indigo-600 text-white flex px-4 py-3 items-center">
                  <div className="flex-1 font-bold text-sm">TRACKING: RUTA DE PEDIDOS</div>
                  <div className="font-black text-sm uppercase tracking-wide">
                    VENDEDOR: {dbSellers.find(s => s.id === selectedSeller)?.name}
                  </div>
                </div>
                
                <div className="grid grid-cols-12 bg-slate-800 text-slate-200 text-xs font-black uppercase p-3 border-b border-slate-700">
                  <div className="col-span-1 text-center">N°</div>
                  <div className="col-span-2">Pedido</div>
                  <div className="col-span-4">Cliente / Hora</div>
                  <div className="col-span-3 text-center">Ubicación GPS</div>
                  <div className="col-span-2 text-center">Diferencia</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {trackingNodes.map((node, i) => (
                    <div key={node.id} className={`grid grid-cols-12 p-3 items-center transition-colors hover:bg-slate-50 ${node.isFlagged ? 'bg-red-50/80 hover:bg-red-100' : ''}`}>
                      
                      {/* N° Secuencia */}
                      <div className="col-span-1 flex justify-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-sm
                          ${node.isFlagged ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          {node.orderNumber}
                        </div>
                      </div>

                      {/* Pedido */}
                      <div className="col-span-2 font-mono font-bold text-slate-700 text-sm">
                        {node.code}
                      </div>

                      {/* Cliente y Hora */}
                      <div className="col-span-4">
                        <div className="font-bold text-slate-800 text-sm truncate pr-2">{node.client_name}</div>
                        <div className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Clock className="w-3 h-3 mr-1" /> {formatTime(node.created_at)}
                        </div>
                      </div>

                      {/* GPS */}
                      <div className="col-span-3 flex justify-center">
                        {node.currentLoc ? (
                          <div className="flex flex-col items-center gap-1">
                            <a 
                              href={getGoogleMapsLink(node.currentLoc.lat, node.currentLoc.lng)} 
                              target="_blank" 
                              rel="noreferrer"
                              className="bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 px-3 py-1.5 rounded-full text-xs font-bold flex items-center transition-colors shadow-sm"
                            >
                              <MapPin className="w-3 h-3 mr-1" /> GPS (Abrir)
                            </a>
                            {node.currentLoc.accuracy && (
                              <span className="text-[9px] text-slate-400 font-medium tracking-tight">Precisión: ±{Math.round(node.currentLoc.accuracy)}m</span>
                            )}
                            {i > 0 && node.prevLoc && (
                              <a 
                                href={getGoogleMapsRouteLink(node.prevLoc.lat, node.prevLoc.lng, node.currentLoc.lat, node.currentLoc.lng)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center underline"
                              >
                                <Navigation className="w-3 h-3 mr-0.5" /> Ver Ruta A → B
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">No capturado</span>
                        )}
                      </div>

                      {/* Diferencia & Alerta */}
                      <div className="col-span-2 flex flex-col items-center justify-center">
                        {i === 0 ? (
                          <span className="text-xs font-bold text-slate-400">00:00 hr</span>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {formatTimeDifference(node.timeDiffMs)}
                            </span>
                            {node.distanceKm > 0 && (
                              <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                A {node.distanceKm.toFixed(2)} km
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Red Flag Alert Full Width (if flagged) */}
                      {node.isFlagged && (
                        <div className="col-span-12 mt-2 bg-red-100 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-start shadow-sm">
                          <Flag className="w-4 h-4 mr-2 shrink-0 mt-0.5 text-red-600" />
                          <div>
                            <strong className="block mb-0.5">🚩 ANOMALÍA DETECTADA</strong>
                            El tiempo transcurrido ({formatTimeDifference(node.timeDiffMs)}) es demasiado corto para la distancia física registrada en el GPS ({node.distanceKm.toFixed(2)} km). Posible "pedido de escritorio".
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
                
                {/* Footer sumario */}
                <div className="bg-slate-50 border-t border-slate-200 p-3 text-right text-xs font-bold text-slate-500">
                  Total Pedidos: {trackingNodes.length} | Pedidos con GPS: {trackingNodes.filter(n => n.currentLoc).length} | Anomalías: <span className={trackingNodes.some(n => n.isFlagged) ? 'text-red-600' : 'text-green-600'}>{trackingNodes.filter(n => n.isFlagged).length}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

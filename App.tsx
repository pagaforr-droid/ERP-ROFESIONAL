
import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { NewSale } from './components/NewSale';
import { Purchases } from './components/Purchases';
import { Dispatch } from './components/Dispatch';
import { ProductManagement } from './components/ProductManagement';
import { ClientManagement } from './components/ClientManagement';
import { MasterData } from './components/MasterData';
import { LogisticsManagement } from './components/LogisticsManagement'; 
import { TerritoryManagement } from './components/TerritoryManagement'; 
import { MobileOrders } from './components/MobileOrders'; 
import { OrderProcessing } from './components/OrderProcessing'; 
import { CompanySettings } from './components/CompanySettings';
import { PrintBatch } from './components/PrintBatch'; 
import { CashFlow } from './components/CashFlow'; 
import { DispatchLiquidationComp } from './components/DispatchLiquidation'; 
import { DocumentManager } from './components/DocumentManager'; 
import { StrategicReports } from './components/StrategicReports'; 
import { Kardex } from './components/Kardex';
import { UserManagement } from './components/UserManagement'; 
import { Attendance } from './components/Attendance'; 
import { PromoManager } from './components/PromoManager';
import { PriceManager } from './components/PriceManager'; 
import { VirtualStore } from './components/VirtualStore';
import { CollectionConsolidation } from './components/CollectionConsolidation'; // NEW
import { Login } from './components/Login';
import { LayoutDashboard, ShoppingCart, Truck, Menu, X, Box, Users, Briefcase, Home, ShoppingBag, ClipboardList, Settings, Container, Map, Smartphone, FileCheck, Printer, DollarSign, FileInput, FileText, PieChart, PackageSearch, Shield, Clock, LogOut, User as UserIcon, Gift, Store, Tag, Wallet } from 'lucide-react';
import { ViewState } from './types';
import { useStore } from './services/store';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState | 'document-manager' | 'reports' | 'kardex' | 'users' | 'attendance' | 'promo-manager' | 'virtual-store' | 'price-manager' | 'collection-consolidation'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { company, currentUser, logout } = useStore();

  // --- AUTH CHECK ---
  if (!currentUser) {
     return <Login />;
  }

  // --- CLIENT REDIRECT ---
  // If the user is a client, bypass the entire admin dashboard and show the store
  if (currentUser.role === 'CLIENT') {
     return <VirtualStore />;
  }

  // --- PERMISSION CHECK ---
  const canAccess = (view: string) => {
     // Admin role fallback or permissions array check
     return currentUser.permissions?.includes(view);
  };

  const renderContent = () => {
    // Basic protection
    if (!canAccess(currentView) && currentView !== 'dashboard') {
       return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado a este módulo. Contacte al administrador.</div>
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'sales': return <NewSale />;
      case 'purchases': return <Purchases />;
      case 'dispatch': return <Dispatch />;
      case 'dispatch-liquidation': return <DispatchLiquidationComp />;
      case 'cash-flow': return <CashFlow />;
      case 'collection-consolidation': return <CollectionConsolidation />; // NEW ROUTE
      case 'products': return <ProductManagement />;
      case 'clients': return <ClientManagement />;
      case 'suppliers': return <MasterData type="suppliers" />;
      case 'warehouses': return <MasterData type="warehouses" />;
      case 'logistics': return <LogisticsManagement />;
      case 'territory': return <TerritoryManagement />;
      case 'mobile-orders': return <MobileOrders />;
      case 'order-processing': return <OrderProcessing />;
      case 'company-settings': return <CompanySettings />;
      case 'print-batch': return <PrintBatch />;
      case 'document-manager': return <DocumentManager />;
      case 'reports': return <StrategicReports />;
      case 'kardex': return <Kardex />;
      case 'users': return <UserManagement />;
      case 'attendance': return <Attendance />;
      case 'promo-manager': return <PromoManager />;
      case 'price-manager': return <PriceManager />;
      case 'virtual-store': return <VirtualStore />;
      default: return <Dashboard />;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => {
    if (!canAccess(view)) return null;
    return (
      <button
        onClick={() => {
          setCurrentView(view as any);
          setIsSidebarOpen(false);
        }}
        className={`flex items-center space-x-3 w-full p-2.5 rounded-lg transition-colors text-sm ${
          currentView === view 
            ? 'bg-accent text-white shadow-md' 
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  // Helper to render section
  const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => {
     const validChildren = React.Children.toArray(children).filter(child => child);
     if (validChildren.length === 0) return null;
     
     return (
        <>
           <div className="px-4 mt-6 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
             {title}
           </div>
           {children}
        </>
     );
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-xl flex flex-col
      `}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="bg-accent p-1.5 rounded-lg">
              <Box className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">TraceFlow</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="px-4 py-4 space-y-1 overflow-y-auto flex-1">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Panel Principal" />
          
          <Section title="Comercial">
             <NavItem view="sales" icon={ShoppingCart} label="Venta Directa" />
             <NavItem view="order-processing" icon={FileCheck} label="Procesar Pedidos" />
             <NavItem view="price-manager" icon={DollarSign} label="Gestión de Precios" />
             <NavItem view="promo-manager" icon={Gift} label="Ofertas & Combos" />
             <NavItem view="virtual-store" icon={Store} label="Tienda Virtual (Web)" />
             <NavItem view="mobile-orders" icon={Smartphone} label="App Vendedores" />
             <NavItem view="document-manager" icon={FileText} label="Historial Documentos" />
             <NavItem view="print-batch" icon={Printer} label="Impresión por Lotes" /> 
          </Section>
          
          <Section title="Finanzas">
             <NavItem view="cash-flow" icon={DollarSign} label="Flujo de Caja" />
             <NavItem view="collection-consolidation" icon={Wallet} label="Consolidar Cobranzas" />
          </Section>
          
          <Section title="Logística">
             <NavItem view="dispatch" icon={Truck} label="Despacho y Rutas" />
             <NavItem view="dispatch-liquidation" icon={FileInput} label="Liquidación Rutas" />
             <NavItem view="kardex" icon={PackageSearch} label="Kardex & Inventario" />
             <NavItem view="inventory" icon={ClipboardList} label="Ingreso Mercadería" />
          </Section>

          <Section title="Gestión">
             <NavItem view="reports" icon={PieChart} label="Reportes & BI" />
             <NavItem view="users" icon={Shield} label="Usuarios & Roles" />
             <NavItem view="attendance" icon={Clock} label="Control Asistencia" />
          </Section>
          
          <Section title="Maestros">
             <NavItem view="purchases" icon={ShoppingBag} label="Compras" />
             <NavItem view="products" icon={ClipboardList} label="Productos" />
             <NavItem view="clients" icon={Users} label="Clientes" />
             <NavItem view="territory" icon={Map} label="Territorio" />
             <NavItem view="suppliers" icon={Briefcase} label="Proveedores" />
             <NavItem view="warehouses" icon={Home} label="Almacenes" />
             <NavItem view="logistics" icon={Container} label="Flota" />
          </Section>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
           <NavItem view="company-settings" icon={Settings} label="Configuración" />
           
           <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                    {currentUser.username.substring(0,2).toUpperCase()}
                 </div>
                 <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-xs text-slate-400 truncate">{currentUser.role}</div>
                 </div>
              </div>
              <button 
                 onClick={logout}
                 className="w-full flex items-center justify-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2 rounded transition-colors text-xs font-bold"
              >
                 <LogOut className="w-3 h-3" /> CERRAR SESIÓN
              </button>
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 lg:hidden hover:bg-slate-100 rounded-md">
            <Menu className="h-6 w-6" />
          </button>
          <div className="text-sm text-slate-600 hidden sm:flex items-center gap-3">
             {company.logo_url && <img src={company.logo_url} alt="Logo" className="h-8 w-auto object-contain" />}
             <div>Empresa: <span className="text-slate-900 font-bold">{company.name}</span></div>
          </div>
          <div className="flex items-center">
             <div className="text-right mr-3 hidden sm:block">
                <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{currentUser.role}</div>
             </div>
             <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">
                {currentUser.username.substring(0,2).toUpperCase()}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-100">
          {currentView === 'mobile-orders' ? (
             <div className="h-full mx-auto max-w-md bg-white shadow-2xl overflow-hidden rounded-xl border border-slate-200">
                {renderContent()}
             </div>
          ) : (
             <div className="max-w-7xl mx-auto h-full">
               {renderContent()}
             </div>
          )}
        </main>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { NewSale } from './components/NewSale';
import { supabase } from './services/supabase';
import { EditSale } from './components/EditSale'; // NUEVO MÓDULO IMPORTADO
import { AdvancedOrderEntry } from './components/AdvancedOrderEntry';
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
import { MobileDelivery } from './components/MobileDelivery';
import { CashFlow } from './components/CashFlow';
import { DispatchLiquidationComp } from './components/DispatchLiquidation';
import { DocumentManager } from './components/DocumentManager';
import { StrategicReports } from './components/StrategicReports';
import { Kardex } from './components/Kardex';
import { UserManagement } from './components/UserManagement';
import { PersonnelManagement } from './components/PersonnelManagement';
import { Attendance } from './components/Attendance';
import { PromoManager } from './components/PromoManager';
import { PriceManager } from './components/PriceManager';
import { VirtualStore } from './components/VirtualStore';
import { CollectionConsolidation } from './components/CollectionConsolidation';
import { AccountsReceivable } from './components/AccountsReceivable'; // NUEVO MÓDULO
import { SunatManager } from './components/SunatManager';
import { CreditNotes } from './components/CreditNotes';
import { SupplierCreditNotes } from './components/SupplierCreditNotes';
import { QuotaManager } from './components/QuotaManager';
import { AccountingReports } from './components/AccountingReports';
import { Login } from './components/Login';
import { SystemMaintenance } from './components/SystemMaintenance';
import { Inventory } from './components/Inventory';
import SellerTrackingReport from './components/SellerTrackingReport';
import { LayoutDashboard, ShoppingCart, Truck, Menu, X, Box, Users, Briefcase, Home, ShoppingBag, ClipboardList, Settings, Container, Map, Smartphone, FileCheck, Printer, DollarSign, FileInput, FileText, PieChart, PackageSearch, Shield, Clock, LogOut, User as UserIcon, Gift, Store, Tag, Wallet, ArrowLeftRight, FileSpreadsheet, ChevronLeft, ChevronRight, Edit3, HardDrive } from 'lucide-react';
import { ViewState } from './types';
import { useStore } from './services/store';

const COLOR_THEMES = {
  blue: {
    sectionText: 'text-blue-400',
    navItemActive: 'bg-blue-600 text-white shadow-md shadow-blue-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-blue-300',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-blue-400'
  },
  emerald: {
    sectionText: 'text-emerald-400',
    navItemActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-emerald-300',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-emerald-400'
  },
  amber: {
    sectionText: 'text-amber-400',
    navItemActive: 'bg-amber-600 text-white shadow-md shadow-amber-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-amber-300',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-amber-400'
  },
  purple: {
    sectionText: 'text-purple-400',
    navItemActive: 'bg-purple-600 text-white shadow-md shadow-purple-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-purple-300',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-purple-400'
  },
  rose: {
    sectionText: 'text-rose-400',
    navItemActive: 'bg-rose-600 text-white shadow-md shadow-rose-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-rose-300',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-rose-400'
  },
  slate: {
    sectionText: 'text-slate-400',
    navItemActive: 'bg-slate-700 text-white shadow-md shadow-slate-900/50',
    navItemIdle: 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
    iconActive: 'text-white',
    iconIdle: 'text-slate-400 group-hover:text-white'
  }
};
type ThemeKey = keyof typeof COLOR_THEMES;

const SIDEBAR_SECTIONS = [
  {
    title: 'Comercial',
    theme: 'blue' as ThemeKey,
    items: [
      { view: 'sales', icon: ShoppingCart, label: 'Venta Directa' },
      { view: 'edit-sale', icon: Edit3, label: 'Editar/Auditar Venta' },
      { view: 'advanced-orders', icon: ClipboardList, label: 'Pedido Avanzado' },
      { view: 'credit-notes', icon: ArrowLeftRight, label: 'Devoluciones y NC' },
      { view: 'order-processing', icon: FileCheck, label: 'Procesar Pedidos' },
      { view: 'price-manager', icon: DollarSign, label: 'Gestión de Precios' },
      { view: 'promo-manager', icon: Gift, label: 'Ofertas & Combos' },
      { view: 'virtual-store', icon: Store, label: 'Tienda Virtual (Web)' },
      { view: 'mobile-orders', icon: Smartphone, label: 'App Vendedores' },
      { view: 'sunat-manager', icon: FileCheck, label: 'Facturación SUNAT' },
      { view: 'document-manager', icon: FileText, label: 'Historial Documentos' },
      { view: 'print-batch', icon: Printer, label: 'Impresión por Lotes' },
    ]
  },
  {
    title: 'Finanzas',
    theme: 'emerald' as ThemeKey,
    items: [
      { view: 'cash-flow', icon: DollarSign, label: 'Flujo de Caja' },
      { view: 'collection-consolidation', icon: Wallet, label: 'Consolidar Cobranzas' },
      { view: 'accounts-receivable', icon: PieChart, label: 'Cuentas por Cobrar' },
    ]
  },
  {
    title: 'Logística',
    theme: 'amber' as ThemeKey,
    items: [
      { view: 'dispatch', icon: Truck, label: 'Despacho y Rutas' },
      { view: 'dispatch-liquidation', icon: FileInput, label: 'Liquidación Rutas' },
      { view: 'mobile-delivery', icon: Smartphone, label: 'App Reparto' },
      { view: 'kardex', icon: PackageSearch, label: 'Kardex Detalles' },
      { view: 'inventory', icon: Home, label: 'Almacenes & Stock' },
    ]
  },
  {
    title: 'Gestión',
    theme: 'purple' as ThemeKey,
    items: [
      { view: 'reports', icon: PieChart, label: 'Reportes & BI' },
      { view: 'accounting-reports', icon: FileSpreadsheet, label: 'Reportes Contables' },
      { view: 'seller-tracking', icon: Map, label: 'Tracking de Vendedores' },
      { view: 'quota-manager', icon: ClipboardList, label: 'Gestión de Cuotas' },
      { view: 'users', icon: Shield, label: 'Usuarios & Permisos' },
      { view: 'system-maintenance', icon: HardDrive, label: 'Mantenimiento DB' },
      { view: 'personnel-management', icon: Users, label: 'RRHH y Planilla' },
      { view: 'attendance', icon: Clock, label: 'Control Asistencia' },
    ]
  },
  {
    title: 'Maestros',
    theme: 'rose' as ThemeKey,
    items: [
      { view: 'purchases', icon: ShoppingBag, label: 'Compras' },
      { view: 'supplier-credit-notes', icon: ArrowLeftRight, label: 'Devoluciones (Compras)' },
      { view: 'products', icon: ClipboardList, label: 'Productos' },
      { view: 'clients', icon: Users, label: 'Clientes' },
      { view: 'territory', icon: Map, label: 'Territorio' },
      { view: 'suppliers', icon: Briefcase, label: 'Proveedores' },
      { view: 'warehouses', icon: Box, label: 'Rst. Locales/Depósitos' },
      { view: 'logistics', icon: Container, label: 'Flota' },
    ]
  }
];

export default function App() {
  // AÑADIDO 'edit-sale' A LOS TIPOS DE VISTA POSIBLES
  const [currentView, setCurrentView] = useState<ViewState | 'document-manager' | 'reports' | 'accounting-reports' | 'kardex' | 'users' | 'attendance' | 'promo-manager' | 'virtual-store' | 'price-manager' | 'collection-consolidation' | 'credit-notes' | 'supplier-credit-notes' | 'advanced-orders' | 'quota-manager' | 'edit-sale' | 'system-maintenance'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const { company, currentUser, logout, updateCompany } = useStore();

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const { data: compData } = await supabase.from('company_config').select('*').limit(1).maybeSingle();
        if (compData) {
          const { data: serData } = await supabase.from('document_series').select('*').eq('company_id', compData.id).order('type');
          updateCompany({ ...compData, series: serData || [] });
        }
      } catch (error) {
        console.error("Error cargando configuración global:", error);
      }
    };
    if (currentUser && company.ruc === '') {
      fetchCompanyData();
    }
  }, [currentUser]);

  // --- AUTH CHECK ---
  if (!currentUser) {
    return <Login />;
  }

  // --- CLIENT REDIRECT ---
  if (currentUser.role === 'CLIENT') {
    return <VirtualStore />;
  }

  // --- PERMISSION CHECK ---
  const canAccess = (view: string) => {
    return currentUser.permissions?.includes(view) || view === 'edit-sale' || view === 'accounts-receivable' || view === 'seller-tracking' || view === 'supplier-credit-notes'; 
  };

  const renderContent = () => {
    if (!canAccess(currentView) && currentView !== 'dashboard') {
      return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado a este módulo. Contacte al administrador.</div>
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'sales': return <NewSale />;
      case 'edit-sale': return <EditSale />; // RENDER DEL NUEVO MÓDULO
      case 'advanced-orders': return <AdvancedOrderEntry />;
      case 'purchases': return <Purchases />;
      case 'dispatch': return <Dispatch />;
      case 'dispatch-liquidation': return <DispatchLiquidationComp />;
      case 'cash-flow': return <CashFlow />;
      case 'collection-consolidation': return <CollectionConsolidation />;
      case 'accounts-receivable': return <AccountsReceivable />; // RENDER DEL NUEVO MÓDULO
      case 'sunat-manager': return <SunatManager />;
      case 'credit-notes': return <CreditNotes />;
      case 'supplier-credit-notes': return <SupplierCreditNotes />;
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
      case 'mobile-delivery': return <MobileDelivery />;
      case 'document-manager': return <DocumentManager />;
      case 'reports': return <StrategicReports />;
      case 'accounting-reports': return <AccountingReports />;
      case 'seller-tracking': return <SellerTrackingReport />;
      case 'quota-manager': return <QuotaManager />;
      case 'kardex': return <Kardex />;
      case 'users': return <UserManagement />;
      case 'personnel-management': return <PersonnelManagement />;
      case 'attendance': return <Attendance />;
      case 'promo-manager': return <PromoManager />;
      case 'price-manager': return <PriceManager />;
      case 'virtual-store': return <VirtualStore />;
      case 'system-maintenance': return <SystemMaintenance />;
      case 'inventory': return <Inventory />;
      default: return <Dashboard />;
    }
  };

  const renderNavItem = (view: string, Icon: any, label: string, theme: ThemeKey = 'slate') => {
    if (!canAccess(view)) return null;
    const isActive = currentView === view;
    const themeClasses = COLOR_THEMES[theme];

    return (
      <button
        key={view}
        onClick={() => {
          setCurrentView(view as any);
          setIsSidebarOpen(false);
        }}
        title={isDesktopSidebarCollapsed ? label : undefined}
        className={`group flex items-center ${isDesktopSidebarCollapsed ? 'justify-center w-11 h-11 mx-auto space-x-0' : 'space-x-3 w-full p-2.5'} rounded-lg transition-all duration-200 text-sm ${isActive
          ? themeClasses.navItemActive
          : themeClasses.navItemIdle
          }`}
      >
        <Icon className={`flex-shrink-0 transition-colors duration-200 ${isDesktopSidebarCollapsed ? 'h-5 w-5' : 'h-5 w-5'} ${isActive ? themeClasses.iconActive : themeClasses.iconIdle}`} />
        {!isDesktopSidebarCollapsed && (
          <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
        )}
      </button>
    );
  };

  const renderSection = (title: string, theme: ThemeKey, items: any[]) => {
    const renderedItems = items.map(item => renderNavItem(item.view, item.icon, item.label, theme)).filter(Boolean);
    if (renderedItems.length === 0) return null;
    
    const themeClasses = COLOR_THEMES[theme];

    return (
      <div key={title} className="mb-2">
        {isDesktopSidebarCollapsed ? (
          <div className="h-px w-8 mx-auto my-4 bg-slate-700 opacity-50 relative group cursor-help">
            <div className="absolute hidden group-hover:block left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 shadow-xl border border-slate-700">{title}</div>
          </div>
        ) : (
          <div className={`px-4 mt-6 mb-2 text-xs font-bold uppercase tracking-wider ${themeClasses.sectionText}`}>
            {title}
          </div>
        )}
        <div className="space-y-1">
          {renderedItems}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen print:h-auto bg-slate-100 overflow-hidden print:overflow-visible">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-slate-900 text-white transform transition-all duration-300 ease-in-out lg:relative
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${isDesktopSidebarCollapsed ? 'w-20' : 'w-72'} shadow-[4px_0_24px_rgba(0,0,0,0.1)] flex flex-col group/sidebar
      `}>
        <div className="h-16 flex items-center justify-between border-b border-slate-800 px-4 shrink-0 relative">
          {!isDesktopSidebarCollapsed ? (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="bg-accent p-2 rounded-lg shrink-0 shadow-lg shadow-accent/20">
                <Box className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white truncate">Tandao ERP</span>
            </div>
          ) : (
            <div className="w-full flex justify-center mt-2">
              <div className="bg-accent/80 p-2 rounded-lg shrink-0">
                <Box className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white shrink-0 absolute right-4">
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            className={`hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full p-1.5 shadow-lg shadow-black/20 transition-all hover:scale-110 z-50`}
            title={isDesktopSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isDesktopSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 overflow-x-hidden ${isDesktopSidebarCollapsed ? 'px-2' : 'px-4'} custom-scrollbar`}>
          <div className="space-y-1">
            {renderNavItem('dashboard', LayoutDashboard, 'Panel Principal', 'blue')}
          </div>

          {SIDEBAR_SECTIONS.map(section => renderSection(section.title, section.theme, section.items))}
        </nav>

        <div className={`border-t border-slate-800 bg-slate-900 shrink-0 ${isDesktopSidebarCollapsed ? 'p-3 space-y-3' : 'p-4'}`}>
          {renderNavItem('company-settings', Settings, 'Configuración', 'slate')}

          {!isDesktopSidebarCollapsed ? (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold shadow-inner">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium tracking-wide truncate">{currentUser.role}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white px-4 py-2.5 rounded-lg transition-all duration-200 text-xs font-bold shadow-sm"
              >
                <LogOut className="w-4 h-4 shrink-0" /> <span className="truncate">CERRAR SESIÓN</span>
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0 cursor-help shadow-inner"
                title={`${currentUser.name} (${currentUser.role})`}
              >
                {currentUser.username.substring(0, 2).toUpperCase()}
              </div>
              <button
                onClick={logout}
                title="Cerrar Sesión"
                className="w-11 h-11 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-all duration-200 shadow-sm"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen print:h-auto overflow-hidden print:overflow-visible">
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
              {currentUser.username.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible p-6 lg:p-8 bg-slate-100">
          {currentView === 'mobile-orders' || currentView === 'mobile-delivery' ? (
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

export interface OfflineOrder {
    localId: string;
    payload: any;
    status: 'PENDING_SYNC' | 'ERROR';
    errorMessage?: string;
    createdAt: string;
    sellerId: string;
}

const STORAGE_KEY = 'traceflow_offline_orders_queue';

export const saveOfflineOrder = (payload: any, sellerId: string): OfflineOrder => {
    const queue = getOfflineOrders();
    // Reutilizar el ID original del pedido o crear uno temporal
    const localId = payload.id || crypto.randomUUID();
    
    const newOrder: OfflineOrder = {
        localId,
        payload,
        status: 'PENDING_SYNC',
        createdAt: new Date().toISOString(),
        sellerId
    };
    
    queue.push(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return newOrder;
};

export const getOfflineOrders = (): OfflineOrder[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Error reading offline orders from localStorage:", e);
        return [];
    }
};

export const getOfflineOrdersBySeller = (sellerId: string): OfflineOrder[] => {
    return getOfflineOrders().filter(o => o.sellerId === sellerId);
};

export const removeOfflineOrder = (localId: string): void => {
    const queue = getOfflineOrders();
    const updatedQueue = queue.filter(o => o.localId !== localId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
};

export const markOfflineOrderError = (localId: string, errorMsg: string): void => {
    const queue = getOfflineOrders();
    const updatedQueue = queue.map(o => {
        if (o.localId === localId) {
            return { ...o, status: 'ERROR' as const, errorMessage: errorMsg };
        }
        return o;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
};

export const clearOfflineQueue = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};

// --- MASTER DATA SNAPSHOTS ---

const MASTER_DATA_KEY = 'traceflow_master_data_snapshot';
const ACTIVE_SELLER_KEY = 'traceflow_active_seller';

export const saveMasterDataLocal = (sellerId: string, data: any): void => {
    try {
        const snapshot = {
            sellerId,
            timestamp: new Date().toISOString(),
            data
        };
        localStorage.setItem(MASTER_DATA_KEY, JSON.stringify(snapshot));
    } catch (e) {
        console.error("Error saving master data snapshot:", e);
        // Podría fallar si se excede la cuota de localStorage
    }
};

export const getMasterDataLocal = (sellerId: string): any | null => {
    try {
        const stored = localStorage.getItem(MASTER_DATA_KEY);
        if (!stored) return null;
        const snapshot = JSON.parse(stored);
        // Retornar solo si coincide el vendedor, para no cruzar data
        if (snapshot.sellerId === sellerId) {
            return snapshot.data;
        }
        return null;
    } catch (e) {
        console.error("Error reading master data snapshot:", e);
        return null;
    }
};

export const saveActiveSeller = (sellerId: string): void => {
    localStorage.setItem(ACTIVE_SELLER_KEY, sellerId);
};

export const getActiveSeller = (): string | null => {
    return localStorage.getItem(ACTIVE_SELLER_KEY);
};

export const clearActiveSeller = (): void => {
    localStorage.removeItem(ACTIVE_SELLER_KEY);
};

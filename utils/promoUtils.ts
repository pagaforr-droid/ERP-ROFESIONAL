import { Promotion, Combo, AutoPromotion, BatchAllocation, Batch } from '../types';
import { allocateBatchesFIFO } from './productUtils';

export const isPromoCurrentlyActive = (promo: Promotion | Combo | AutoPromotion): boolean => {
  if (!promo.is_active) return false;

  const now = new Date();
  
  // Set time of start_date to 00:00:00
  const startDate = new Date(promo.start_date);
  startDate.setHours(0, 0, 0, 0);

  // Set time of end_date to 23:59:59
  const endDate = new Date(promo.end_date);
  endDate.setHours(23, 59, 59, 999);

  return now >= startDate && now <= endDate;
};

// Common target cities for Peru used across the application
export const PERU_CITIES = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca',
  'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín',
  'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios',
  'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna',
  'Tumbes', 'Ucayali'
];

export const isPromoValidForContext = (
  promo: Promotion | Combo | AutoPromotion, 
  channel: 'IN_STORE' | 'SELLER_APP' | 'DIRECT_SALE', 
  clientCityInput?: string,
  sellerId?: string,
  userRole?: string
): boolean => {
  if (!isPromoCurrentlyActive(promo)) return false;

  if (promo.channels && promo.channels.length > 0) {
    if (!promo.channels.includes(channel)) return false;
  }

  // App Vendedores Role Check
  if (channel === 'SELLER_APP' && userRole) {
    if (userRole !== 'SELLER' && userRole !== 'ADMIN') return false;
  }

  // Seller Restriction Check
  if (promo.allowed_seller_ids && promo.allowed_seller_ids.length > 0) {
    if (!sellerId || !promo.allowed_seller_ids.includes(sellerId)) return false;
  }

  if (promo.target_cities && promo.target_cities.length > 0) {
    if (!clientCityInput) return false;
    const clientCity = clientCityInput.trim().toLowerCase();
    
    // Strict match to client's "city" field
    const matchesCity = promo.target_cities.some(targetCity => {
      return clientCity === targetCity.trim().toLowerCase();
    });

    if (!matchesCity) return false;
  }

  return true;
};

export const isHappyHourActive = (promo: AutoPromotion): boolean => {
  if (!promo.is_happy_hour) return true;
  if (!promo.start_time || !promo.end_time) return true;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const [startHour, startMinute] = promo.start_time.split(':').map(Number);
  const [endHour, endMinute] = promo.end_time.split(':').map(Number);

  const currentTotal = currentHour * 60 + currentMinute;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return currentTotal >= startTotal && currentTotal <= endTotal;
};

// Context interfaces for the Engine
export interface PromoContext {
  channel: 'IN_STORE' | 'SELLER_APP' | 'DIRECT_SALE';
  city?: string;
  sellerId?: string;
  userRole?: string;
  priceListId?: string;
  clientId?: string;
}

export interface ClientPromoUsage {
  [promoId: string]: number; // Map of promo_id to usage count for this specific client
}

// THE NEW CENTRALIZED ENGINE
export const applyAutoPromotionsEngine = (
  cart: any[], // SaleItem[]
  allAutoPromos: AutoPromotion[],
  products: any[],
  batches: any[],
  context: PromoContext,
  clientUsage: ClientPromoUsage = {}
): { newCart: any[], warnings: string[] } => {
  let newCart = cart.filter(item => !item.auto_promo_id);
  let warnings: string[] = [];

  // Filter valid promos by context
  let validPromos = allAutoPromos.filter(ap => {
    if (!isPromoValidForContext(ap, context.channel, context.city, context.sellerId, context.userRole)) return false;
    if (ap.target_price_list_ids && ap.target_price_list_ids.length > 0 && !ap.target_price_list_ids.includes('ALL')) {
      if (!context.priceListId || !ap.target_price_list_ids.includes(context.priceListId)) return false;
    }
    if (!isHappyHourActive(ap)) return false;
    
    // Check Global Limit
    if (ap.global_reward_limit && ap.global_reward_limit > 0) {
       if ((ap.current_reward_uses || 0) >= ap.global_reward_limit) return false;
    }

    // Check Client Limit
    if (ap.max_uses_per_client && ap.max_uses_per_client > 0) {
       const uses = clientUsage[ap.id] || 0;
       if (uses >= ap.max_uses_per_client) return false;
    }
    
    return true;
  });

  // Sort promos so Exclusives and higher conditions go first
  validPromos.sort((a, b) => {
    if (a.is_exclusive && !b.is_exclusive) return -1;
    if (!a.is_exclusive && b.is_exclusive) return 1;
    return b.condition_amount - a.condition_amount;
  });

  let appliedExclusive = false;

  for (const ap of validPromos) {
    if (appliedExclusive) break; // Skip if an exclusive promo already applied

    let applies = false;
    let multiplyFactor = 0;

    if (ap.condition_type === 'BUY_X_PRODUCT') {
       const qtyBought = newCart.reduce((sum, item) => {
           if (item.is_bonus) return sum;
           const hasList = ap.condition_product_ids && ap.condition_product_ids.length > 0;
           const hasSingle = !!ap.condition_product_id;
           
           let itemBaseQty = Number(item.quantity_base);
           if (isNaN(itemBaseQty)) {
               const conversionFactor = Number((item.unit_type || item.selected_unit || '').split('/')[1]) || 1;
               itemBaseQty = Number(item.quantity || 0) * conversionFactor;
           }

           if (hasList && ap.condition_product_ids!.includes(item.product_id)) return sum + itemBaseQty;
           if (hasSingle && item.product_id === ap.condition_product_id) return sum + itemBaseQty;
           return sum;
       }, 0);
       
       if (qtyBought >= ap.condition_amount) { 
           applies = true; 
           multiplyFactor = Math.floor(qtyBought / ap.condition_amount); 
       }
    } else if (ap.condition_type === 'SPEND_Y_TOTAL') {
       const totalSpent = newCart.reduce((sum, item) => {
          const conditionItemKeys = ap.condition_product_ids || [];
          if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
          return sum + Number(item.total_price || 0);
       }, 0);
       if (totalSpent >= ap.condition_amount) { 
           applies = true; 
           multiplyFactor = Math.floor(totalSpent / ap.condition_amount); 
       }
    } else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
       const catSpent = newCart.reduce((sum, item) => {
          const p = products.find(prod => prod.id === item.product_id);
          if (p?.category === ap.condition_category) return sum + Number(item.total_price || 0);
          return sum;
       }, 0);
       if (catSpent >= ap.condition_amount) { 
           applies = true; 
           multiplyFactor = Math.floor(catSpent / ap.condition_amount); 
       }
    }

    if (applies && multiplyFactor > 0) {
       // APLY TOPES / LIMITS
       if (ap.max_reward_multiplier && ap.max_reward_multiplier > 0) {
           multiplyFactor = Math.min(multiplyFactor, ap.max_reward_multiplier);
       }

       // CAP: TOPE POR CLIENTE (Restante Histórico)
       if (ap.max_uses_per_client && ap.max_uses_per_client > 0) {
           const currentUses = clientUsage[ap.id] || 0;
           const remainingUses = ap.max_uses_per_client - currentUses;
           multiplyFactor = Math.min(multiplyFactor, Math.max(0, remainingUses));
       }

       // CAP: TOPE GLOBAL (Restante en BD)
       if (ap.global_reward_limit && ap.global_reward_limit > 0) {
           const currentGlobalUses = ap.current_reward_uses || 0;
           const remainingGlobalUses = ap.global_reward_limit - currentGlobalUses;
           multiplyFactor = Math.min(multiplyFactor, Math.max(0, remainingGlobalUses));
       }

       if (multiplyFactor <= 0) continue; // Si agotó el límite, no aplicar bonificación


       const rewardProd = products.find(p => p.id === ap.reward_product_id);
       if (rewardProd) {
          const requestedBaseQty = ap.reward_quantity * multiplyFactor * (ap.reward_unit_type === 'PKG' ? Number(rewardProd.package_content || 1) : 1);
          
          // VERIFICACION DE STOCK FISICO
          const totalStockAvailable = batches.filter(b => b.product_id === rewardProd.id && b.quantity_current > 0).reduce((sum, b) => sum + b.quantity_current, 0);

          if (totalStockAvailable < requestedBaseQty) {
              warnings.push(`¡Alerta! El cliente ganó el bono "${ap.name}", pero NO HAY STOCK FÍSICO suficiente del premio (${rewardProd.name}). Stock disponible: ${totalStockAvailable}`);
              // We do not inject if there is zero stock. If there is partial stock, we could inject partial, but it's safer to skip or just inject the available amount.
              if (totalStockAvailable === 0) continue; // Skip injection
              
              // Partially inject up to available stock
              const newMultiplier = Math.floor(totalStockAvailable / (ap.reward_unit_type === 'PKG' ? Number(rewardProd.package_content || 1) : 1));
              if (newMultiplier <= 0) continue;
              multiplyFactor = newMultiplier;
          }

          if (ap.is_exclusive) appliedExclusive = true;

          const rewardQty = ap.reward_quantity * multiplyFactor;
          const isPkgMode = ap.reward_unit_type === 'PKG';
          const conversionFactor = isPkgMode ? Number(rewardProd.package_content || 1) : 1;
          const realUnitName = isPkgMode ? `${(rewardProd.package_type || 'CAJA').toUpperCase()} / ${conversionFactor}` : `${(rewardProd.unit_type || 'UND').toUpperCase()} / 1`;

          const productBatches = batches.filter(b => b.product_id === rewardProd.id && b.quantity_current > 0).sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
          
          newCart.push({ 
             id: crypto.randomUUID(), 
             sale_id: '', 
             product_id: rewardProd.id, 
             product_sku: rewardProd.sku, 
             product_name: rewardProd.name, 
             quantity_base: rewardQty * conversionFactor, 
             batch_allocations: allocateBatchesFIFO(rewardQty * conversionFactor, productBatches), 
             quantity: rewardQty, 
             quantity_presentation: rewardQty, 
             unit_price: 0, 
             discount_percent: 100, 
             discount_amount: 0, 
             total_price: 0, 
             selected_unit: realUnitName, 
             is_bonus: true, 
             auto_promo_id: ap.id, 
             product: rewardProd 
          } as any);
       }
    }
  }

  return { newCart, warnings };
};


import { OrderItem, Product, AutoPromotion } from '../types';
import { isPromoValidForContext, isPromoCurrentlyActive } from './promoUtils';

export function isPromoActive(start_date: string, end_date: string, is_active: boolean): boolean {
    if (!is_active) return false;
    const now = new Date();
    // Parse start_date ensuring it starts at 00:00:00 of local time
    const start = new Date(`${start_date}T00:00:00`);
    // Parse end_date ensuring it ends at 23:59:59 of local time
    const end = new Date(`${end_date}T23:59:59.999`);
    return now >= start && now <= end;
}

export function calculatePromotions(
    cartItems: OrderItem[],
    autoPromotions: AutoPromotion[],
    products: Product[],
    channel: 'IN_STORE' | 'SELLER_APP' | 'DIRECT_SALE' = 'IN_STORE',
    clientCity?: string
): OrderItem[] {
    // 1. Remove all existing bonus items logically added by auto-promos
    // This ensures we always calculate from a clean state.
    const baseCart = cartItems.filter(item => !item.is_promo);

    const newBonusItems: OrderItem[] = [];

    // 2. Evaluate active auto promotions
    autoPromotions.filter(p => isPromoValidForContext(p, channel, clientCity)).forEach(promo => {
        // Rule 1: BUY_X_PRODUCT
        if (promo.condition_type === 'BUY_X_PRODUCT') {
            const conditionItemKeys = promo.condition_product_ids || (promo.condition_product_id ? [promo.condition_product_id] : []);
            
            const totalBaseUnitsInCart = baseCart
                .filter(item => conditionItemKeys.includes(item.product_id))
                .reduce((sum, item) => {
                    const product = products.find(p => p.id === item.product_id);
                    const factor = item.unit_type === 'PKG' ? (product?.package_content || 1) : 1;
                    return sum + (item.quantity * factor);
                }, 0);

            // Calculate how many times the rule is met
            const timesMet = Math.floor(totalBaseUnitsInCart / promo.condition_amount);

            if (timesMet > 0) {
                const rewardProduct = products.find(p => p.id === promo.reward_product_id);
                if (rewardProduct) {
                    // Calculate total reward quantity
                    const rewardQty = timesMet * promo.reward_quantity;

                    // Deduplicate if multiple rules give the same product?
                    newBonusItems.push({
                        product_id: rewardProduct.id,
                        product_name: rewardProduct.name,
                        unit_type: promo.reward_unit_type,
                        quantity: rewardQty,
                        unit_price: 0,
                        total_price: 0,
                        is_promo: true, // Locked, zero-price item
                        auto_promo_id: promo.id
                    });
                }
            }
        } else if (promo.condition_type === 'SPEND_Y_TOTAL') {
            const conditionItemKeys = promo.condition_product_ids || [];
            const totalSpent = baseCart.reduce((sum, item) => {
               if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
               return sum + item.total_price;
            }, 0);

            const timesMet = Math.floor(totalSpent / promo.condition_amount);
            if (timesMet > 0) {
                const rewardProduct = products.find(p => p.id === promo.reward_product_id);
                if (rewardProduct) {
                    newBonusItems.push({
                        product_id: rewardProduct.id,
                        product_name: rewardProduct.name,
                        unit_type: promo.reward_unit_type,
                        quantity: promo.reward_quantity * timesMet,
                        unit_price: 0,
                        total_price: 0,
                        is_promo: true,
                        auto_promo_id: promo.id
                    });
                }
            }
        } else if (promo.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = baseCart.reduce((sum, item) => {
               const p = products.find(prod => prod.id === item.product_id);
               if (p?.category === promo.condition_category) return sum + item.total_price;
               return sum;
            }, 0);
            const timesMet = Math.floor(catSpent / promo.condition_amount);
            if (timesMet > 0) {
                const rewardProduct = products.find(p => p.id === promo.reward_product_id);
                if (rewardProduct) {
                    newBonusItems.push({
                        product_id: rewardProduct.id,
                        product_name: rewardProduct.name,
                        unit_type: promo.reward_unit_type,
                        quantity: promo.reward_quantity * timesMet,
                        unit_price: 0,
                        total_price: 0,
                        is_promo: true,
                        auto_promo_id: promo.id
                    });
                }
            }
        }
    });

    // 3. Combine base cart with newly calculated bonuses
    return [...baseCart, ...newBonusItems];
}

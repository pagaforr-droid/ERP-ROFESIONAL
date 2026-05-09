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
    clientCity?: string,
    sellerId?: string,
    userRole?: string
): OrderItem[] {
    const baseCart = cartItems.filter(item => !item.is_promo);
    const newBonusItems: OrderItem[] = [];

    let validPromos = autoPromotions.filter(p => {
        if (!isPromoValidForContext(p, channel, clientCity, sellerId, userRole)) return false;
        
        // Happy Hour Check
        if (p.is_happy_hour && p.start_time && p.end_time) {
            const now = new Date();
            const currentTotal = now.getHours() * 60 + now.getMinutes();
            const [startHour, startMinute] = p.start_time.split(':').map(Number);
            const [endHour, endMinute] = p.end_time.split(':').map(Number);
            if (currentTotal < startHour * 60 + startMinute || currentTotal > endHour * 60 + endMinute) return false;
        }

        // Global Limit Check
        if (p.global_reward_limit && p.global_reward_limit > 0) {
            if ((p.current_reward_uses || 0) >= p.global_reward_limit) return false;
        }
        
        // Client Limit Check could be here if we pass clientUsage, but we don't have it in this signature yet.
        return true;
    });

    validPromos.sort((a, b) => {
        if (a.is_exclusive && !b.is_exclusive) return -1;
        if (!a.is_exclusive && b.is_exclusive) return 1;
        return b.condition_amount - a.condition_amount;
    });

    let appliedExclusive = false;

    validPromos.forEach(promo => {
        if (appliedExclusive) return;
        
        let timesMet = 0;

        if (promo.condition_type === 'BUY_X_PRODUCT') {
            const conditionItemKeys = promo.condition_product_ids || (promo.condition_product_id ? [promo.condition_product_id] : []);
            const totalBaseUnitsInCart = baseCart
                .filter(item => conditionItemKeys.length === 0 || conditionItemKeys.includes(item.product_id))
                .reduce((sum, item) => {
                    const product = products.find(p => p.id === item.product_id);
                    const factor = item.unit_type === 'PKG' ? (product?.package_content || 1) : 1;
                    return sum + (item.quantity * factor);
                }, 0);

            timesMet = Math.floor(totalBaseUnitsInCart / promo.condition_amount);
        } else if (promo.condition_type === 'SPEND_Y_TOTAL') {
            const conditionItemKeys = promo.condition_product_ids || [];
            const totalSpent = baseCart.reduce((sum, item) => {
               if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
               return sum + item.total_price;
            }, 0);
            timesMet = Math.floor(totalSpent / promo.condition_amount);
        } else if (promo.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = baseCart.reduce((sum, item) => {
               const p = products.find(prod => prod.id === item.product_id);
               if (p?.category === promo.condition_category) return sum + item.total_price;
               return sum;
            }, 0);
            timesMet = Math.floor(catSpent / promo.condition_amount);
        }

        if (timesMet > 0) {
            if (promo.max_reward_multiplier && promo.max_reward_multiplier > 0) {
                timesMet = Math.min(timesMet, promo.max_reward_multiplier);
            }

            const rewardProduct = products.find(p => p.id === promo.reward_product_id);
            if (rewardProduct) {
                // Stock validation is hard here because we don't have batches in this signature.
                // We'll rely on checkout to validate final stock.
                
                if (promo.is_exclusive) appliedExclusive = true;

                newBonusItems.push({
                    product_id: rewardProduct.id,
                    product_name: rewardProduct.name,
                    unit_type: promo.reward_unit_type || 'UND',
                    quantity: promo.reward_quantity * timesMet,
                    unit_price: 0,
                    total_price: 0,
                    is_promo: true,
                    auto_promo_id: promo.id
                });
            }
        }
    });

    return [...baseCart, ...newBonusItems];
}

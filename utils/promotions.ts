import { OrderItem, Product, AutoPromotion } from '../types';

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
    products: Product[]
): OrderItem[] {
    // 1. Remove all existing bonus items logically added by auto-promos
    // This ensures we always calculate from a clean state.
    const baseCart = cartItems.filter(item => !item.is_promo);

    const newBonusItems: OrderItem[] = [];

    // 2. Evaluate active auto promotions
    autoPromotions.filter(p => isPromoActive(p.start_date, p.end_date, p.is_active)).forEach(promo => {
        // Rule 1: BUY_X_PRODUCT
        if (promo.condition_type === 'BUY_X_PRODUCT' && promo.condition_product_id) {
            const triggerProduct = products.find(p => p.id === promo.condition_product_id);
            if (!triggerProduct) return;

            // Count how many base units of the trigger product are in the cart
            let totalBaseUnitsInCart = 0;
            baseCart.forEach(item => {
                if (item.product_id === triggerProduct.id) {
                    const factor = item.unit_type === 'PKG' ? (triggerProduct.package_content || 1) : 1;
                    totalBaseUnitsInCart += item.quantity * factor;
                }
            });

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
        }

        // Additional rules (SPEND_Y_TOTAL, SPEND_Y_CATEGORY) can be added here
    });

    // 3. Combine base cart with newly calculated bonuses
    return [...baseCart, ...newBonusItems];
}

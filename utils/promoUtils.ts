import { Promotion, Combo, AutoPromotion } from '../types';

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


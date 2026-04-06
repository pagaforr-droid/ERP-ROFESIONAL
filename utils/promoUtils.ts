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
  clientCityInput?: string
): boolean => {
  if (!isPromoCurrentlyActive(promo)) return false;

  if (promo.channels && promo.channels.length > 0) {
    if (!promo.channels.includes(channel)) return false;
  }

  if (promo.target_cities && promo.target_cities.length > 0) {
    if (!clientCityInput) return false;
    const clientCityLower = clientCityInput.toLowerCase();
    
    const matchesCity = promo.target_cities.some(targetCity => {
      // Remove accents for safter comparison if needed, but a simple includes is robust for basic matches
      return clientCityLower.includes(targetCity.toLowerCase());
    });

    if (!matchesCity) return false;
  }

  return true;
};

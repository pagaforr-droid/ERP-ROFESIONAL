import { createClient } from '@supabase/supabase-js';

// En desarrollo, la constante default es VITE_USE_MOCK_DB=true
// En Vercel o para entorno real hay que pasarle VITE_USE_MOCK_DB=false
export const USE_MOCK_DB = (import.meta as any).env.VITE_USE_MOCK_DB !== 'false';

// Creamos un dummy genérico para evitar crash si el usuario aún no pone las keys
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from '@supabase/supabase-js';

// FORZADO A USAR LA BASE DE DATOS REAL DE SUPABASE
export const USE_MOCK_DB = false;

// Creamos un dummy genérico para evitar crash si el usuario aún no pone las keys
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

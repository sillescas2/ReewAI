import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigInfo {
  url: string;
  anonKey: string;
  source: 'env' | 'custom' | 'none';
}

export const sanitizeSupabaseUrl = (rawUrl: string): string => {
  let trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    // Supabase project URL must be origin only (protocol + domain + port).
    // Subpaths like /rest/v1 or /auth/v1 break auth endpoint calls and trigger PGRST125.
    return parsed.origin;
  } catch {
    return trimmed
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/auth\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  }
};

export const getSupabaseConfig = (): SupabaseConfigInfo => {
  const envUrl = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl.startsWith('http') && envKey.length > 0) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const customUrl = sanitizeSupabaseUrl(localStorage.getItem('reewai_custom_supabase_url') || '');
    const customKey = (localStorage.getItem('reewai_custom_supabase_key') || '').trim();
    if (customUrl.startsWith('http') && customKey.length > 0) {
      return { url: customUrl, anonKey: customKey, source: 'custom' };
    }
  }

  return { url: '', anonKey: '', source: 'none' };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  return url.length > 0 && url.startsWith('http') && anonKey.length > 0;
};

let clientInstance: SupabaseClient | null = null;
let currentClientKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  const clientKey = `${url}::${anonKey}`;
  if (!clientInstance || currentClientKey !== clientKey) {
    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      });
      currentClientKey = clientKey;
    } catch (e) {
      console.error('Error initializing Supabase client:', e);
      return null;
    }
  }

  return clientInstance;
};

export const saveCustomSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    const cleanUrl = sanitizeSupabaseUrl(url);
    localStorage.setItem('reewai_custom_supabase_url', cleanUrl);
    localStorage.setItem('reewai_custom_supabase_key', key.trim());
    clientInstance = null;
    currentClientKey = '';
  }
};

export const clearCustomSupabaseConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('reewai_custom_supabase_url');
    localStorage.removeItem('reewai_custom_supabase_key');
    clientInstance = null;
    currentClientKey = '';
  }
};

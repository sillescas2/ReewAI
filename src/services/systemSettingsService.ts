import { UserProfile } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchAiStatus } from './aiStatusService';

export const SUPABASE_SYSTEM_SETTINGS_SQL = `-- ==============================================================================
-- REEWAI - TABLA DE CONFIGURACIÓN DEL SISTEMA Y CLAVES (public.system_settings)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (https://app.supabase.com)
-- ==============================================================================

-- 1. Crear tabla para almacenar parámetros de configuración y claves
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.system_settings IS 'Configuraciones seguras y claves del sistema gestionadas exclusivamente por administradores';

-- 2. Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Habilitar Row Level Security (RLS) para aislamiento estricto
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACCESO: SOLO ADMINISTRADORES
-- Política de LECTURA: Solo usuarios con rol 'admin' o el correo autorizado pueden consultar la clave
DROP POLICY IF EXISTS "Solo administradores pueden leer la configuración del sistema" ON public.system_settings;
CREATE POLICY "Solo administradores pueden leer la configuración del sistema"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  );

-- Política de ESCRITURA/MODIFICACIÓN: Solo administradores pueden guardar, actualizar o borrar
DROP POLICY IF EXISTS "Solo administradores pueden modificar la configuración" ON public.system_settings;
CREATE POLICY "Solo administradores pueden modificar la configuración"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  );
`;

const LOCAL_STORAGE_KEY = 'reewai_admin_gemini_key';
let inMemoryCachedKey: string | null = null;

export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.email?.trim().toLowerCase() === 'sillescas2@gmail.com';
}

export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const first = trimmed.slice(0, 6);
  const last = trimmed.slice(-4);
  return `${first}...${last}`;
}

/**
 * Returns the currently active Gemini API key (for analyzing links).
 * Checks memory, Supabase (if admin), local storage fallback, and env.
 */
export async function getActiveGeminiApiKey(user?: UserProfile | null): Promise<string | null> {
  if (inMemoryCachedKey) {
    return inMemoryCachedKey;
  }

  // If user is admin and Supabase is configured, try fetching from Supabase
  if (isUserAdmin(user) && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'GEMINI_API_KEY')
          .maybeSingle();

        if (!error && data?.value) {
          inMemoryCachedKey = data.value.trim();
          return inMemoryCachedKey;
        }
      }
    } catch {
      // Fallback
    }
  }

  // Check admin local storage fallback
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local && local.trim().length > 5) {
      inMemoryCachedKey = local.trim();
      return inMemoryCachedKey;
    }
  }

  // Check Vite client env variable if defined
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (envKey.length > 5) {
    return envKey;
  }

  return null;
}

export interface StoredKeyInfo {
  apiKey: string | null;
  maskedKey: string;
  source: 'supabase' | 'local' | 'env' | 'none';
  updatedAt?: string;
  error?: string;
}

/**
 * Loads the current Gemini API Key status and details for an administrator.
 */
export async function getStoredGeminiApiKey(user: UserProfile | null): Promise<StoredKeyInfo> {
  if (!isUserAdmin(user)) {
    return {
      apiKey: null,
      maskedKey: '',
      source: 'none',
      error: 'Se requieren permisos de administrador.',
    };
  }

  // 1. Check Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value, updated_at')
          .eq('key', 'GEMINI_API_KEY')
          .maybeSingle();

        if (!error && data?.value) {
          inMemoryCachedKey = data.value.trim();
          return {
            apiKey: data.value.trim(),
            maskedKey: maskApiKey(data.value),
            source: 'supabase',
            updatedAt: data.updated_at,
          };
        } else if (error && error.code !== 'PGRST116') {
          // Table doesn't exist or RLS issue
          console.warn('Supabase system_settings query notice:', error.message);
        }
      }
    } catch (e: any) {
      console.warn('Could not read from Supabase system_settings:', e.message);
    }
  }

  // 2. Check Local Storage fallback
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local && local.trim().length > 5) {
      inMemoryCachedKey = local.trim();
      return {
        apiKey: local.trim(),
        maskedKey: maskApiKey(local),
        source: 'local',
      };
    }
  }

  // 3. Check VITE_GEMINI_API_KEY
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (envKey.length > 5) {
    return {
      apiKey: envKey,
      maskedKey: maskApiKey(envKey),
      source: 'env',
    };
  }

  return {
    apiKey: null,
    maskedKey: '',
    source: 'none',
  };
}

/**
 * Saves the Gemini API key in Supabase (and local backup).
 */
export async function saveGeminiApiKey(
  apiKey: string,
  user: UserProfile | null
): Promise<{ success: boolean; source: 'supabase' | 'local'; message: string; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      success: false,
      source: 'local',
      message: 'La clave de API no puede estar vacía.',
      error: 'La clave de API no puede estar vacía.',
    };
  }

  if (!isUserAdmin(user)) {
    return {
      success: false,
      source: 'local',
      message: 'Acceso denegado: solo administradores pueden configurar la clave de API.',
      error: 'Acceso denegado: solo administradores pueden configurar la clave de API.',
    };
  }

  inMemoryCachedKey = cleanKey;

  // Always save in localStorage backup so local sessions retain it
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, cleanKey);
    } catch {}
  }

  let savedInSupabase = false;
  let supabaseErrorMsg = '';

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('system_settings').upsert(
          {
            key: 'GEMINI_API_KEY',
            value: cleanKey,
            description: 'Google Gemini API Key para análisis y transcripción automática de enlaces',
            updated_by: user?.id && user.id.length > 10 ? user.id : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

        if (!error) {
          savedInSupabase = true;
        } else {
          supabaseErrorMsg = error.message;
          console.warn('Error saving in Supabase system_settings table:', error);
        }
      }
    } catch (e: any) {
      supabaseErrorMsg = e.message;
    }
  }

  // Trigger global events and refresh status
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reewai-gemini-key-updated', { detail: { configured: true } }));
  }
  await fetchAiStatus(true);

  if (savedInSupabase) {
    return {
      success: true,
      source: 'supabase',
      message: 'Clave Gemini API guardada con éxito en la base de datos Supabase (protegida con RLS).',
    };
  }

  return {
    success: true,
    source: 'local',
    message: isSupabaseConfigured()
      ? `Clave guardada localmente en la app. (Aviso Supabase: ${supabaseErrorMsg || 'Asegúrate de ejecutar el script SQL para crear la tabla system_settings'}).`
      : 'Clave guardada localmente en la aplicación.',
  };
}

/**
 * Removes the Gemini API key from Supabase and local storage.
 */
export async function removeGeminiApiKey(
  user: UserProfile | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isUserAdmin(user)) {
    return {
      success: false,
      message: 'Acceso denegado: solo administradores pueden eliminar la clave.',
      error: 'Acceso denegado: solo administradores pueden eliminar la clave.',
    };
  }

  inMemoryCachedKey = null;

  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('system_settings').delete().eq('key', 'GEMINI_API_KEY');
      }
    } catch (e: any) {
      console.warn('Error deleting from Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reewai-gemini-key-updated', { detail: { configured: false } }));
  }
  await fetchAiStatus(true);

  return {
    success: true,
    message: 'Clave de API eliminada correctamente.',
  };
}

/**
 * Tests a Gemini API key by making a lightweight model list or verification request.
 */
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string; modelsCount?: number; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Ingresa una clave para probar.', error: 'Clave vacía' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    // Call Google Gemini API list models endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}&pageSize=5`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const count = data.models ? data.models.length : 0;
      return {
        success: true,
        message: '¡Conexión verificada con éxito! La clave es válida y Google Gemini responde correctamente.',
        modelsCount: count,
      };
    }

    const errData = await res.json().catch(() => null);
    const apiError = errData?.error?.message || `Código HTTP ${res.status}`;
    return {
      success: false,
      message: `Error al verificar con Google Gemini: ${apiError}`,
      error: apiError,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Tiempo de espera agotado al conectar con Google Gemini. Revisa tu conexión a internet.',
        error: 'Timeout',
      };
    }
    return {
      success: false,
      message: `No se pudo conectar con Google Gemini: ${err.message}`,
      error: err.message,
    };
  }
}

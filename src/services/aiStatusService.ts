import { useState, useEffect, useCallback } from 'react';
import { AiStatusResponse } from '../types';

let cachedStatus: AiStatusResponse | null = null;
let listeners: Array<(status: AiStatusResponse) => void> = [];

function notifyListeners(status: AiStatusResponse) {
  cachedStatus = status;
  listeners.forEach((listener) => listener(status));
}

export async function fetchAiStatus(forceRefresh = false): Promise<AiStatusResponse> {
  if (cachedStatus && !forceRefresh) {
    return cachedStatus;
  }

  // Check if there is an admin-stored key in local storage or env
  let activeStoredKey = '';
  if (typeof window !== 'undefined') {
    activeStoredKey = localStorage.getItem('reewai_admin_gemini_key') || '';
  }
  if (!activeStoredKey) {
    activeStoredKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (activeStoredKey) {
      headers['x-gemini-api-key'] = activeStoredKey;
    }

    const res = await fetch('/api/ai-status', {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data: AiStatusResponse = await res.json();
      if (!data.hasKey && activeStoredKey) {
        data.configured = true;
        data.hasKey = true;
        data.missingKey = false;
        data.source = 'database_or_app';
        data.message = 'GEMINI_API_KEY configurada desde Supabase/Aplicación y lista para usar.';
      }
      notifyListeners(data);
      return data;
    }

    // Server returned HTML (e.g. static SPA fallback without serverless function)
    const hasLocalKey = Boolean(activeStoredKey && activeStoredKey.length > 5);
    const fallbackStatus: AiStatusResponse = {
      success: true,
      configured: hasLocalKey,
      hasKey: hasLocalKey,
      missingKey: !hasLocalKey,
      source: hasLocalKey ? 'database_or_app' : 'none',
      provider: 'Google Gemini AI',
      environment: 'netlify-static',
      message: hasLocalKey
        ? 'GEMINI_API_KEY activa desde Supabase / Configuración local de Administrador.'
        : 'No se detectaron funciones serverless de Netlify o la variable GEMINI_API_KEY no está configurada.',
      setupGuide: {
        variableName: 'GEMINI_API_KEY',
        dashboardUrl: 'https://app.netlify.com',
        steps: [
          'Entra en tu panel de Netlify (https://app.netlify.com) o usa la sección inferior de Ajustes para guardar la clave directamente en Supabase.',
          'En Netlify: Ve a "Site configuration" -> "Environment variables" -> GEMINI_API_KEY.',
          'Haz un nuevo despliegue con "Clear cache and deploy site".',
        ],
      },
    };
    notifyListeners(fallbackStatus);
    return fallbackStatus;
  } catch {
    const hasLocalKey = Boolean(activeStoredKey && activeStoredKey.length > 5);
    const fallbackOffline: AiStatusResponse = {
      success: hasLocalKey,
      configured: hasLocalKey,
      hasKey: hasLocalKey,
      missingKey: !hasLocalKey,
      source: hasLocalKey ? 'database_or_app' : 'none',
      provider: 'Google Gemini AI',
      message: hasLocalKey
        ? 'GEMINI_API_KEY activa desde la base de datos / almacenamiento de Administrador.'
        : 'No se pudo verificar el estado de GEMINI_API_KEY con el servidor.',
    };
    notifyListeners(fallbackOffline);
    return fallbackOffline;
  }
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatusResponse | null>(cachedStatus);
  const [loading, setLoading] = useState<boolean>(!cachedStatus);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchAiStatus(true);
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const listener = (newStatus: AiStatusResponse) => {
      setStatus(newStatus);
      setLoading(false);
    };
    listeners.push(listener);

    if (!cachedStatus) {
      refreshStatus();
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, [refreshStatus]);

  return {
    status,
    loading,
    refreshStatus,
    isKeyConfigured: Boolean(status?.hasKey && status?.configured),
    isKeyMissing: status !== null && (!status.hasKey || status.missingKey),
  };
}

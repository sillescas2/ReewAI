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

  try {
    const res = await fetch('/api/ai-status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data: AiStatusResponse = await res.json();
      notifyListeners(data);
      return data;
    }

    // Server returned HTML (e.g. static SPA fallback without serverless function)
    const fallbackStatus: AiStatusResponse = {
      success: false,
      configured: false,
      hasKey: false,
      missingKey: true,
      provider: 'Google Gemini AI',
      environment: 'netlify-static',
      message: 'No se detectaron funciones serverless de Netlify o la variable GEMINI_API_KEY no está configurada.',
      setupGuide: {
        variableName: 'GEMINI_API_KEY',
        dashboardUrl: 'https://app.netlify.com',
        steps: [
          'Entra en tu panel de Netlify (https://app.netlify.com) y selecciona tu sitio.',
          'Ve a "Site configuration" -> "Environment variables".',
          'Añade la variable GEMINI_API_KEY con tu clave de API de Google Gemini.',
          'Haz un nuevo despliegue con "Clear cache and deploy site".',
        ],
      },
    };
    notifyListeners(fallbackStatus);
    return fallbackStatus;
  } catch {
    const fallbackOffline: AiStatusResponse = {
      success: false,
      configured: false,
      hasKey: false,
      missingKey: true,
      provider: 'Google Gemini AI',
      message: 'No se pudo verificar el estado de GEMINI_API_KEY con el servidor.',
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

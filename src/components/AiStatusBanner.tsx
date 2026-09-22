import React, { useState, useEffect } from 'react';
import { AlertTriangle, KeyRound, ExternalLink, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAiStatus } from '../services/aiStatusService';

interface AiStatusBannerProps {
  onOpenGuide: () => void;
}

export const AiStatusBanner: React.FC<AiStatusBannerProps> = ({ onOpenGuide }) => {
  const { status, loading, refreshStatus, isKeyMissing, isKeyConfigured } = useAiStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('reewai_gemini_banner_dismissed') === 'true';
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('reewai_gemini_banner_dismissed', 'true');
  };

  const handleCheckNow = async () => {
    await refreshStatus();
    setJustVerified(true);
    setTimeout(() => setJustVerified(false), 3000);
  };

  // If already configured or user dismissed for this session and not just verifying, hide banner
  if (isKeyConfigured || (isDismissed && !justVerified) || !isKeyMissing) {
    return null;
  }

  const isNetlifyEnv = status?.environment === 'netlify';

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 text-white shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold tracking-tight text-white leading-tight">
              {isNetlifyEnv
                ? '⚠️ GEMINI_API_KEY no detectada activa en tu sitio de Netlify'
                : '⚠️ GEMINI_API_KEY no configurada en esta vista previa (AI Studio)'}
            </p>
            <p className="text-white/90 text-[11px] truncate leading-tight hidden sm:block">
              {isNetlifyEnv
                ? 'Comprueba que la variable esté en "Same value in all deploy contexts" y haz "Clear cache and deploy site".'
                : 'Si ya la configuraste en Netlify, pruébala directamente abriendo la URL pública de tu web en Netlify.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-banner-check-ai"
            type="button"
            onClick={handleCheckNow}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-lg text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Comprobar si ya se detecta la clave"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Comprobando...' : 'Comprobar'}</span>
          </button>

          <button
            id="btn-banner-configure-gemini"
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-neutral-900 hover:bg-neutral-100 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-violet-600" />
            <span>Configurar en Netlify</span>
          </button>

          <button
            id="btn-banner-dismiss"
            type="button"
            onClick={handleDismiss}
            className="p-1 text-white/75 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            title="Ocultar aviso durante esta sesión"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

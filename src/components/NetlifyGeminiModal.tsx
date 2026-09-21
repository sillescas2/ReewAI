import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  Layers,
  Terminal,
} from 'lucide-react';
import { useAiStatus } from '../services/aiStatusService';

interface NetlifyGeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetlifyGeminiModal: React.FC<NetlifyGeminiModalProps> = ({ isOpen, onClose }) => {
  const { status, loading, refreshStatus, isKeyConfigured } = useAiStatus();
  const [copiedVarName, setCopiedVarName] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopyVarName = () => {
    navigator.clipboard.writeText('GEMINI_API_KEY');
    setCopiedVarName(true);
    setTimeout(() => setCopiedVarName(false), 2000);
  };

  const handleManualCheck = async () => {
    setCheckFeedback(null);
    await refreshStatus();
    // After refresh
    setTimeout(() => {
      if (status?.hasKey && status?.configured) {
        setCheckFeedback({
          type: 'success',
          message: '¡Excelente! GEMINI_API_KEY detectada correctamente y activa.',
        });
      } else {
        setCheckFeedback({
          type: 'error',
          message: 'Aún no se detecta la clave GEMINI_API_KEY en Netlify. Recuerda que tras añadir la variable, debes hacer un nuevo despliegue ("Clear cache and deploy site").',
        });
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs ${
              isKeyConfigured
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              {isKeyConfigured ? <CheckCircle2 className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight flex items-center gap-2">
                <span>Configurar GEMINI_API_KEY en Netlify</span>
              </h2>
              <p className="text-xs text-neutral-500">
                Guía oficial para activar el análisis automático con Inteligencia Artificial
              </p>
            </div>
          </div>
          <button
            id="btn-close-gemini-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-neutral-700 text-xs sm:text-sm leading-relaxed">
          {/* Status Alert Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isKeyConfigured
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            {isKeyConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold text-xs sm:text-sm">
                {isKeyConfigured
                  ? 'Inteligencia Artificial Gemini: CONECTADA Y ACTIVA'
                  : 'Estado actual: GEMINI_API_KEY no detectada en Netlify'}
              </p>
              <p className="text-xs opacity-90">
                {isKeyConfigured
                  ? 'Las transcripciones de reels, resúmenes automáticos y categorizaciones avanzadas están operativas al 100%.'
                  : 'Sin esta variable, los enlaces se guardarán usando el modo sin conexión (solo título básico de la URL), sin transcribir el texto ni extraer puntos clave con IA.'}
              </p>
            </div>
          </div>

          {/* Feedback from live test */}
          {checkFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                checkFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              {checkFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{checkFeedback.message}</span>
            </div>
          )}

          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <h3 className="font-bold text-neutral-900 text-xs sm:text-sm uppercase tracking-wider text-[11px] text-neutral-500">
              Pasos para configurarlo en Netlify (2 minutos):
            </h3>

            {/* Step 1 */}
            <div className="flex gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
              <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-neutral-900 text-xs sm:text-sm">
                  Obtén tu clave gratuita de Google Gemini AI
                </p>
                <p className="text-xs text-neutral-600">
                  Si aún no tienes una, créala gratis en segundos en Google AI Studio.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-700 hover:text-violet-900 font-semibold underline mt-1"
                >
                  <span>Ir a Google AI Studio (Crear API Key)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
              <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-neutral-900 text-xs sm:text-sm">
                  Abre tu panel de Netlify y añade la variable de entorno
                </p>
                <p className="text-xs text-neutral-600">
                  Entra en <strong>app.netlify.com</strong>, haz clic en tu sitio de <strong>ReewAI</strong> y en el menú de la izquierda ve a:
                  <br />
                  <span className="font-mono text-[11px] bg-neutral-200/70 px-1.5 py-0.5 rounded text-neutral-800">
                    Site configuration → Environment variables
                  </span>
                </p>
                <div className="mt-2 pt-2 border-t border-neutral-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-500 font-medium">Nombre exacto de la clave (Key):</span>
                  <div className="inline-flex items-center gap-1.5 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 shadow-2xs font-mono font-bold text-neutral-900 text-xs">
                    <code>GEMINI_API_KEY</code>
                    <button
                      id="btn-copy-var-name"
                      type="button"
                      onClick={handleCopyVarName}
                      className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar nombre de variable"
                    >
                      {copiedVarName ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {copiedVarName && <span className="text-[11px] text-emerald-600 font-medium">¡Copiado!</span>}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  En <strong>Value</strong> pega la clave de API que obtuviste en el paso 1 (empieza por <code>AIza...</code>).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-neutral-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <span>¡Paso crucial! Desplegar de nuevo para aplicar los cambios</span>
                </p>
                <p className="text-xs text-neutral-600">
                  En Netlify las funciones serverless solo cargan las nuevas variables cuando se hace un nuevo despliegue.
                  <br />
                  En tu panel de Netlify ve a la pestaña <strong>Deploys</strong> → haz clic en el botón desplegable <strong>Trigger deploy</strong> → selecciona <strong>Clear cache and deploy site</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-neutral-200 bg-neutral-50/80 flex flex-wrap items-center justify-between gap-3">
          <button
            id="btn-check-gemini-connection"
            type="button"
            onClick={handleManualCheck}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Comprobando...' : 'Comprobar conexión ahora'}</span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href="https://app.netlify.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl shadow-2xs transition-colors"
            >
              <span>Abrir Netlify</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </a>
            <button
              id="btn-gemini-modal-done"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

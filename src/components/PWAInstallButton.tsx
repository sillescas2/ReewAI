import React, { useState } from 'react';
import { Download, Smartphone, X, Share, PlusSquare, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running inside installed standalone PWA, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        id="btn-pwa-install"
        type="button"
        onClick={handleInstallClick}
        title="Instalar como aplicación en tu móvil o escritorio"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-all cursor-pointer"
      >
        {justInstalled ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700">¡Instalada!</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Instalar App</span>
          </>
        )}
      </button>

      {/* Mobile/Safari guide modal if beforeinstallprompt isn't fired or user is on iOS/unsupported browser */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {isIOS ? 'Instalar en iPhone / iPad' : 'Instalar ReewAI'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Instala la aplicación en tu pantalla de inicio para poder compartir reels directamente desde Instagram o Facebook con el botón de compartir:
            </p>

            <div className="space-y-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/80 text-xs text-neutral-800">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 bg-white rounded-md border border-neutral-200 shrink-0 mt-0.5">
                      <Share className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span>1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 bg-white rounded-md border border-neutral-200 shrink-0 mt-0.5">
                      <PlusSquare className="w-3.5 h-3.5 text-neutral-700" />
                    </div>
                    <span>2. Desplaza hacia abajo y pulsa <strong>«Añadir a la pantalla de inicio»</strong>.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="font-bold text-indigo-600">1.</span>
                    <span>Abre el menú de tu navegador (los tres puntos en Chrome o Edge).</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="font-bold text-indigo-600">2.</span>
                    <span>Selecciona <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

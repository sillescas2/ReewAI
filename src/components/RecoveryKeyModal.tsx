import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Download,
  CheckCircle2,
  X,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface RecoveryKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryKey?: string | null;
  email?: string;
  isInitialRegistration?: boolean;
}

export const RecoveryKeyModal: React.FC<RecoveryKeyModalProps> = ({
  isOpen,
  onClose,
  recoveryKey: propKey,
  email: propEmail,
  isInitialRegistration = false,
}) => {
  const { user, newlyRegisteredKey, clearNewlyRegisteredKey } = useAuth();
  const [copied, setCopied] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  if (!isOpen) return null;

  const activeKey = propKey || newlyRegisteredKey || user?.recoveryKey || 'RW88-9999';
  const activeEmail = propEmail || user?.email || 'tu@correo.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadTxt = () => {
    const textContent = `=====================================================
REEWAI - CLAVE SECRETA DE RESCATE PERSONAL
=====================================================

Correo de la cuenta: ${activeEmail}
Clave de Rescate (8 caracteres): ${activeKey}
Fecha: ${new Date().toLocaleString()}
Versión: ${APP_VERSION}

INSTRUCCIONES DE USO:
1. Guarda este archivo en un lugar seguro (por ejemplo en tus notas, 
   gestor de contraseñas o en una carpeta privada).
2. Si alguna vez olvidas tu contraseña o los enlaces del correo electrónico 
   caducan por el antivirus, pulsa en "¿Olvidaste tu contraseña? Usar Clave de Rescate".
3. Introduce tu correo y esta clave de 8 caracteres.
4. Podrás cambiar tu contraseña al instante sin depender de correos electrónicos.
=====================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clave-Rescate-ReewAI-${activeEmail.split('@')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
  };

  const handleFinish = () => {
    if (clearNewlyRegisteredKey) {
      clearNewlyRegisteredKey();
    }
    onClose();
  };

  return (
    <div
      id="recovery-key-modal-backdrop"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="recovery-key-modal-card"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header with Dark Indigo Banner */}
        <div className="bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 p-6 text-white relative">
          <button
            type="button"
            onClick={handleFinish}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isInitialRegistration ? '¡Cuenta creada con éxito!' : 'Seguridad de la Cuenta'}
            </span>
            <span className="text-[10px] font-mono text-neutral-300 px-2 py-0.5 rounded-full bg-white/10">
              {APP_VERSION}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <span>Tu Clave Secreta de Rescate</span>
          </h2>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            Esta es tu llave maestra de emergencia. Te permite recuperar tu cuenta en 5 segundos sin depender de correos electrónicos ni enlaces caducados.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Recovery Key Display Box */}
          <div className="bg-linear-to-b from-indigo-50/90 to-purple-50/70 border-2 border-indigo-200/90 rounded-2xl p-5 text-center shadow-inner">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-900/80 mb-1.5">
              Clave de Rescate Personal (8 caracteres)
            </p>
            <div className="py-2">
              <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-indigo-950 select-all">
                {activeKey}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Asociada a: <span className="font-medium text-neutral-700">{activeEmail}</span>
            </p>
          </div>

          {/* Quick Action Buttons: Copy & Download */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-copy-recovery-key"
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Clave Copiada!' : 'Copiar al Portapapeles'}</span>
            </button>

            <button
              id="btn-download-recovery-key"
              type="button"
              onClick={handleDownloadTxt}
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-xs border transition-all cursor-pointer ${
                hasDownloaded
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300 shadow-2xs'
              }`}
            >
              {hasDownloaded ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4 text-neutral-600" />}
              <span>{hasDownloaded ? '¡Archivo Descargado!' : 'Descargar en .txt'}</span>
            </button>
          </div>

          {/* Value proposition / Explanation list */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs space-y-2 text-neutral-700">
            <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>¿Cómo funciona el día que olvides tu contraseña?</span>
            </div>
            <ul className="space-y-1.5 text-neutral-600 text-[11px] list-disc list-inside">
              <li>
                En la pantalla de acceso, pulsa en <strong>"¿Olvidaste tu contraseña? Usar Clave de Rescate"</strong>.
              </li>
              <li>
                Introduce tu correo y esta clave de 8 caracteres.
              </li>
              <li>
                Escribe tu nueva clave y entrarás <strong>directamente</strong>, sin esperar emails ni preocuparte por enlaces caducados.
              </li>
            </ul>
          </div>

          {/* Action button */}
          <button
            id="btn-confirm-recovery-saved"
            type="button"
            onClick={handleFinish}
            className="w-full py-3 px-4 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>He guardado mi clave de rescate y continuar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

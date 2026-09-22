import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PasswordResetModal: React.FC = () => {
  const { recoveryFlow, closeRecoveryFlow, updatePasswordDirectly, requestPasswordReset } = useAuth();

  // Form states for setting new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // States for re-requesting link when expired
  const [resendEmail, setResendEmail] = useState(recoveryFlow.email || '');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  if (!recoveryFlow.isActive) {
    return null;
  }

  // Password validation & strength calculations
  const pwdLen = newPassword.length;
  const isMinLength = pwdLen >= 6;
  const isGoodLength = pwdLen >= 8;
  const hasSpecialOrNumber = /[0-9\W]/.test(newPassword);
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  const getStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'Introduce una clave', color: 'bg-neutral-200', textClass: 'text-neutral-400' };
    if (pwd.length < 6) return { score: 1, text: 'Demasiado corta (mínimo 6 caracteres)', color: 'bg-rose-500', textClass: 'text-rose-600' };
    let score = 2;
    if (pwd.length >= 8) score++;
    if (/[0-9\W]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score++;
    if (score === 2) return { score: 2, text: 'Débil (mínimo alcanzado)', color: 'bg-amber-500', textClass: 'text-amber-600' };
    if (score === 3) return { score: 3, text: 'Buena (8+ o combinada)', color: 'bg-blue-500', textClass: 'text-blue-600' };
    return { score: 4, text: 'Muy segura', color: 'bg-emerald-500', textClass: 'text-emerald-600' };
  };

  const strength = getStrength(newPassword);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setFormError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Las dos contraseñas introducidas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePasswordDirectly(newPassword);
      if (!res.success) {
        setFormError(res.error || 'No se pudo guardar la nueva contraseña.');
        return;
      }

      setSuccessMessage('¡Tu contraseña ha sido actualizada con éxito! Ya puedes utilizarla para iniciar sesión.');
      setTimeout(() => {
        closeRecoveryFlow();
      }, 2000);
    } catch (err: any) {
      setFormError(err.message || 'Error inesperado al guardar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setResendSuccess(null);

    const email = resendEmail.trim();
    if (!email || !email.includes('@')) {
      setFormError('Por favor, ingresa una dirección de correo válida.');
      return;
    }

    setIsResending(true);
    try {
      const res = await requestPasswordReset(email);
      if (!res.success) {
        setFormError(res.error || 'No se pudo enviar el correo de recuperación.');
        return;
      }

      setResendSuccess(
        `¡Enlace enviado a ${email}! Revisa tu correo electrónico y pulsa directamente en "Restablecer contraseña".`
      );
    } catch (err: any) {
      setFormError(err.message || 'Error al solicitar el enlace.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      id="password-reset-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="password-reset-modal-card"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${recoveryFlow.type === 'expired-link' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {recoveryFlow.type === 'expired-link' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                {recoveryFlow.type === 'expired-link'
                  ? 'Enlace de Recuperación Caducado'
                  : 'Restablecer Tu Contraseña'}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {recoveryFlow.type === 'expired-link'
                  ? 'Solicitud de recuperación de acceso'
                  : 'Verificación de seguridad completada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="password-reset-close-btn"
            onClick={closeRecoveryFlow}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* ================= CASE 1: EXPIRED OR INVALID LINK (IMAGE 2 SCENARIO) ================= */}
          {recoveryFlow.type === 'expired-link' ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>El enlace ha expirado o ya ha sido utilizado</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Por motivos de seguridad de Supabase, los enlaces de recuperación enviados por correo son de <strong>un solo uso</strong> y caducan automáticamente a los pocos minutos o si tu gestor de correo pre-visualizó el enlace.
                </p>
                <div className="pt-1 text-[11px] text-amber-800">
                  💡 <strong>¿Cómo solucionarlo?</strong> Solicita un enlace nuevo a continuación y púlsalo directamente en cuanto te llegue a tu correo. No necesitas buscar ningún código numérico.
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {resendSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>¡Nuevo enlace enviado con éxito!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {resendSuccess}
                  </p>
                  <p className="text-[10.5px] text-emerald-700/90">
                    Recuerda revisar también tu carpeta de spam o correo no deseado.
                  </p>
                  <button
                    type="button"
                    onClick={closeRecoveryFlow}
                    className="w-full mt-2 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Entendido, revisaré mi correo
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResendRecovery} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Correo Electrónico para Enviar Nuevo Enlace
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={closeRecoveryFlow}
                      className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isResending}
                      className="flex-2 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isResending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando enlace...</span>
                        </>
                      ) : (
                        <>
                          <span>Enviar nuevo enlace</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ================= CASE 2: USER CLICKED VALID LINK (SET NEW PASSWORD) ================= */
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-indigo-950">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>¡Identidad confirmada a través del enlace de correo!</span>
                </div>
                <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                  Has accedido mediante el enlace oficial de verificación. Por favor, escribe tu nueva contraseña para actualizar tu acceso:
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {successMessage ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 animate-fade-in text-center">
                  <div className="inline-flex p-2 bg-emerald-100 text-emerald-700 rounded-full mb-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">¡Contraseña Guardada!</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {successMessage}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSetNewPassword} className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-neutral-700">
                        Nueva Contraseña
                      </label>
                      {newPassword && (
                        <span className={`text-[10.5px] font-semibold ${strength.textClass}`}>
                          {strength.text}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={`w-full pl-9 pr-10 py-2 text-xs border rounded-xl focus:ring-2 outline-hidden ${
                          pwdLen > 0 && !isMinLength
                            ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                            : 'border-neutral-300 focus:ring-indigo-500 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title={showPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Visual Password Strength Meter */}
                    {newPassword && (
                      <div className="mt-1.5 space-y-1">
                        <div className="grid grid-cols-4 gap-1 h-1 w-full">
                          <div className={`rounded-full ${strength.score >= 1 ? strength.color : 'bg-neutral-200'}`} />
                          <div className={`rounded-full ${strength.score >= 2 ? strength.color : 'bg-neutral-200'}`} />
                          <div className={`rounded-full ${strength.score >= 3 ? strength.color : 'bg-neutral-200'}`} />
                          <div className={`rounded-full ${strength.score >= 4 ? strength.color : 'bg-neutral-200'}`} />
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                          <div className={`flex items-center gap-1 ${isMinLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                            {isMinLength ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                            <span>Mínimo 6 caracteres</span>
                          </div>
                          <div className={`flex items-center gap-1 ${isGoodLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                            {isGoodLength ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                            <span>Recomendado 8+</span>
                          </div>
                          <div className={`flex items-center gap-1 ${hasSpecialOrNumber ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                            {hasSpecialOrNumber ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                            <span>Números/símbolos</span>
                          </div>
                          <div className={`flex items-center gap-1 ${hasLetters ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                            {hasLetters ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                            <span>Letras</span>
                          </div>
                        </div>

                        {pwdLen > 0 && !isMinLength && (
                          <p className="text-[10px] text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            La contraseña debe tener al menos 6 caracteres (llevas {pwdLen}).
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Confirmar Nueva Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                        className={`w-full pl-9 pr-10 py-2 text-xs border rounded-xl focus:ring-2 outline-hidden ${
                          passwordsMismatch
                            ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                            : passwordsMatch
                            ? 'border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500'
                            : 'border-neutral-300 focus:ring-indigo-500 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <div className="mt-1 flex items-center gap-1 text-[10px]">
                        {passwordsMatch ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-medium">
                            <Check className="w-3 h-3" /> Las contraseñas coinciden
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" /> Las contraseñas no coinciden aún
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeRecoveryFlow}
                      className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !isMinLength || passwordsMismatch}
                      className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <span>Guardar nueva contraseña</span>
                          <Check className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
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
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

export const PasswordResetModal: React.FC = () => {
  const {
    recoveryFlow,
    closeRecoveryFlow,
    updatePasswordDirectly,
    requestPasswordReset,
    resetPasswordWithCode,
    isSupabase,
  } = useAuth();

  // Active recovery sub-mode when link is expired
  const [activeTab, setActiveTab] = useState<'link' | 'code'>('link');

  // Form states for setting new password directly (active recovery session)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // States for re-requesting link when expired
  const [resendEmail, setResendEmail] = useState(
    recoveryFlow.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('reewai_last_recovery_email') || '' : '')
  );
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // States for 6-digit code recovery tab
  const [codeEmail, setCodeEmail] = useState(
    recoveryFlow.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('reewai_last_recovery_email') || '' : '')
  );
  const [resetCode, setResetCode] = useState('');
  const [codeNewPassword, setCodeNewPassword] = useState('');
  const [codeConfirmPassword, setCodeConfirmPassword] = useState('');
  const [showCodePassword, setShowCodePassword] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  // Sync emails if recoveryFlow changes
  useEffect(() => {
    if (recoveryFlow.email) {
      setResendEmail(recoveryFlow.email);
      setCodeEmail(recoveryFlow.email);
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reewai_last_recovery_email');
      if (saved) {
        setResendEmail(saved);
        setCodeEmail(saved);
      }
    }
  }, [recoveryFlow.email]);

  // Handle 60s cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
    if (pwd.length < 6) return { score: 1, text: 'Demasiado corta (mínimo 6)', color: 'bg-rose-500', textClass: 'text-rose-600' };
    let score = 2;
    if (pwd.length >= 8) score++;
    if (/[0-9\W]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score++;
    if (score === 2) return { score: 2, text: 'Débil (mínimo 6)', color: 'bg-amber-500', textClass: 'text-amber-600' };
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

      setSuccessMessage('¡Tu contraseña ha sido actualizada con éxito! Ya puedes iniciar sesión con tu nueva clave.');
      setTimeout(() => {
        closeRecoveryFlow();
      }, 2500);
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

    if (cooldown > 0) {
      setFormError(`Por favor, espera ${cooldown} segundos antes de volver a solicitar un enlace.`);
      return;
    }

    const email = resendEmail.trim();
    if (!email || !email.includes('@')) {
      setFormError('Por favor, introduce una dirección de correo válida.');
      return;
    }

    setIsResending(true);
    try {
      const res = await requestPasswordReset(email);
      if (!res.success) {
        setFormError(res.error || 'No se pudo enviar el correo de recuperación.');
        if (res.error && res.error.toLowerCase().includes('60 segundos')) {
          setCooldown(60);
        }
        return;
      }

      setCooldown(60);
      setResendSuccess(
        `Hemos enviado el correo a "${email}". Revisa tu bandeja de entrada y pulsa en "Restablecer contraseña" en el ÚLTIMO correo recibido.`
      );
    } catch (err: any) {
      setFormError(err.message || 'Error al solicitar el enlace de recuperación.');
    } finally {
      setIsResending(false);
    }
  };

  const handleResetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const email = codeEmail.trim();
    const code = resetCode.trim();
    const pwd = codeNewPassword.trim();

    if (!email || !email.includes('@')) {
      setFormError('Introduce un correo electrónico válido.');
      return;
    }
    if (!code || code.length < 6) {
      setFormError('Introduce los 6 dígitos del código de verificación.');
      return;
    }
    if (!pwd || pwd.length < 6) {
      setFormError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (pwd !== codeConfirmPassword.trim()) {
      setFormError('Las dos contraseñas no coinciden.');
      return;
    }

    setIsSubmittingCode(true);
    try {
      const res = await resetPasswordWithCode(email, code, pwd);
      if (!res.success) {
        setFormError(res.error || 'Código incorrecto o expirado.');
        return;
      }

      setSuccessMessage(res.message || '¡Contraseña restablecida con éxito!');
      setTimeout(() => {
        closeRecoveryFlow();
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setIsSubmittingCode(false);
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                recoveryFlow.type === 'expired-link'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {recoveryFlow.type === 'expired-link' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                {recoveryFlow.type === 'expired-link'
                  ? 'Recuperación de Contraseña'
                  : 'Restablecer Tu Contraseña'}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {recoveryFlow.type === 'expired-link'
                  ? isSupabase
                    ? 'Autenticación con Supabase'
                    : 'Servicio de recuperación ReewAI'
                  : 'Verificación de identidad completada'}
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
          {/* ================= CASE 1: EXPIRED OR INVALID LINK ================= */}
          {recoveryFlow.type === 'expired-link' ? (
            <div className="space-y-4">
              {/* Informative explanation banner */}
              <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>El enlace anterior ha caducado o ya fue utilizado</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Por seguridad, los enlaces de Supabase son de <strong>un solo uso</strong>. Si has solicitado
                  recuperar la contraseña más de una vez, <strong>solo el enlace del último correo recibido es válido</strong> (los anteriores quedan cancelados).
                </p>
              </div>

              {/* Sub-mode selector tabs */}
              <div className="flex rounded-xl bg-neutral-100 p-1 text-xs">
                <button
                  type="button"
                  id="tab-request-link"
                  onClick={() => {
                    setActiveTab('link');
                    setFormError(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'link'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Solicitar nuevo enlace</span>
                </button>
                <button
                  type="button"
                  id="tab-enter-code"
                  onClick={() => {
                    setActiveTab('code');
                    setFormError(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'code'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Tengo código de 6 dígitos</span>
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: Request New Link */}
              {activeTab === 'link' && (
                <>
                  {resendSuccess ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2.5 animate-fade-in">
                      <div className="flex items-center gap-2 font-bold text-emerald-800">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>¡Correo enviado con éxito!</span>
                      </div>
                      <p className="text-[11.5px] text-emerald-800 leading-relaxed">
                        {resendSuccess}
                      </p>
                      <div className="p-2.5 bg-emerald-100/60 rounded-lg text-[11px] text-emerald-950 font-medium">
                        💡 <strong>Paso a seguir:</strong> Abre tu correo y haz clic directamente en el botón <strong>"Restablecer contraseña"</strong> del correo más nuevo. No necesitas introducir ningún código.
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={closeRecoveryFlow}
                          className="w-full py-2 text-xs font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors cursor-pointer shadow-xs"
                        >
                          Entendido, voy a abrir mi correo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleResendRecovery} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Tu Correo Electrónico
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type="email"
                            required
                            value={resendEmail}
                            onChange={(e) => {
                              setResendEmail(e.target.value);
                              setCodeEmail(e.target.value);
                            }}
                            placeholder="tu@correo.com"
                            className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={closeRecoveryFlow}
                          className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Volver al inicio
                        </button>
                        <button
                          type="submit"
                          disabled={isResending || cooldown > 0}
                          className="flex-2 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isResending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : cooldown > 0 ? (
                            <>
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>Reenviar en {cooldown}s</span>
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
                </>
              )}

              {/* TAB 2: Enter 6-digit verification code */}
              {activeTab === 'code' && (
                <>
                  {successMessage ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 text-center animate-fade-in">
                      <div className="inline-flex p-2 bg-emerald-100 text-emerald-700 rounded-full mb-1">
                        <Check className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-emerald-950">¡Contraseña Restablecida!</h4>
                      <p className="text-[11.5px] text-emerald-800 leading-relaxed">
                        {successMessage}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleResetWithCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Correo Electrónico
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type="email"
                            required
                            value={codeEmail}
                            onChange={(e) => setCodeEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Código de 6 dígitos
                        </label>
                        <div className="relative">
                          <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type="text"
                            required
                            maxLength={10}
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value.replace(/\s/g, ''))}
                            placeholder="Ej. 123456"
                            className="w-full pl-9 pr-3 py-1.5 text-xs font-mono tracking-widest border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-neutral-700">
                            Nueva Contraseña
                          </label>
                          <span className="text-[10px] text-neutral-500">Mínimo 6 caracteres</span>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type={showCodePassword ? 'text' : 'password'}
                            required
                            value={codeNewPassword}
                            onChange={(e) => setCodeNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full pl-9 pr-10 py-1.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCodePassword(!showCodePassword)}
                            className="absolute right-3 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                          >
                            {showCodePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Confirmar Nueva Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type={showCodePassword ? 'text' : 'password'}
                            required
                            value={codeConfirmPassword}
                            onChange={(e) => setCodeConfirmPassword(e.target.value)}
                            placeholder="Repite la nueva contraseña"
                            className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1.5">
                        <button
                          type="button"
                          onClick={closeRecoveryFlow}
                          className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingCode || codeNewPassword.length < 6 || resetCode.length < 4}
                          className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSubmittingCode ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Validando...</span>
                            </>
                          ) : (
                            <>
                              <span>Restablecer con código</span>
                              <Check className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ================= CASE 2: USER ARRIVED VIA VALID LINK ================= */
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-indigo-950">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>¡Identidad confirmada!</span>
                </div>
                <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                  Has accedido mediante el enlace de verificación. Escribe tu nueva contraseña para actualizar tu acceso:
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
                  <p className="text-[11.5px] text-emerald-800 leading-relaxed">
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

                    {/* Password Strength */}
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

        {/* Footer with App Version */}
        <div className="px-6 py-2.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
          <span>ReewAI Security Shield</span>
          <span className="font-mono">{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
};

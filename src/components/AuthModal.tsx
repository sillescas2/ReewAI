import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useAuth, DEMO_TEAM_MEMBERS } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupabaseGuide?: () => void;
}

type AuthTab = 'login' | 'register' | 'forgot-password' | 'reset-code';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    login,
    register,
    isSupabase,
    switchUser,
    user,
    getLoginLockout,
    requestPasswordReset,
    resetPasswordWithCode,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Password recovery states
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength and validation helpers
  const modalPwdLen = newPassword.length;
  const isModalMinLength = modalPwdLen >= 6;
  const isModalGoodLength = modalPwdLen >= 8;
  const hasModalSpecial = /[0-9\W]/.test(newPassword);
  const hasModalLetters = /[a-zA-Z]/.test(newPassword);
  const modalPasswordsMatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const modalPasswordsMismatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const getModalPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'Introduce una clave', color: 'bg-neutral-200', textClass: 'text-neutral-400' };
    if (pwd.length < 6) return { score: 1, text: 'Demasiado corta (mínimo 6 caracteres)', color: 'bg-rose-500', textClass: 'text-rose-600' };
    let score = 2;
    if (pwd.length >= 8) score++;
    if (/[0-9\W]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score++;
    if (score === 2) return { score: 2, text: 'Débil (mínimo alcanzado)', color: 'bg-amber-500', textClass: 'text-amber-600' };
    if (score === 3) return { score: 3, text: 'Buena (8+ o combinada)', color: 'bg-blue-500', textClass: 'text-blue-600' };
    return { score: 4, text: 'Muy segura', color: 'bg-emerald-500', textClass: 'text-emerald-600' };
  };

  const modalStrength = getModalPasswordStrength(newPassword);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lockout state (max 3 failed attempts, 10 min lockout)
  const [lockoutState, setLockoutState] = useState(() =>
    getLoginLockout ? getLoginLockout(email) : { isLocked: false, remainingSeconds: 0, attempts: 0, maxAttempts: 3 }
  );

  useEffect(() => {
    if (!isOpen) return;
    const updateLockout = () => {
      if (getLoginLockout) {
        setLockoutState(getLoginLockout(email));
      }
    };
    updateLockout();
    const timer = setInterval(updateLockout, 1000);
    return () => clearInterval(timer);
  }, [isOpen, email, getLoginLockout]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  // Handle Login & Register submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (tab === 'login' && lockoutState.isLocked) {
      setError(`Has alcanzado el límite de 3 intentos fallidos. Por motivos de seguridad, debes esperar ${formatCountdown(lockoutState.remainingSeconds)} para volver a intentarlo.`);
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Por favor, ingresa un correo electrónico válido.');
      return;
    }

    if (password && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'No se pudo iniciar sesión. Verifica tus credenciales.');
          if (getLoginLockout) {
            setLockoutState(getLoginLockout(email));
          }
        } else {
          setSuccessMessage('¡Sesión iniciada con éxito!');
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else if (tab === 'register') {
        const res = await register(email, password, fullName);
        if (!res.success) {
          setError(res.error || 'No se pudo crear la cuenta.');
        } else {
          setSuccessMessage('¡Cuenta creada y conectada con éxito!');
          setTimeout(() => {
            onClose();
          }, 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 1: Request Password Recovery for Registered User
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const targetEmail = (recoveryEmail || email).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Por favor, ingresa una dirección de correo electrónico válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(targetEmail);
      if (!res.success) {
        setError(res.error || 'No se pudo procesar la solicitud de recuperación.');
        return;
      }

      setRecoveryCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTab('reset-code');
      setSuccessMessage(
        res.message ||
          `Hemos enviado un código de verificación a "${targetEmail}". Abre tu correo, copia el código de 6 dígitos y pégalo aquí.`
      );
    } catch (err: any) {
      setError(err.message || 'Error al solicitar el código de recuperación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Reset Password using 6-Digit Code
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const targetEmail = (recoveryEmail || email).trim();
    const code = recoveryCode.trim();

    if (!code || code.length < 6) {
      setError('Por favor, ingresa el código de verificación completo de 6 dígitos recibido en tu correo.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Las dos contraseñas introducidas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordWithCode(targetEmail, code, newPassword);
      if (!res.success) {
        setError(res.error || 'No se pudo restablecer la contraseña. Verifica el código recibido.');
        return;
      }

      // Success! Update local fields
      setEmail(targetEmail);
      setPassword(newPassword);
      setSuccessMessage('¡Tu contraseña ha sido restablecida con éxito! Ya puedes iniciar sesión con tu nueva contraseña.');
      
      // Keep state clean
      setTimeout(() => {
        setTab('login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (member: typeof DEMO_TEAM_MEMBERS[0]) => {
    switchUser(member);
    setSuccessMessage(`Conectado como ${member.fullName}`);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header with gradient badge */}
        <div className="bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isSupabase ? 'Supabase Auth' : 'Gestión Multi-usuario'}
            </span>
            <span className="text-[10px] font-mono text-neutral-300 font-medium px-2 py-0.5 rounded-full bg-white/10 border border-white/10">
              {APP_VERSION}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">
            {tab === 'login' && 'Iniciar Sesión en ReewAI'}
            {tab === 'register' && 'Crear Cuenta en ReewAI'}
            {tab === 'forgot-password' && 'Recuperar Contraseña'}
            {tab === 'reset-code' && 'Restablecer Contraseña'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            {tab === 'login' && 'Tus reels y notas se guardan de forma privada para cada usuario.'}
            {tab === 'register' && 'Únete con tu correo para organizar y analizar tus enlaces con IA.'}
            {tab === 'forgot-password' && 'Comprobaremos que tu usuario esté dado de alta para restablecer tu clave.'}
            {tab === 'reset-code' && 'Introduce el código de verificación y define tu nueva clave de acceso.'}
          </p>
        </div>

        {/* Tab Selector / Breadcrumb */}
        {tab === 'login' || tab === 'register' ? (
          <div className="flex border-b border-neutral-200 bg-neutral-50 px-6 pt-3">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`pb-3 text-xs font-semibold px-3 transition-colors relative cursor-pointer ${
                tab === 'login'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`pb-3 text-xs font-semibold px-3 transition-colors relative cursor-pointer ${
                tab === 'register'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Crear Nueva Cuenta
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-2.5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Iniciar Sesión</span>
            </button>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-600" />
              Recuperación de acceso
            </span>
          </div>
        )}

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Status feedback */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1.5 animate-shake">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
              {tab === 'login' && error.toLowerCase().includes('contraseña') && (
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(email);
                    setTab('forgot-password');
                    setError(null);
                  }}
                  className="pl-6 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer block"
                >
                  ¿Has olvidado tu contraseña? Haz clic aquí para recuperarla →
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Lockout notification if user reached 3 errors */}
          {tab === 'login' && lockoutState.isLocked && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-900 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-900 text-sm">
                    🔒 Acceso bloqueado temporalmente (3 errores)
                  </p>
                  <p className="text-rose-800 leading-snug">
                    Has alcanzado el límite de 3 intentos fallidos de acceso. Por seguridad, debes esperar <strong>10 minutos</strong> para volver a intentarlo.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold text-sm shadow-xs mt-1">
                    <Clock className="w-4 h-4 text-rose-600 animate-spin" />
                    <span>Tiempo de espera restante: {formatCountdown(lockoutState.remainingSeconds)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 1 & 2: LOGIN OR REGISTER ================= */}
          {(tab === 'login' || tab === 'register') && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {tab === 'login' && !lockoutState.isLocked && (
                <div className="flex items-center justify-between text-[11px] text-neutral-500 bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200/80">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Protección de acceso
                  </span>
                  <span>Máx. 3 errores (bloqueo 10 min)</span>
                </div>
              )}

              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. Laura Gómez"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    disabled={tab === 'login' && lockoutState.isLocked}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden disabled:bg-neutral-100 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-700">
                    Contraseña
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryEmail(email);
                        setTab('forgot-password');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      ¿Has olvidado tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={tab === 'login' && lockoutState.isLocked}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-10 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden disabled:bg-neutral-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={tab === 'login' && lockoutState.isLocked}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer disabled:opacity-40"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (tab === 'login' && lockoutState.isLocked)}
                className={`w-full py-2.5 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2 ${
                  tab === 'login' && lockoutState.isLocked
                    ? 'bg-rose-600 hover:bg-rose-700 opacity-80 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : tab === 'login' && lockoutState.isLocked ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Bloqueado ({formatCountdown(lockoutState.remainingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <span>{tab === 'login' ? 'Entrar a mi cuenta' : 'Crear y acceder'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================= VIEW 3: FORGOT PASSWORD (REQUEST RECOVERY) ================= */}
          {tab === 'forgot-password' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                  Recuperación por correo para usuarios registrados
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Introduce el correo electrónico con el que estás dado de alta en la plataforma. Si tu cuenta está registrada, enviaremos un código de verificación de 6 dígitos a tu bandeja de entrada para que puedas restablecer tu contraseña con total seguridad.
                </p>
              </div>

              <form onSubmit={handleRequestRecovery} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Correo Electrónico Registrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={recoveryEmail || email}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="usuario@empresa.com"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verificando usuario...</span>
                      </>
                    ) : (
                      <>
                        <span>Verificar y recuperar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= VIEW 4: RESET PASSWORD WITH CODE ================= */}
          {tab === 'reset-code' && (
            <div className="space-y-4">
              {/* Security info card: instructions to check email */}
              <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 font-semibold text-xs text-indigo-950">
                  <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Correo de recuperación enviado a {recoveryEmail || email}</span>
                </div>
                <div className="text-[11px] text-indigo-900/90 space-y-1.5 leading-relaxed">
                  <p>
                    🔗 <strong>Si recibes un enlace/botón ("Restablecer contraseña"):</strong> Haz clic directamente en él desde tu correo. La aplicación se abrirá automáticamente para que elijas tu nueva contraseña sin necesidad de código numérico.
                  </p>
                  <p>
                    🔢 <strong>Si tu correo incluye un código de 6 dígitos:</strong> Puedes introducirlo abajo junto a tu nueva clave.
                  </p>
                </div>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-neutral-700">
                      Código de Verificación (6 dígitos)
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {recoveryCode.length}/6 dígitos
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 123456"
                    className="w-full px-3 py-2 font-mono text-center tracking-widest text-base font-bold border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                  />
                  {recoveryCode.length > 0 && recoveryCode.length < 6 && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Introduce los 6 dígitos recibidos en tu correo.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-neutral-700">
                      Nueva Contraseña
                    </label>
                    {newPassword && (
                      <span className={`text-[10.5px] font-semibold ${modalStrength.textClass}`}>
                        {modalStrength.text}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`w-full pl-9 pr-10 py-2 text-xs border rounded-xl focus:ring-2 outline-hidden ${
                        modalPwdLen > 0 && !isModalMinLength
                          ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                          : 'border-neutral-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      title={showNewPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Visual Meter */}
                  {newPassword && (
                    <div className="mt-1.5 space-y-1">
                      <div className="grid grid-cols-4 gap-1 h-1 w-full">
                        <div className={`rounded-full ${modalStrength.score >= 1 ? modalStrength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full ${modalStrength.score >= 2 ? modalStrength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full ${modalStrength.score >= 3 ? modalStrength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full ${modalStrength.score >= 4 ? modalStrength.color : 'bg-neutral-200'}`} />
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                        <div className={`flex items-center gap-1 ${isModalMinLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {isModalMinLength ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Mínimo 6 caract.</span>
                        </div>
                        <div className={`flex items-center gap-1 ${isModalGoodLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {isModalGoodLength ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Recomendado 8+</span>
                        </div>
                        <div className={`flex items-center gap-1 ${hasModalSpecial ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {hasModalSpecial ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Núm./símbolos</span>
                        </div>
                        <div className={`flex items-center gap-1 ${hasModalLetters ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {hasModalLetters ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="w-1 h-1 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Contiene letras</span>
                        </div>
                      </div>

                      {modalPwdLen > 0 && !isModalMinLength && (
                        <p className="text-[10px] text-rose-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          La contraseña debe tener al menos 6 caracteres (llevas {modalPwdLen}).
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
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className={`w-full pl-9 pr-10 py-2 text-xs border rounded-xl focus:ring-2 outline-hidden ${
                        modalPasswordsMismatch
                          ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                          : modalPasswordsMatch
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
                  {confirmNewPassword && (
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      {modalPasswordsMatch ? (
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

                {/* Inline Error Notice */}
                {error && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-1.5 text-xs text-rose-800">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot-password');
                      setError(null);
                    }}
                    className="flex-1 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (newPassword.length > 0 && !isModalMinLength) || modalPasswordsMismatch}
                    className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando clave...</span>
                      </>
                    ) : (
                      <>
                        <span>Guardar contraseña</span>
                        <Check className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Quick Demo Switcher - Only visible on Login & Register tabs */}
          {(tab === 'login' || tab === 'register') && (!user || user.role === 'admin') && (
            <div className="pt-2 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                  <Users className="w-3 h-3 text-neutral-400" />
                  Acceso Rápido de Equipo:
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {DEMO_TEAM_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleQuickLogin(member)}
                    className={`flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      user?.id === member.id
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-neutral-50 border-neutral-200/80 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={member.avatarUrl}
                        alt={member.fullName}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-neutral-300 shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-neutral-900 truncate">
                          {member.fullName}
                        </p>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {member.jobTitle} • {member.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-white rounded-md border border-neutral-200 text-neutral-600 shrink-0">
                      {user?.id === member.id ? 'Activo' : 'Seleccionar'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

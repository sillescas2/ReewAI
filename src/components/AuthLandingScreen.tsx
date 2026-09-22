import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Copy,
  Check,
  Film,
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useAuth, DEMO_TEAM_MEMBERS, DemoTeamMember } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface AuthLandingScreenProps {
  onOpenSupabaseModal?: () => void;
}

export const AuthLandingScreen: React.FC<AuthLandingScreenProps> = () => {
  const { login, register, switchUser, requestPasswordReset, resetPasswordWithCode } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset-code'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password Recovery States
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password security helpers
  const passwordLen = newPassword.length;
  const isMinLength = passwordLen >= 6;
  const isGoodLength = passwordLen >= 8;
  const hasNumbersOrSymbols = /[0-9\W]/.test(newPassword);
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const passwordsMismatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'Introduce una clave', color: 'bg-neutral-200', textClass: 'text-neutral-400' };
    if (pwd.length < 6) return { score: 1, text: 'Demasiado corta (mínimo 6 caracteres)', color: 'bg-rose-500', textClass: 'text-rose-600' };
    let score = 2;
    if (pwd.length >= 8) score++;
    if (/[0-9\W]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score++;
    if (score === 2) return { score: 2, text: 'Débil (cumple el mínimo de 6)', color: 'bg-amber-500', textClass: 'text-amber-600' };
    if (score === 3) return { score: 3, text: 'Buena (8+ caracteres o combinada)', color: 'bg-blue-500', textClass: 'text-blue-600' };
    return { score: 4, text: 'Muy segura (larga y combinada)', color: 'bg-emerald-500', textClass: 'text-emerald-600' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Por favor ingresa tu correo electrónico.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (mode === 'register') {
      if (!fullName.trim()) {
        setErrorMessage('Por favor ingresa tu nombre completo.');
        return;
      }
      if (!password || password.length < 4) {
        setErrorMessage('La contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Las contraseñas no coinciden.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await register(cleanEmail, password, fullName.trim());
        if (!res.success) {
          setErrorMessage(res.error || 'No se pudo crear la cuenta.');
        } else {
          setSuccessMessage('¡Cuenta creada con éxito! Accediendo a tu biblioteca...');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Error durante el registro.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Login mode
      setIsSubmitting(true);
      try {
        const res = await login(cleanEmail, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Credenciales no válidas.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al iniciar sesión.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Por favor ingresa una dirección de correo electrónico válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(cleanEmail);
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo procesar la solicitud de recuperación.');
        return;
      }

      setRecoveryCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('reset-code');

      if (res.isSupabase) {
        setSuccessMessage(
          `Hemos enviado el correo oficial de Supabase a "${cleanEmail}". Abre tu correo y pulsa en "Restablecer contraseña". No necesitas buscar ningún código numérico.`
        );
      } else {
        setSuccessMessage(
          res.message ||
            `Hemos enviado un código de verificación de 6 dígitos a "${cleanEmail}". Por favor, abre tu correo, copia el código y pégalo a continuación.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al solicitar la recuperación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    const cleanCode = recoveryCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Por favor, introduce el código de verificación completo de 6 dígitos que has recibido en tu correo.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('La contraseña no es válida: debe tener al menos 6 caracteres para ser admitida.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Las contraseñas no coinciden. Asegúrate de escribirlas exactamente iguales.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordWithCode(cleanEmail, cleanCode, newPassword);
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo restablecer la contraseña. Verifica el código de tu correo.');
        return;
      }

      setPassword(newPassword);
      setSuccessMessage('¡Tu contraseña ha sido restablecida con éxito! Ya puedes entrar con tu nueva clave.');
      setMode('login');
      setRecoveryCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoQuickLogin = (demoUser: DemoTeamMember) => {
    switchUser(demoUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-neutral-100 flex flex-col justify-between text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Brand Bar */}
      <header className="w-full border-b border-neutral-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-neutral-950 via-neutral-900 to-indigo-950 bg-clip-text text-transparent">
              ReewAI
            </span>
            <span className="hidden sm:inline-block ml-1 text-[11px] font-medium text-neutral-600">
              Reel & Web Saver AI
            </span>
            <span className="text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/80">
              {APP_VERSION}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Hero Welcome Text */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Espacio de Trabajo Seguro y Personal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950">
              Bienvenido a ReewAI
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-sm mx-auto">
              Guarda tus reels de Instagram, Facebook y páginas web con resúmenes por IA y detección automática de duplicados.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xl shadow-neutral-900/5 overflow-hidden">
            {/* Header: Tabs or Back to Login */}
            {mode === 'forgot' || mode === 'reset-code' ? (
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-neutral-100 bg-neutral-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-neutral-500" />
                  <span>Volver a Iniciar Sesión</span>
                </button>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200/60">
                  <KeyRound className="w-3 h-3 text-indigo-600" />
                  Recuperar Contraseña
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 p-1.5 bg-neutral-100/90 border-b border-neutral-200/80 m-3 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                >
                  Darse de Alta
                </button>
              </div>
            )}

            {/* Error / Success feedback */}
            {errorMessage && (
              <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* MODE: FORGOT (Solicitar código o enlace al correo) */}
            {mode === 'forgot' && (
              <form onSubmit={handleRequestRecovery} className="p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-neutral-900">Restablecer tu Contraseña</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Ingresa el correo de tu cuenta. Si estás registrado, recibirás un correo seguro de recuperación para restablecer tu clave mediante enlace directo o código de verificación.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-neutral-900/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Verificando y enviando...</span>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Enviar Correo de Recuperación</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset-code');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                  >
                    ¿Ya tienes un código o quieres introducirlo? Haz clic aquí →
                  </button>
                </div>
              </form>
            )}

            {/* MODE: RESET-CODE (Introducir código y nueva clave) */}
            {mode === 'reset-code' && (
              <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                {/* Security info card: instructions to check email */}
                <div className="p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200/90 text-indigo-950 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900">
                    <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Correo de recuperación enviado a {email || 'tu dirección'}</span>
                  </div>
                  <div className="text-[11px] text-indigo-900/90 space-y-1.5 leading-relaxed">
                    <p>
                      🔗 <strong>Si recibes un enlace/botón ("Restablecer contraseña"):</strong> Haz clic directamente en él desde tu correo. La aplicación se abrirá automáticamente con el formulario para guardar tu nueva clave sin necesidad de código numérico.
                    </p>
                    <p>
                      🔢 <strong>Si tu correo contiene un código de 6 dígitos:</strong> Puedes escribirlo en la casilla de abajo junto a tu nueva contraseña.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Correo electrónico de tu cuenta
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      Código de verificación (6 dígitos del correo)
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
                    className="w-full text-center tracking-widest font-mono text-lg py-2.5 bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-bold placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400"
                  />
                  {recoveryCode.length > 0 && recoveryCode.length < 6 && (
                    <p className="text-[10.5px] text-amber-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Introduce los 6 dígitos completos recibidos en tu correo.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      Nueva contraseña
                    </label>
                    {newPassword && (
                      <span className={`text-[11px] font-semibold ${strength.textClass}`}>
                        {strength.text}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        passwordLen > 0 && !isMinLength
                          ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-neutral-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Visual Meter */}
                  {newPassword && (
                    <div className="mt-2 space-y-1.5">
                      <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                        <div className={`rounded-full transition-all ${strength.score >= 1 ? strength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full transition-all ${strength.score >= 2 ? strength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full transition-all ${strength.score >= 3 ? strength.color : 'bg-neutral-200'}`} />
                        <div className={`rounded-full transition-all ${strength.score >= 4 ? strength.color : 'bg-neutral-200'}`} />
                      </div>

                      {/* Requirement checklist */}
                      <div className="grid grid-cols-2 gap-1 pt-1 text-[10.5px]">
                        <div className={`flex items-center gap-1 ${isMinLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {isMinLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Mínimo 6 caracteres</span>
                        </div>
                        <div className={`flex items-center gap-1 ${isGoodLength ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {isGoodLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Recomendado 8+</span>
                        </div>
                        <div className={`flex items-center gap-1 ${hasNumbersOrSymbols ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {hasNumbersOrSymbols ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Números o símbolos</span>
                        </div>
                        <div className={`flex items-center gap-1 ${hasLetters ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
                          {hasLetters ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1 mr-0.5" />}
                          <span>Contiene letras</span>
                        </div>
                      </div>

                      {/* Explicit Warning for short password */}
                      {passwordLen > 0 && !isMinLength && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5 mt-1 animate-fade-in">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>Clave demasiado corta:</strong> El sistema exige un mínimo de 6 caracteres (actualmente tiene {passwordLen}). Añade más caracteres para poder guardarla.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className={`w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        passwordsMismatch
                          ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                          : passwordsMatch
                          ? 'border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-600'
                          : 'border-neutral-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                      }`}
                    />
                  </div>

                  {confirmNewPassword && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                      {passwordsMatch ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Las contraseñas coinciden
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Las contraseñas no coinciden aún
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline Error Notice directly above the submit button */}
                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || (newPassword.length > 0 && !isMinLength)}
                  className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-neutral-900/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Guardando y verificando...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Guardar Nueva Contraseña</span>
                    </>
                  )}
                </button>

                {newPassword.length > 0 && !isMinLength && (
                  <p className="text-[10.5px] text-center text-rose-600 font-medium -mt-2">
                    ⚠️ El botón se habilitará al completar el mínimo de 6 caracteres.
                  </p>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
                  >
                    ¿No te llegó el correo con el código? Solicitar reenvío
                  </button>
                </div>
              </form>
            )}

            {/* MODE: LOGIN & REGISTER */}
            {(mode === 'login' || mode === 'register') && (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej: Laura Gómez"
                        className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-neutral-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      Contraseña
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3 text-indigo-600" />
                        <span>¿Has olvidado tu contraseña?</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-neutral-400"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-neutral-900/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Procesando...</span>
                  ) : mode === 'login' ? (
                    <>
                      <span>Entrar a mi biblioteca</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Completar Registro y Entrar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {mode === 'login' && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-neutral-500 hover:text-indigo-600 font-medium hover:underline inline-flex items-center gap-1.5 cursor-pointer transition-colors py-1"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                      <span>¿No recuerdas tu contraseña? Restablécela aquí</span>
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Quick Demo Access Divider */}
            <div className="p-6 pt-0 space-y-3">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-neutral-200 w-full"></div>
                <span className="bg-white px-3 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider shrink-0">
                  O prueba con 1 clic
                </span>
                <div className="border-t border-neutral-200 w-full"></div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-neutral-600 text-center">
                  Cuentas de demostración con datos de ejemplo ya cargados:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {DEMO_TEAM_MEMBERS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleDemoQuickLogin(m)}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200/90 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={m.avatarUrl}
                          alt={m.fullName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-lg object-cover border border-neutral-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-neutral-900 group-hover:text-indigo-900 truncate">
                              {m.fullName}
                            </span>
                            <span className="text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded bg-neutral-100 group-hover:bg-indigo-100 text-neutral-600 group-hover:text-indigo-700">
                              {m.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-600 truncate">{m.jobTitle}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature Highlights Footer */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-neutral-600">
            <div className="p-2 bg-white/60 rounded-xl border border-neutral-200/60 flex flex-col items-center gap-1">
              <Film className="w-4 h-4 text-pink-500" />
              <span className="font-medium">Reels Instagram & FB</span>
            </div>
            <div className="p-2 bg-white/60 rounded-xl border border-neutral-200/60 flex flex-col items-center gap-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="font-medium">Resumen IA Gemini</span>
            </div>
            <div className="p-2 bg-white/60 rounded-xl border border-neutral-200/60 flex flex-col items-center gap-1">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">Artículos y Webs</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-neutral-600 border-t border-neutral-200/60 bg-white/40 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
        <span>ReewAI • Sistema de biblioteca personal con IA y detección de duplicados</span>
        <span className="text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200/60">
          {APP_VERSION}
        </span>
      </footer>
    </div>
  );
};

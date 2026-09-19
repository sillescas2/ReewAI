import React, { useState } from 'react';
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
  Users
} from 'lucide-react';
import { useAuth, DEMO_TEAM_MEMBERS } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupabaseGuide?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { login, register, isSupabase, switchUser, user } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

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
        } else {
          setSuccessMessage('¡Sesión iniciada con éxito!');
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
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
            className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
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
            {tab === 'login' ? 'Iniciar Sesión en ReewAI' : 'Crear Cuenta en ReewAI'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            Tus reels y enlaces se guardan y aíslan de forma privada para cada usuario.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-6 pt-3">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
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

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Status feedback */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{tab === 'login' ? 'Entrar a mi cuenta' : 'Crear y acceder'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Switcher - Only visible if no user is active yet OR if active user is admin */}
          {(!user || user.role === 'admin') && (
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

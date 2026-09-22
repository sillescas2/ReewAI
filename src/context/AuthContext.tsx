import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { DatabaseService } from '../services/dbService';
import {
  getLockoutState,
  recordFailedAttempt,
  recordSuccessfulLogin,
  formatRemainingLockout,
} from '../services/loginRateLimitService';

export interface DemoTeamMember {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: 'admin' | 'user' | 'editor';
  jobTitle: string;
  password?: string;
}

export const DEMO_TEAM_MEMBERS: DemoTeamMember[] = [
  {
    id: 'usr_santi_illescas',
    email: 'sillescas2@gmail.com',
    fullName: 'Santi',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
    role: 'admin',
    jobTitle: 'Administrador Principal',
    password: 'admin',
  },
  {
    id: 'usr_prueba',
    email: 'prueba@reewai.app',
    fullName: 'Usuario de prueba',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    role: 'editor',
    jobTitle: 'Cuenta de Prueba',
    password: 'prueba',
  },
];

const LOCAL_ACTIVE_USER_KEY = 'reewai_active_user_id';
const LOCAL_USERS_KEY = 'reewai_registered_users';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isSupabase: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password?: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (targetUser: UserProfile | DemoTeamMember) => void;
  availableUsers: UserProfile[];
  updateProfile: (updates: { fullName?: string; email?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, newRole: 'admin' | 'user' | 'editor') => Promise<{ success: boolean; error?: string }>;
  updateAnyUser: (userId: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (userData: { email: string; fullName: string; role: 'admin' | 'user' | 'editor'; avatarUrl?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  refreshUsers: () => Promise<void>;
  checkUserExists: (email: string) => boolean;
  getLoginLockout: (email?: string) => {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
    maxAttempts: number;
  };
  requestPasswordReset: (email: string) => Promise<{
    success: boolean;
    isSupabase?: boolean;
    code?: string;
    expiresAt?: number;
    error?: string;
    message?: string;
  }>;
  resetPasswordWithCode: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }>;
  recoveryFlow: PasswordRecoveryFlowState;
  closeRecoveryFlow: () => void;
  updatePasswordDirectly: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

export interface PasswordRecoveryFlowState {
  isActive: boolean;
  type: 'set-new-password' | 'expired-link' | 'none';
  errorMessage?: string;
  email?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSupabase = isSupabaseConfigured();
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  // Recovery flow state (handles both valid email link tokens and expired/error hash from Supabase)
  const [recoveryFlow, setRecoveryFlow] = useState<PasswordRecoveryFlowState>({
    isActive: false,
    type: 'none',
  });

  const closeRecoveryFlow = () => {
    setRecoveryFlow({ isActive: false, type: 'none' });
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      } catch (e) {}
    }
  };

  // Inspect URL on startup & on hash changes for Supabase recovery callbacks or errors
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkUrlForRecovery = () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(window.location.search);

      const error = hashParams.get('error') || searchParams.get('error');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
      const type = hashParams.get('type') || searchParams.get('type');
      const accessToken = hashParams.get('access_token');

      // Check for errors like otp_expired or access_denied (from Image 2)
      if (
        errorCode === 'otp_expired' ||
        error === 'access_denied' ||
        (errorDescription && errorDescription.toLowerCase().includes('expired'))
      ) {
        const lastEmail = (typeof window !== 'undefined' && localStorage.getItem('reewai_last_recovery_email')) || '';
        setRecoveryFlow({
          isActive: true,
          type: 'expired-link',
          errorMessage: 'El enlace de recuperación ha caducado o ya ha sido utilizado.',
          email: lastEmail,
        });
        try {
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState(null, '', cleanUrl);
        } catch (e) {}
        return;
      }

      // Check for valid recovery token in URL
      const code = searchParams.get('code') || hashParams.get('code');
      const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');

      if (type === 'recovery' || (accessToken && type === 'recovery') || (code && type === 'recovery') || tokenHash) {
        const lastEmail = (typeof window !== 'undefined' && localStorage.getItem('reewai_last_recovery_email')) || '';
        setRecoveryFlow((prev) => ({
          ...prev,
          isActive: true,
          type: 'set-new-password',
          email: prev.email || lastEmail,
        }));
      }
    };

    checkUrlForRecovery();
    window.addEventListener('hashchange', checkUrlForRecovery);
    return () => window.removeEventListener('hashchange', checkUrlForRecovery);
  }, []);

  // Initialize Auth state
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);

      if (isSupabase) {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              const u = data.session.user;
              setUser({
                id: u.id,
                email: u.email || '',
                fullName: u.user_metadata?.full_name || (u.email ? u.email.split('@')[0] : 'Usuario'),
                avatarUrl: u.user_metadata?.avatar_url || '',
                role: 'user',
                createdAt: u.created_at,
              });
            }

            // Listen to auth changes
            supabase.auth.onAuthStateChange((event, session) => {
              if (event === 'PASSWORD_RECOVERY') {
                setRecoveryFlow({
                  isActive: true,
                  type: 'set-new-password',
                  email: session?.user?.email || '',
                });
              }

              if (session?.user) {
                const u = session.user;
                setUser({
                  id: u.id,
                  email: u.email || '',
                  fullName: u.user_metadata?.full_name || (u.email ? u.email.split('@')[0] : 'Usuario'),
                  avatarUrl: u.user_metadata?.avatar_url || '',
                  role: 'user',
                  createdAt: u.created_at,
                });
              } else {
                setUser(null);
              }
            });
          } catch (err) {
            console.error('Error fetching Supabase session:', err);
          }
        }
      } else {
        // Multi-User local storage mode
        const savedUsersRaw = localStorage.getItem(LOCAL_USERS_KEY);
        let currentUsers: UserProfile[] = [];
        if (savedUsersRaw) {
          try {
            currentUsers = JSON.parse(savedUsersRaw);
          } catch {
            currentUsers = [];
          }
        }

        // Active cleanup: Purge Carlos and Sofia, and migrate Elena to "Usuario de prueba"
        currentUsers = currentUsers
          .filter((cu) => {
            const id = (cu.id || '').toLowerCase();
            const email = (cu.email || '').toLowerCase();
            if (id.includes('carlos') || email.includes('carlos.mendez')) return false;
            if (id.includes('sofia') || email.includes('sofia.roca')) return false;
            return true;
          })
          .map((cu) => {
            if (
              cu.id === 'usr_elena_vega' ||
              (cu.fullName && cu.fullName.toLowerCase().includes('elena vega')) ||
              cu.email.toLowerCase().includes('elena.vega')
            ) {
              return {
                ...cu,
                id: 'usr_prueba',
                email: cu.email.toLowerCase().includes('elena.vega') ? 'prueba@reewai.app' : cu.email,
                fullName: 'Usuario de prueba',
                role: cu.role || 'editor',
                password: cu.password || 'prueba',
              };
            }
            return cu;
          });

        // Combine default demo team members with locally registered users
        let serverUsers: UserProfile[] = [];
        try {
          serverUsers = await DatabaseService.fetchUsers();
        } catch (e) {
          console.warn('Could not fetch users from server DB:', e);
        }

        const combinedUsersMap = new Map<string, UserProfile>();

        // 1. Initial demo members
        DEMO_TEAM_MEMBERS.forEach((m) => {
          combinedUsersMap.set(m.email.toLowerCase(), {
            id: m.id,
            email: m.email,
            fullName: m.fullName,
            avatarUrl: m.avatarUrl,
            role: m.role,
            password: m.password,
          });
        });

        // 2. Server database users
        serverUsers.forEach((su) => {
          combinedUsersMap.set(su.email.toLowerCase(), {
            ...su,
            role: su.email.toLowerCase() === 'sillescas2@gmail.com' ? 'admin' : (su.role || 'user'),
          });
        });

        // 3. Local users
        currentUsers.forEach((cu) => {
          if (!combinedUsersMap.has(cu.email.toLowerCase())) {
            combinedUsersMap.set(cu.email.toLowerCase(), cu);
          }
        });

        const allUsers: UserProfile[] = Array.from(combinedUsersMap.values()).map((u) => {
          if (u.email.toLowerCase() === 'sillescas2@gmail.com') {
            return { ...u, role: 'admin' as const, password: u.password || 'admin' };
          }
          return u;
        });

        setAvailableUsers(allUsers);
        localStorage.setItem(
          LOCAL_USERS_KEY,
          JSON.stringify(allUsers.filter((u) => u.id !== 'usr_santi_illescas' && u.id !== 'usr_prueba'))
        );

        // Find active user if previously signed in
        const activeUserId = localStorage.getItem(LOCAL_ACTIVE_USER_KEY);
        let found = activeUserId ? allUsers.find((u) => u.id === activeUserId) || null : null;
        if (found) {
          if (found.email.toLowerCase() === 'sillescas2@gmail.com') {
            found = { ...found, role: 'admin' };
          }
        }
        setUser(found);
      }

      setIsLoading(false);
    }

    initAuth();
  }, [isSupabase]);

  const login = async (email: string, password?: string) => {
    const cleanEmail = (email || '').trim().toLowerCase();

    // Check if account/device is locked out due to 3 failed attempts
    const lockout = getLockoutState(cleanEmail);
    if (lockout.isLocked) {
      return {
        success: false,
        error: `Has alcanzado el límite de 3 errores de inicio de sesión. Por motivos de seguridad, el acceso está bloqueado temporalmente. Debes esperar ${formatRemainingLockout(lockout.remainingSeconds)} antes de volver a intentarlo.`,
      };
    }

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (!supabase) return { success: false, error: 'Supabase no inicializado' };
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password || '',
      });
      if (error) {
        // Record failed attempt
        const failRecord = recordFailedAttempt(cleanEmail);
        if (failRecord.isLocked) {
          return {
            success: false,
            error: `Has alcanzado el límite de 3 errores. Tu acceso ha sido bloqueado durante 10 minutos. Por favor espera antes de volver a intentarlo.`,
          };
        }
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return {
            success: false,
            error: 'Este correo aún no ha sido confirmado en Supabase. Puedes desactivar la confirmación en Supabase (Authentication -> Providers -> Email -> Desactivar "Confirm email") para que los usuarios accedan de inmediato.',
          };
        }
        return {
          success: false,
          error: `Credenciales incorrectas (error ${failRecord.attempts} de 3). Te queda${failRecord.remainingAttempts === 1 ? '' : 'n'} ${failRecord.remainingAttempts} intento${failRecord.remainingAttempts === 1 ? '' : 's'} antes de un bloqueo de 10 minutos.`,
        };
      }
      // Successful login
      recordSuccessfulLogin(cleanEmail);
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          fullName: data.user.user_metadata?.full_name || email.split('@')[0],
          avatarUrl: data.user.user_metadata?.avatar_url || '',
          role: (data.user.email?.toLowerCase() === 'sillescas2@gmail.com') ? 'admin' : 'user',
        });
      }
      return { success: true };
    } else {
      // Central database authentication
      // Try central database first
      const serverLogin = await DatabaseService.login(cleanEmail, password?.trim());
      if (serverLogin.success && serverLogin.user) {
        recordSuccessfulLogin(cleanEmail);
        const loggedUser: UserProfile = {
          ...serverLogin.user,
          role: cleanEmail === 'sillescas2@gmail.com' ? 'admin' : serverLogin.user.role,
        };
        setUser(loggedUser);
        localStorage.setItem(LOCAL_ACTIVE_USER_KEY, loggedUser.id);
        return { success: true };
      }

      // If server returned an explicit lockout response
      if (serverLogin.error && serverLogin.error.includes('bloqueado')) {
        recordFailedAttempt(cleanEmail);
        return { success: false, error: serverLogin.error };
      }

      // Fallback to local memory / available users list
      let found = availableUsers.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!found) {
        const failRecord = recordFailedAttempt(cleanEmail);
        return {
          success: false,
          error: failRecord.isLocked
            ? 'Has alcanzado el límite de 3 errores. Tu acceso está bloqueado durante 10 minutos.'
            : `No se encontró ningún usuario con este correo (error ${failRecord.attempts} de 3). Te queda${failRecord.remainingAttempts === 1 ? '' : 'n'} ${failRecord.remainingAttempts} intento${failRecord.remainingAttempts === 1 ? '' : 's'}.`,
        };
      }

      // Check password if set on user
      if (found.password) {
        if (!password || password.trim() === '') {
          return { success: false, error: 'Por favor, introduce la contraseña para este usuario.' };
        }
        if (found.password !== password.trim()) {
          const failRecord = recordFailedAttempt(cleanEmail);
          return {
            success: false,
            error: failRecord.isLocked
              ? 'Has alcanzado el límite de 3 errores. Tu acceso está bloqueado durante 10 minutos.'
              : `Contraseña incorrecta (error ${failRecord.attempts} de 3). Te queda${failRecord.remainingAttempts === 1 ? '' : 'n'} ${failRecord.remainingAttempts} intento${failRecord.remainingAttempts === 1 ? '' : 's'} antes del bloqueo de 10 minutos.`,
          };
        }
      }

      // Successful local login
      recordSuccessfulLogin(cleanEmail);
      setUser(found);
      localStorage.setItem(LOCAL_ACTIVE_USER_KEY, found.id);
      return { success: true };
    }
  };

  const register = async (email: string, password?: string, fullName?: string) => {
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (!supabase) return { success: false, error: 'Supabase no inicializado' };
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || '',
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          fullName: fullName || email.split('@')[0],
          role: (data.user.email?.toLowerCase() === 'sillescas2@gmail.com') ? 'admin' : 'user',
        });
      }
      return { success: true };
    } else {
      const cleanEmail = email.trim().toLowerCase();
      const existing = availableUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return { success: false, error: 'Este correo electrónico ya está registrado.' };
      }

      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        email: cleanEmail,
        fullName: fullName?.trim() || cleanEmail.split('@')[0],
        role: cleanEmail === 'sillescas2@gmail.com' ? 'admin' : 'user',
        password: password?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      // Also persist to central database
      DatabaseService.register(cleanEmail, password?.trim(), fullName?.trim()).catch((err) => {
        console.warn('Could not register user to central DB:', err);
      });

      const updated = [...availableUsers, newUser];
      setAvailableUsers(updated);
      localStorage.setItem(
        LOCAL_USERS_KEY,
        JSON.stringify(updated.filter((u) => u.id !== 'usr_santi_illescas' && u.id !== 'usr_prueba'))
      );

      setUser(newUser);
      localStorage.setItem(LOCAL_ACTIVE_USER_KEY, newUser.id);
      return { success: true };
    }
  };

  const logout = async () => {
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } else {
      localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
    }
    setUser(null);
  };

  const switchUser = (targetUser: UserProfile | DemoTeamMember) => {
    setUser({
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.fullName,
      avatarUrl: targetUser.avatarUrl,
      role: targetUser.role,
    });
    localStorage.setItem(LOCAL_ACTIVE_USER_KEY, targetUser.id);
  };

  const checkUserExists = (rawEmail: string): boolean => {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    if (!cleanEmail) return false;
    return availableUsers.some((u) => u.email.toLowerCase() === cleanEmail);
  };

  const requestPasswordReset = async (
    rawEmail: string
  ): Promise<{
    success: boolean;
    isSupabase?: boolean;
    code?: string;
    expiresAt?: number;
    error?: string;
    message?: string;
  }> => {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Por favor, introduce un correo electrónico válido.' };
    }

    // Persist email for easy prefilling in recovery screens
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('reewai_last_recovery_email', cleanEmail);
      }
    } catch (e) {}

    // Check if user exists in local availableUsers
    const existingUser = availableUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    // If Supabase mode is configured, Supabase is the single source of truth
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const redirectUrl = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined;

          const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: redirectUrl,
          });

          if (!error) {
            return {
              success: true,
              isSupabase: true,
              message: `Hemos enviado el correo oficial de recuperación a "${cleanEmail}". Abre tu correo y pulsa directamente en el enlace "Restablecer contraseña" para elegir tu nueva clave.`,
            };
          }

          const msg = error.message || '';
          const lower = msg.toLowerCase();
          console.warn('Supabase resetPasswordForEmail error:', msg);

          // Rate limiting (60-second cooldown in Supabase)
          if (
            lower.includes('rate limit') ||
            lower.includes('once every') ||
            lower.includes('security purposes') ||
            lower.includes('seconds') ||
            lower.includes('429')
          ) {
            return {
              success: false,
              isSupabase: true,
              error: 'Por motivos de seguridad, Supabase solo permite enviar un correo cada 60 segundos. Por favor, espera unos segundos antes de pulsar "Enviar nuevo enlace".',
            };
          }

          // User not found in Supabase
          if (
            lower.includes('user not found') ||
            lower.includes('not found') ||
            lower.includes('invalid user')
          ) {
            return {
              success: false,
              isSupabase: true,
              error: `No existe ninguna cuenta registrada con el correo "${cleanEmail}" en Supabase. Verifica que esté bien escrito o regístrate.`,
            };
          }

          // Redirect URL configuration issues
          if (lower.includes('redirect') || lower.includes('url')) {
            return {
              success: false,
              isSupabase: true,
              error: `Error de configuración en Supabase: la URL de redirección no está autorizada. ${msg}`,
            };
          }

          // Any other error from Supabase
          return {
            success: false,
            isSupabase: true,
            error: msg || 'No se pudo enviar el correo de recuperación desde Supabase.',
          };
        } catch (err: any) {
          console.error('Supabase reset exception:', err);
          return {
            success: false,
            isSupabase: true,
            error: err.message || 'Error de conexión con Supabase al solicitar recuperación.',
          };
        }
      }
    }

    // Built-in / Local / Central Database mode (ONLY active when Supabase is NOT configured):
    const serverRes = await DatabaseService.requestPasswordReset(cleanEmail);

    if (serverRes.success) {
      const expiresAt = serverRes.expiresAt || (Date.now() + 15 * 60 * 1000);
      if (serverRes.code) {
        try {
          sessionStorage.setItem(
            `reewai_pwd_reset_${cleanEmail}`,
            JSON.stringify({ code: serverRes.code, expiresAt })
          );
        } catch (e) {}
      }

      return {
        success: true,
        isSupabase: false,
        expiresAt,
        message: `Hemos enviado el código de verificación a "${cleanEmail}". Revisa tu correo, copia el código de 6 dígitos y pégalo a continuación.`,
      };
    }

    if (existingUser) {
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      try {
        sessionStorage.setItem(
          `reewai_pwd_reset_${cleanEmail}`,
          JSON.stringify({ code: fallbackCode, expiresAt })
        );
      } catch (e) {}

      return {
        success: true,
        isSupabase: false,
        expiresAt,
        message: `Código de verificación generado para tu cuenta "${cleanEmail}". Escribe los 6 dígitos para restablecer tu contraseña.`,
      };
    }

    // Neither exists
    return {
      success: false,
      error: `No existe ninguna cuenta registrada con el correo "${cleanEmail}". Verifica que esté bien escrito o date de alta.`,
    };
  };

  const resetPasswordWithCode = async (
    rawEmail: string,
    rawCode: string,
    rawNewPassword: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    const cleanCode = (rawCode || '').trim();
    const cleanPassword = (rawNewPassword || '').trim();

    if (!cleanEmail || !cleanCode || !cleanPassword) {
      return { success: false, error: 'Por favor, completa todos los campos requeridos.' };
    }

    if (cleanPassword.length < 6) {
      return {
        success: false,
        error: 'La nueva contraseña debe contener al menos 6 caracteres para ser aceptada.',
      };
    }

    // Verify code from session storage if present (offline/local fallback)
    let cachedData: { code: string; expiresAt: number } | null = null;
    try {
      const stored = sessionStorage.getItem(`reewai_pwd_reset_${cleanEmail}`);
      if (stored) {
        cachedData = JSON.parse(stored);
      }
    } catch (e) {}

    if (cachedData && !isSupabase) {
      if (Date.now() > cachedData.expiresAt) {
        sessionStorage.removeItem(`reewai_pwd_reset_${cleanEmail}`);
        return {
          success: false,
          error: 'El código de recuperación ha expirado. Por favor solicita uno nuevo.',
        };
      }
      if (cachedData.code !== cleanCode) {
        return {
          success: false,
          error: 'El código de recuperación es incorrecto. Verifica los 6 dígitos introducidos desde tu correo.',
        };
      }
    }

    // If Supabase is configured, verify OTP and update user password
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          // Attempt OTP verification to authenticate recovery session
          const { error: otpError } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanCode,
            type: 'recovery',
          });

          if (otpError) {
            console.warn('Supabase verifyOtp notice:', otpError.message);
            const lower = otpError.message.toLowerCase();
            const friendlyOtpMsg = lower.includes('expired')
              ? 'El código de verificación ha expirado. Por favor solicita uno nuevo.'
              : `El código de 6 dígitos es incorrecto o no coincide con tu correo: ${otpError.message}.`;
            return { success: false, error: friendlyOtpMsg };
          }

          // Update password in Supabase
          const { error: updateError } = await supabase.auth.updateUser({ password: cleanPassword });
          if (updateError) {
            let userFriendlyMsg = updateError.message;
            const lowerMsg = userFriendlyMsg.toLowerCase();
            if (lowerMsg.includes('weak') || lowerMsg.includes('least 6') || lowerMsg.includes('pwned') || lowerMsg.includes('security')) {
              userFriendlyMsg = 'La contraseña no es suficientemente segura según las políticas de Supabase: debe tener al menos 6 caracteres y combinar números o letras.';
            }
            return {
              success: false,
              error: `Problema con la clave: ${userFriendlyMsg}`,
            };
          }

          try {
            sessionStorage.removeItem(`reewai_pwd_reset_${cleanEmail}`);
          } catch (e) {}

          return {
            success: true,
            message: '¡Contraseña actualizada con éxito en Supabase! Ya puedes iniciar sesión con tu nueva clave.',
          };
        } catch (e: any) {
          console.warn('Notice updating password in Supabase:', e);
          return {
            success: false,
            error: e.message || 'Error de comunicación con Supabase.',
          };
        }
      }
    }

    // Call server to reset in central DB
    const dbRes = await DatabaseService.resetPassword(cleanEmail, cleanCode, cleanPassword);
    if (!dbRes.success && !isSupabase && (!cachedData || cachedData.code !== cleanCode)) {
      return {
        success: false,
        error: dbRes.error || 'No se pudo restablecer la contraseña en el servidor.',
      };
    }

    // Update local availableUsers
    const userIndex = availableUsers.findIndex(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (userIndex >= 0) {
      const updatedList = availableUsers.map((u) =>
        u.email.toLowerCase() === cleanEmail ? { ...u, password: cleanPassword } : u
      );
      setAvailableUsers(updatedList);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

      if (user && user.email.toLowerCase() === cleanEmail) {
        setUser({ ...user, password: cleanPassword });
      }
    }

    // Invalidate session storage code
    try {
      sessionStorage.removeItem(`reewai_pwd_reset_${cleanEmail}`);
    } catch (e) {}

    return {
      success: true,
      message: '¡Contraseña restablecida correctamente! Ya puedes iniciar sesión con tu nueva clave.',
    };
  };

  const updatePasswordDirectly = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPassword = (newPassword || '').trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { error } = await supabase.auth.updateUser({ password: cleanPassword });
          if (error) {
            let userFriendlyMsg = error.message;
            const lower = userFriendlyMsg.toLowerCase();
            if (
              lower.includes('weak') ||
              lower.includes('least 6') ||
              lower.includes('pwned') ||
              lower.includes('security')
            ) {
              userFriendlyMsg =
                'La contraseña no es suficientemente segura según las políticas de Supabase: debe tener al menos 6 caracteres y combinar números o letras.';
            }
            return { success: false, error: userFriendlyMsg };
          }
        } catch (err: any) {
          return {
            success: false,
            error: err.message || 'Error al actualizar contraseña en Supabase.',
          };
        }
      }
    }

    // Also update in local and central DB if target user is known
    const targetEmail = recoveryFlow.email || user?.email;
    if (targetEmail) {
      DatabaseService.resetPassword(targetEmail, '', cleanPassword).catch((e) =>
        console.warn('DatabaseService password update notice:', e)
      );

      const updatedList = availableUsers.map((u) =>
        u.email.toLowerCase() === targetEmail.toLowerCase() ? { ...u, password: cleanPassword } : u
      );
      setAvailableUsers(updatedList);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

      if (user && user.email.toLowerCase() === targetEmail.toLowerCase()) {
        setUser({ ...user, password: cleanPassword });
      }
    }

    return { success: true };
  };

  const refreshUsers = async () => {
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            const mapped: UserProfile[] = data.map((d: any) => ({
              id: d.id,
              email: d.email,
              fullName: d.full_name || d.email.split('@')[0],
              avatarUrl: d.avatar_url || '',
              role: (d.role || 'user') as 'admin' | 'user' | 'editor',
              createdAt: d.created_at,
            }));
            setAvailableUsers(mapped);
            return;
          }
        } catch (e) {
          console.warn('Could not fetch profiles from Supabase:', e);
        }
      }
    }

    // Fallback or Local Multi-User Mode
    const savedUsersRaw = localStorage.getItem(LOCAL_USERS_KEY);
    let currentUsers: UserProfile[] = [];
    if (savedUsersRaw) {
      try {
        currentUsers = JSON.parse(savedUsersRaw);
      } catch {
        currentUsers = [];
      }
    }

    currentUsers = currentUsers
      .filter((cu) => {
        const id = (cu.id || '').toLowerCase();
        const email = (cu.email || '').toLowerCase();
        if (id.includes('carlos') || email.includes('carlos.mendez')) return false;
        if (id.includes('sofia') || email.includes('sofia.roca')) return false;
        return true;
      })
      .map((cu) => {
        if (
          cu.id === 'usr_elena_vega' ||
          (cu.fullName && cu.fullName.toLowerCase().includes('elena vega')) ||
          cu.email.toLowerCase().includes('elena.vega')
        ) {
          return {
            ...cu,
            id: 'usr_prueba',
            email: cu.email.toLowerCase().includes('elena.vega') ? 'prueba@reewai.app' : cu.email,
            fullName: 'Usuario de prueba',
            role: cu.role || 'editor',
            password: cu.password || 'prueba',
          };
        }
        return cu;
      });

    const allUsers: UserProfile[] = [
      ...DEMO_TEAM_MEMBERS.map((m) => ({
        id: m.id,
        email: m.email,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        role: m.role,
        password: m.password,
        createdAt: '2025-01-01T00:00:00.000Z',
      })),
      ...currentUsers.filter(
        (cu) => !DEMO_TEAM_MEMBERS.some((m) => m.id === cu.id || m.email.toLowerCase() === cu.email.toLowerCase())
      ),
    ];

    setAvailableUsers(allUsers);
  };

  const updateProfile = async (updates: { fullName?: string; email?: string; avatarUrl?: string }) => {
    if (!user) return { success: false, error: 'No hay usuario autenticado.' };

    const newFullName = updates.fullName !== undefined ? updates.fullName.trim() : user.fullName;
    const newEmail = updates.email !== undefined ? updates.email.trim().toLowerCase() : user.email;
    const newAvatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : user.avatarUrl;

    if (!newFullName) {
      return { success: false, error: 'El nombre no puede estar vacío.' };
    }
    if (!newEmail || !newEmail.includes('@')) {
      return { success: false, error: 'El correo electrónico no es válido.' };
    }

    // 1. If Supabase is connected, update profiles table & auth metadata
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              full_name: newFullName,
              email: newEmail,
              avatar_url: newAvatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (profileError) {
            console.warn('Supabase profiles table update notice:', profileError.message);
          }

          // Also attempt to update auth user metadata
          await supabase.auth.updateUser({
            email: newEmail !== user.email ? newEmail : undefined,
            data: {
              full_name: newFullName,
              avatar_url: newAvatarUrl,
            },
          });
        } catch (err: any) {
          console.error('Error updating profile in Supabase:', err);
        }
      }
    }

    // 2. Update current active user and local list for persistence
    const updatedUser: UserProfile = {
      ...user,
      fullName: newFullName,
      email: newEmail,
      avatarUrl: newAvatarUrl,
    };

    setUser(updatedUser);

    // Persist to central DB
    DatabaseService.updateUser(user.id, {
      fullName: newFullName,
      email: newEmail,
      avatarUrl: newAvatarUrl,
    }).catch((e) => console.warn('DatabaseService profile update notice:', e));

    const updatedList = availableUsers.map((u) => (u.id === user.id ? updatedUser : u));
    setAvailableUsers(updatedList);

    // Persist to localStorage
    const toStoreLocally = updatedList.filter(
      (u) => !DEMO_TEAM_MEMBERS.some((m) => m.id === u.id && m.email === u.email && !u.avatarUrl?.startsWith('data:'))
    );
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

    return { success: true };
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user' | 'editor') => {
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('profiles')
            .update({
              role: newRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        } catch (e) {
          console.warn('Could not update role in Supabase profiles:', e);
        }
      }
    }

    const updatedList = availableUsers.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
    setAvailableUsers(updatedList);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

    DatabaseService.updateUser(userId, { role: newRole }).catch((e) =>
      console.warn('DatabaseService role update notice:', e)
    );

    if (user && user.id === userId) {
      setUser({ ...user, role: newRole });
    }

    return { success: true };
  };

  const updateAnyUser = async (userId: string, updates: Partial<UserProfile>) => {
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('profiles')
            .update({
              full_name: updates.fullName,
              email: updates.email,
              avatar_url: updates.avatarUrl,
              role: updates.role,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        } catch (e) {
          console.warn('Could not update user in Supabase profiles:', e);
        }
      }
    }

    DatabaseService.updateUser(userId, updates).catch((e) =>
      console.warn('DatabaseService updateAnyUser notice:', e)
    );

    const updatedList = availableUsers.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          ...updates,
          password: updates.password !== undefined && updates.password.trim() !== '' ? updates.password.trim() : u.password,
        };
      }
      return u;
    });

    setAvailableUsers(updatedList);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

    if (user && user.id === userId) {
      setUser({
        ...user,
        ...updates,
        password: updates.password !== undefined && updates.password.trim() !== '' ? updates.password.trim() : user.password,
      });
    }

    return { success: true };
  };

  const deleteUser = async (userId: string) => {
    if (user && user.id === userId) {
      return { success: false, error: 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.' };
    }

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('profiles').delete().eq('id', userId);
        } catch (e) {
          console.warn('Could not delete user in Supabase:', e);
        }
      }
    }

    DatabaseService.deleteUser(userId).catch((e) =>
      console.warn('DatabaseService deleteUser notice:', e)
    );

    const updatedList = availableUsers.filter((u) => u.id !== userId);
    setAvailableUsers(updatedList);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

    return { success: true };
  };

  const createUser = async (userData: {
    email: string;
    fullName: string;
    role: 'admin' | 'user' | 'editor';
    avatarUrl?: string;
    password?: string;
  }) => {
    const cleanEmail = userData.email.trim().toLowerCase();
    const cleanName = userData.fullName.trim();
    const cleanPassword = userData.password?.trim() || '';

    if (!cleanName) return { success: false, error: 'El nombre es obligatorio.' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { success: false, error: 'El email no es válido.' };
    if (!cleanPassword) return { success: false, error: 'La contraseña es obligatoria para el nuevo usuario.' };
    if (cleanPassword.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };

    const exists = availableUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'Ya existe un usuario con este correo electrónico.' };
    }

    const newId = `usr_${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      email: cleanEmail,
      fullName: cleanName,
      role: userData.role || 'user',
      avatarUrl: userData.avatarUrl || '',
      password: cleanPassword,
      createdAt: new Date().toISOString(),
    };

    // Save to central database
    DatabaseService.register(cleanEmail, cleanPassword, cleanName).catch((e) =>
      console.warn('DatabaseService register notice:', e)
    );

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('profiles').insert({
            id: newId,
            email: cleanEmail,
            full_name: cleanName,
            avatar_url: userData.avatarUrl || '',
            role: userData.role || 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          // Attempt to register in Supabase Auth as well
          await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanName,
                role: userData.role || 'user',
              },
              emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
          });
        } catch (e) {
          console.warn('Could not insert profile in Supabase:', e);
        }
      }
    }

    const updatedList = [newUser, ...availableUsers];
    setAvailableUsers(updatedList);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSupabase,
        login,
        register,
        logout,
        switchUser,
        availableUsers,
        updateProfile,
        updateUserRole,
        updateAnyUser,
        deleteUser,
        createUser,
        refreshUsers,
        checkUserExists,
        getLoginLockout: (email?: string) => getLockoutState(email),
        requestPasswordReset,
        resetPasswordWithCode,
        recoveryFlow,
        closeRecoveryFlow,
        updatePasswordDirectly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

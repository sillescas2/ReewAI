import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { getSupabaseClient, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabaseClient';
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
  recoveryKey?: string;
}

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === 'xxxx@gmaxl.xxx' || clean === 'sillescas2@gmail.com';
};

// Characters excluding confusing glyphs (0, O, 1, I)
const RECOVERY_KEY_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRecoveryKeyCode(): string {
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += RECOVERY_KEY_CHARS.charAt(Math.floor(Math.random() * RECOVERY_KEY_CHARS.length));
    part2 += RECOVERY_KEY_CHARS.charAt(Math.floor(Math.random() * RECOVERY_KEY_CHARS.length));
  }
  return `${part1}-${part2}`;
}

export function normalizeRecoveryKey(raw: string): string {
  return (raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export const DEMO_TEAM_MEMBERS: DemoTeamMember[] = [
  {
    id: 'usr_santi_illescas',
    email: 'xxxx@gmaxl.xxx',
    fullName: 'Superadministrador',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
    role: 'admin',
    jobTitle: 'Superadministrador',
    password: 'admin',
    recoveryKey: 'RW88-9999',
  },
  {
    id: 'usr_prueba',
    email: 'prueba@reewai.app',
    fullName: 'Usuario de prueba',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    role: 'editor',
    jobTitle: 'Cuenta de Prueba',
    password: 'prueba',
    recoveryKey: 'PRUE-2026',
  },
];

const LOCAL_ACTIVE_USER_KEY = 'reewai_active_user_id';
const LOCAL_USERS_KEY = 'reewai_registered_users';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isSupabase: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password?: string, fullName?: string) => Promise<{ success: boolean; error?: string; recoveryKey?: string }>;
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
  resetPasswordWithRecoveryKey: (
    email: string,
    recoveryKey: string,
    newPassword: string
  ) => Promise<{
    success: boolean;
    newRecoveryKey?: string;
    error?: string;
    message?: string;
  }>;
  regenerateRecoveryKey: () => Promise<{ success: boolean; recoveryKey?: string; error?: string }>;
  newlyRegisteredKey: string | null;
  clearNewlyRegisteredKey: () => void;
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

  // Master recovery key modal for newly registered users
  const [newlyRegisteredKey, setNewlyRegisteredKey] = useState<string | null>(null);
  const clearNewlyRegisteredKey = () => setNewlyRegisteredKey(null);

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

      if (accessToken || type === 'recovery' || (code && type === 'recovery') || tokenHash) {
        let extractedEmail = '';
        let extractedSupabaseUrl = '';

        if (accessToken) {
          try {
            const parts = accessToken.split('.');
            if (parts.length >= 2) {
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const decoded = JSON.parse(jsonPayload);
              if (decoded.email) {
                extractedEmail = decoded.email;
              }
              if (decoded.iss && typeof decoded.iss === 'string' && decoded.iss.includes('.supabase.co')) {
                extractedSupabaseUrl = decoded.iss.replace(/\/auth\/v1\/?$/, '').trim();
                if (extractedSupabaseUrl) {
                  try {
                    sessionStorage.setItem('reewai_recovery_supabase_url', extractedSupabaseUrl);
                    if (!localStorage.getItem('reewai_custom_supabase_url')) {
                      localStorage.setItem('reewai_custom_supabase_url', extractedSupabaseUrl);
                    }
                  } catch {}
                }
              }
            }
            try {
              sessionStorage.setItem('reewai_recovery_access_token', accessToken);
            } catch {}
          } catch (e) {
            console.warn('JWT token inspection notice:', e);
          }
        }

        const lastEmail = (typeof window !== 'undefined' && localStorage.getItem('reewai_last_recovery_email')) || '';
        setRecoveryFlow((prev) => ({
          ...prev,
          isActive: true,
          type: 'set-new-password',
          email: extractedEmail || prev.email || lastEmail,
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

        // Active cleanup: Purge Carlos/Sofia, migrate Elena to "Usuario de prueba", migrate Santi to "Superadministrador"
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
              cu.id === 'usr_santi_illescas' ||
              isSuperAdminEmail(cu.email) ||
              (cu.fullName && cu.fullName.toLowerCase() === 'santi')
            ) {
              return {
                ...cu,
                id: 'usr_santi_illescas',
                email: 'xxxx@gmaxl.xxx',
                fullName: 'Superadministrador',
                role: 'admin',
                password: 'admin',
              };
            }
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
          const isSuper = isSuperAdminEmail(su.email) || su.id === 'usr_santi_illescas';
          combinedUsersMap.set(isSuper ? 'xxxx@gmaxl.xxx' : su.email.toLowerCase(), {
            ...su,
            email: isSuper ? 'xxxx@gmaxl.xxx' : su.email,
            fullName: isSuper ? 'Superadministrador' : su.fullName,
            role: isSuper ? 'admin' : (su.role || 'user'),
          });
        });

        // 3. Local users
        currentUsers.forEach((cu) => {
          if (!combinedUsersMap.has(cu.email.toLowerCase())) {
            combinedUsersMap.set(cu.email.toLowerCase(), cu);
          }
        });

        const allUsers: UserProfile[] = Array.from(combinedUsersMap.values()).map((u) => {
          if (isSuperAdminEmail(u.email) || u.id === 'usr_santi_illescas') {
            return {
              ...u,
              email: 'xxxx@gmaxl.xxx',
              fullName: 'Superadministrador',
              role: 'admin' as const,
              password: u.password || 'admin',
            };
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
          if (isSuperAdminEmail(found.email) || found.id === 'usr_santi_illescas') {
            found = {
              ...found,
              email: 'xxxx@gmaxl.xxx',
              fullName: 'Superadministrador',
              role: 'admin',
            };
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
          role: isSuperAdminEmail(data.user.email) ? 'admin' : 'user',
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
          role: isSuperAdminEmail(cleanEmail) ? 'admin' : serverLogin.user.role,
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
    const cleanEmail = email.trim().toLowerCase();
    const generatedRecoveryKey = generateRecoveryKeyCode();

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (!supabase) return { success: false, error: 'Supabase no inicializado' };
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password || '',
        options: {
          data: {
            full_name: fullName || cleanEmail.split('@')[0],
            recovery_key: generatedRecoveryKey,
          },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      try {
        localStorage.setItem(`reewai_recovery_key_${cleanEmail}`, generatedRecoveryKey);
      } catch {}
      setNewlyRegisteredKey(generatedRecoveryKey);

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || cleanEmail,
          fullName: fullName || cleanEmail.split('@')[0],
          role: isSuperAdminEmail(data.user.email) ? 'admin' : 'user',
          recoveryKey: generatedRecoveryKey,
        });
      }
      return { success: true, recoveryKey: generatedRecoveryKey };
    } else {
      const existing = availableUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return { success: false, error: 'Este correo electrónico ya está registrado.' };
      }

      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        email: cleanEmail,
        fullName: fullName?.trim() || cleanEmail.split('@')[0],
        role: isSuperAdminEmail(cleanEmail) ? 'admin' : 'user',
        password: password?.trim() || '',
        recoveryKey: generatedRecoveryKey,
        createdAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`reewai_recovery_key_${cleanEmail}`, generatedRecoveryKey);
      } catch {}

      // Also persist to central database
      DatabaseService.register(cleanEmail, password?.trim(), fullName?.trim(), generatedRecoveryKey).catch((err) => {
        console.warn('Could not register user to central DB:', err);
      });

      const updated = [...availableUsers, newUser];
      setAvailableUsers(updated);
      localStorage.setItem(
        LOCAL_USERS_KEY,
        JSON.stringify(updated.filter((u) => u.id !== 'usr_santi_illescas' && u.id !== 'usr_prueba'))
      );

      setUser(newUser);
      setNewlyRegisteredKey(generatedRecoveryKey);
      localStorage.setItem(LOCAL_ACTIVE_USER_KEY, newUser.id);
      return { success: true, recoveryKey: generatedRecoveryKey };
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

          let { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: redirectUrl,
          });

          // Graceful fallback: If Supabase rejects the specific redirect URL (e.g. not in whitelist),
          // retry immediately without explicit redirectTo so Supabase uses the default Site URL.
          if (
            error &&
            (error.message.toLowerCase().includes('redirect') ||
             error.message.toLowerCase().includes('not allowed'))
          ) {
            console.warn('Redirect URL rejected by Supabase, retrying with default Site URL fallback...');
            const fallbackResult = await supabase.auth.resetPasswordForEmail(cleanEmail);
            if (!fallbackResult.error) {
              error = null;
            } else {
              error = fallbackResult.error;
            }
          }

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

          // Hourly rate limit of Supabase built-in email service (Free tier max 3-4 emails/hour)
          if (
            lower.includes('over_email_send_rate_limit') ||
            (lower.includes('rate limit') && !lower.includes('60 seconds')) ||
            (lower.includes('exceeded') && lower.includes('limit'))
          ) {
            return {
              success: false,
              isSupabase: true,
              error: 'Supabase ha alcanzado el límite de correos por hora de su servicio gratuito (máx. 3 o 4 correos/hora). Para envíos ilimitados e inmediatos, activa un SMTP gratuito (ej. Resend) en el botón "Set up SMTP" de tu panel de Supabase, o espera a que se reinicie la cuota de la hora.',
            };
          }

          // Rate limiting (60-second cooldown in Supabase between consecutive requests)
          if (
            lower.includes('once every') ||
            lower.includes('60 seconds') ||
            lower.includes('security purposes') ||
            lower.includes('429')
          ) {
            return {
              success: false,
              isSupabase: true,
              error: 'Por motivos de seguridad, Supabase exige esperar 60 segundos entre envíos de correo. Por favor, aguarda un momento antes de volver a solicitarlo.',
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

          // Invalid path / malformed URL endpoint
          if (lower.includes('invalid path') || lower.includes('pgrst125')) {
            return {
              success: false,
              isSupabase: true,
              error: 'La dirección URL de Supabase guardada contenía una subruta (ej. /rest/v1). Se ha corregido automáticamente al dominio base. Vuelve a pulsar "Enviar Correo de Recuperación".',
            };
          }

          // Redirect URL configuration issues
          if (lower.includes('redirect_uri') || (lower.includes('redirect') && lower.includes('allowed'))) {
            return {
              success: false,
              isSupabase: true,
              error: `Error de configuración en Supabase: la URL de redirección no está autorizada en Authentication > URL Configuration. ${msg}`,
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

  /**
   * Resets user password instantly using their 8-character Master Recovery Key.
   * Completely bypasses email delivery delays, spam filters, and link expiration.
   */
  const resetPasswordWithRecoveryKey = async (
    rawEmail: string,
    rawKey: string,
    rawNewPassword: string
  ): Promise<{ success: boolean; newRecoveryKey?: string; message?: string; error?: string }> => {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    const normInputKey = normalizeRecoveryKey(rawKey);
    const cleanPassword = (rawNewPassword || '').trim();

    if (!cleanEmail || !normInputKey || !cleanPassword) {
      return { success: false, error: 'Por favor, completa todos los campos requeridos (correo, clave de rescate y nueva contraseña).' };
    }

    if (cleanPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Try central server DB first
    try {
      const serverRes = await DatabaseService.resetPasswordWithRecoveryKey(cleanEmail, normInputKey, cleanPassword);
      if (serverRes.success && serverRes.newRecoveryKey) {
        try {
          localStorage.setItem(`reewai_recovery_key_${cleanEmail}`, serverRes.newRecoveryKey);
        } catch {}

        const updatedList = availableUsers.map((u) =>
          u.email.toLowerCase() === cleanEmail
            ? { ...u, password: cleanPassword, recoveryKey: serverRes.newRecoveryKey }
            : u
        );
        setAvailableUsers(updatedList);
        try {
          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));
        } catch {}

        if (user && user.email.toLowerCase() === cleanEmail) {
          setUser({ ...user, password: cleanPassword, recoveryKey: serverRes.newRecoveryKey });
        } else if (serverRes.user) {
          setUser({ ...serverRes.user, recoveryKey: serverRes.newRecoveryKey });
          try {
            localStorage.setItem(LOCAL_ACTIVE_USER_KEY, serverRes.user.id);
          } catch {}
        }

        if (isSupabase) {
          const supabase = getSupabaseClient();
          if (supabase) {
            supabase.auth.updateUser({
              password: cleanPassword,
              data: { recovery_key: serverRes.newRecoveryKey },
            }).catch(() => {});
          }
        }

        return {
          success: true,
          newRecoveryKey: serverRes.newRecoveryKey,
          message: '¡Contraseña restablecida con éxito! Tu nueva Clave de Rescate ha sido generada.',
        };
      } else if (serverRes.error && !serverRes.error.includes('conexión') && !serverRes.error.includes('servidor')) {
        // If server responded with explicit business logic error (e.g. key mismatch)
        return { success: false, error: serverRes.error };
      }
    } catch (e) {
      console.warn('Central server reset failed, falling back to local storage:', e);
    }

    // 2. Client / Local fallback (e.g. static hosting on Netlify)
    let storedKey = '';
    try {
      storedKey = localStorage.getItem(`reewai_recovery_key_${cleanEmail}`) || '';
    } catch {}

    const targetUser = availableUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!storedKey && targetUser?.recoveryKey) {
      storedKey = targetUser.recoveryKey;
    }

    if (!storedKey) {
      const demo = DEMO_TEAM_MEMBERS.find((d) => d.email.toLowerCase() === cleanEmail);
      if (demo?.recoveryKey) storedKey = demo.recoveryKey;
    }

    if (!storedKey) {
      return {
        success: false,
        error: 'No se encontró ninguna Clave de Rescate registrada para este correo. Verifica que el correo esté bien escrito o crea una cuenta.',
      };
    }

    if (normalizeRecoveryKey(storedKey) !== normInputKey) {
      return {
        success: false,
        error: 'La Clave de Rescate no coincide con la registrada para esta cuenta. Comprueba los 8 dígitos introducidos.',
      };
    }

    // Valid recovery key! Rotate key for security
    const newRotatedKey = generateRecoveryKeyCode();
    try {
      localStorage.setItem(`reewai_recovery_key_${cleanEmail}`, newRotatedKey);
    } catch {}

    const updatedList = availableUsers.map((u) =>
      u.email.toLowerCase() === cleanEmail
        ? { ...u, password: cleanPassword, recoveryKey: newRotatedKey }
        : u
    );
    setAvailableUsers(updatedList);
    try {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));
    } catch {}

    if (user && user.email.toLowerCase() === cleanEmail) {
      setUser({ ...user, password: cleanPassword, recoveryKey: newRotatedKey });
    } else if (targetUser) {
      const loggedIn = { ...targetUser, password: cleanPassword, recoveryKey: newRotatedKey };
      setUser(loggedIn);
      try {
        localStorage.setItem(LOCAL_ACTIVE_USER_KEY, loggedIn.id);
      } catch {}
    }

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.updateUser({
          password: cleanPassword,
          data: { recovery_key: newRotatedKey },
        }).catch(() => {});
      }
    }

    return {
      success: true,
      newRecoveryKey: newRotatedKey,
      message: '¡Contraseña restablecida con éxito con tu Clave de Rescate!',
    };
  };

  /**
   * Regenerates a new recovery key for the active user.
   */
  const regenerateRecoveryKey = async (): Promise<{ success: boolean; recoveryKey?: string; error?: string }> => {
    if (!user) return { success: false, error: 'Usuario no conectado.' };

    const newKey = generateRecoveryKeyCode();
    const updatedUser = { ...user, recoveryKey: newKey };
    setUser(updatedUser);

    try {
      localStorage.setItem(`reewai_recovery_key_${user.email.toLowerCase()}`, newKey);
    } catch {}

    const updatedList = availableUsers.map((u) =>
      u.id === user.id ? { ...u, recoveryKey: newKey } : u
    );
    setAvailableUsers(updatedList);
    try {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedList));
    } catch {}

    DatabaseService.regenerateRecoveryKey(user.id).catch(() => {});

    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.updateUser({ data: { recovery_key: newKey } }).catch(() => {});
      }
    }

    return { success: true, recoveryKey: newKey };
  };

  const updatePasswordDirectly = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPassword = (newPassword || '').trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    const storedRecoveryToken = typeof window !== 'undefined' ? sessionStorage.getItem('reewai_recovery_access_token') : null;
    const storedSupabaseUrl = typeof window !== 'undefined' ? sessionStorage.getItem('reewai_recovery_supabase_url') : null;

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
              return {
                success: false,
                error:
                  'La contraseña no es suficientemente segura según las políticas de Supabase: debe tener al menos 6 caracteres y combinar números o letras.',
              };
            }
            if (storedRecoveryToken) {
              const endpoint = (storedSupabaseUrl || getSupabaseConfig().url).replace(/\/+$/, '') + '/auth/v1/user';
              const res = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${storedRecoveryToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: cleanPassword }),
              });
              if (!res.ok) {
                return { success: false, error: userFriendlyMsg };
              }
            } else {
              return { success: false, error: userFriendlyMsg };
            }
          }
        } catch (err: any) {
          if (storedRecoveryToken) {
            const endpoint = (storedSupabaseUrl || getSupabaseConfig().url).replace(/\/+$/, '') + '/auth/v1/user';
            try {
              const res = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${storedRecoveryToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: cleanPassword }),
              });
              if (!res.ok) {
                return { success: false, error: err.message || 'Error al actualizar contraseña en Supabase.' };
              }
            } catch {
              return { success: false, error: err.message || 'Error de conexión al actualizar contraseña.' };
            }
          } else {
            return {
              success: false,
              error: err.message || 'Error al actualizar contraseña en Supabase.',
            };
          }
        }
      }
    } else if (storedRecoveryToken) {
      const targetUrl = (storedSupabaseUrl || '').replace(/\/+$/, '');
      if (targetUrl.includes('.supabase.co')) {
        try {
          const res = await fetch(`${targetUrl}/auth/v1/user`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${storedRecoveryToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: cleanPassword }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.msg || errData.error_description || 'No se pudo actualizar la contraseña.' };
          }
        } catch (e: any) {
          console.warn('Direct token reset notice:', e);
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
          cu.id === 'usr_santi_illescas' ||
          isSuperAdminEmail(cu.email) ||
          (cu.fullName && cu.fullName.toLowerCase() === 'santi')
        ) {
          return {
            ...cu,
            id: 'usr_santi_illescas',
            email: 'xxxx@gmaxl.xxx',
            fullName: 'Superadministrador',
            role: 'admin',
            password: 'admin',
          };
        }
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
        resetPasswordWithRecoveryKey,
        regenerateRecoveryKey,
        newlyRegisteredKey,
        clearNewlyRegisteredKey,
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

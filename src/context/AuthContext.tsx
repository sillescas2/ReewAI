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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSupabase = isSupabaseConfigured();
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

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
            supabase.auth.onAuthStateChange((_event, session) => {
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

    // Check if user exists in local availableUsers
    const existingUser = availableUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    // If Supabase mode is configured
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
          });
          if (error) {
            return { success: false, error: error.message };
          }
          return {
            success: true,
            isSupabase: true,
            message: `Se ha enviado un enlace de recuperación oficial de Supabase a ${cleanEmail}. Revisa tu bandeja de entrada o spam.`,
          };
        } catch (err: any) {
          return { success: false, error: err.message || 'Error al solicitar restablecimiento en Supabase.' };
        }
      }
    }

    // Built-in / Local / Central Database mode:
    const serverRes = await DatabaseService.requestPasswordReset(cleanEmail);

    if (serverRes.success && serverRes.code) {
      const expiresAt = serverRes.expiresAt || (Date.now() + 15 * 60 * 1000);
      try {
        sessionStorage.setItem(
          `reewai_pwd_reset_${cleanEmail}`,
          JSON.stringify({ code: serverRes.code, expiresAt })
        );
      } catch (e) {}

      return {
        success: true,
        isSupabase: false,
        code: serverRes.code,
        expiresAt,
        message: 'Código de recuperación generado con éxito.',
      };
    }

    // If server says user not found and we also do not have it locally
    if (!existingUser && !serverRes.success) {
      return {
        success: false,
        error: `No existe ninguna cuenta registrada con el correo "${cleanEmail}". Verifica la dirección o crea una cuenta nueva.`,
      };
    }

    // Fallback if server offline or standalone preview
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
      code: fallbackCode,
      expiresAt,
      message: 'Código de recuperación de 6 dígitos generado para tu cuenta.',
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
      return { success: false, error: 'La nueva contraseña debe contener al menos 6 caracteres.' };
    }

    // Verify code from session storage if present
    let cachedData: { code: string; expiresAt: number } | null = null;
    try {
      const stored = sessionStorage.getItem(`reewai_pwd_reset_${cleanEmail}`);
      if (stored) {
        cachedData = JSON.parse(stored);
      }
    } catch (e) {}

    if (cachedData) {
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
          error: 'El código de recuperación es incorrecto. Verifica los 6 dígitos introducidos.',
        };
      }
    }

    // Call server to reset in central DB
    await DatabaseService.resetPassword(cleanEmail, cleanCode, cleanPassword);

    // Also update Supabase if configured
    if (isSupabase) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.auth.updateUser({ password: cleanPassword });
        } catch (e) {
          console.warn('Notice updating password in Supabase:', e);
        }
      }
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

export const MAX_LOGIN_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

interface RateLimitData {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

function getStorageKey(email?: string): string {
  const clean = (email || 'global').trim().toLowerCase();
  return `reewai_login_attempts_${clean}`;
}

function readData(key: string): RateLimitData {
  if (typeof window === 'undefined') {
    return { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
  }
}

function saveData(key: string, data: RateLimitData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function formatRemainingLockout(seconds: number): string {
  if (seconds <= 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds > 0 ? `${remainingSeconds} s` : ''}`.trim();
  }
  return `${remainingSeconds} s`;
}

export function getLockoutState(rawEmail?: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
  maxAttempts: number;
} {
  const now = Date.now();
  const emailKey = getStorageKey(rawEmail);
  const data = readData(emailKey);

  // Check if locked
  if (data.lockedUntil && data.lockedUntil > now) {
    const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attempts: data.attempts,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  // Lockout expired: reset attempts
  if (data.lockedUntil && data.lockedUntil <= now) {
    saveData(emailKey, { attempts: 0, lockedUntil: null, lastAttemptAt: now });
    return {
      isLocked: false,
      remainingSeconds: 0,
      attempts: 0,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts: data.attempts || 0,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
  };
}

export function recordFailedAttempt(rawEmail?: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
  remainingAttempts: number;
  errorMessage: string;
} {
  const now = Date.now();
  const emailKey = getStorageKey(rawEmail);
  const data = readData(emailKey);

  // If already locked
  if (data.lockedUntil && data.lockedUntil > now) {
    const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attempts: data.attempts,
      remainingAttempts: 0,
      errorMessage: `Has alcanzado el límite de 3 errores de acceso. Por seguridad, debes esperar ${formatRemainingLockout(remainingSeconds)} antes de volver a intentarlo.`,
    };
  }

  // Reset if expired
  let currentAttempts = data.lockedUntil && data.lockedUntil <= now ? 0 : data.attempts || 0;
  currentAttempts += 1;

  if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    saveData(emailKey, { attempts: currentAttempts, lockedUntil, lastAttemptAt: now });
    const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attempts: currentAttempts,
      remainingAttempts: 0,
      errorMessage: `Has alcanzado el límite de 3 errores de inicio de sesión. Tu acceso está bloqueado durante 10 minutos. Por favor espera antes de volver a intentarlo.`,
    };
  }

  saveData(emailKey, { attempts: currentAttempts, lockedUntil: null, lastAttemptAt: now });
  const remaining = MAX_LOGIN_ATTEMPTS - currentAttempts;
  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts: currentAttempts,
    remainingAttempts: remaining,
    errorMessage: `Credenciales incorrectas (error ${currentAttempts} de ${MAX_LOGIN_ATTEMPTS}). Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'} antes de un bloqueo de 10 minutos.`,
  };
}

export function recordSuccessfulLogin(rawEmail?: string) {
  const emailKey = getStorageKey(rawEmail);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(emailKey);
    } catch {}
  }
}

export function clearLockout(rawEmail?: string) {
  recordSuccessfulLogin(rawEmail);
}

import { UserProfile, SavedLinkItem } from '../types';

export const MAX_NON_ADMIN_AI_SAVES = 3;

export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.email?.trim().toLowerCase() === 'sillescas2@gmail.com';
}

function getStorageKey(userIdOrEmail?: string): string {
  const identifier = (userIdOrEmail || 'guest').trim().toLowerCase();
  return `reewai_ai_saves_count_${identifier}`;
}

export function getAiSavesUsed(userIdOrEmail?: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(getStorageKey(userIdOrEmail));
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch {
    return 0;
  }
}

export function getAiSavesRemaining(user: UserProfile | null | undefined): number {
  if (isUserAdmin(user)) {
    return Infinity;
  }
  const used = getAiSavesUsed(user?.id || user?.email);
  return Math.max(0, MAX_NON_ADMIN_AI_SAVES - used);
}

export function canUseAiSave(user: UserProfile | null | undefined): boolean {
  if (isUserAdmin(user)) return true;
  return getAiSavesRemaining(user) > 0;
}

export function recordAiSave(userIdOrEmail?: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const current = getAiSavesUsed(userIdOrEmail);
    const updated = current + 1;
    localStorage.setItem(getStorageKey(userIdOrEmail), updated.toString());
    // Also dispatch custom window event so other components update synchronously
    window.dispatchEvent(new CustomEvent('reewai-ai-quota-updated', { detail: { updated } }));
    return updated;
  } catch {
    return 0;
  }
}

export function resetAiQuota(userIdOrEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(userIdOrEmail));
    window.dispatchEvent(new CustomEvent('reewai-ai-quota-updated', { detail: { updated: 0 } }));
  } catch {}
}

/**
 * Ensures existing items saved with AI are counted if local storage counter was empty
 */
export function reconcileAiSavesWithExistingItems(
  userIdOrEmail: string | undefined,
  items: SavedLinkItem[]
): number {
  if (typeof window === 'undefined') return 0;
  const currentCount = getAiSavesUsed(userIdOrEmail);
  const aiItemsCount = items.filter(
    (i) => i.savedWithAi === true || (i.savedWithAi !== false && (i.keyTakeaways?.length || 0) > 0)
  ).length;

  const finalCount = Math.max(currentCount, aiItemsCount);
  if (finalCount !== currentCount) {
    try {
      localStorage.setItem(getStorageKey(userIdOrEmail), finalCount.toString());
    } catch {}
  }
  return finalCount;
}

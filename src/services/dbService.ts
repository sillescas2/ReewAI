import { SavedLinkItem, UserProfile, CategoryItem } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Safely parse JSON from fetch responses.
 * Detects HTML responses (such as SPA 404/index.html fallbacks on Netlify/Vercel)
 * and avoids throwing 'Unexpected token <, "<!DOCTYPE "... is not valid JSON'.
 */
async function safeParseJson<T = any>(
  res: Response
): Promise<{ isJson: boolean; data: T | null; error?: string }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!text || text.trim().startsWith('<') || !contentType.includes('application/json')) {
      return { isJson: false, data: null, error: `Respuesta no JSON (${res.status})` };
    }

    const data = JSON.parse(text);
    return { isJson: true, data };
  } catch (err: any) {
    return { isJson: false, data: null, error: err.message };
  }
}

// Default initial categories for any user with rich AI classification guides
const DEFAULT_SYSTEM_CATEGORIES_CONFIG = [
  {
    name: 'Sin categorías',
    color: '#64748b',
    description: 'Contenido general o que no encaja en ninguna otra categoría específica del usuario.',
  },
  {
    name: 'Marketing Digital',
    color: '#3b82f6',
    description: 'Estrategias de marketing, publicidad, ventas, embudos, captación, retención, ganchos (hooks) y redes sociales.',
  },
  {
    name: 'Tecnología e IA',
    color: '#8b5cf6',
    description: 'Inteligencia artificial, desarrollo de software, informática, routers, redes, WiFi, hardware y programación.',
  },
  {
    name: 'Desarrollo Personal',
    color: '#10b981',
    description: 'Hábitos, mentalidad, crecimiento personal, libros, disciplina, equilibrio vida-trabajo y productividad.',
  },
  {
    name: 'Recetas y Cocina',
    color: '#f59e0b',
    description: 'Recetas de cocina, técnicas culinarias, ingredientes, gastronomía, postres y preparación de platos.',
  },
];

function getDefaultCategories(userId: string): CategoryItem[] {
  return DEFAULT_SYSTEM_CATEGORIES_CONFIG.map((def, idx) => ({
    id: `cat_def_${idx + 1}_${userId}`,
    userId,
    name: def.name,
    color: def.color,
    description: def.description,
    createdAt: '2025-01-01T00:00:00.000Z',
  }));
}

function getStoredCategories(userId: string): CategoryItem[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`reewai_categories_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill default descriptions if user categories don't have one
        const descMap: Record<string, string> = {
          'sin categorías': 'Contenido general o que no encaja en ninguna otra categoría específica del usuario.',
          'marketing digital': 'Estrategias de marketing, publicidad, ventas, embudos, captación, retención, ganchos (hooks) y redes sociales.',
          'tecnología e ia': 'Inteligencia artificial, desarrollo de software, informática, routers, redes, WiFi, hardware y programación.',
          'desarrollo personal': 'Hábitos, mentalidad, crecimiento personal, libros, disciplina, equilibrio vida-trabajo y productividad.',
          'recetas y cocina': 'Recetas de cocina, técnicas culinarias, ingredientes, gastronomía, postres y preparación de platos.',
        };
        let backfilled = false;
        const normalized = parsed.map((cat: CategoryItem) => {
          if (!cat.description && descMap[cat.name.toLowerCase()]) {
            backfilled = true;
            return { ...cat, description: descMap[cat.name.toLowerCase()] };
          }
          return cat;
        });
        if (backfilled) {
          saveStoredCategories(userId, normalized);
        }
        return normalized;
      }
    }
  } catch {}
  return [];
}

function saveStoredCategories(userId: string, categories: CategoryItem[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`reewai_categories_${userId}`, JSON.stringify(categories));
  } catch (e) {
    console.warn('Error saving categories to localStorage:', e);
  }
}

export class DatabaseService {
  /**
   * Fetches user's saved reels and links from the central database.
   * Enforces user isolation so only the current user's data is retrieved.
   */
  static async fetchUserLinks(userId: string): Promise<{ success: boolean; data: SavedLinkItem[]; error?: string }> {
    if (!userId) {
      return { success: false, data: [], error: 'userId es requerido' };
    }

    try {
      const res = await fetch(`/api/links?userId=${encodeURIComponent(userId)}`, {
        headers: {
          Accept: 'application/json',
          'X-User-Id': userId,
        },
      });

      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return {
          success: false,
          data: [],
          error: parsed.data?.error || `Servidor no disponible (${res.status})`,
        };
      }

      return {
        success: true,
        data: Array.isArray(parsed.data.data) ? parsed.data.data : [],
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err.message || 'Error de conexión con la base de datos central.',
      };
    }
  }

  /**
   * Persists a reel or link to the central database.
   */
  static async saveLink(
    item: SavedLinkItem,
    userId: string
  ): Promise<{ success: boolean; data?: SavedLinkItem; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          ...item,
          userId,
        }),
      });

      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        // Return item directly so local-first flow succeeds without crashing
        return { success: true, data: item };
      }

      return { success: true, data: parsed.data.data || item };
    } catch {
      // Offline/Static host fallback
      return { success: true, data: item };
    }
  }

  /**
   * Updates an existing reel or link in the central database.
   */
  static async updateLink(
    id: string,
    updates: Partial<SavedLinkItem>,
    userId: string
  ): Promise<{ success: boolean; data?: SavedLinkItem; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    try {
      const res = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          ...updates,
          userId,
        }),
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success) {
        return { success: true, data: parsed.data.data };
      }

      return { success: true, data: updates as SavedLinkItem };
    } catch {
      return { success: true, data: updates as SavedLinkItem };
    }
  }

  /**
   * Deletes a reel from the central database with ownership verification.
   */
  static async deleteLink(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    try {
      const res = await fetch(`/api/links/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId,
        },
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && (!res.ok || !parsed.data?.success)) {
        return { success: false, error: parsed.data?.error || 'Error eliminando de la base de datos' };
      }

      return { success: true };
    } catch {
      return { success: true };
    }
  }

  /**
   * Batch synchronize links into the database.
   */
  static async syncBatch(
    items: SavedLinkItem[],
    userId: string
  ): Promise<{ success: boolean; added: number; updated: number; error?: string }> {
    if (!userId) {
      return { success: false, added: 0, updated: 0, error: 'Usuario no autenticado' };
    }

    try {
      const res = await fetch('/api/links/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          userId,
          items,
        }),
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success) {
        return { success: true, added: parsed.data.added || 0, updated: parsed.data.updated || 0 };
      }

      return { success: true, added: items.length, updated: 0 };
    } catch (err: any) {
      return { success: true, added: items.length, updated: 0 };
    }
  }

  // ================= USERS & AUTH =================

  static async fetchUsers(): Promise<UserProfile[]> {
    try {
      const res = await fetch('/api/users');
      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && Array.isArray(parsed.data?.data)) {
        return parsed.data.data;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async login(email: string, password?: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return { success: false, error: parsed.data?.error || 'Error al iniciar sesión.' };
      }
      return { success: true, user: parsed.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor.' };
    }
  }

  static async register(
    email: string,
    password?: string,
    fullName?: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return { success: false, error: parsed.data?.error || 'Error al registrar usuario.' };
      }
      return { success: true, user: parsed.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor.' };
    }
  }

  static async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; code?: string; expiresAt?: number; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return {
          success: false,
          error: parsed.data?.error || 'No se encontró ningún usuario dado de alta con este correo.',
        };
      }
      return {
        success: true,
        code: parsed.data.code,
        expiresAt: parsed.data.expiresAt,
        message: parsed.data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor.' };
    }
  }

  static async resetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return {
          success: false,
          error: parsed.data?.error || 'No se pudo restablecer la contraseña.',
        };
      }
      return {
        success: true,
        message: parsed.data.message || '¡Contraseña actualizada con éxito!',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor.' };
    }
  }

  static async updateUser(id: string, updates: Partial<UserProfile>): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return { success: false, error: parsed.data?.error || 'Error al actualizar usuario.' };
      }
      return { success: true, user: parsed.data.user };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const parsed = await safeParseJson(res);
      if (!parsed.isJson || !res.ok || !parsed.data?.success) {
        return { success: false, error: parsed.data?.error || 'Error al eliminar usuario.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ================= CATEGORIES SERVICE =================

  /**
   * Fetches user's registered categories.
   * Multi-layer sync: LocalStorage -> Supabase -> Central Express API.
   * Never throws or shows HTML parse errors on static hosting (Netlify).
   */
  static async fetchCategories(userId: string): Promise<{ success: boolean; data: CategoryItem[]; error?: string }> {
    if (!userId) {
      return { success: false, data: [], error: 'userId es requerido' };
    }

    // 1. Check local storage cache
    let categories = getStoredCategories(userId);
    if (categories.length === 0) {
      categories = getDefaultCategories(userId);
      saveStoredCategories(userId, categories);
    }

    // 2. Try Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userId);

          if (!error && Array.isArray(data) && data.length > 0) {
            const mapped: CategoryItem[] = data.map((row: any) => ({
              id: row.id || `cat_${Date.now()}`,
              userId: row.user_id || userId,
              name: row.name,
              color: row.color || '#6366f1',
              description: row.description || '',
              createdAt: row.created_at,
            }));

            // Merge local and Supabase categories
            const mergedMap = new Map<string, CategoryItem>();
            categories.forEach((c) => mergedMap.set(c.name.toLowerCase(), c));
            mapped.forEach((c) => mergedMap.set(c.name.toLowerCase(), c));
            categories = Array.from(mergedMap.values());
            saveStoredCategories(userId, categories);
          }
        }
      } catch (err) {
        console.warn('Supabase categories fetch notice:', err);
      }
    }

    // 3. Try Server API if active
    try {
      const res = await fetch(`/api/categories?userId=${encodeURIComponent(userId)}`, {
        headers: {
          Accept: 'application/json',
          'X-User-Id': userId,
        },
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success && Array.isArray(parsed.data?.data) && parsed.data.data.length > 0) {
        const serverCats: CategoryItem[] = parsed.data.data;
        const mergedMap = new Map<string, CategoryItem>();
        categories.forEach((c) => mergedMap.set(c.name.toLowerCase(), c));
        serverCats.forEach((c) => mergedMap.set(c.name.toLowerCase(), c));
        categories = Array.from(mergedMap.values());
        saveStoredCategories(userId, categories);
      }
    } catch {
      // Safe fallback to local cache
    }

    return {
      success: true,
      data: categories,
    };
  }

  /**
   * Creates a new category with name, color and description for the user.
   * Resilient to Netlify/Vercel/Static hosting where backend /api returns HTML.
   * Always persists to LocalStorage and Supabase, and syncs to backend when available.
   */
  static async createCategory(
    userId: string,
    name: string,
    color: string,
    description?: string
  ): Promise<{ success: boolean; data?: CategoryItem; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'El nombre de la categoría es obligatorio.' };
    }

    const cleanColor = (color || '').trim() || '#6366f1';
    const cleanDescription = (description !== undefined ? description : '').trim();

    // 1. Get current categories from local storage
    let current = getStoredCategories(userId);
    if (current.length === 0) {
      current = getDefaultCategories(userId);
    }

    // 2. Validate duplicate name
    if (current.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      return { success: false, error: `Ya tienes una categoría llamada "${cleanName}".` };
    }

    // 3. Create new category entity
    const newCategory: CategoryItem = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: cleanName,
      color: cleanColor,
      description: cleanDescription,
      createdAt: new Date().toISOString(),
    };

    // 4. Save to LocalStorage immediately
    const updatedList = [...current, newCategory];
    saveStoredCategories(userId, updatedList);

    // 5. Save to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          Promise.resolve(
            supabase
              .from('categories')
              .insert({
                id: newCategory.id,
                user_id: userId,
                name: newCategory.name,
                color: newCategory.color,
                description: newCategory.description,
                created_at: newCategory.createdAt,
              })
          ).catch(() => {});
        }
      } catch (err) {
        console.warn('Supabase categories error:', err);
      }
    }

    // 6. Try syncing to central Express backend if available
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ userId, name: cleanName, color: cleanColor, description: cleanDescription }),
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success && parsed.data.data) {
        // Reconcile server-assigned ID if available
        const serverCat: CategoryItem = parsed.data.data;
        const reconciled = updatedList.map((c) => (c.name.toLowerCase() === cleanName.toLowerCase() ? serverCat : c));
        saveStoredCategories(userId, reconciled);
        return { success: true, data: serverCat };
      }
    } catch {
      // Backend not running / Netlify static hosting: local save is already successful
    }

    return { success: true, data: newCategory };
  }

  /**
   * Updates a category name, color and/or description.
   */
  static async updateCategory(
    userId: string,
    categoryId: string,
    updates: { name?: string; color?: string; description?: string }
  ): Promise<{ success: boolean; data?: CategoryItem; reassignedLinksCount?: number; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const current = getStoredCategories(userId);
    const target = current.find((c) => c.id === categoryId);
    const cleanName = updates.name !== undefined ? updates.name.trim() : target?.name || '';
    const cleanColor = updates.color !== undefined ? updates.color.trim() : target?.color || '#6366f1';
    const cleanDescription = updates.description !== undefined ? updates.description.trim() : (target?.description || '');

    // Duplicate check if renaming
    if (cleanName && target && cleanName.toLowerCase() !== target.name.toLowerCase()) {
      if (current.some((c) => c.id !== categoryId && c.name.toLowerCase() === cleanName.toLowerCase())) {
        return { success: false, error: `Ya existe otra categoría llamada "${cleanName}".` };
      }
    }

    const updatedCategory: CategoryItem = target
      ? { ...target, name: cleanName, color: cleanColor, description: cleanDescription }
      : {
          id: categoryId,
          userId,
          name: cleanName || 'Categoría',
          color: cleanColor,
          description: cleanDescription,
        };

    const updatedList = current.map((c) => (c.id === categoryId ? updatedCategory : c));
    saveStoredCategories(userId, updatedList);

    // Supabase update
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          Promise.resolve(
            supabase
              .from('categories')
              .update({
                ...(updates.name !== undefined ? { name: cleanName } : {}),
                ...(updates.color !== undefined ? { color: cleanColor } : {}),
                ...(updates.description !== undefined ? { description: cleanDescription } : {}),
              })
              .eq('id', categoryId)
              .eq('user_id', userId)
          ).catch(() => {});
        }
      } catch {}
    }

    // Try server update
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ userId, ...updates, description: cleanDescription }),
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success && parsed.data.data) {
        return { success: true, data: parsed.data.data, reassignedLinksCount: parsed.data.reassignedLinksCount };
      }
    } catch {}

    return { success: true, data: updatedCategory };
  }

  /**
   * Deletes a category and cascades reassignment to "Sin categorías".
   */
  static async deleteCategory(
    userId: string,
    categoryId: string
  ): Promise<{ success: boolean; reassignedLinksCount?: number; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const current = getStoredCategories(userId);
    const updatedList = current.filter((c) => c.id !== categoryId);
    saveStoredCategories(userId, updatedList);

    // Supabase delete
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          Promise.resolve(
            supabase
              .from('categories')
              .delete()
              .eq('id', categoryId)
              .eq('user_id', userId)
          ).catch(() => {});
        }
      } catch {}
    }

    // Try server delete
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(categoryId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId,
        },
      });

      const parsed = await safeParseJson(res);
      if (parsed.isJson && res.ok && parsed.data?.success) {
        return { success: true, reassignedLinksCount: parsed.data.reassignedLinksCount };
      }
    } catch {}

    return { success: true };
  }
}

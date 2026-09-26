import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user' | 'editor';
  avatarUrl?: string;
  password?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LinkRecord {
  id: string;
  userId: string;
  url: string;
  originalUrl: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'web';
  title: string;
  summary: string;
  keyTakeaways: string[];
  category: string;
  tags: string[];
  estimatedTime?: string;
  authorOrChannel?: string;
  userNote?: string;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  duplicateCheck?: {
    isDuplicateTopic: boolean;
    duplicateReason?: string;
    similarExistingTitle?: string;
    similarExistingId?: string;
    similarityScore?: number;
  };
  isExactDuplicateOf?: string;
}

export interface CategoryRecord {
  id: string;
  userId: string;
  name: string;
  color: string;
  description?: string;
  createdAt: string;
}

export const DEFAULT_CATEGORY_NAME = 'Sin categorías';
export const DEFAULT_CATEGORY_COLOR = '#64748b';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LINKS_FILE = path.join(DATA_DIR, 'saved-links.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Atomic write utility to prevent file corruption
function atomicWriteJson(filePath: string, data: any) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// Initial default users
const INITIAL_USERS: UserRecord[] = [
  {
    id: 'usr_santi_illescas',
    email: 'xxxx@gmaxl.xxx',
    fullName: 'Superadministrador',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
    role: 'admin',
    password: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_prueba',
    email: 'prueba@reewai.app',
    fullName: 'Usuario de prueba',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    role: 'editor',
    password: 'prueba',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

// Initial default links for Santi
const INITIAL_SANTI_LINKS: LinkRecord[] = [
  {
    id: 'link-1789458161434-8yoyyy',
    userId: 'usr_santi_illescas',
    url: 'https://www.instagram.com/reel/DdJsZgLlrh0/?stkn=MWQ2NnQxcWV1MGo5Nw%3D%3D',
    originalUrl: 'https://www.instagram.com/reel/DdJsZgLlrh0/?stkn=MWQ2NnQxcWV1MGo5Nw%3D%3D',
    platform: 'instagram',
    title: 'La relación entre el trabajo y la realización personal',
    summary: 'El reel reflexiona sobre la distinción entre el empleo remunerado y la realización personal, cuestionando la idea de que el trabajo debe definir nuestra identidad. Se explora cómo equilibrar las responsabilidades profesionales con el rol dentro de la familia y el bienestar personal.',
    keyTakeaways: [
      'El trabajo no debe ser la única fuente de realización personal.',
      'Importancia de priorizar la familia y las relaciones personales sobre la identidad laboral.',
      'Reflexión sobre el rol del individuo más allá de su posición como empleado o jefe.',
      'La necesidad de encontrar propósito en facetas de la vida que trascienden el entorno profesional.'
    ],
    category: 'Desarrollo Personal',
    tags: ['paternidad', 'equilibrio vida-trabajo', 'desarrollo personal', 'liderazgo'],
    estimatedTime: 'Reel 1 min',
    authorOrChannel: '@soyflorencioramos',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-09-15T07:42:41.434Z',
    duplicateCheck: {
      isDuplicateTopic: false,
      duplicateReason: 'El contenido trata sobre el bienestar y la psicología del trabajo, lo cual es distinto a los temas previos centrados en marketing.',
      similarityScore: 10
    }
  },
  {
    id: 'santi-link-1',
    userId: 'usr_santi_illescas',
    url: 'https://www.instagram.com/reel/C8qB7r8vX2M/',
    originalUrl: 'https://www.instagram.com/reel/C8qB7r8vX2M/',
    platform: 'instagram',
    title: 'Estructura de 3 Segundos para Retención en Reels',
    summary: 'Desglosa la regla de los 3 segundos para evitar que el espectador haga scroll: gancho visual disruptivo, subtítulo dinámico con palabras clave y planteamiento inmediato del beneficio antes del segundo 4.',
    keyTakeaways: [
      'Cambio de plano o zoom rápido en los primeros 1.5 segundos.',
      'Eliminar introducciones lentas tipo "hola chicos".',
      'Usar subtítulos con contraste alto para reproducción en silencio.'
    ],
    category: 'Marketing Digital',
    tags: ['reels', 'retencion', 'hooks', 'algoritmo'],
    estimatedTime: 'Reel 42s',
    authorOrChannel: '@creadordigital_pro',
    userNote: 'Estrategia clave para la campaña de video marketing.',
    createdAt: '2026-09-14T10:30:00.000Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    duplicateCheck: {
      isDuplicateTopic: false,
      similarityScore: 10,
    }
  },
  {
    id: 'santi-link-2',
    userId: 'usr_santi_illescas',
    url: 'https://www.facebook.com/reel/982341234567890',
    originalUrl: 'https://www.facebook.com/reel/982341234567890',
    platform: 'facebook',
    title: 'Estrategia de Anuncios en Reels de Facebook para B2B',
    summary: 'Muestra cómo configurar campañas de anuncios en Reels de Facebook y Meta Advantage+ segmentando a tomadores de decisión mediante formatos de video nativo y demostraciones de software.',
    keyTakeaways: [
      'Formato vertical 9:16 sin bordes negros.',
      'Demostración de producto en los primeros 5 segundos sin logos corporativos aburridos.',
      'Coste por lead reducido un 38% respecto a anuncios estáticos en feed.'
    ],
    category: 'Tecnología e IA',
    tags: ['facebook-ads', 'b2b', 'growth', 'meta'],
    estimatedTime: 'Reel 1 min',
    authorOrChannel: '@growth_mastery',
    userNote: 'Excelente para campañas corporativas y captación B2B.',
    createdAt: '2026-09-13T14:15:00.000Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80',
    duplicateCheck: {
      isDuplicateTopic: false,
      similarityScore: 15,
    }
  }
];

class DatabaseManager {
  private usersCache: UserRecord[] = [];
  private linksCache: LinkRecord[] = [];
  private categoriesCache: CategoryRecord[] = [];
  private resetCodes: Map<string, { code: string; expiresAt: number }> = new Map();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Initialize Users
    if (!fs.existsSync(USERS_FILE)) {
      this.usersCache = [...INITIAL_USERS];
      atomicWriteJson(USERS_FILE, this.usersCache);
    } else {
      try {
        const content = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        this.usersCache = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error reading users from disk:', e);
        this.usersCache = [...INITIAL_USERS];
      }
    }

    // Ensure default admin (Superadministrador) is always in users list
    const adminIndex = this.usersCache.findIndex(
      (u) => u.email.toLowerCase() === 'xxxx@gmaxl.xxx' || u.email.toLowerCase() === 'sillescas2@gmail.com' || u.id === 'usr_santi_illescas'
    );
    if (adminIndex === -1) {
      this.usersCache.unshift(INITIAL_USERS[0]);
      atomicWriteJson(USERS_FILE, this.usersCache);
    } else {
      // Migrate / Keep admin role and update details
      this.usersCache[adminIndex].email = 'xxxx@gmaxl.xxx';
      this.usersCache[adminIndex].fullName = 'Superadministrador';
      this.usersCache[adminIndex].role = 'admin';
      atomicWriteJson(USERS_FILE, this.usersCache);
    }

    // 2. Initialize Links
    if (!fs.existsSync(LINKS_FILE)) {
      this.linksCache = [...INITIAL_SANTI_LINKS];
      atomicWriteJson(LINKS_FILE, this.linksCache);
    } else {
      try {
        const content = fs.readFileSync(LINKS_FILE, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        this.linksCache = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error reading links from disk:', e);
        this.linksCache = [...INITIAL_SANTI_LINKS];
      }
    }

    // Migration: ensure every link has a valid userId
    let modified = false;
    for (const link of this.linksCache) {
      if (!link.userId) {
        link.userId = 'usr_santi_illescas';
        modified = true;
      }
    }

    // Ensure Santi's uploaded reel and essentials exist in database
    for (const initialLink of INITIAL_SANTI_LINKS) {
      const exists = this.linksCache.some((l) => l.id === initialLink.id || l.url === initialLink.url);
      if (!exists) {
        this.linksCache.push(initialLink);
        modified = true;
      }
    }

    if (modified) {
      atomicWriteJson(LINKS_FILE, this.linksCache);
    }

    // 3. Initialize Categories
    const defaultDescriptionsMap: Record<string, string> = {
      'marketing digital': 'Estrategias de marketing, publicidad, ventas, embudos, captación, retención, ganchos (hooks) y redes sociales.',
      'tecnología e ia': 'Inteligencia artificial, software, informática, programación, hardware, redes, routers, wifi y desarrollo técnico.',
      'desarrollo personal': 'Hábitos, mentalidad, crecimiento personal, libros, disciplina, equilibrio vida-trabajo y productividad.',
      'recetas y cocina': 'Recetas de cocina, técnicas culinarias, ingredientes, gastronomía, postres y preparación de comida.',
      'sin categorías': 'Contenido genérico o que no encaja en ninguna otra categoría específica del usuario.',
    };

    if (!fs.existsSync(CATEGORIES_FILE)) {
      this.categoriesCache = [
        { id: 'cat_santi_mkt', userId: 'usr_santi_illescas', name: 'Marketing Digital', color: '#3b82f6', description: defaultDescriptionsMap['marketing digital'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_tech', userId: 'usr_santi_illescas', name: 'Tecnología e IA', color: '#8b5cf6', description: defaultDescriptionsMap['tecnología e ia'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_des', userId: 'usr_santi_illescas', name: 'Desarrollo Personal', color: '#10b981', description: defaultDescriptionsMap['desarrollo personal'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_rec', userId: 'usr_santi_illescas', name: 'Recetas y Cocina', color: '#f59e0b', description: defaultDescriptionsMap['recetas y cocina'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_none', userId: 'usr_santi_illescas', name: 'Sin categorías', color: '#64748b', description: defaultDescriptionsMap['sin categorías'], createdAt: '2025-01-01T00:00:00.000Z' },
      ];
      atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);
    } else {
      try {
        const content = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        this.categoriesCache = Array.isArray(parsed) ? parsed : [];
        // Ensure categories loaded from disk populate description if empty for default categories
        let updatedOnLoad = false;
        for (const cat of this.categoriesCache) {
          if (!cat.description && defaultDescriptionsMap[cat.name.toLowerCase()]) {
            cat.description = defaultDescriptionsMap[cat.name.toLowerCase()];
            updatedOnLoad = true;
          }
        }
        if (updatedOnLoad) {
          atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);
        }
      } catch (e) {
        console.error('Error reading categories from disk:', e);
        this.categoriesCache = [];
      }
    }

    // Ensure Santi always has default categories if missing
    const santiCategories = this.categoriesCache.filter((c) => c.userId === 'usr_santi_illescas');
    if (santiCategories.length === 0) {
      this.categoriesCache.push(
        { id: 'cat_santi_mkt', userId: 'usr_santi_illescas', name: 'Marketing Digital', color: '#3b82f6', description: defaultDescriptionsMap['marketing digital'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_tech', userId: 'usr_santi_illescas', name: 'Tecnología e IA', color: '#8b5cf6', description: defaultDescriptionsMap['tecnología e ia'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_des', userId: 'usr_santi_illescas', name: 'Desarrollo Personal', color: '#10b981', description: defaultDescriptionsMap['desarrollo personal'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_rec', userId: 'usr_santi_illescas', name: 'Recetas y Cocina', color: '#f59e0b', description: defaultDescriptionsMap['recetas y cocina'], createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'cat_santi_none', userId: 'usr_santi_illescas', name: 'Sin categorías', color: '#64748b', description: defaultDescriptionsMap['sin categorías'], createdAt: '2025-01-01T00:00:00.000Z' },
      );
      atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);
    }

    this.isInitialized = true;
    console.log(`✅ Database initialized. Loaded ${this.usersCache.length} users, ${this.linksCache.length} links and ${this.categoriesCache.length} categories.`);
  }

  // ================= USERS OPERATIONS =================
  public getUsers(): UserRecord[] {
    return this.usersCache;
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.usersCache.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    const clean = email.trim().toLowerCase();
    return this.usersCache.find((u) => u.email.toLowerCase() === clean);
  }

  public createUser(userData: {
    email: string;
    fullName: string;
    role?: 'admin' | 'user' | 'editor';
    avatarUrl?: string;
    password?: string;
  }): { success: boolean; user?: UserRecord; error?: string } {
    const cleanEmail = userData.email.trim().toLowerCase();
    if (this.getUserByEmail(cleanEmail)) {
      return { success: false, error: 'Ya existe un usuario con este correo electrónico.' };
    }

    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: cleanEmail,
      fullName: userData.fullName.trim(),
      role: userData.role || (cleanEmail === 'xxxx@gmaxl.xxx' || cleanEmail === 'sillescas2@gmail.com' ? 'admin' : 'user'),
      avatarUrl: userData.avatarUrl || '',
      password: userData.password || '123456',
      createdAt: new Date().toISOString(),
    };

    this.usersCache.push(newUser);
    atomicWriteJson(USERS_FILE, this.usersCache);
    return { success: true, user: newUser };
  }

  public updateUser(
    id: string,
    updates: Partial<UserRecord>
  ): { success: boolean; user?: UserRecord; error?: string } {
    const index = this.usersCache.findIndex((u) => u.id === id);
    if (index === -1) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const existing = this.usersCache[index];
    const isSuperAdmin = existing.email.toLowerCase() === 'xxxx@gmaxl.xxx' || existing.email.toLowerCase() === 'sillescas2@gmail.com';
    const updated: UserRecord = {
      ...existing,
      ...updates,
      id: existing.id, // ID cannot be changed
      email: updates.email ? updates.email.trim().toLowerCase() : existing.email,
      role: isSuperAdmin ? 'admin' : (updates.role || existing.role),
      updatedAt: new Date().toISOString(),
    };

    this.usersCache[index] = updated;
    atomicWriteJson(USERS_FILE, this.usersCache);
    return { success: true, user: updated };
  }

  public deleteUser(id: string): { success: boolean; error?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { success: false, error: 'Usuario no encontrado.' };
    }
    const isSuperAdmin = user.email.toLowerCase() === 'xxxx@gmaxl.xxx' || user.email.toLowerCase() === 'sillescas2@gmail.com';
    if (isSuperAdmin) {
      return { success: false, error: 'No se puede eliminar la cuenta del administrador principal.' };
    }

    this.usersCache = this.usersCache.filter((u) => u.id !== id);
    atomicWriteJson(USERS_FILE, this.usersCache);

    // Also delete user's links
    this.linksCache = this.linksCache.filter((l) => l.userId !== id);
    atomicWriteJson(LINKS_FILE, this.linksCache);

    return { success: true };
  }

  // ================= PASSWORD RECOVERY OPERATIONS =================

  /**
   * Generates a secure 6-digit recovery code for registered users.
   * Ensures the user is registered ("dado de alta") before generating code.
   */
  public generatePasswordResetCode(email: string): {
    success: boolean;
    code?: string;
    expiresAt?: number;
    user?: UserRecord;
    error?: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.getUserByEmail(cleanEmail);
    if (!user) {
      return {
        success: false,
        error: `No existe ninguna cuenta registrada con el correo "${cleanEmail}". Comprueba que esté bien escrito o regístrate.`,
      };
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // Valid for 15 minutes

    this.resetCodes.set(cleanEmail, { code, expiresAt });

    return {
      success: true,
      code,
      expiresAt,
      user,
    };
  }

  /**
   * Verifies the recovery code and updates the user's password.
   */
  public verifyAndResetPassword(
    email: string,
    code: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = (code || '').trim();
    const cleanPassword = (newPassword || '').trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    const user = this.getUserByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'No se encontró ningún usuario dado de alta con este correo.' };
    }

    const record = this.resetCodes.get(cleanEmail);
    if (!record) {
      return {
        success: false,
        error: 'No hay ninguna solicitud de recuperación activa para este correo o el código ha caducado. Solicita uno nuevo.',
      };
    }

    if (Date.now() > record.expiresAt) {
      this.resetCodes.delete(cleanEmail);
      return {
        success: false,
        error: 'El código de recuperación ha expirado. Por favor solicita uno nuevo.',
      };
    }

    if (record.code !== cleanCode) {
      return {
        success: false,
        error: 'El código de recuperación es incorrecto. Verifica los 6 dígitos introducidos.',
      };
    }

    // Update user password
    const updateResult = this.updateUser(user.id, { password: cleanPassword });
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Error al guardar la nueva contraseña.' };
    }

    // Invalidate code after successful reset
    this.resetCodes.delete(cleanEmail);
    return { success: true };
  }

  // ================= LINKS / REELS OPERATIONS (STRICT USER ISOLATION) =================

  /**
   * Retrieves all links belonging ONLY to the specified user.
   * Strict privacy: User A cannot see User B's reels.
   */
  public getLinksForUser(userId: string): LinkRecord[] {
    if (!userId) return [];
    return this.linksCache.filter((l) => l.userId === userId);
  }

  /**
   * Admin-only overview of all links count or stats
   */
  public getAllLinksAdmin(): LinkRecord[] {
    return this.linksCache;
  }

  public getLinkById(id: string, userId?: string): LinkRecord | undefined {
    const link = this.linksCache.find((l) => l.id === id);
    if (!link) return undefined;
    if (userId && link.userId !== userId) {
      return undefined; // unauthorized access
    }
    return link;
  }

  public saveLink(item: Omit<LinkRecord, 'id'> & { id?: string }): {
    success: boolean;
    data: LinkRecord;
    isUpdated: boolean;
  } {
    if (!item.userId) {
      throw new Error('userId is strictly required for link persistence');
    }

    const cleanUrl = item.url.trim().toLowerCase().replace(/\/+$/, '');

    // Check if the same user already has this exact URL
    const existingIndex = this.linksCache.findIndex(
      (l) => l.userId === item.userId && (l.url.toLowerCase().replace(/\/+$/, '') === cleanUrl || (l.originalUrl && l.originalUrl.toLowerCase().replace(/\/+$/, '') === cleanUrl))
    );

    if (existingIndex >= 0) {
      // Update existing item for this user
      const existing = this.linksCache[existingIndex];
      const updated: LinkRecord = {
        ...existing,
        ...item,
        id: existing.id,
        userId: item.userId,
        updatedAt: new Date().toISOString(),
      };
      this.linksCache[existingIndex] = updated;
      atomicWriteJson(LINKS_FILE, this.linksCache);
      return { success: true, data: updated, isUpdated: true };
    }

    const newRecord: LinkRecord = {
      ...item,
      id: item.id || `link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: item.userId,
      originalUrl: item.originalUrl || item.url,
      createdAt: item.createdAt || new Date().toISOString(),
    };

    this.linksCache.unshift(newRecord);
    atomicWriteJson(LINKS_FILE, this.linksCache);
    return { success: true, data: newRecord, isUpdated: false };
  }

  public updateLink(
    id: string,
    updates: Partial<LinkRecord>,
    userId: string
  ): { success: boolean; data?: LinkRecord; error?: string } {
    const index = this.linksCache.findIndex((l) => l.id === id);
    if (index === -1) {
      return { success: false, error: 'Enlace no encontrado en la base de datos.' };
    }

    const existing = this.linksCache[index];
    // Strict ownership verification
    if (existing.userId !== userId) {
      return { success: false, error: 'Acceso denegado: no tienes permiso para editar este contenido.' };
    }

    const updated: LinkRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId, // Ownership cannot be hijacked
      updatedAt: new Date().toISOString(),
    };

    this.linksCache[index] = updated;
    atomicWriteJson(LINKS_FILE, this.linksCache);
    return { success: true, data: updated };
  }

  public deleteLink(
    id: string,
    userId: string
  ): { success: boolean; error?: string } {
    const index = this.linksCache.findIndex((l) => l.id === id);
    if (index === -1) {
      return { success: false, error: 'Enlace no encontrado.' };
    }

    const existing = this.linksCache[index];
    if (existing.userId !== userId) {
      return { success: false, error: 'Acceso denegado: no tienes permiso para eliminar este enlace.' };
    }

    this.linksCache.splice(index, 1);
    atomicWriteJson(LINKS_FILE, this.linksCache);
    return { success: true };
  }

  public bulkSync(items: LinkRecord[], userId: string): { success: boolean; added: number; updated: number } {
    let added = 0;
    let updated = 0;

    for (const item of items) {
      if (!item || !item.url) continue;
      const cleanUrl = item.url.trim().toLowerCase().replace(/\/+$/, '');
      const existingIdx = this.linksCache.findIndex(
        (l) => l.userId === userId && (l.url.toLowerCase().replace(/\/+$/, '') === cleanUrl || l.id === item.id)
      );

      if (existingIdx >= 0) {
        this.linksCache[existingIdx] = {
          ...this.linksCache[existingIdx],
          ...item,
          userId,
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else {
        this.linksCache.unshift({
          ...item,
          id: item.id || `link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId,
          createdAt: item.createdAt || new Date().toISOString(),
        });
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      atomicWriteJson(LINKS_FILE, this.linksCache);
    }

    return { success: true, added, updated };
  }

  // ================= CATEGORIES OPERATIONS =================

  /**
   * Returns all categories for the given user.
   * If user has no categories, auto-initializes the default "Sin categorías".
   */
  public getCategoriesForUser(userId: string): CategoryRecord[] {
    if (!userId) return [];
    let userCategories = this.categoriesCache.filter((c) => c.userId === userId);

    if (userCategories.length === 0) {
      // Default for any new user: "Sin categorías"
      const defaultCategory: CategoryRecord = {
        id: `cat_${userId}_default`,
        userId,
        name: DEFAULT_CATEGORY_NAME,
        color: DEFAULT_CATEGORY_COLOR,
        createdAt: new Date().toISOString(),
      };
      this.categoriesCache.push(defaultCategory);
      atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);
      userCategories = [defaultCategory];
    }

    return userCategories;
  }

  /**
   * Create a new category for a user.
   * Enforces unique name per user (case-insensitive).
   */
  public createCategory(
    userId: string,
    name: string,
    color: string,
    description?: string
  ): { success: boolean; data?: CategoryRecord; error?: string } {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado.' };
    }
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'El nombre de la categoría no puede estar vacío.' };
    }

    const cleanColor = (color || '').trim() || DEFAULT_CATEGORY_COLOR;
    const cleanDescription = (description !== undefined ? description : '').trim();

    // Check duplicate name for this user
    const exists = this.categoriesCache.some(
      (c) => c.userId === userId && c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `Ya existe una categoría llamada "${cleanName}".` };
    }

    const newCategory: CategoryRecord = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: cleanName,
      color: cleanColor,
      description: cleanDescription,
      createdAt: new Date().toISOString(),
    };

    this.categoriesCache.push(newCategory);
    atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);

    return { success: true, data: newCategory };
  }

  /**
   * Update category name, color or description.
   * If name changes, cascade-update all user's links that used the old name.
   */
  public updateCategory(
    userId: string,
    categoryId: string,
    updates: { name?: string; color?: string; description?: string }
  ): { success: boolean; data?: CategoryRecord; reassignedLinksCount?: number; error?: string } {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado.' };
    }

    const index = this.categoriesCache.findIndex((c) => c.id === categoryId && c.userId === userId);
    if (index === -1) {
      return { success: false, error: 'Categoría no encontrada.' };
    }

    const current = this.categoriesCache[index];
    const oldName = current.name;
    const newName = updates.name !== undefined ? updates.name.trim() : current.name;
    const newColor = updates.color !== undefined ? updates.color.trim() : current.color;
    const newDescription = updates.description !== undefined ? updates.description.trim() : (current.description || '');

    if (!newName) {
      return { success: false, error: 'El nombre de la categoría no puede estar vacío.' };
    }

    // Check uniqueness if name changed
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicate = this.categoriesCache.some(
        (c) => c.userId === userId && c.id !== categoryId && c.name.toLowerCase() === newName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: `Ya existe otra categoría con el nombre "${newName}".` };
      }
    }

    const updated: CategoryRecord = {
      ...current,
      name: newName,
      color: newColor || current.color,
      description: newDescription,
    };
    this.categoriesCache[index] = updated;
    atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);

    // Cascade link category update if name changed
    let reassignedLinksCount = 0;
    if (newName !== oldName) {
      for (const link of this.linksCache) {
        if (link.userId === userId && link.category === oldName) {
          link.category = newName;
          link.updatedAt = new Date().toISOString();
          reassignedLinksCount++;
        }
      }
      if (reassignedLinksCount > 0) {
        atomicWriteJson(LINKS_FILE, this.linksCache);
      }
    }

    return { success: true, data: updated, reassignedLinksCount };
  }

  /**
   * Delete category.
   * If links used this category, automatically reassign them to "Sin categorías" so content is not lost.
   */
  public deleteCategory(
    userId: string,
    categoryId: string
  ): { success: boolean; reassignedLinksCount?: number; error?: string } {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado.' };
    }

    const categoryToDelete = this.categoriesCache.find((c) => c.id === categoryId && c.userId === userId);
    if (!categoryToDelete) {
      return { success: false, error: 'Categoría no encontrada.' };
    }

    const userCategories = this.categoriesCache.filter((c) => c.userId === userId);
    if (userCategories.length <= 1) {
      return { success: false, error: 'No puedes eliminar la única categoría que tienes dada de alta.' };
    }

    // Ensure fallback "Sin categorías" exists for this user
    let defaultCat = this.categoriesCache.find(
      (c) => c.userId === userId && c.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()
    );
    if (!defaultCat) {
      defaultCat = {
        id: `cat_${userId}_default_${Date.now()}`,
        userId,
        name: DEFAULT_CATEGORY_NAME,
        color: DEFAULT_CATEGORY_COLOR,
        createdAt: new Date().toISOString(),
      };
      this.categoriesCache.push(defaultCat);
    }

    // Reassign any links of this user that were under the deleted category
    let reassignedLinksCount = 0;
    for (const link of this.linksCache) {
      if (link.userId === userId && link.category === categoryToDelete.name) {
        link.category = defaultCat.name;
        link.updatedAt = new Date().toISOString();
        reassignedLinksCount++;
      }
    }
    if (reassignedLinksCount > 0) {
      atomicWriteJson(LINKS_FILE, this.linksCache);
    }

    // Remove category
    this.categoriesCache = this.categoriesCache.filter((c) => c.id !== categoryId);
    atomicWriteJson(CATEGORIES_FILE, this.categoriesCache);

    return { success: true, reassignedLinksCount };
  }
}

export const db = new DatabaseManager();

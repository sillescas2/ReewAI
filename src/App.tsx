import React, { useState, useEffect, useMemo } from 'react';
import { SavedLinkItem, PlatformType, CategoryItem } from './types';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { LinksTable } from './components/LinksTable';
import { CardsView } from './components/CardsView';
import { AddLinkModal } from './components/AddLinkModal';
import { LinkDetailModal } from './components/LinkDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthModal } from './components/AuthModal';
import { SupabaseModal } from './components/SupabaseModal';
import { AuthLandingScreen } from './components/AuthLandingScreen';
import { EditProfileModal } from './components/EditProfileModal';
import { UsersManagementView } from './components/UsersManagementView';
import { SettingsView } from './components/SettingsView';
import { useAuth } from './context/AuthContext';
import { USER_SAMPLE_DATA } from './data/sampleData';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient';
import { DatabaseService } from './services/dbService';
import { APP_VERSION } from './constants/version';
import {
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const { user, isLoading: isAuthLoading, isSupabase } = useAuth();
  const [items, setItems] = useState<SavedLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncVersion, setSyncVersion] = useState(0);
  const [importToastMessage, setImportToastMessage] = useState<string | null>(null);

  // Current Screen / View Navigation
  const [currentView, setCurrentView] = useState<'links' | 'users' | 'settings'>('links');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('reewai_view_mode') : null;
    return (saved === 'table' || saved === 'cards') ? saved : 'cards';
  });

  const handleViewModeChange = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem('reewai_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sharedUrl, setSharedUrl] = useState('');
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<SavedLinkItem | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<SavedLinkItem | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // User's custom categories (Name and Color)
  const [userCategories, setUserCategories] = useState<CategoryItem[]>([]);

  // Load categories whenever user changes or sync happens
  useEffect(() => {
    async function loadUserCategories() {
      if (!user) {
        setUserCategories([]);
        return;
      }

      // Fast local cache load (0ms instant display)
      try {
        const cached = localStorage.getItem(`reewai_categories_${user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUserCategories(parsed);
          }
        }
      } catch {}

      try {
        const res = await DatabaseService.fetchCategories(user.id);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setUserCategories(res.data);
        }
      } catch (err) {
        console.warn('Could not load user categories:', err);
      }
    }
    loadUserCategories();
  }, [user?.id, syncVersion]);

  // Detect incoming PWA Web Share Target parameters (e.g. from Instagram / Facebook share)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url') || '';
      const textParam = params.get('text') || '';
      const titleParam = params.get('title') || '';

      let foundUrl = '';
      const rawCombined = `${urlParam} ${textParam} ${titleParam}`;
      const urlMatch = rawCombined.match(/(https?:\/\/[^\s]+)/i);

      if (urlMatch && urlMatch[1]) {
        foundUrl = urlMatch[1];
      } else if (urlParam && urlParam.startsWith('http')) {
        foundUrl = urlParam;
      }

      if (foundUrl) {
        setSharedUrl(foundUrl);
        setIsAddModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('Could not parse share target URL:', e);
    }
  }, []);

  // Load items isolated per active user with Database-First architecture
  useEffect(() => {
    async function loadUserData() {
      if (!user) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      const userStorageKey = `reewai_items_${user.id}`;

      // 1. FAST LOCAL CACHE LOAD (Instant 0ms display for high speed)
      let localCachedItems: SavedLinkItem[] = [];
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localCachedItems = parsed;
            setItems(parsed);
            setIsLoading(false);
          }
        } catch {
          // fallback
        }
      }

      // If no local cache yet, check sample data for initial member experience
      if (localCachedItems.length === 0 && USER_SAMPLE_DATA[user.id]) {
        localCachedItems = USER_SAMPLE_DATA[user.id];
        setItems(localCachedItems);
        localStorage.setItem(userStorageKey, JSON.stringify(localCachedItems));
        setIsLoading(false);
      }

      // 2. AUTHORITATIVE CENTRAL DATABASE SYNC
      try {
        // Priority A: If Supabase is active, fetch from PostgreSQL
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data, error } = await supabase
              .from('saved_links')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
              const mapped: SavedLinkItem[] = data.map((d: any) => ({
                id: d.id,
                userId: d.user_id,
                url: d.url,
                originalUrl: d.url,
                platform: d.platform,
                title: d.title,
                summary: d.summary,
                keyTakeaways: Array.isArray(d.key_takeaways) ? d.key_takeaways : [],
                category: d.category || 'General',
                tags: Array.isArray(d.tags) ? d.tags : [],
                estimatedTime: d.estimated_time,
                authorOrChannel: d.author_or_channel,
                thumbnailUrl: d.thumbnail_url,
                userNote: d.user_note,
                createdAt: d.created_at,
                updatedAt: d.updated_at,
                duplicateCheck: d.duplicate_check,
              }));
              setItems(mapped);
              localStorage.setItem(userStorageKey, JSON.stringify(mapped));
              setIsLoading(false);
              return;
            }
          }
        }

        // Priority B: Central Database API (/api/links?userId=...)
        const dbResult = await DatabaseService.fetchUserLinks(user.id);
        if (dbResult.success && Array.isArray(dbResult.data)) {
          if (dbResult.data.length > 0) {
            // Found user's links in central database (including reels uploaded from phone!)
            setItems(dbResult.data);
            localStorage.setItem(userStorageKey, JSON.stringify(dbResult.data));
          } else if (localCachedItems.length > 0) {
            // Central database was empty for this user, but local device had items: auto-sync to DB!
            console.log('Syncing initial items to central database for user:', user.id);
            const syncRes = await DatabaseService.syncBatch(localCachedItems, user.id);
            if (syncRes.success) {
              setItems(localCachedItems);
              localStorage.setItem(userStorageKey, JSON.stringify(localCachedItems));
            }
          }
        }
      } catch (err) {
        console.warn('Central database sync notice:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [user?.id, isSupabase, syncVersion]);

  // Save changes to current user's local persistence
  const persistUserItems = (newItems: SavedLinkItem[]) => {
    setItems(newItems);
    if (user?.id) {
      localStorage.setItem(`reewai_items_${user.id}`, JSON.stringify(newItems));
    }
  };

  // Add new link handler - Central Database First
  const handleSaveItem = async (newItem: SavedLinkItem) => {
    if (!user) return;
    const itemWithUser: SavedLinkItem = {
      ...newItem,
      userId: user.id,
    };

    // 1. Optimistic UI update for 0ms delay
    const updated = [itemWithUser, ...items.filter((i) => i.id !== itemWithUser.id)];
    persistUserItems(updated);

    // 2. Persist to Central Database (PRIMARY)
    try {
      const dbSaveRes = await DatabaseService.saveLink(itemWithUser, user.id);
      if (dbSaveRes.success && dbSaveRes.data) {
        const reconciled = [
          dbSaveRes.data,
          ...items.filter((i) => i.id !== itemWithUser.id && i.id !== dbSaveRes.data!.id),
        ];
        persistUserItems(reconciled);
      }
    } catch (err) {
      console.error('Error saving link to central database:', err);
    }

    // 3. If Supabase is active, persist directly to PostgreSQL as well
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('saved_links').upsert({
            id: itemWithUser.id,
            user_id: user.id,
            url: itemWithUser.url,
            platform: itemWithUser.platform,
            title: itemWithUser.title,
            summary: itemWithUser.summary,
            key_takeaways: itemWithUser.keyTakeaways,
            category: itemWithUser.category,
            tags: itemWithUser.tags,
            estimated_time: itemWithUser.estimatedTime,
            author_or_channel: itemWithUser.authorOrChannel,
            thumbnail_url: itemWithUser.thumbnailUrl,
            user_note: itemWithUser.userNote,
            duplicate_check: itemWithUser.duplicateCheck || {},
          });
        } catch (err) {
          console.error('Supabase save error:', err);
        }
      }
    }
  };

  // Delete link handler - Central Database First
  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    const updated = items.filter((i) => i.id !== id);
    persistUserItems(updated);

    if (selectedItemForDetail?.id === id) {
      setSelectedItemForDetail(null);
    }

    // 1. Central Database Delete
    try {
      await DatabaseService.deleteLink(id, user.id);
    } catch (err) {
      console.error('Error deleting link from central database:', err);
    }

    // 2. Supabase delete
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('saved_links').delete().eq('id', id);
        } catch (e) {
          console.error('Supabase delete error:', e);
        }
      }
    }
  };

  // Update item handler (for note, category, title, summary, etc.) - Central Database First
  const handleUpdateItem = async (
    id: string,
    updates: { userNote?: string; category?: string; title?: string; summary?: string }
  ) => {
    if (!user) return;
    const updated = items.map((i) => (i.id === id ? { ...i, ...updates } : i));
    persistUserItems(updated);

    if (selectedItemForDetail?.id === id) {
      setSelectedItemForDetail({ ...selectedItemForDetail, ...updates });
    }

    // 1. Central Database update
    try {
      await DatabaseService.updateLink(id, updates, user.id);
    } catch (err) {
      console.error('Error updating item on central database:', err);
    }

    // 2. Supabase update
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const supaUpdates: Record<string, any> = {};
          if (updates.userNote !== undefined) supaUpdates.user_note = updates.userNote;
          if (updates.category !== undefined) supaUpdates.category = updates.category;
          if (updates.title !== undefined) supaUpdates.title = updates.title;
          if (updates.summary !== undefined) supaUpdates.summary = updates.summary;

          if (Object.keys(supaUpdates).length > 0) {
            await supabase.from('saved_links').update(supaUpdates).eq('id', id);
          }
        } catch (e) {
          console.error('Supabase item update error:', e);
        }
      }
    }
  };

  // Update note handler (backwards-compatible wrapper)
  const handleUpdateNote = async (id: string, newNote: string) => {
    await handleUpdateItem(id, { userNote: newNote });
  };

  // Export collection as JSON
  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `reewai_links_${user?.fullName || 'usuario'}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import collection from JSON (synchronize backup from mobile to desktop or vice-versa)
  const handleImportData = (importedList: any[]) => {
    if (!user) return;
    try {
      let addedCount = 0;
      const currentUrls = new Set(items.map((i) => (i.originalUrl || i.url).toLowerCase().trim()));
      const currentIds = new Set(items.map((i) => i.id));
      const newItemsToAdd: SavedLinkItem[] = [];

      for (const raw of importedList) {
        if (!raw || (!raw.url && !raw.originalUrl) || !raw.title) continue;
        const finalUrl = raw.originalUrl || raw.url;
        const cleanUrl = finalUrl.toLowerCase().trim();
        const cleanId = raw.id || `link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        if (currentUrls.has(cleanUrl) || currentIds.has(cleanId)) {
          continue;
        }

        const validItem: SavedLinkItem = {
          id: cleanId,
          userId: user.id,
          url: finalUrl,
          originalUrl: finalUrl,
          platform: raw.platform || 'web',
          title: raw.title,
          summary: raw.summary || '',
          keyTakeaways: Array.isArray(raw.keyTakeaways) ? raw.keyTakeaways : [],
          category: raw.category || 'General',
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          estimatedTime: raw.estimatedTime || 'Lectura',
          authorOrChannel: raw.authorOrChannel,
          thumbnailUrl: raw.thumbnailUrl,
          userNote: raw.userNote,
          createdAt: raw.createdAt || new Date().toISOString(),
          duplicateCheck: raw.duplicateCheck || { isDuplicateTopic: false, similarityScore: 0 },
          isExactDuplicateOf: raw.isExactDuplicateOf,
        };

        newItemsToAdd.push(validItem);
        currentUrls.add(cleanUrl);
        currentIds.add(cleanId);
        addedCount++;
      }

      if (addedCount > 0) {
        const merged = [...newItemsToAdd, ...items];
        setItems(merged);
        localStorage.setItem(`reewai_items_${user.id}`, JSON.stringify(merged));

        // Sync to central database
        DatabaseService.syncBatch(newItemsToAdd, user.id).catch((err) => {
          console.warn('Central database batch sync notice:', err);
        });

        // If Supabase is active, also persist to PostgreSQL
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const records = newItemsToAdd.map((it) => ({
              id: it.id,
              user_id: user.id,
              url: it.url,
              platform: it.platform,
              title: it.title,
              summary: it.summary,
              key_takeaways: it.keyTakeaways,
              category: it.category,
              tags: it.tags,
              estimated_time: it.estimatedTime,
              author_or_channel: it.authorOrChannel || null,
              thumbnail_url: it.thumbnailUrl || null,
              user_note: it.userNote || null,
              duplicate_check: it.duplicateCheck || {},
            }));
            supabase.from('saved_links').upsert(records).then(({ error }) => {
              if (error) console.error('Error importing to Supabase:', error);
            });
          }
        }
        setImportToastMessage(`¡${addedCount} enlace(s) importado(s) con éxito!`);
        setTimeout(() => setImportToastMessage(null), 4000);
      } else {
        setImportToastMessage('Todos los enlaces del archivo ya existían en tu biblioteca.');
        setTimeout(() => setImportToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error processing JSON file:', err);
      setImportToastMessage('Error al procesar el archivo JSON.');
      setTimeout(() => setImportToastMessage(null), 3000);
    }
  };

  // Upload local items from this browser to cloud Supabase
  const handleUploadLocalToCloud = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!user) return { success: false, count: 0, error: 'No hay usuario autenticado.' };
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, count: 0, error: 'Supabase no está configurado.' };

    const userStorageKey = `reewai_items_${user.id}`;
    const cached = localStorage.getItem(userStorageKey);
    const localList: SavedLinkItem[] = cached ? JSON.parse(cached) : items;

    if (!localList || localList.length === 0) {
      return { success: false, count: 0, error: 'No hay enlaces locales para subir.' };
    }

    try {
      const recordsToUpsert = localList.map((it) => ({
        id: it.id,
        user_id: user.id,
        url: it.url,
        platform: it.platform,
        title: it.title,
        summary: it.summary,
        key_takeaways: it.keyTakeaways || [],
        category: it.category || 'General',
        tags: it.tags || [],
        estimated_time: it.estimatedTime || 'Lectura',
        author_or_channel: it.authorOrChannel || null,
        thumbnail_url: it.thumbnailUrl || null,
        user_note: it.userNote || null,
        duplicate_check: it.duplicateCheck || {},
      }));

      const { error } = await supabase.from('saved_links').upsert(recordsToUpsert);
      if (error) {
        console.error('Error uploading to Supabase:', error);
        return { success: false, count: 0, error: error.message };
      }

      setSyncVersion((v) => v + 1);
      return { success: true, count: recordsToUpsert.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Error al conectar con la base de datos.' };
    }
  };

  // Category Management CRUD Handlers
  const handleAddCategory = async (name: string, color: string, description?: string) => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    const res = await DatabaseService.createCategory(user.id, name, color, description);
    if (res.success && res.data) {
      setUserCategories((prev) => {
        const withoutDuplicate = prev.filter(
          (c) => c.id !== res.data!.id && c.name.toLowerCase() !== res.data!.name.toLowerCase()
        );
        return [...withoutDuplicate, res.data!];
      });
      return { success: true };
    }
    return { success: false, error: res.error || 'Error al crear la categoría' };
  };

  const handleUpdateCategory = async (id: string, name: string, color: string, description?: string) => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    const oldCat = userCategories.find((c) => c.id === id);
    const oldName = oldCat?.name;

    const res = await DatabaseService.updateCategory(user.id, id, { name, color, description });
    if (res.success && res.data) {
      setUserCategories((prev) => prev.map((c) => (c.id === id ? res.data! : c)));

      // If category name changed, cascade rename across links in state & localStorage
      if (oldName && oldName.toLowerCase() !== name.toLowerCase()) {
        const updated = items.map((it) =>
          it.category.toLowerCase() === oldName.toLowerCase() ? { ...it, category: name } : it
        );
        persistUserItems(updated);
      }
      return { success: true, reassignedLinksCount: res.reassignedLinksCount };
    }
    return { success: false, error: res.error || 'Error al actualizar la categoría' };
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    const catToDelete = userCategories.find((c) => c.id === id);
    const deletedName = catToDelete?.name;

    const res = await DatabaseService.deleteCategory(user.id, id);
    if (res.success) {
      setUserCategories((prev) => prev.filter((c) => c.id !== id));

      // Reassign affected links in state & localStorage to "Sin categorías"
      if (deletedName) {
        const updated = items.map((it) =>
          it.category.toLowerCase() === deletedName.toLowerCase() ? { ...it, category: 'Sin categorías' } : it
        );
        persistUserItems(updated);
      }
      return { success: true, reassignedLinksCount: res.reassignedLinksCount };
    }
    return { success: false, error: res.error || 'Error al eliminar la categoría' };
  };

  // Extract unique categories (combining configured categories and any legacy item categories)
  const categories = useMemo(() => {
    const list: string[] = [];
    userCategories.forEach((c) => {
      if (!list.includes(c.name)) list.push(c.name);
    });
    items.forEach((item) => {
      if (item.category && !list.includes(item.category)) {
        list.push(item.category);
      }
    });
    if (list.length === 0) {
      list.push('Sin categorías');
    }
    return list;
  }, [userCategories, items]);

  // Color lookup map for badges and labels
  const categoryColors = useMemo(() => {
    const map: Record<string, string> = {};
    userCategories.forEach((c) => {
      map[c.name] = c.color;
    });
    return map;
  }, [userCategories]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedPlatform !== 'all' && item.platform !== selectedPlatform) {
        return false;
      }

      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      if (filterDuplicateOnly) {
        const hasDup = item.duplicateCheck?.isDuplicateTopic || item.isExactDuplicateOf;
        if (!hasDup) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = item.summary.toLowerCase().includes(q);
        const inUrl = (item.originalUrl || item.url).toLowerCase().includes(q);
        const inAuthor = (item.authorOrChannel || '').toLowerCase().includes(q);
        const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const inCategory = item.category.toLowerCase().includes(q);
        const inNote = (item.userNote || '').toLowerCase().includes(q);

        if (!inTitle && !inSummary && !inUrl && !inAuthor && !inTags && !inCategory && !inNote) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedPlatform, selectedCategory, filterDuplicateOnly, searchQuery]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-neutral-500 font-medium">Iniciando ReewAI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <AuthLandingScreen
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />
        <SupabaseModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
        />
        <OfflineIndicator />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation */}
      <Navbar
        items={items}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        filterDuplicateOnly={filterDuplicateOnly}
        onToggleDuplicateFilter={() => setFilterDuplicateOnly(!filterDuplicateOnly)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenEditProfile={() => setIsEditProfileModalOpen(true)}
        onOpenUsersManagement={() => setCurrentView('users')}
        onOpenSettings={() => setCurrentView('settings')}
      />

      {/* Floating Toast Notification for Imports */}
      {importToastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-neutral-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importToastMessage}</span>
        </div>
      )}

      {/* Main View Router */}
      {currentView === 'settings' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-32 sm:pb-36 lg:pb-32">
          <SettingsView
            onBack={() => setCurrentView('links')}
            categories={userCategories}
            savedLinks={items}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
          />
          {/* Bottom safety clearance for fixed badges */}
          <div className="h-16 w-full pointer-events-none" aria-hidden="true" />
        </main>
      ) : currentView === 'users' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-32 sm:pb-36 lg:pb-32">
          <UsersManagementView onBack={() => setCurrentView('links')} />
          {/* Bottom safety clearance for fixed badges (e.g. Powered by Netlify) */}
          <div className="h-16 w-full pointer-events-none" aria-hidden="true" />
        </main>
      ) : (
        <>
          {/* Filter and Search Controls */}
          <StatsBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedPlatform={selectedPlatform}
            onPlatformChange={setSelectedPlatform}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={categories}
            categoryColors={categoryColors}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            filterDuplicateOnly={filterDuplicateOnly}
            onToggleDuplicateFilter={() => setFilterDuplicateOnly(!filterDuplicateOnly)}
            totalFilteredCount={filteredItems.length}
            totalAllCount={items.length}
            onExportData={handleExportData}
            onImportData={handleImportData}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-32 sm:pb-40 lg:pb-32 space-y-5">
            {/* Active duplicate filter banner if toggled */}
            {filterDuplicateOnly && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Mostrando únicamente enlaces de <strong>{user?.fullName}</strong> con temas duplicados o URLs repetidas ({filteredItems.length}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterDuplicateOnly(false)}
                  className="font-semibold underline hover:text-amber-950 cursor-pointer"
                >
                  Ver todos los enlaces
                </button>
              </div>
            )}

            {/* View Switcher: Table View vs Cards View */}
            {isLoading ? (
              <div className="py-20 text-center text-neutral-400 text-sm">
                Cargando enlaces guardados de {user?.fullName || 'tu cuenta'}...
              </div>
            ) : viewMode === 'table' ? (
              <LinksTable
                items={filteredItems}
                onSelectItem={(item) => setSelectedItemForDetail(item)}
                onDeleteItem={handleDeleteItem}
                onRequestDelete={(item) => setItemPendingDelete(item)}
                categoryColors={categoryColors}
              />
            ) : (
              <CardsView
                items={filteredItems}
                onSelectItem={(item) => setSelectedItemForDetail(item)}
                onDeleteItem={handleDeleteItem}
                onRequestDelete={(item) => setItemPendingDelete(item)}
                categoryColors={categoryColors}
              />
            )}

            {/* Discreet Page Footer with Version */}
            <footer className="pt-6 pb-2 border-t border-neutral-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-500">ReewAI</span>
                <span>•</span>
                <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200/70">
                  {APP_VERSION}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-[11px] text-neutral-400">Reel & Web Saver AI</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span>{filteredItems.length} {filteredItems.length === 1 ? 'enlace' : 'enlaces'}</span>
                <span>•</span>
                <span className="text-neutral-500 font-medium">{user.fullName}</span>
              </div>
            </footer>

            {/* Bottom safety clearance so floating badges (e.g. Powered by Netlify on mobile) never cover the last card */}
            <div className="h-16 sm:h-20 w-full pointer-events-none" aria-hidden="true" />
          </main>
        </>
      )}

      {/* Modals & Offline Indicator */}
      <AddLinkModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSharedUrl('');
        }}
        onSaveItem={handleSaveItem}
        existingItems={items}
        initialUrl={sharedUrl}
        categories={userCategories}
      />

      {selectedItemForDetail && (
        <LinkDetailModal
          item={selectedItemForDetail}
          onClose={() => setSelectedItemForDetail(null)}
          onDeleteItem={handleDeleteItem}
          onUpdateNote={handleUpdateNote}
          onUpdateItem={handleUpdateItem}
          onNavigateToItem={(target) => setSelectedItemForDetail(target)}
          allItems={items}
          categories={userCategories}
          categoryColors={categoryColors}
        />
      )}

      {/* Delete Confirmation Dialog - Infaliable & Accessible */}
      <DeleteConfirmModal
        isOpen={!!itemPendingDelete}
        title={itemPendingDelete?.title || ''}
        onConfirm={() => {
          if (itemPendingDelete) {
            handleDeleteItem(itemPendingDelete.id);
            setItemPendingDelete(null);
          }
        }}
        onCancel={() => setItemPendingDelete(null)}
      />

      {/* User Profile Edit Modal */}
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
      />

      {/* Multi-User Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenSupabaseGuide={() => setIsSupabaseModalOpen(true)}
      />

      {/* Supabase SQL and Setup Guide Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        localItems={items}
        onUploadLocalToCloud={handleUploadLocalToCloud}
        onConnectionChange={() => setSyncVersion((v) => v + 1)}
      />

      <OfflineIndicator />
    </div>
  );
}

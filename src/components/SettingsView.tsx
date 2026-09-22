import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Settings,
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  Database,
  AlertCircle,
  Folder,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  Palette,
  KeyRound,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CategoryItem, SavedLinkItem } from '../types';
import { APP_VERSION } from '../constants/version';
import { useAiStatus } from '../services/aiStatusService';
import { AdminGeminiKeySection } from './AdminGeminiKeySection';

interface SettingsViewProps {
  onBack: () => void;
  categories: CategoryItem[];
  savedLinks: SavedLinkItem[];
  onAddCategory: (name: string, color: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateCategory: (id: string, name: string, color: string, description?: string) => Promise<{ success: boolean; reassignedLinksCount?: number; error?: string }>;
  onDeleteCategory: (id: string) => Promise<{ success: boolean; reassignedLinksCount?: number; error?: string }>;
  onOpenGeminiGuide?: () => void;
}

const PRESET_COLORS = [
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Violeta', hex: '#8b5cf6' },
  { name: 'Púrpura', hex: '#a855f7' },
  { name: 'Fucsia', hex: '#d946ef' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Rojo Carmesí', hex: '#ef4444' },
  { name: 'Naranja', hex: '#f97316' },
  { name: 'Ámbar', hex: '#f59e0b' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Verde Azulado', hex: '#14b8a6' },
  { name: 'Cian', hex: '#06b6d4' },
  { name: 'Azul Eléctrico', hex: '#3b82f6' },
  { name: 'Azul Marino', hex: '#1d4ed8' },
  { name: 'Pizarra', hex: '#64748b' },
  { name: 'Gris Oscuro', hex: '#334155' },
  { name: 'Grafito', hex: '#1e293b' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  categories,
  savedLinks,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onOpenGeminiGuide,
}) => {
  const { user } = useAuth();
  const { status: aiStatus, loading: aiStatusLoading, refreshStatus: refreshAiStatus, isKeyConfigured, isKeyMissing } = useAiStatus();
  const [copiedVarName, setCopiedVarName] = useState(false);

  const handleCopyVar = () => {
    navigator.clipboard.writeText('GEMINI_API_KEY');
    setCopiedVarName(true);
    setTimeout(() => setCopiedVarName(false), 2000);
  };

  // Create form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete modal state
  const [deletingCategory, setDeletingCategory] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Supabase SQL copy state
  const [copiedSql, setCopiedSql] = useState(false);

  // Calculate links count per category
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const link of savedLinks) {
      const cat = link.category || 'Sin categorías';
      map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [savedLinks]);

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    const cleanName = newCatName.trim();
    if (!cleanName) {
      setCreateError('Por favor ingresa un nombre para la categoría.');
      return;
    }

    // Check duplicate
    const exists = categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      setCreateError(`Ya tienes una categoría llamada "${cleanName}".`);
      return;
    }

    setIsCreating(true);
    const result = await onAddCategory(cleanName, newCatColor, newCatDescription.trim());
    setIsCreating(false);

    if (result.success) {
      setCreateSuccess(`Categoría "${cleanName}" dada de alta correctamente.`);
      setNewCatName('');
      setNewCatDescription('');
      setTimeout(() => setCreateSuccess(''), 3500);
    } else {
      setCreateError(result.error || 'Error al guardar la categoría.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditColor(cat.color || '#6366f1');
    setEditDescription(cat.description || '');
    setEditError('');
  };

  // Submit Edit Category
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setEditError('');

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditError('El nombre no puede estar vacío.');
      return;
    }

    setIsUpdating(true);
    const result = await onUpdateCategory(editingCategory.id, cleanName, editColor, editDescription.trim());
    setIsUpdating(false);

    if (result.success) {
      setEditingCategory(null);
    } else {
      setEditError(result.error || 'Error al actualizar la categoría.');
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (cat: CategoryItem) => {
    setDeletingCategory(cat);
    setDeleteError('');
  };

  // Confirm Delete Category
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleteError('');
    setIsDeleting(true);

    const result = await onDeleteCategory(deletingCategory.id);
    setIsDeleting(false);

    if (result.success) {
      setDeletingCategory(null);
    } else {
      setDeleteError(result.error || 'Error al eliminar la categoría.');
    }
  };

  const sqlCodeForSupabase = `-- ==========================================
-- 1. TABLA DE CATEGORÍAS (public.categories)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name)
);

-- Si la tabla ya existía, añadir la columna description si falta:
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Política de acceso para que cada usuario gestione sus categorías
DROP POLICY IF EXISTS "Permitir acceso a categories" ON public.categories;
CREATE POLICY "Permitir acceso a categories" ON public.categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Categorías por defecto iniciales (opcional)
INSERT INTO public.categories (user_id, name, color, description)
VALUES
  ('${user?.id || 'usr_default'}', 'Sin categorías', '#64748b', 'Contenido general o que no encaja en otra categoría.'),
  ('${user?.id || 'usr_default'}', 'Marketing Digital', '#3b82f6', 'Estrategias de marketing, ventas, embudos y redes sociales.'),
  ('${user?.id || 'usr_default'}', 'Tecnología e IA', '#8b5cf6', 'Inteligencia artificial, desarrollo, software, hardware e informática.')
ON CONFLICT (user_id, name) DO NOTHING;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCodeForSupabase);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-50/50 pb-16">
      {/* Header Bar */}
      <div className="sticky top-16 z-20 bg-white/90 backdrop-blur-md border-b border-neutral-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="btn-settings-back"
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Enlaces Guardados</span>
            </button>
            <div className="h-4 w-px bg-neutral-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200/60">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-neutral-900 leading-tight">Configuración del Sistema</h1>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  Gestión de categorías autorizadas{user?.role === 'admin' ? ' y sincronización' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-lg">
              <Folder className="w-3 h-3 text-neutral-400" />
              <span>{categories.length} {categories.length === 1 ? 'categoría' : 'categorías'} activas</span>
            </span>
            <span className="inline-flex items-center text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200/70">
              {APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Strict Scope Alert & Context */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50 border border-violet-100/80 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-violet-950">Categorización Estricta de Contenido</h2>
              <p className="text-xs text-violet-900/80 mt-1 leading-relaxed">
                El contenido y Reels solo podrán categorizarse bajo las categorías que tengas dadas de alta aquí.
                Cada categoría cuenta con un <strong>nombre identificativo</strong> y un <strong>color representativo</strong> que se reflejará en tus tarjetas, tablas y filtros.
                Los nuevos usuarios siempre comienzan con la categoría obligatoria <strong>"Sin categorías"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* AI Engine Status & Configuration Card */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition-all ${
          isKeyConfigured
            ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
            : 'bg-amber-50/80 border-amber-300 text-amber-950'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                isKeyConfigured
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}>
                {isKeyConfigured ? <CheckCircle2 className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-neutral-900">
                    Motor de Inteligencia Artificial (Google Gemini AI)
                  </h2>
                  {isKeyConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Activo y Operativo en Netlify
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-full border border-amber-400 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      GEMINI_API_KEY no detectada en Netlify
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                  {isKeyConfigured
                    ? 'La clave GEMINI_API_KEY está configurada en las funciones de Netlify. Los reels se transcriben con IA, se extraen resúmenes y se categorizan automáticamente.'
                    : 'Sin la clave GEMINI_API_KEY en las variables de entorno de Netlify, los enlaces se guardarán solo con información básica y sin transcripción con IA.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                id="btn-settings-refresh-ai-status"
                type="button"
                onClick={refreshAiStatus}
                disabled={aiStatusLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiStatusLoading ? 'animate-spin' : ''}`} />
                <span>{aiStatusLoading ? 'Comprobando...' : 'Comprobar'}</span>
              </button>

              {onOpenGeminiGuide && (
                <button
                  id="btn-settings-open-gemini-guide"
                  type="button"
                  onClick={onOpenGeminiGuide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Guía Netlify</span>
                </button>
              )}
            </div>
          </div>

          {!isKeyConfigured && (
            <div className="mt-3.5 pt-3.5 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-900">Variable requerida:</span>
                <code className="px-2 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold text-amber-950">
                  GEMINI_API_KEY
                </code>
                <button
                  type="button"
                  onClick={handleCopyVar}
                  className="p-1 hover:bg-amber-200/60 rounded text-amber-800 transition-colors cursor-pointer"
                  title="Copiar nombre de variable"
                >
                  {copiedVarName ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {copiedVarName && <span className="text-[11px] text-emerald-700 font-semibold">¡Copiado!</span>}
              </div>

              <a
                href="https://app.netlify.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-violet-700 hover:text-violet-900 font-semibold underline"
              >
                <span>Ir al panel de Netlify</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Zona de Administración: Configuración Segura de Gemini API Key en Supabase */}
        <AdminGeminiKeySection />

        {/* 2-Column Grid: Left (Add Category) / Right (Category List) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Create Category Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Dar de alta nueva categoría</h3>
                  <p className="text-[11px] text-neutral-500">Asigna un nombre y un color para clasificar tus enlaces</p>
                </div>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {createSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{createSuccess}</span>
                  </div>
                )}

                {/* Name Input */}
                <div>
                  <label htmlFor="input-new-cat-name" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Nombre de la Categoría <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-new-cat-name"
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ej: Marketing Digital, Recetas, IA..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 bg-white"
                    maxLength={40}
                  />
                </div>

                {/* Description for AI */}
                <div>
                  <label htmlFor="input-new-cat-desc" className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span>Descripción / Guía para la IA</span>
                    </span>
                    <span className="text-[10px] font-normal text-neutral-400">Opcional pero muy recomendado</span>
                  </label>
                  <textarea
                    id="input-new-cat-desc"
                    value={newCatDescription}
                    onChange={(e) => setNewCatDescription(e.target.value)}
                    placeholder="Ej: Trucos de cocina, ingredientes, técnicas culinarias, postres, pastelería y recetas rápidas..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 bg-white resize-none leading-relaxed"
                    maxLength={350}
                  />
                  <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
                    La Inteligencia Artificial leerá esta guía para comprender a qué se refiere esta categoría y clasificar automáticamente los enlaces y Reels que coincidan.
                  </p>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center justify-between">
                    <span>Color representativo</span>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase">{newCatColor}</span>
                  </label>

                  {/* Palette Swatches */}
                  <div className="grid grid-cols-8 gap-2 mb-3">
                    {PRESET_COLORS.map((preset) => {
                      const isSelected = newCatColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setNewCatColor(preset.hex)}
                          title={`${preset.name} (${preset.hex})`}
                          className={`w-7 h-7 rounded-lg transition-transform cursor-pointer relative flex items-center justify-center shadow-2xs ${
                            isSelected ? 'ring-2 ring-neutral-900 ring-offset-2 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative flex items-center">
                      <input
                        id="custom-color-picker"
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                      />
                    </div>
                    <input
                      type="text"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      placeholder="#6366f1"
                      className="w-28 px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600"
                      maxLength={7}
                    />
                    <span className="text-[11px] text-neutral-400">Selector personalizado</span>
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                  <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Vista previa de la etiqueta
                  </p>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-2xs transition-all"
                      style={{
                        backgroundColor: `${newCatColor}18`,
                        color: newCatColor,
                        borderColor: `${newCatColor}40`,
                        borderWidth: '1px',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: newCatColor }} />
                      {newCatName.trim() || 'Nombre de la categoría'}
                    </span>
                    <span className="text-[10px] text-neutral-400">Así se verá en las tarjetas y tablas</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  id="btn-create-category-submit"
                  type="submit"
                  disabled={isCreating || !newCatName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Guardando...' : 'Dar de Alta Categoría'}</span>
                </button>
              </form>
            </div>

            {/* Supabase Schema Advice Card - Only for Administrator users */}
            {user?.role === 'admin' && (
              <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs sm:text-sm">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Configuración en Supabase (Nube)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>

                <p className="text-xs text-neutral-600 leading-relaxed">
                  Si sincronizas tu app con Supabase para ver las mismas categorías en tu teléfono móvil y ordenador, ejecuta este script en la sección <strong>SQL Editor</strong> de Supabase:
                </p>

                <div className="relative rounded-xl bg-neutral-950 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 border border-neutral-800">
                  <pre>{sqlCodeForSupabase}</pre>
                </div>

                <div className="flex items-start gap-2 pt-1 text-[11px] text-neutral-500">
                  <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Esta tabla almacena cada categoría con su respectivo <code>user_id</code>, <code>name</code> y código <code>color</code>.</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Registered Categories List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Categorías Dadas de Alta</h3>
                  <p className="text-[11px] text-neutral-500">
                    Solo podrás seleccionar estas categorías al guardar o clasificar nuevo contenido
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                  {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
                </span>
              </div>

              {/* Categories Rows */}
              <div className="divide-y divide-neutral-100">
                {categories.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500 text-xs">
                    No tienes categorías registradas actualmente.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const isDefault = cat.name.toLowerCase() === 'sin categorías';
                    const linkCount = categoryCounts[cat.name] || 0;
                    const catColor = cat.color || '#64748b';

                    return (
                      <div
                        key={cat.id}
                        id={`category-row-${cat.id}`}
                        className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors"
                      >
                        {/* Left: Category Badge & Details */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Color Dot & Swatch */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border"
                            style={{
                              backgroundColor: `${catColor}20`,
                              borderColor: `${catColor}40`,
                              color: catColor,
                            }}
                          >
                            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: catColor }} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                                {cat.name}
                              </span>
                              {isDefault && (
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded border border-neutral-200 shrink-0">
                                  Por defecto
                                </span>
                              )}
                            </div>

                            {/* Description for AI or prompt to add one */}
                            {cat.description ? (
                              <p className="text-[11px] text-neutral-600 line-clamp-1 mt-0.5 flex items-center gap-1.5" title={cat.description}>
                                <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                                <span className="truncate">{cat.description}</span>
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(cat)}
                                className="text-[10px] text-amber-600 hover:text-amber-700 underline decoration-dotted flex items-center gap-1 mt-0.5 text-left cursor-pointer"
                                title="Añadir descripción para guiar a la IA"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Sin guía para la IA (clic para añadir)</span>
                              </button>
                            )}

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                              <span className="font-mono text-[10px] uppercase text-neutral-400">{catColor}</span>
                              <span>•</span>
                              <span>
                                {linkCount} {linkCount === 1 ? 'enlace asignado' : 'enlaces asignados'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Edit Button */}
                          <button
                            id={`btn-edit-cat-${cat.id}`}
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="p-2 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                            title="Editar nombre, color y descripción IA"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            id={`btn-delete-cat-${cat.id}`}
                            type="button"
                            onClick={() => handleOpenDelete(cat)}
                            disabled={categories.length <= 1}
                            className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              categories.length <= 1
                                ? 'No se puede eliminar la única categoría existente'
                                : 'Eliminar categoría'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Helper explanation */}
            <div className="p-4 rounded-2xl bg-neutral-100/70 border border-neutral-200/80 text-neutral-600 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-neutral-800">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                <span>¿Cómo funciona la asignación automática por Inteligencia Artificial?</span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Cuando pegues un enlace o Reel, el analizador con IA revisará el contenido y comparará los temas con las <strong>descripciones y palabras clave</strong> que hayas asignado a cada categoría. Seleccionará <strong>exclusivamente</strong> la categoría cuya descripción mejor encaje con el vídeo. Si el tema no encaja de forma evidente con ninguna, se clasificará bajo <strong>"Sin categorías"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Discreet Settings Footer with Version */}
        <footer className="pt-6 pb-8 border-t border-neutral-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-500">ReewAI</span>
            <span>•</span>
            <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200/70">
              {APP_VERSION}
            </span>
            <span>•</span>
            <span>Configuración del Sistema</span>
          </div>
          <div className="text-[11px] text-neutral-400">
            {categories.length} categorías autorizadas
          </div>
        </footer>
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Editar Categoría</h3>
                  <p className="text-[11px] text-neutral-500">Actualiza el nombre y color de esta categoría</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Nombre de la categoría <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600"
                  maxLength={40}
                  required
                />
              </div>

              {/* Description for AI */}
              <div>
                <label htmlFor="input-edit-cat-desc" className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    <span>Descripción / Guía para la IA</span>
                  </span>
                  <span className="text-[10px] font-normal text-neutral-400">Para categorización automática</span>
                </label>
                <textarea
                  id="input-edit-cat-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Explica qué temáticas, palabras clave o contenidos abarca esta categoría..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 bg-white resize-none leading-relaxed"
                  maxLength={350}
                />
                <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
                  Permite a la IA comprender con exactitud qué enlaces o Reels corresponden a esta categoría.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center justify-between">
                  <span>Color representativo</span>
                  <span className="text-[11px] font-mono text-neutral-500 uppercase">{editColor}</span>
                </label>

                <div className="grid grid-cols-8 gap-2 mb-3">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = editColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setEditColor(preset.hex)}
                        className={`w-7 h-7 rounded-lg transition-transform cursor-pointer relative flex items-center justify-center shadow-2xs ${
                          isSelected ? 'ring-2 ring-neutral-900 ring-offset-2 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-28 px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-2xs"
                  style={{
                    backgroundColor: `${editColor}18`,
                    color: editColor,
                    borderColor: `${editColor}40`,
                    borderWidth: '1px',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: editColor }} />
                  {editName.trim() || 'Nombre'}
                </span>
                <span className="text-[11px] text-neutral-400">Si cambias el nombre, se actualizarán los enlaces existentes.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">¿Eliminar categoría "{deletingCategory.name}"?</h3>
                <p className="text-[11px] text-neutral-500">Esta acción no puede deshacerse</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-neutral-700 leading-relaxed">
                Los enlaces o Reels que estén actualmente asignados a la categoría <strong>"{deletingCategory.name}"</strong> no se perderán. Serán automáticamente reasignados a la categoría por defecto <strong>"Sin categorías"</strong>.
              </p>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Hay {categoryCounts[deletingCategory.name] || 0} enlaces con esta categoría que serán reasignados.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setDeletingCategory(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar y Reasignar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

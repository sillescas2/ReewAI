import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
  Key,
  CheckCircle2,
  Terminal,
  FileCode,
  Cloud,
  HardDrive,
  RefreshCw,
  AlertCircle,
  UploadCloud,
  Globe
} from 'lucide-react';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  getSupabaseClient
} from '../lib/supabaseClient';
import { SavedLinkItem } from '../types';
import { APP_VERSION } from '../constants/version';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  localItems?: SavedLinkItem[];
  onUploadLocalToCloud?: () => Promise<{ success: boolean; count: number; error?: string }>;
  onConnectionChange?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  localItems = [],
  onUploadLocalToCloud,
  onConnectionChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'connect' | 'sql' | 'guide' | 'tables'>('connect');

  // Connection inputs
  const config = getSupabaseConfig();
  const [inputUrl, setInputUrl] = useState(config.url);
  const [inputKey, setInputKey] = useState(config.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getSupabaseConfig();
      setInputUrl(current.url);
      setInputKey(current.anonKey);
      setTestResult({ status: 'idle', message: '' });
      setUploadStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnected = isSupabaseConfigured();

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim();
    const cleanKey = inputKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        status: 'error',
        message: 'Por favor ingresa tanto la URL como la Anon Key de Supabase.',
      });
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setTestResult({
        status: 'error',
        message: 'La URL del proyecto debe comenzar con https:// (ej: https://xyz.supabase.co)',
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ status: 'idle', message: '' });

    try {
      saveCustomSupabaseConfig(cleanUrl, cleanKey);
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('No se pudo inicializar el cliente de Supabase.');
      }

      // Quick test: query saved_links or check connection
      const { error } = await client.from('saved_links').select('id').limit(1);
      if (error && !error.message.includes('relation "public.saved_links" does not exist')) {
        // Connected to Supabase, but schema might not exist yet or table empty
        console.warn('Test query warning:', error);
      }

      setTestResult({
        status: 'success',
        message: '¡Conexión establecida con éxito! Ahora tus enlaces se sincronizarán en la nube.',
      });

      if (onConnectionChange) {
        onConnectionChange();
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Error al conectar con Supabase. Verifica la URL y la Key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearCustomSupabaseConfig();
    setInputUrl('');
    setInputKey('');
    setTestResult({
      status: 'idle',
      message: 'Se ha restablecido al Modo Local (almacenamiento en este navegador).',
    });
    if (onConnectionChange) {
      onConnectionChange();
    }
  };

  const handleUploadLocalLinks = async () => {
    if (!onUploadLocalToCloud) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const res = await onUploadLocalToCloud();
      if (res.success) {
        setUploadStatus(`¡${res.count} enlaces locales subidos a Supabase con éxito! Ahora podrás verlos en tu ordenador y en cualquier otro dispositivo.`);
      } else {
        setUploadStatus(`Error al subir enlaces: ${res.error || 'Verifica que la tabla saved_links exista en Supabase.'}`);
      }
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || 'No se pudieron sincronizar los enlaces locales.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const sqlCode = `-- ==============================================================================
-- REEWAI (Reel & Web Saver AI) - ESQUEMA UNIVERSAL PARA SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (https://app.supabase.com)
-- Compatible con autenticación Supabase y enlaces de cualquier dispositivo

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA DE PERFILES (public.profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'editor')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger de sincronización auth.users -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TABLA DE CATEGORÍAS (public.categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name)
);

-- 4. TABLA DE ENLACES GUARDADOS (public.saved_links)
-- Utiliza TEXT para id y user_id para compatibilidad total multiplataforma
CREATE TABLE IF NOT EXISTS public.saved_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'web', 'tiktok', 'youtube')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_takeaways JSONB DEFAULT '[]'::jsonb NOT NULL,
  category TEXT DEFAULT 'General' NOT NULL,
  tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
  estimated_time TEXT DEFAULT 'Lectura',
  author_or_channel TEXT,
  thumbnail_url TEXT,
  user_note TEXT,
  is_favorite BOOLEAN DEFAULT false NOT NULL,
  is_exact_duplicate_of TEXT,
  duplicate_check JSONB DEFAULT '{"isDuplicateTopic": false, "similarityScore": 0}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_saved_links_user_id ON public.saved_links(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_url ON public.saved_links(user_id, url);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_platform ON public.saved_links(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_category ON public.saved_links(user_id, category);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_created ON public.saved_links(user_id, created_at DESC);

-- Índice de texto completo para búsqueda en español
CREATE INDEX IF NOT EXISTS idx_saved_links_fts ON public.saved_links
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(user_note, '')));

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso a saved_links" ON public.saved_links;
CREATE POLICY "Permitir acceso a saved_links" ON public.saved_links
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. CATEGORÍAS GLOBALES INICIALES
INSERT INTO public.categories (user_id, name, color)
VALUES
  (NULL, 'Marketing & Negocios', '#4F46E5'),
  (NULL, 'Tecnología & IA', '#7C3AED'),
  (NULL, 'Diseño & Creatividad', '#EC4899'),
  (NULL, 'Productividad & Hábitos', '#10B981'),
  (NULL, 'Finanzas & Inversión', '#F59E0B'),
  (NULL, 'Salud & Bienestar', '#06B6D4'),
  (NULL, 'General', '#64748B')
ON CONFLICT (user_id, name) DO NOTHING;`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-neutral-950 p-5 sm:p-6 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Sincronización en la Nube (Supabase)
                </h2>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isConnected ? '● Nube Conectada' : '○ Modo Local (Este dispositivo)'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Conecta tu base de datos para sincronizar tus Reels y Webs entre tu móvil y tu ordenador.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher & copy action */}
        <div className="bg-neutral-50 px-4 sm:px-6 py-2.5 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-neutral-200/70 p-1 rounded-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('connect')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'connect'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span>Conectar Nube</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sql'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Script SQL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Guía Netlify + Supabase
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tables')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'tables'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Estructura BD
            </button>
          </div>

          {activeTab === 'sql' && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar SQL</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-190px)] space-y-4">
          {/* TAB 1: CONNECT CLOUD */}
          {activeTab === 'connect' && (
            <div className="space-y-5">
              {/* Informative banner explaining why phone and PC differ */}
              <div className={`p-4 rounded-2xl border ${
                isConnected
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isConnected ? <Cloud className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1 text-xs leading-relaxed">
                    <p className="font-bold text-sm">
                      {isConnected
                        ? '¡Tu biblioteca está sincronizada en la nube con Supabase!'
                        : '¿Por qué no ves en el ordenador lo guardado en el móvil?'}
                    </p>
                    <p className="text-neutral-700">
                      {isConnected
                        ? `Conectado a ${config.url}. Cualquier reel o enlace que guardes desde tu móvil u ordenador se actualizará de inmediato en ambos dispositivos.`
                        : 'Actualmente ReewAI está operando en Modo Local. Los enlaces que guardaste en el móvil están almacenados en la memoria del navegador de tu teléfono (LocalStorage). Para que tu ordenador y tu móvil compartan los mismos reels en tiempo real, conecta tu proyecto de Supabase abajo.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Local Items to Supabase button (if items exist in local) */}
              {localItems.length > 0 && isConnected && onUploadLocalToCloud && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-indigo-950">
                      Tienes {localItems.length} enlace(s) en la memoria local de este dispositivo
                    </p>
                    <p className="text-[11px] text-indigo-700">
                      Súbelos a Supabase con un clic para que aparezcan en tu ordenador y en todos tus dispositivos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadLocalLinks}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Subiendo...' : 'Subir a la Nube'}</span>
                  </button>
                </div>
              )}

              {uploadStatus && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              {/* Connection Form */}
              <form onSubmit={handleSaveConnection} className="space-y-4 bg-neutral-50 p-4 sm:p-5 rounded-2xl border border-neutral-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                    Credenciales de tu proyecto Supabase
                  </h3>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Ir a Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-700">
                    Project URL (URL del proyecto)
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzabcdefghijklmnop.supabase.co"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-neutral-500">
                    En Supabase: <strong>Project Settings</strong> $\rightarrow$ <strong>API</strong> $\rightarrow$ <strong>Project URL</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-700">
                    Anon / Public Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-neutral-500">
                    En Supabase: <strong>Project Settings</strong> $\rightarrow$ <strong>API</strong> $\rightarrow$ <strong>Project API keys</strong> $\rightarrow$ clave <strong>anon / public</strong>.
                  </p>
                </div>

                {testResult.message && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.status === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {testResult.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 flex-wrap gap-2">
                  <div className="text-[11px] text-neutral-500">
                    {config.source === 'env'
                      ? '🔒 Configurado mediante variables de entorno (Netlify / .env)'
                      : config.source === 'custom'
                      ? '🔑 Configurado manualmente en este navegador'
                      : '⚪ Sin configuración activa'}
                  </div>

                  <div className="flex items-center gap-2">
                    {config.source === 'custom' && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="px-3 py-1.5 text-xs text-neutral-600 hover:text-rose-600 hover:bg-neutral-200/60 rounded-xl transition-colors cursor-pointer"
                      >
                        Desconectar
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={isTesting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Conectando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardar y Probar Conexión</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Quick tip on how to do it in Netlify permanently */}
              <div className="p-3.5 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
                <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Para que quede activo automáticamente para todos tus dispositivos en Netlify:</span>
                </p>
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  En el panel de <strong>Netlify</strong> $\rightarrow$ <strong>Site configuration</strong> $\rightarrow$ <strong>Environment variables</strong>, añade:
                  <br />
                  1. <code className="bg-white px-1 py-0.5 rounded font-mono text-indigo-800">VITE_SUPABASE_URL</code>: tu URL de Supabase
                  <br />
                  2. <code className="bg-white px-1 py-0.5 rounded font-mono text-indigo-800">VITE_SUPABASE_ANON_KEY</code>: tu clave pública de Supabase
                  <br />
                  Y pulsa <strong>Trigger deploy</strong>. Con eso, cualquier persona que entre a tu web en Netlify se conectará automáticamente.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SQL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Pega este código en Supabase $\rightarrow$ <strong>SQL Editor</strong> $\rightarrow$ <strong>Run</strong></span>
                <span className="text-[11px] text-emerald-600 font-medium">Compatible con Supabase Free & Pro</span>
              </div>
              <pre className="p-4 bg-neutral-950 text-neutral-200 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto border border-neutral-800 max-h-[420px]">
                {sqlCode}
              </pre>
            </div>
          )}

          {/* TAB 3: TABLES STRUCTURE */}
          {activeTab === 'tables' && (
            <div className="space-y-4 text-xs text-neutral-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>public.saved_links</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Guarda los Reels de Instagram, Facebook y enlaces web, resúmenes generados por IA, key takeaways, categorías y análisis de duplicados.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <Layers className="w-4 h-4 text-pink-600" />
                    <span>public.categories</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Categorías organizadas con colores (Recetas, Marketing, Tecnología, Finanzas, Productividad, Fitness, General).
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>public.profiles</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Almacena el perfil de usuario (nombre, avatar, rol) sincronizado automáticamente con Supabase Auth.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STEP-BY-STEP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-neutral-700">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <span>Pasos para conectar Supabase en 2 minutos:</span>
                </h3>

                <ol className="space-y-2.5 list-decimal list-inside text-neutral-600 text-[12px] leading-relaxed">
                  <li>
                    Entra en <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">Supabase.com</a> y crea un proyecto gratuito si aún no lo tienes.
                  </li>
                  <li>
                    En el menú izquierdo de Supabase, entra a <strong>SQL Editor</strong>, pulsa <strong>«New Query»</strong>, pega el código de la pestaña <strong>Script SQL</strong> y pulsa el botón verde <strong>«Run»</strong>.
                  </li>
                  <li>
                    Ve a <strong>Project Settings $\rightarrow$ API</strong> y copia tu <strong>Project URL</strong> y tu <strong>anon public key</strong>.
                  </li>
                  <li>
                    Pégalos en la pestaña <strong>«Conectar Nube»</strong> de esta ventana tanto en tu móvil como en tu ordenador.
                  </li>
                  <li>
                    ¡Listo! Ahora cualquier reel que guardes en tu móvil aparecerá al instante en tu ordenador.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <FileCode className="w-4 h-4 text-neutral-400" />
            <span>Guía y archivo SQL listos en <span className="font-mono font-medium text-neutral-700">supabase/schema.sql</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral-400 font-medium">{APP_VERSION}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

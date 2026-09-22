-- ==============================================================================
-- REEWAI (Reel & Web Saver AI) - ESQUEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (https://app.supabase.com)
-- Este archivo crea:
-- 1. Tablas: profiles, categories, saved_links
-- 2. Triggers para sincronización automática de auth.users -> profiles
-- 3. Índices de alta velocidad (búsqueda, URLs, usuarios)
-- 4. Row Level Security (RLS) para aislamiento total de datos entre usuarios
-- ==============================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLA DE PERFILES DE USUARIO (public.profiles)
-- Sincronizada con auth.users de Supabase
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'editor')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario de ReewAI sincronizados con Auth';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función y trigger para crear perfil automáticamente cuando un usuario se registra en auth.users
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
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. TABLA DE CATEGORÍAS (public.categories)
-- Permite categorías globales (user_id IS NULL) y categorías personalizadas por usuario
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name)
);

-- ==============================================================================
-- 4. TABLA PRINCIPAL DE ENLACES GUARDADOS (public.saved_links)
-- Almacena reels de Instagram, Facebook y páginas web con resúmenes por IA
-- ==============================================================================
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

DROP TRIGGER IF EXISTS set_saved_links_updated_at ON public.saved_links;
CREATE TRIGGER set_saved_links_updated_at
  BEFORE UPDATE ON public.saved_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. ÍNDICES DE ALTO RENDIMIENTO
-- Optimizan la consulta de reels y enlaces por usuario, fecha, URL y búsqueda de texto
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_saved_links_user_id ON public.saved_links(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_url ON public.saved_links(user_id, url);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_platform ON public.saved_links(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_category ON public.saved_links(user_id, category);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_created ON public.saved_links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_links_user_fav ON public.saved_links(user_id, is_favorite) WHERE is_favorite = true;

-- Índice GIN para búsqueda rápida de texto completo en español
CREATE INDEX IF NOT EXISTS idx_saved_links_fts ON public.saved_links
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(user_note, '')));

-- ==============================================================================
-- 6. SEGURIDAD Y POLÍTICAS ROW LEVEL SECURITY (RLS)
-- Garantiza que NINGÚN usuario pueda ver ni modificar los reels o datos de otro
-- ==============================================================================

-- A. RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Los usuarios pueden editar su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden editar su propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- B. RLS para saved_links
ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver únicamente sus enlaces guardados" ON public.saved_links;
CREATE POLICY "Los usuarios pueden ver únicamente sus enlaces guardados"
  ON public.saved_links FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propios enlaces" ON public.saved_links;
CREATE POLICY "Los usuarios pueden insertar sus propios enlaces"
  ON public.saved_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios enlaces" ON public.saved_links;
CREATE POLICY "Los usuarios pueden actualizar sus propios enlaces"
  ON public.saved_links FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios enlaces" ON public.saved_links;
CREATE POLICY "Los usuarios pueden eliminar sus propios enlaces"
  ON public.saved_links FOR DELETE
  USING (auth.uid() = user_id);

-- C. RLS para categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver categorías públicas y propias" ON public.categories;
CREATE POLICY "Los usuarios pueden ver categorías públicas y propias"
  ON public.categories FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus categorías" ON public.categories;
CREATE POLICY "Los usuarios pueden insertar sus categorías"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden modificar sus categorías" ON public.categories;
CREATE POLICY "Los usuarios pueden modificar sus categorías"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden borrar sus categorías" ON public.categories;
CREATE POLICY "Los usuarios pueden borrar sus categorías"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. CATEGORÍAS PREDEFINIDAS GLOBALES (Opcional)
-- ==============================================================================
INSERT INTO public.categories (user_id, name, color)
VALUES
  (NULL, 'Marketing & Negocios', '#4F46E5'),
  (NULL, 'Tecnología & IA', '#7C3AED'),
  (NULL, 'Diseño & Creatividad', '#EC4899'),
  (NULL, 'Productividad & Hábitos', '#10B981'),
  (NULL, 'Finanzas & Inversión', '#F59E0B'),
  (NULL, 'Salud & Bienestar', '#06B6D4'),
  (NULL, 'General', '#64748B')
ON CONFLICT (user_id, name) DO NOTHING;

-- ==============================================================================
-- 8. TABLA DE CONFIGURACIÓN DEL SISTEMA Y CLAVES SEGURAS (public.system_settings)
-- Almacena claves (como GEMINI_API_KEY) protegidas con RLS estricto para administradores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.system_settings IS 'Parámetros de configuración del sistema y claves gestionadas por administradores';

DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para administradores:
-- Lectura: Solo administradores
DROP POLICY IF EXISTS "Solo administradores pueden leer la configuración del sistema" ON public.system_settings;
CREATE POLICY "Solo administradores pueden leer la configuración del sistema"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  );

-- Escritura/Modificación: Solo administradores
DROP POLICY IF EXISTS "Solo administradores pueden modificar la configuración" ON public.system_settings;
CREATE POLICY "Solo administradores pueden modificar la configuración"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'sillescas2@gmail.com')
    )
  );

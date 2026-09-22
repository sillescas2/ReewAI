import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Database,
  Copy,
  Check,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  isUserAdmin,
  getStoredGeminiApiKey,
  saveGeminiApiKey,
  removeGeminiApiKey,
  testGeminiApiKey,
  SUPABASE_SYSTEM_SETTINGS_SQL,
  StoredKeyInfo,
} from '../services/systemSettingsService';
import { useAiStatus } from '../services/aiStatusService';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export const AdminGeminiKeySection: React.FC = () => {
  const { user } = useAuth();
  const { refreshStatus: refreshAiStatus } = useAiStatus();
  const isAdmin = isUserAdmin(user);

  const [storedInfo, setStoredInfo] = useState<StoredKeyInfo>({
    apiKey: null,
    maskedKey: '',
    source: 'none',
  });
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Load current key on mount
  const loadKeyInfo = async () => {
    setLoadingInfo(true);
    try {
      const info = await getStoredGeminiApiKey(user);
      setStoredInfo(info);
      if (info.apiKey) {
        setApiKeyInput(info.apiKey);
      }
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadKeyInfo();
    } else {
      setLoadingInfo(false);
    }
  }, [isAdmin, user]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SYSTEM_SETTINGS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const clean = apiKeyInput.trim();
    if (!clean) {
      setFeedback({ type: 'error', message: 'Ingresa una clave válida antes de guardar.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveGeminiApiKey(clean, user);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message,
        });
        await loadKeyInfo();
        await refreshAiStatus();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Ocurrió un error al guardar la clave.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error inesperado al guardar la clave.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKeyInput.trim() || storedInfo.apiKey || '';
    if (!keyToTest) {
      setFeedback({
        type: 'error',
        message: 'Escribe o guarda primero una clave para verificar la conexión con Gemini.',
      });
      return;
    }

    setIsTesting(true);
    setFeedback({ type: 'info', message: 'Verificando clave con la API de Google Gemini...' });
    try {
      const result = await testGeminiApiKey(keyToTest);
      if (result.success) {
        setFeedback({
          type: 'success',
          message: result.message,
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.message,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Confirmas que deseas eliminar la API Key de Gemini configurada? Los análisis con IA dejarán de funcionar si no hay otra variable configurada.')) {
      return;
    }

    setIsDeleting(true);
    setFeedback(null);
    try {
      const res = await removeGeminiApiKey(user);
      if (res.success) {
        setApiKeyInput('');
        setStoredInfo({ apiKey: null, maskedKey: '', source: 'none' });
        setFeedback({ type: 'success', message: 'Clave eliminada correctamente.' });
        await refreshAiStatus();
      } else {
        setFeedback({ type: 'error', message: res.error || 'No se pudo eliminar la clave.' });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // If non-admin user
  if (!isAdmin) {
    return (
      <div className="bg-neutral-50/80 rounded-2xl border border-neutral-200/80 p-5 text-neutral-600 text-xs flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-neutral-200/80 text-neutral-600 flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-bold text-neutral-900 text-xs sm:text-sm">Configuración de Gemini API Key (Exclusiva para Administradores)</h4>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            La gestión global de la clave de inteligencia artificial está protegida y reservada para usuarios con rol de Administrador.
          </p>
        </div>
      </div>
    );
  }

  const hasKeyConfigured = Boolean(storedInfo.apiKey || (apiKeyInput && apiKeyInput.length > 10));

  return (
    <div
      id="admin-gemini-key-section"
      className="bg-white rounded-2xl border border-violet-200 shadow-xs overflow-hidden transition-all"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50/80 via-indigo-50/40 to-white px-5 py-4 border-b border-violet-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">
                Configuración de Gemini API Key en Supabase
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-800 bg-violet-100 px-2 py-0.5 rounded-full border border-violet-200">
                <ShieldCheck className="w-3 h-3 text-violet-600" />
                Solo Administradores
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Guarda y administra la clave de Google Gemini directamente en Supabase con Row Level Security (RLS)
            </p>
          </div>
        </div>

        {/* Source Badge */}
        <div className="flex items-center gap-2">
          {storedInfo.source === 'supabase' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Database className="w-3 h-3 text-emerald-600" />
              Guardada en Supabase (BD)
            </span>
          )}
          {storedInfo.source === 'local' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
              <Save className="w-3 h-3 text-sky-600" />
              Guardada Localmente
            </span>
          )}
          {storedInfo.source === 'env' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Variable de Entorno
            </span>
          )}
          {storedInfo.source === 'none' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">
              Sin clave guardada
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-4">
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-violet-50 border-violet-200 text-violet-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 text-violet-600 animate-spin mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">{feedback.message}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="input-admin-gemini-key" className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <span>Google Gemini API Key</span>
                <span className="text-rose-500">*</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-violet-700 hover:text-violet-900 font-semibold inline-flex items-center gap-1 underline decoration-violet-300"
              >
                <span>Obtener API Key gratuita en Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                id="input-admin-gemini-key"
                type={showKeyText ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy... (pega aquí tu clave de Google Gemini)"
                className="w-full pl-3.5 pr-20 py-2.5 text-xs font-mono rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 bg-white"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-neutral-500 hover:text-neutral-800 text-[11px] font-medium flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer"
                title={showKeyText ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showKeyText ? 'Ocultar' : 'Ver'}</span>
              </button>
            </div>

            {storedInfo.maskedKey && !showKeyText && (
              <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                Clave activa actual: <span className="font-semibold text-neutral-700">{storedInfo.maskedKey}</span>
                {storedInfo.updatedAt && (
                  <span className="text-neutral-400 ml-2">
                    (Guardada: {new Date(storedInfo.updatedAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-admin-save-gemini-key"
                type="submit"
                disabled={isSaving || loadingInfo || !apiKeyInput.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? 'Guardando en Supabase...' : 'Guardar Clave en Supabase'}</span>
              </button>

              <button
                id="btn-admin-test-gemini-key"
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || (!apiKeyInput.trim() && !storedInfo.apiKey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-violet-600' : ''}`} />
                <span>{isTesting ? 'Probando...' : 'Probar Conexión con IA'}</span>
              </button>
            </div>

            {hasKeyConfigured && (
              <button
                id="btn-admin-delete-gemini-key"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Eliminar clave configurada"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Eliminando...' : 'Eliminar Clave'}</span>
              </button>
            )}
          </div>
        </form>

        {/* Security & Architecture Note */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-[11px] text-neutral-600 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Seguridad y Privacidad de la Clave:</span>
          </div>
          <p className="leading-relaxed">
            La clave se almacena en la tabla protegida <code className="font-mono text-neutral-800 font-semibold">public.system_settings</code> con políticas de seguridad a nivel de fila (<strong>RLS</strong>). Ningún usuario común ni visitante anónimo puede leerla ni modificarla. El backend de la aplicación o las funciones de Netlify la utilizarán para procesar y categorizar los Reels automáticamente.
          </p>
        </div>

        {/* Collapsible Supabase SQL Script Guide */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="w-full px-4 py-3 bg-neutral-50 hover:bg-neutral-100/80 text-left flex items-center justify-between gap-3 text-xs font-bold text-neutral-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-violet-600" />
              <span>Ver Sentencias SQL para Supabase (Tabla y Políticas RLS)</span>
            </div>
            <div className="flex items-center gap-1 text-neutral-500 font-normal text-[11px]">
              <span>{showSqlGuide ? 'Ocultar script' : 'Ver script SQL'}</span>
              {showSqlGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {showSqlGuide && (
            <div className="p-4 bg-white border-t border-neutral-200 space-y-3">
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Si aún no has creado la tabla en tu proyecto de Supabase, copia este script y ejecútalo en el <strong>SQL Editor</strong> de Supabase:
              </p>

              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-neutral-900 text-neutral-200 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed select-all">
                  {SUPABASE_SYSTEM_SETTINGS_SQL}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-bold backdrop-blur-xs transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-neutral-600">
                <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/70">
                  <span className="font-bold text-neutral-800 block mb-0.5">1. Accede a Supabase</span>
                  Entra en <a href="https://app.supabase.com" target="_blank" rel="noreferrer" className="text-violet-600 underline">app.supabase.com</a> y abre tu proyecto.
                </div>
                <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/70">
                  <span className="font-bold text-neutral-800 block mb-0.5">2. SQL Editor</span>
                  En el menú izquierdo, haz clic en el icono <strong>SQL Editor</strong> y pulsa <strong>New query</strong>.
                </div>
                <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/70">
                  <span className="font-bold text-neutral-800 block mb-0.5">3. Pega y Ejecuta</span>
                  Pega el código copiado y haz clic en <strong>Run</strong>. ¡La tabla y RLS quedarán listas!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

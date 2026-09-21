import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Clipboard,
  Info,
  Check,
  Tag,
  Clock,
  BookOpen
} from 'lucide-react';
import { SavedLinkItem, AnalyzeLinkResponse, PlatformType, CategoryItem } from '../types';
import { APP_VERSION } from '../constants/version';
import { getPlatformInfo } from '../utils/platformHelper';
import { analyzeLinkClientFallback, detectClientPlatform } from '../lib/clientLinkAnalyzer';
import { useAiStatus } from '../services/aiStatusService';

function deriveDirectUrlTitle(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, '');
    const cleanPath = parsed.pathname.split('/').filter(Boolean).pop();
    if (cleanPath && cleanPath.length > 2 && !/^[0-9]+$/.test(cleanPath)) {
      return `${host} - ${decodeURIComponent(cleanPath).replace(/[-_]/g, ' ')}`;
    }
    return `Enlace de ${host}`;
  } catch {
    return 'Enlace guardado';
  }
}

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItem: (item: SavedLinkItem) => void;
  existingItems: SavedLinkItem[];
  initialUrl?: string;
  initialNote?: string;
  categories?: CategoryItem[];
  onOpenGeminiGuide?: () => void;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({
  isOpen,
  onClose,
  onSaveItem,
  existingItems,
  initialUrl = '',
  initialNote = '',
  categories = [],
  onOpenGeminiGuide,
}) => {
  const { isKeyMissing } = useAiStatus();
  const [url, setUrl] = useState(initialUrl || '');
  const [manualTitle, setManualTitle] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [userNote, setUserNote] = useState(initialNote || '');
  const [manualCategory, setManualCategory] = useState<string>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalyzeLinkResponse['data'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available registered categories fallback
  const availableCategories =
    categories && categories.length > 0
      ? categories
      : [{ id: 'cat_default', userId: '', name: 'Sin categorías', color: '#64748b' }];

  // Editable fields once analyzed
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedCategory, setEditedCategory] = useState(availableCategories[0].name);
  const [userIgnoredDuplicate, setUserIgnoredDuplicate] = useState(false);

  // Quick exact duplicate pre-check
  const [exactDuplicateFound, setExactDuplicateFound] = useState<SavedLinkItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setManualTitle('');
      setManualSummary('');
      setUserNote('');
      setManualCategory('auto');
      setIsAnalyzing(false);
      setAnalysisResult(null);
      setErrorMessage(null);
      setUserIgnoredDuplicate(false);
      setExactDuplicateFound(null);
    } else {
      if (initialUrl) setUrl(initialUrl);
      if (initialNote) setUserNote(initialNote);
    }
  }, [isOpen, initialUrl, initialNote]);

  // Check URL as user types
  useEffect(() => {
    if (!url.trim()) {
      setExactDuplicateFound(null);
      return;
    }
    const clean = url.trim().toLowerCase().replace(/\/+$/, '');
    const found = existingItems.find((item) => {
      const itemClean = (item.originalUrl || item.url).toLowerCase().replace(/\/+$/, '');
      return itemClean === clean || itemClean.includes(clean) || clean.includes(itemClean);
    });
    setExactDuplicateFound(found || null);
  }, [url, existingItems]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard access not granted');
    }
  };

  const handleQuickSample = (sampleUrl: string, sampleNote: string) => {
    setUrl(sampleUrl);
    setUserNote(sampleNote);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisStep('Conectando con el enlace y extrayendo metadatos...');

    try {
      const stepTimer1 = setTimeout(() => {
        setAnalysisStep('Procesando con Gemini 3.8 Flash y sintetizando resumen...');
      }, 900);

      const stepTimer2 = setTimeout(() => {
        setAnalysisStep('Comparando temas para detectar posibles duplicados...');
      }, 2000);

      let data: AnalyzeLinkResponse | null = null;

      try {
        const res = await fetch('/api/analyze-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.trim(),
            userNote: userNote.trim() || undefined,
            manualTitle: manualTitle.trim() || undefined,
            manualSummary: manualSummary.trim() || undefined,
            allowedCategories: availableCategories.map((c) => c.name),
            categoryObjects: availableCategories.map((c) => ({
              name: c.name,
              description: c.description || '',
            })),
            existingItems: existingItems.map((item) => ({
              id: item.id,
              url: item.url,
              originalUrl: item.originalUrl,
              title: item.title,
              summary: item.summary,
              category: item.category,
              tags: item.tags,
            })),
          }),
        });

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);

        const contentType = res.headers.get('content-type') || '';
        // If the server returned JSON, parse it
        if (contentType.includes('application/json')) {
          const parsed = await res.json();
          if (res.ok && parsed.success && parsed.data) {
            data = parsed;
          }
        }

        // If backend returned HTML (e.g. Netlify/Vercel SPA fallback or 404 without Node server)
        if (!data) {
          console.warn('Backend returned non-JSON response. Activating client analyzer fallback.');
          data = await analyzeLinkClientFallback(
            url.trim(),
            userNote.trim() || undefined,
            existingItems,
            availableCategories.map((c) => c.name),
            manualTitle.trim() || undefined,
            manualSummary.trim() || undefined
          );
        }
      } catch (fetchErr) {
        // Network offline or static host without backend API
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        console.warn('Backend API unreachable. Using client analyzer fallback:', fetchErr);
        data = await analyzeLinkClientFallback(
          url.trim(),
          userNote.trim() || undefined,
          existingItems,
          availableCategories.map((c) => c.name),
          manualTitle.trim() || undefined,
          manualSummary.trim() || undefined
        );
      }

      if (!data || !data.data) {
        throw new Error('No se pudo analizar el enlace. Por favor verifica la URL ingresada.');
      }

      setAnalysisResult(data.data);
      setEditedTitle(manualTitle.trim() || data.data.title);
      setEditedSummary(manualSummary.trim() || data.data.summary);

      // Category precedence: If the user selected a manual category, that PREVAILS over the AI!
      if (manualCategory && manualCategory !== 'auto') {
        const found = availableCategories.find(
          (c) => c.name.toLowerCase() === manualCategory.toLowerCase()
        );
        setEditedCategory(found ? found.name : manualCategory);
      } else {
        // Fallback to AI category matched against registered categories
        const matchedCat = availableCategories.find(
          (c) => c.name.toLowerCase() === (data?.data.category || '').toLowerCase()
        );
        setEditedCategory(matchedCat ? matchedCat.name : availableCategories[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al analizar el enlace.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDirect = () => {
    if (!url.trim()) return;

    const platform = detectClientPlatform(url.trim());
    const finalCategory =
      manualCategory !== 'auto'
        ? manualCategory
        : availableCategories[0]?.name || 'General';

    // Strictly separate title, summary, and userNote to prevent repeated text
    const title = manualTitle.trim() || deriveDirectUrlTitle(url.trim());
    const summary = manualSummary.trim();

    const newItem: SavedLinkItem = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: url.trim(),
      originalUrl: url.trim(),
      platform,
      title,
      summary,
      keyTakeaways: [],
      category: finalCategory,
      tags: [platform],
      estimatedTime: '1 min',
      authorOrChannel: (() => {
        try {
          const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
          return u.hostname.replace(/^www\./, '');
        } catch {
          return undefined;
        }
      })(),
      userNote: userNote.trim() || undefined,
      createdAt: new Date().toISOString(),
      duplicateCheck: exactDuplicateFound
        ? {
            isDuplicateTopic: true,
            similarityScore: 100,
            duplicateReason: 'Misma URL exacta ya existente en tu biblioteca.',
            similarExistingTitle: exactDuplicateFound.title,
            similarExistingId: exactDuplicateFound.id,
          }
        : { isDuplicateTopic: false },
      isExactDuplicateOf: exactDuplicateFound ? exactDuplicateFound.id : undefined,
    };

    onSaveItem(newItem);
    onClose();
  };

  const handleFinalSave = () => {
    if (!analysisResult) return;

    // Strictly enforce that category must belong to registered categories
    const validatedCat = availableCategories.find(
      (c) => c.name.toLowerCase() === (editedCategory || '').trim().toLowerCase()
    );
    const finalCategoryName = validatedCat ? validatedCat.name : availableCategories[0].name;

    const newItem: SavedLinkItem = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: url.trim(),
      originalUrl: url.trim(),
      platform: analysisResult.platform,
      title: editedTitle.trim() || analysisResult.title,
      summary: editedSummary.trim() || analysisResult.summary,
      keyTakeaways: analysisResult.keyTakeaways,
      category: finalCategoryName,
      tags: analysisResult.tags,
      estimatedTime: analysisResult.estimatedTime,
      authorOrChannel: analysisResult.authorOrChannel,
      userNote: userNote.trim() || undefined,
      createdAt: new Date().toISOString(),
      thumbnailUrl: analysisResult.thumbnailUrl,
      duplicateCheck: analysisResult.duplicateCheck,
      isExactDuplicateOf: exactDuplicateFound ? exactDuplicateFound.id : undefined,
    };

    onSaveItem(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-hidden">
      <div
        id="modal-add-link"
        className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-2xl bg-white sm:rounded-2xl shadow-xl border-0 sm:border border-neutral-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                  Guardar Reel o Enlace con IA
                </h2>
                <span className="text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/70">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500">
                Pega el link de Instagram, Facebook o web para resumirlo
              </p>
            </div>
          </div>
          <button
            id="btn-close-add-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overscroll-contain">
          {!analysisResult ? (
            <form onSubmit={handleAnalyze} className="space-y-4">
              {/* Alert if GEMINI_API_KEY is not configured in Netlify */}
              {isKeyMissing && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-bold">⚠️ Falta configurar GEMINI_API_KEY en Netlify</p>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      La Inteligencia Artificial de Gemini está inactiva. Los enlaces se guardarán con título básico sin transcribir el reel.
                    </p>
                    {onOpenGeminiGuide && (
                      <button
                        type="button"
                        onClick={onOpenGeminiGuide}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-900 underline cursor-pointer"
                      >
                        <span>Ver cómo añadir GEMINI_API_KEY en tu panel de Netlify →</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Enlace del Reel o Página Web *
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="input-new-url"
                    type="url"
                    required
                    placeholder="https://www.instagram.com/reel/... o facebook.com/reel/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isAnalyzing}
                    className="w-full pl-10 pr-24 py-2.5 text-sm bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <button
                    id="btn-paste-clipboard"
                    type="button"
                    onClick={handlePasteClipboard}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Pegar</span>
                  </button>
                </div>
              </div>

              {/* Exact duplicate warning pre-check */}
              {exactDuplicateFound && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold">⚠️ Este enlace ya existe en tu biblioteca:</span>
                    <p className="text-amber-800">
                      "{exactDuplicateFound.title}" (guardado en {exactDuplicateFound.category}). Si continúas, podrás actualizar su resumen o guardar una nueva versión.
                    </p>
                  </div>
                </div>
              )}

              {/* Título de la Ficha / Enlace (Opcional si usas IA o manual) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-manual-title" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Título de la Ficha (Opcional)
                  </label>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    Manual o generado por IA
                  </span>
                </div>
                <input
                  id="input-manual-title"
                  type="text"
                  placeholder="Ej: Estrategia de Marketing Q4, Receta de pasta..."
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Resumen de la Ficha (Opcional si usas IA o manual) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="textarea-manual-summary" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Resumen o Descripción (Opcional)
                  </label>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    Si no usas IA, puedes rellenarlo a mano
                  </span>
                </div>
                <textarea
                  id="textarea-manual-summary"
                  rows={2}
                  placeholder="Escribe una breve síntesis o descripción del enlace..."
                  value={manualSummary}
                  onChange={(e) => setManualSummary(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed"
                />
              </div>

              {/* User Note (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-user-note" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Comentario Personal / Nota (Opcional)
                  </label>
                  {url.toLowerCase().includes('instagram') && (
                    <span className="text-[10px] text-pink-600 font-medium">Reel de Instagram</span>
                  )}
                </div>
                <input
                  id="input-user-note"
                  type="text"
                  placeholder={
                    url.toLowerCase().includes('instagram') || url.toLowerCase().includes('facebook')
                      ? "Ej: Receta masa pizza crujiente, o Consejos de copywriting..."
                      : "Ej: Probar esta receta el sábado, o aplicar al proyecto..."
                  }
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <p className="text-[11px] text-neutral-500 leading-normal">
                  💡 <strong>Tip:</strong> Tu comentario personal se guarda como nota privada y no se mezclará con el título ni con el resumen.
                </p>
              </div>

              {/* Manual Category Selection (Optional - prevails over AI) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="select-manual-category" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Elegir Categoría Manualmente</span>
                  </label>
                  {manualCategory !== 'auto' ? (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      Prevalece sobre la IA
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 font-medium">
                      Opcional (por defecto: IA)
                    </span>
                  )}
                </div>
                <select
                  id="select-manual-category"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-neutral-800 cursor-pointer"
                >
                  <option value="auto">🤖 Dejar que la IA clasifique automáticamente</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      📁 {cat.name} (manual)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 leading-normal">
                  {manualCategory === 'auto'
                    ? 'Si no eliges ninguna categoría, la IA lo categorizará según el contenido. Si seleccionas una, prevalecerá siempre.'
                    : `Has fijado manualmente "${manualCategory}". Prevalecerá tanto al guardar directamente como al analizar con IA.`}
                </p>
              </div>

              {/* Quick Sample Links for testing */}
              <div className="pt-2 border-t border-neutral-100">
                <span className="text-[11px] font-semibold text-neutral-400 block mb-2">
                  Prueba rápida con ejemplos:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSample(
                        'https://www.instagram.com/reel/C3x9L_pM4Q/',
                        'Revisar si coincide con los ganchos virales ya guardados'
                      )
                    }
                    className="text-xs px-2.5 py-1 bg-pink-50 text-pink-700 border border-pink-200/80 rounded-lg hover:bg-pink-100 transition-colors"
                  >
                    📸 Probar duplicado de Reel (Marketing)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSample(
                        'https://www.facebook.com/reel/1049283749281',
                        'Receta nueva de pasta cremosa en 15 minutos'
                      )
                    }
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    📘 Probar Reel Facebook (Cocina)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSample(
                        'https://blog.developer.tech/deep-dive-prompt-engineering-tips',
                        'Técnicas avanzadas de prompt engineering'
                      )
                    }
                    className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    🌐 Probar Artículo Web (Tecnología)
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Loading indicator */}
              {isAnalyzing && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                  <div className="text-xs text-indigo-950 font-medium">
                    {analysisStep}
                  </div>
                </div>
              )}

              {/* Submit Action: Direct Save without AI + Analyze with AI */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs sm:text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Option: Guardar sin analizar y resumir con IA */}
                  <button
                    id="btn-save-without-ai"
                    type="button"
                    onClick={handleSaveDirect}
                    disabled={isAnalyzing || !url.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-white hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-50 text-neutral-700 hover:text-neutral-900 border border-neutral-300 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs"
                    title="Guarda directamente la nota y el enlace sin analizar con IA"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Guardar sin analizar</span>
                  </button>

                  {/* Option: Analizar y Resumir con IA */}
                  <button
                    id="btn-submit-analyze"
                    type="submit"
                    disabled={isAnalyzing || !url.trim()}
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Analizar y Resumir con IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: Review & Confirm AI Results */
            <div className="space-y-4">
              {/* Notice if analyzed without Gemini API Key */}
              {analysisResult.geminiKeyMissing && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Metadatos básicos guardados. Falta <strong>GEMINI_API_KEY</strong> en Netlify para transcripción IA.</span>
                  </div>
                  {onOpenGeminiGuide && (
                    <button
                      type="button"
                      onClick={onOpenGeminiGuide}
                      className="text-[11px] font-bold text-violet-700 hover:text-violet-900 underline shrink-0 cursor-pointer"
                    >
                      Configurar en Netlify
                    </button>
                  )}
                </div>
              )}

              {/* Duplicate Warning if flagged */}
              {analysisResult.duplicateCheck?.isDuplicateTopic && !userIgnoredDuplicate && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      ⚠️ Detección Inteligente: ¡Este tema ya fue subido! (
                      {analysisResult.duplicateCheck.similarityScore}% similitud)
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {analysisResult.duplicateCheck.duplicateReason}
                  </p>
                  {analysisResult.duplicateCheck.similarExistingTitle && (
                    <div className="text-xs bg-white/80 p-2 rounded-lg border border-amber-200 text-neutral-700">
                      <span className="font-semibold text-neutral-900">Enlace coincidente previo: </span>
                      {analysisResult.duplicateCheck.similarExistingTitle}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setUserIgnoredDuplicate(true)}
                      className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Guardar de todos modos como variante
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisResult(null)}
                      className="text-xs px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Volver y cambiar enlace
                    </button>
                  </div>
                </div>
              )}

              {/* AI Generated Content Review */}
              <div className="space-y-3 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-violet-600" />
                      Resumen Generado por IA
                    </span>
                    <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                      {analysisResult.platform}
                    </span>
                  </div>
                  {analysisResult.estimatedTime && (
                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {analysisResult.estimatedTime}
                    </span>
                  )}
                </div>

                {/* Editable Title */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                    Título Identificado
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full text-sm font-semibold bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Editable Summary */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                    Resumen Ejecutivo (IA)
                  </label>
                  <textarea
                    rows={3}
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="w-full text-xs text-neutral-800 leading-relaxed bg-white border border-neutral-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Key takeaways */}
                {analysisResult.keyTakeaways && analysisResult.keyTakeaways.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                      Puntos Clave Extraídos
                    </label>
                    <ul className="space-y-1 text-xs text-neutral-700 bg-white p-3 rounded-lg border border-neutral-200">
                      {analysisResult.keyTakeaways.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Category & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="select-assigned-category"
                      className="block text-[11px] font-bold text-neutral-500 uppercase mb-1 flex items-center justify-between"
                    >
                      <span>Categoría autorizada</span>
                      {manualCategory !== 'auto' ? (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                          Prevaleció tu elección manual
                        </span>
                      ) : (
                        <span className="text-[10px] text-violet-600 font-semibold lowercase">
                          {availableCategories.length} disponibles
                        </span>
                      )}
                    </label>
                    <select
                      id="select-assigned-category"
                      value={editedCategory}
                      onChange={(e) => setEditedCategory(e.target.value)}
                      className="w-full text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {/* Selected category color pill */}
                    {(() => {
                      const selected = availableCategories.find(
                        (c) => c.name.toLowerCase() === editedCategory.toLowerCase()
                      );
                      const color = selected?.color || '#64748b';
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border"
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                              borderColor: `${color}40`,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            {selected?.name || editedCategory}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                      Etiquetas detectadas
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 bg-white text-neutral-600 rounded border border-neutral-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setAnalysisResult(null)}
                  className="text-xs text-neutral-600 hover:text-neutral-900 font-medium px-3 py-1.5"
                >
                  ← Analizar otro enlace
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs sm:text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirm-save-link"
                    type="button"
                    onClick={handleFinalSave}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Guardar en mi Biblioteca</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  Clock,
  Trash2,
  Share2,
  BookmarkCheck,
  Edit3,
  Save,
  CheckCircle2,
  Tag,
  MessageSquare,
  ChevronDown,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { SavedLinkItem, CategoryItem } from '../types';
import { APP_VERSION } from '../constants/version';
import { getPlatformInfo, formatDate, formatTimeAgo } from '../utils/platformHelper';

interface LinkDetailModalProps {
  item: SavedLinkItem | null;
  onClose: () => void;
  onDeleteItem: (id: string) => void;
  onUpdateNote?: (id: string, newNote: string) => void;
  onUpdateItem?: (id: string, updates: { userNote?: string; category?: string; title?: string; summary?: string }) => void;
  onNavigateToItem?: (item: SavedLinkItem) => void;
  allItems: SavedLinkItem[];
  categories?: CategoryItem[];
  categoryColors?: Record<string, string>;
}

export const LinkDetailModal: React.FC<LinkDetailModalProps> = ({
  item,
  onClose,
  onDeleteItem,
  onUpdateNote,
  onUpdateItem,
  onNavigateToItem,
  allItems,
  categories = [],
  categoryColors = {},
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  
  // Note / Comment editing state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item?.userNote || '');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // Category editing state
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(item?.category || 'General');
  const [categorySavedFeedback, setCategorySavedFeedback] = useState(false);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(item?.title || '');

  // Summary editing state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(item?.summary || '');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when selected item changes
  useEffect(() => {
    if (item) {
      setNoteText(item.userNote || '');
      setSelectedCategory(item.category || 'General');
      setTitleText(item.title || '');
      setSummaryText(item.summary || '');
      setIsEditingNote(false);
      setIsEditingCategory(false);
      setIsEditingTitle(false);
      setIsEditingSummary(false);
      setShowDeleteConfirm(false);
      setCopiedLink(false);
      setCopiedSummary(false);
    }
  }, [item?.id, item?.userNote, item?.category, item?.title, item?.summary]);

  // Lock background body scroll so there is ONLY 1 scrollbar when modal is open
  useEffect(() => {
    if (item) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [item]);

  if (!item) return null;

  const platformInfo = getPlatformInfo(item.platform);
  const currentCatColor = categoryColors[item.category] || '#6366f1';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(item.originalUrl || item.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySummary = () => {
    const content = `📌 ${item.title} (${platformInfo.name})\n\n🤖 Resumen Inteligente:\n${item.summary}\n\n💡 Puntos Clave:\n${item.keyTakeaways.map((k) => `• ${k}`).join('\n')}\n\n🔗 Enlace: ${item.originalUrl || item.url}`;
    navigator.clipboard.writeText(content);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Save personal note/comment
  const handleSaveNote = () => {
    const cleanNote = noteText.trim();
    if (onUpdateItem) {
      onUpdateItem(item.id, { userNote: cleanNote });
    } else if (onUpdateNote) {
      onUpdateNote(item.id, cleanNote);
    }
    setIsEditingNote(false);
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  const handleCancelNote = () => {
    setNoteText(item.userNote || '');
    setIsEditingNote(false);
  };

  const handleClearNote = () => {
    setNoteText('');
    if (onUpdateItem) {
      onUpdateItem(item.id, { userNote: '' });
    } else if (onUpdateNote) {
      onUpdateNote(item.id, '');
    }
    setIsEditingNote(false);
  };

  // Save category change
  const handleSaveCategory = (newCat: string) => {
    if (!newCat || newCat === item.category) {
      setIsEditingCategory(false);
      return;
    }
    setSelectedCategory(newCat);
    if (onUpdateItem) {
      onUpdateItem(item.id, { category: newCat });
    }
    setIsEditingCategory(false);
    setCategorySavedFeedback(true);
    setTimeout(() => setCategorySavedFeedback(false), 2500);
  };

  // Save title change
  const handleSaveTitle = () => {
    const trimmed = titleText.trim();
    if (!trimmed || trimmed === item.title) {
      setIsEditingTitle(false);
      return;
    }
    if (onUpdateItem) {
      onUpdateItem(item.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setTitleText(item.title || '');
    setIsEditingTitle(false);
  };

  // Save summary change
  const handleSaveSummary = () => {
    const trimmed = summaryText.trim();
    if (trimmed === item.summary) {
      setIsEditingSummary(false);
      return;
    }
    if (onUpdateItem) {
      onUpdateItem(item.id, { summary: trimmed });
    }
    setIsEditingSummary(false);
  };

  const handleCancelSummary = () => {
    setSummaryText(item.summary || '');
    setIsEditingSummary(false);
  };

  // Find related duplicate item if referenced
  const relatedDuplicateItem = item.duplicateCheck?.similarExistingId
    ? allItems.find((i) => i.id === item.duplicateCheck?.similarExistingId)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        id={`modal-detail-${item.id}`}
        className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[88vh] max-w-3xl bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-neutral-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header - Fixed on top, guaranteed visibility on all devices */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0 gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 ${platformInfo.badgeClass}`}
            >
              <span className="hidden sm:inline">{platformInfo.name}</span>
              <span className="sm:hidden">{platformInfo.shortName}</span>
            </span>
            {item.authorOrChannel && (
              <span className="text-xs text-neutral-600 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                {item.authorOrChannel}
              </span>
            )}
            <span className="hidden sm:inline text-xs text-neutral-300">•</span>
            <span className="hidden sm:inline text-xs text-neutral-400 whitespace-nowrap" title={formatDate(item.createdAt)}>
              {formatTimeAgo(item.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              id="btn-open-original-link"
              href={item.originalUrl || item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-colors shrink-0"
              title="Abrir enlace original"
            >
              <span className="sm:hidden">Abrir</span>
              <span className="hidden sm:inline">Abrir Original</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            <button
              id="btn-close-detail-modal"
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors shrink-0 cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - The ONLY vertical scroll container */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {/* Category Selector / Display & Estimated Time */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {!isEditingCategory ? (
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 shadow-2xs transition-all"
                      style={{
                        backgroundColor: currentCatColor ? `${currentCatColor}18` : undefined,
                        color: currentCatColor || undefined,
                        borderColor: currentCatColor ? `${currentCatColor}40` : undefined,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: currentCatColor || '#6366f1' }}
                      />
                      <span>{item.category}</span>
                    </span>

                    <button
                      id="btn-edit-category"
                      type="button"
                      onClick={() => setIsEditingCategory(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200/70 rounded-lg transition-colors cursor-pointer"
                      title="Cambiar la categoría de este enlace"
                    >
                      <Tag className="w-3 h-3 text-neutral-400" />
                      <span>Cambiar categoría</span>
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-neutral-50 border border-neutral-300 p-1.5 rounded-xl shadow-xs animate-in fade-in duration-150">
                    <Tag className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" />
                    <label htmlFor="select-change-category" className="sr-only">
                      Seleccionar categoría
                    </label>
                    <select
                      id="select-change-category"
                      value={selectedCategory}
                      onChange={(e) => {
                        handleSaveCategory(e.target.value);
                      }}
                      className="text-xs font-semibold text-neutral-800 bg-white border border-neutral-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      {(categories.length > 0
                        ? categories
                        : [
                            { id: '1', name: item.category, color: '#6366f1' },
                            { id: '2', name: 'General', color: '#64748b' },
                            { id: '3', name: 'Tecnología', color: '#0ea5e9' },
                            { id: '4', name: 'Negocios', color: '#10b981' },
                            { id: '5', name: 'Recetas', color: '#f59e0b' },
                          ]
                      ).map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsEditingCategory(false)}
                      className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60 rounded-md font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {categorySavedFeedback && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-in fade-in">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Categoría actualizada
                  </span>
                )}
              </div>

              {item.estimatedTime && (
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.estimatedTime}
                </span>
              )}
            </div>

            {/* Title display or edit */}
            {!isEditingTitle ? (
              <div className="group/title flex items-start justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-neutral-900 leading-snug">
                  {item.title}
                </h2>
                <button
                  id="btn-edit-title"
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Modificar título"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-neutral-50 border border-neutral-300 rounded-xl animate-in fade-in">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">
                  Editar Título del Enlace / Nota
                </label>
                <input
                  type="text"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  className="w-full text-sm font-bold text-neutral-900 p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                  placeholder="Título..."
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Guardar Título
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelTitle}
                    className="px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* URL Display and copy */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-mono text-neutral-500 truncate max-w-[240px] sm:max-w-md bg-neutral-50 px-2.5 py-1 rounded border border-neutral-200">
                {item.originalUrl || item.url}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 font-medium px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Duplicate Detection Alert if flagged */}
          {item.duplicateCheck?.isDuplicateTopic && (
            <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Detección de Tema Similar / Duplicado ({item.duplicateCheck.similarityScore}% coincidencia)
                  </span>
                </div>
              </div>

              {item.duplicateCheck.duplicateReason && (
                <p className="text-xs text-amber-800 leading-relaxed">
                  {item.duplicateCheck.duplicateReason}
                </p>
              )}

              {relatedDuplicateItem && onNavigateToItem && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToItem(relatedDuplicateItem);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 bg-amber-200/60 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Ver enlace relacionado: "{relatedDuplicateItem.title}"</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* COMENTARIO PERSONAL / NOTAS - Destacado y totalmente editable              */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-5 rounded-2xl border border-amber-200/90 bg-amber-50/40 space-y-3">
            {!isEditingNote ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Comentario / Nota Personal
                  </h3>
                </div>

                <button
                  id="btn-edit-note"
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-neutral-200 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{item.userNote ? 'Modificar comentario' : 'Añadir comentario'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Primera línea: Título sin marcador de guardado */}
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Comentario / Nota Personal
                  </h3>
                </div>

                {/* Debajo: Botones Cancelar y Guardar Comentario */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCancelNote}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-save-note"
                    type="button"
                    onClick={handleSaveNote}
                    className="inline-flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Comentario</span>
                  </button>
                </div>
              </div>
            )}

            {isEditingNote ? (
              <div className="space-y-2 animate-in fade-in duration-150">
                <textarea
                  id="textarea-user-note"
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Escribe aquí tus notas personales, ideas clave, recordatorios o por qué guardaste este enlace..."
                  className="w-full text-xs sm:text-sm text-neutral-900 p-3.5 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-hidden leading-relaxed shadow-2xs"
                />
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Puedes escribir o actualizar tu nota en cualquier momento.</span>
                  {item.userNote && (
                    <button
                      type="button"
                      onClick={handleClearNote}
                      className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                    >
                      Borrar comentario
                    </button>
                  )}
                </div>
              </div>
            ) : item.userNote ? (
              <div className="text-xs sm:text-sm text-neutral-800 bg-white/90 border border-amber-200/80 p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap shadow-2xs">
                {item.userNote}
              </div>
            ) : (
              <div
                onClick={() => setIsEditingNote(true)}
                className="text-xs text-neutral-500 bg-white/60 hover:bg-white border border-dashed border-neutral-300 hover:border-indigo-300 p-3.5 rounded-xl transition-colors cursor-pointer text-center space-y-1"
              >
                <p className="font-medium text-neutral-600">
                  No has añadido ningún comentario personal todavía.
                </p>
                <p className="text-[11px] text-neutral-400">
                  Haz clic aquí para añadir tus notas, reflexiones o recordatorios.
                </p>
              </div>
            )}

            {noteSavedFeedback && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>¡Comentario personal guardado correctamente!</span>
              </div>
            )}
          </div>

          {/* AI or Manual Summary Box */}
          {((item.summary &&
            item.summary.trim() !== '' &&
            item.summary.trim() !== item.userNote?.trim() &&
            item.summary.trim() !== item.title?.trim() &&
            !item.summary.toLowerCase().includes('sin análisis ni resumen de ia')) ||
            isEditingSummary) && (
            <div className="bg-neutral-50/80 rounded-xl p-4 sm:p-5 border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    {item.keyTakeaways && item.keyTakeaways.length > 0
                      ? 'Resumen Automático por IA'
                      : 'Resumen / Descripción'}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isEditingSummary && onUpdateItem && (
                    <button
                      id="btn-edit-summary"
                      type="button"
                      onClick={() => setIsEditingSummary(true)}
                      className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 font-medium px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                      title="Modificar resumen"
                    >
                      <Edit3 className="w-3 h-3 text-neutral-400" />
                      <span>Editar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 font-medium px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!isEditingSummary ? (
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  {item.summary}
                </p>
              ) : (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <textarea
                    rows={3}
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    className="w-full text-xs sm:text-sm text-neutral-800 p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden leading-relaxed"
                    placeholder="Escribe o modifica el resumen..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-save-summary"
                      type="button"
                      onClick={handleSaveSummary}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Guardar Resumen
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSummary}
                      className="px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Option to add summary if not present and not editing */}
          {(!item.summary ||
            item.summary.trim() === '' ||
            item.summary.trim() === item.userNote?.trim() ||
            item.summary.trim() === item.title?.trim() ||
            item.summary.toLowerCase().includes('sin análisis ni resumen de ia')) &&
            !isEditingSummary &&
            onUpdateItem && (
              <button
                id="btn-add-summary-prompt"
                type="button"
                onClick={() => {
                  setSummaryText('');
                  setIsEditingSummary(true);
                }}
                className="w-full py-2.5 px-3 border border-dashed border-neutral-300 hover:border-indigo-300 rounded-xl text-xs font-medium text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir un resumen o descripción a esta ficha</span>
              </button>
            )}

          {/* Key Takeaways */}
          {item.keyTakeaways && item.keyTakeaways.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Puntos Clave y Aprendizajes
              </h3>
              <ul className="space-y-2">
                {item.keyTakeaways.map((takeaway, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-700 bg-white p-3 rounded-xl border border-neutral-200/80"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Etiquetas
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-0.5 bg-neutral-100 text-neutral-700 rounded-md border border-neutral-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-200 bg-neutral-50/80 shrink-0 flex items-center justify-between gap-3">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-700">¿Confirmas eliminar?</span>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(item.id);
                  onClose();
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1.5 bg-white border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-semibold hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar enlace</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral-400 font-medium">{APP_VERSION}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


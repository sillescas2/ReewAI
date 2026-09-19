import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  Trash2,
  Clock,
  Instagram,
  Facebook,
  Globe,
  Video,
  CheckCircle2,
  Share2,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { SavedLinkItem, PlatformType } from '../types';
import { getPlatformInfo, formatDate, formatTimeAgo } from '../utils/platformHelper';

interface LinksTableProps {
  items: SavedLinkItem[];
  onSelectItem: (item: SavedLinkItem) => void;
  onDeleteItem: (id: string) => void;
  onRequestDelete?: (item: SavedLinkItem) => void;
  onReanalyzeItem?: (item: SavedLinkItem) => void;
  categoryColors?: Record<string, string>;
}

export const LinksTable: React.FC<LinksTableProps> = ({
  items,
  onSelectItem,
  onDeleteItem,
  onRequestDelete,
  categoryColors = {},
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSummaryId, setCopiedSummaryId] = useState<string | null>(null);

  const handleCopyUrl = (e: React.MouseEvent, item: SavedLinkItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.originalUrl || item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopySummary = (e: React.MouseEvent, item: SavedLinkItem) => {
    e.stopPropagation();
    const textToCopy = `📌 ${item.title}\n\n🤖 Resumen IA:\n${item.summary}\n\n🔗 Enlace: ${item.originalUrl || item.url}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSummaryId(item.id);
    setTimeout(() => setCopiedSummaryId(null), 2000);
  };

  const getPlatformIcon = (platform: PlatformType) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5 text-pink-600 shrink-0" />;
      case 'facebook':
        return <Facebook className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
      case 'tiktok':
      case 'youtube':
        return <Video className="w-3.5 h-3.5 text-red-600 shrink-0" />;
      case 'web':
      default:
        return <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 shadow-xs max-w-xl mx-auto my-8 p-8">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
          <Sparkles className="w-7 h-7 text-neutral-500" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-1">No se encontraron enlaces</h3>
        <p className="text-xs sm:text-sm text-neutral-500 mb-6">
          Prueba cambiando los filtros de búsqueda o añade tu primer Reel de Instagram, Facebook o web.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ========================================================================= */}
      {/* 1. VISTA MÓVIL Y TABLET OPTIMIZADA (Visible en < lg, teléfonos y tablets)  */}
      {/* Tarjetas limpias con jerarquía, etiquetas, resumen legible y acciones      */}
      {/* ========================================================================= */}
      <div className="lg:hidden space-y-3.5">
        {items.map((item) => {
          const platformInfo = getPlatformInfo(item.platform);
          const isDuplicate = item.duplicateCheck?.isDuplicateTopic || !!item.isExactDuplicateOf;

          return (
            <article
              key={`mobile-${item.id}`}
              id={`mobile-card-${item.id}`}
              onClick={() => onSelectItem(item)}
              className={`bg-white rounded-2xl border p-4 shadow-xs transition-all active:scale-[0.99] cursor-pointer relative overflow-hidden ${
                isDuplicate
                  ? 'border-amber-300/90 bg-amber-50/20'
                  : 'border-neutral-200/90 hover:border-neutral-300'
              }`}
            >
              {/* Header: Platform Badge + Category + Duplicate Alert */}
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Platform Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${platformInfo.badgeClass}`}
                  >
                    {getPlatformIcon(item.platform)}
                    <span>{platformInfo.shortName}</span>
                  </span>

                  {/* Category Chip */}
                  {(() => {
                    const color = categoryColors[item.category] || '#64748b';
                    return (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                          borderColor: `${color}35`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>{item.category}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Duplicate badge */}
                {item.duplicateCheck?.isDuplicateTopic ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Tema Similar ({item.duplicateCheck.similarityScore || 70}%)</span>
                  </span>
                ) : item.isExactDuplicateOf ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Duplicado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Único</span>
                  </span>
                )}
              </div>

              {/* Title & Channel */}
              <div className="space-y-1 mb-2.5">
                <h3 className="font-bold text-neutral-950 text-sm sm:text-base leading-snug line-clamp-2">
                  {item.title}
                </h3>

                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  {item.authorOrChannel && (
                    <span className="font-medium text-neutral-700 truncate max-w-[150px]">
                      {item.authorOrChannel}
                    </span>
                  )}
                  {item.authorOrChannel && <span>•</span>}
                  {item.estimatedTime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      {item.estimatedTime}
                    </span>
                  )}
                  <span>•</span>
                  <span title={formatDate(item.createdAt)}>
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>
              </div>

              {/* Duplicate Reason Warning if applicable */}
              {item.duplicateCheck?.isDuplicateTopic && item.duplicateCheck.duplicateReason && (
                <div className="mb-2.5 p-2 bg-amber-50/90 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{item.duplicateCheck.duplicateReason}</span>
                </div>
              )}

              {/* AI Summary Box */}
              <div className="p-3 bg-neutral-50/80 border border-neutral-100 rounded-xl space-y-2 mb-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-800">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Resumen IA
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopySummary(e, item)}
                    className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-900 font-semibold cursor-pointer"
                  >
                    {copiedSummaryId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3 h-3" />
                        <span>Copiar resumen</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-neutral-700 leading-relaxed line-clamp-3">
                  {item.summary}
                </p>

                {item.keyTakeaways && item.keyTakeaways.length > 0 && (
                  <div className="pt-1.5 border-t border-neutral-200/60 text-[11px] text-neutral-600 flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    <span className="line-clamp-1 font-medium">
                      {item.keyTakeaways[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags & Note */}
              {(item.userNote || (item.tags && item.tags.length > 0)) && (
                <div className="space-y-1.5 mb-3">
                  {item.userNote && (
                    <div className="text-[11px] bg-indigo-50/70 text-indigo-900 border border-indigo-200/60 rounded-lg px-2.5 py-1">
                      <span className="font-semibold">Tu nota:</span> {item.userNote}
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] text-neutral-500 bg-neutral-100/70 px-2 py-0.5 rounded-md"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div
                className="pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Link Preview / Open External */}
                <div className="flex items-center gap-1.5 min-w-0 max-w-[60%]">
                  <a
                    href={item.originalUrl || item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-indigo-600 truncate py-1"
                    title={item.originalUrl || item.url}
                  >
                    <span className="truncate">{item.originalUrl || item.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>

                  <button
                    type="button"
                    onClick={(e) => handleCopyUrl(e, item)}
                    title="Copiar enlace"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Right controls: Ver Detalle & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Ver</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onRequestDelete) {
                        onRequestDelete(item);
                      } else {
                        onDeleteItem(item.id);
                      }
                    }}
                    title="Eliminar enlace"
                    className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. VISTA DE TABLA PARA PANTALLAS GRANDES Y ESCRITORIO (hidden lg:block)    */}
      {/* Formato 100% horizontal sin desborde: Todas las columnas visibles         */}
      {/* ========================================================================= */}
      <div className="hidden lg:block bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        <table id="table-saved-links" className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider select-none">
              <th className="py-3 pl-4 pr-2 w-[115px] xl:w-[130px]">Plataforma</th>
              <th className="py-3 px-2.5 w-[24%] xl:w-[26%] min-w-0">Título y Enlace</th>
              <th className="py-3 px-2.5 w-[32%] xl:w-[34%] min-w-0">Resumen IA</th>
              <th className="py-3 px-2 w-[105px] xl:w-[120px]">Categoría</th>
              <th className="py-3 px-2 w-[110px] xl:w-[125px]">Duplicados</th>
              <th className="py-3 px-2 w-[75px] xl:w-[85px] text-center">Fecha</th>
              <th className="py-3 pl-1 pr-4 text-right w-[80px] xl:w-[90px]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-sm">
            {items.map((item) => {
              const platformInfo = getPlatformInfo(item.platform);
              const isDuplicate = item.duplicateCheck?.isDuplicateTopic || !!item.isExactDuplicateOf;

              return (
                <tr
                  key={item.id}
                  id={`row-link-${item.id}`}
                  onClick={() => onSelectItem(item)}
                  className={`group hover:bg-neutral-50/90 cursor-pointer transition-colors ${
                    isDuplicate ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Platform */}
                  <td className="py-3.5 pl-4 pr-2 align-top">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${platformInfo.badgeClass}`}
                      >
                        {getPlatformIcon(item.platform)}
                        <span>{platformInfo.shortName}</span>
                      </span>
                      {item.authorOrChannel ? (
                        <span
                          className="text-[11px] text-neutral-500 font-medium truncate max-w-[95px] xl:max-w-[115px]"
                          title={item.authorOrChannel}
                        >
                          {item.authorOrChannel}
                        </span>
                      ) : null}
                      {item.estimatedTime && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[90px]">{item.estimatedTime}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Title & Link */}
                  <td className="py-3.5 px-2.5 align-top min-w-0">
                    <div className="space-y-1.5 pr-1">
                      <div
                        className="font-semibold text-neutral-900 group-hover:text-indigo-600 transition-colors line-clamp-2 text-xs xl:text-sm leading-snug break-words"
                        title={item.title}
                      >
                        {item.title}
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <a
                          id={`link-original-${item.id}`}
                          href={item.originalUrl || item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-indigo-600 transition-colors font-mono truncate min-w-0 flex-1"
                          title={item.originalUrl || item.url}
                        >
                          <span className="truncate">{item.originalUrl || item.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>

                        <button
                          id={`btn-copy-url-${item.id}`}
                          type="button"
                          onClick={(e) => handleCopyUrl(e, item)}
                          title="Copiar enlace original"
                          className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md hover:bg-neutral-200/60 transition-colors shrink-0 cursor-pointer"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {item.userNote && (
                        <div
                          className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/80 rounded px-1.5 py-0.5 inline-block truncate max-w-full"
                          title={item.userNote}
                        >
                          Nota: {item.userNote}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* AI Summary */}
                  <td className="py-3.5 px-2.5 align-top min-w-0">
                    <div className="space-y-1.5">
                      <p
                        className="text-xs text-neutral-600 leading-relaxed line-clamp-2 xl:line-clamp-3 break-words"
                        title={item.summary}
                      >
                        {item.summary}
                      </p>

                      {item.keyTakeaways && item.keyTakeaways.length > 0 && (
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                          <span
                            className="truncate font-medium text-neutral-700 text-[11px]"
                            title={item.keyTakeaways[0]}
                          >
                            {item.keyTakeaways[0]}
                          </span>
                          {item.keyTakeaways.length > 1 && (
                            <span className="text-neutral-400 text-[10px] shrink-0">
                              (+{item.keyTakeaways.length - 1})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          id={`btn-copy-summary-${item.id}`}
                          type="button"
                          onClick={(e) => handleCopySummary(e, item)}
                          className="inline-flex items-center gap-1 text-[10px] xl:text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors font-medium cursor-pointer"
                        >
                          {copiedSummaryId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="text-emerald-600 font-semibold">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3 h-3 shrink-0" />
                              <span>Copiar resumen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Category & Tags */}
                  <td className="py-3.5 px-2 align-top min-w-0">
                    <div className="space-y-1">
                      {(() => {
                        const color = categoryColors[item.category] || '#64748b';
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] xl:text-[11px] font-semibold border max-w-full truncate"
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                              borderColor: `${color}35`,
                            }}
                            title={item.category}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="truncate">{item.category}</span>
                          </span>
                        );
                      })()}
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span
                            className="text-[9px] xl:text-[10px] text-neutral-500 bg-neutral-100/80 px-1 py-0.2 rounded border border-neutral-200 truncate max-w-[85px]"
                            title={item.tags[0]}
                          >
                            #{item.tags[0]}
                          </span>
                          {item.tags.length > 1 && (
                            <span className="text-[9px] text-neutral-400">+{item.tags.length - 1}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Duplicate Detection Status */}
                  <td className="py-3.5 px-2 align-top min-w-0">
                    {item.duplicateCheck?.isDuplicateTopic ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] xl:text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 max-w-full truncate">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span>Similar</span>
                          {item.duplicateCheck.similarityScore ? (
                            <span className="text-[9px] opacity-80">
                              {item.duplicateCheck.similarityScore}%
                            </span>
                          ) : null}
                        </span>
                        {item.duplicateCheck.duplicateReason && (
                          <p
                            className="text-[9px] text-amber-800 line-clamp-2 leading-tight break-words"
                            title={item.duplicateCheck.duplicateReason}
                          >
                            {item.duplicateCheck.duplicateReason}
                          </p>
                        )}
                      </div>
                    ) : item.isExactDuplicateOf ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] xl:text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                        <AlertTriangle className="w-2.5 h-2.5 text-red-600 shrink-0" />
                        <span>Repetido</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] xl:text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        <span>Único</span>
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-2 align-top text-center text-xs text-neutral-500 whitespace-nowrap">
                    <span title={formatDate(item.createdAt)} className="text-[11px]">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 pl-1 pr-4 align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        id={`btn-view-detail-${item.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem(item);
                        }}
                        title="Ver detalle completo"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        id={`btn-delete-${item.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRequestDelete) {
                            onRequestDelete(item);
                          } else {
                            onDeleteItem(item.id);
                          }
                        }}
                        title="Eliminar enlace"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

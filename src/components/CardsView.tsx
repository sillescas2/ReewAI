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
  MessageSquare,
} from 'lucide-react';
import { SavedLinkItem, PlatformType } from '../types';
import { getPlatformInfo, formatTimeAgo } from '../utils/platformHelper';

interface CardsViewProps {
  items: SavedLinkItem[];
  onSelectItem: (item: SavedLinkItem) => void;
  onDeleteItem: (id: string) => void;
  onRequestDelete?: (item: SavedLinkItem) => void;
  categoryColors?: Record<string, string>;
}

export const CardsView: React.FC<CardsViewProps> = ({
  items,
  onSelectItem,
  onDeleteItem,
  onRequestDelete,
  categoryColors = {},
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, item: SavedLinkItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.originalUrl || item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item) => {
        const platformInfo = getPlatformInfo(item.platform);
        const isDuplicate = item.duplicateCheck?.isDuplicateTopic || !!item.isExactDuplicateOf;

        return (
          <div
            key={item.id}
            id={`card-link-${item.id}`}
            onClick={() => onSelectItem(item)}
            className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between hover:shadow-md cursor-pointer ${
              isDuplicate
                ? 'border-amber-300 ring-1 ring-amber-200'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {/* Optional Thumbnail or Platform banner */}
            {item.thumbnailUrl ? (
              <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold backdrop-blur-md bg-white/95 shadow-xs border ${platformInfo.badgeClass}`}
                    >
                      {getPlatformIcon(item.platform)}
                      <span>{platformInfo.shortName}</span>
                    </span>
                    {(() => {
                      const color = categoryColors[item.category] || '#64748b';
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border backdrop-blur-md bg-white/95 shadow-xs"
                          style={{
                            color: color,
                            borderColor: `${color}40`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span>{item.category}</span>
                        </span>
                      );
                    })()}
                  </div>

                  <span className="text-[11px] font-medium text-white/95 bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded shrink-0">
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>
                {item.estimatedTime && (
                  <div className="absolute bottom-3 left-3 text-[11px] font-medium text-white/90 flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    <span>{item.estimatedTime}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${platformInfo.badgeClass}`}
                  >
                    {getPlatformIcon(item.platform)}
                    <span>{platformInfo.shortName}</span>
                  </span>
                  {(() => {
                    const color = categoryColors[item.category] || '#64748b';
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
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

                <div className="flex items-center gap-2 text-[11px] text-neutral-400 shrink-0">
                  <span>{formatTimeAgo(item.createdAt)}</span>
                  {item.estimatedTime && (
                    <span className="flex items-center gap-1 text-neutral-400">
                      • <Clock className="w-3 h-3" />
                      {item.estimatedTime}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Card Content */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm leading-snug">
                  {item.title}
                </h3>

                {/* Only display summary if non-empty and not identical to title or userNote */}
                {item.summary &&
                  item.summary.trim() !== '' &&
                  item.summary.trim() !== item.userNote?.trim() &&
                  item.summary.trim() !== item.title?.trim() &&
                  !item.summary.toLowerCase().includes('sin análisis ni resumen de ia') && (
                    <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                {item.userNote && (
                  <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 leading-snug">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      <strong className="font-semibold text-amber-950">Tu comentario:</strong> {item.userNote}
                    </span>
                  </div>
                )}
              </div>

              {/* Duplicate Alert Banner if flagged */}
              {isDuplicate && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Tema similar en biblioteca ({item.duplicateCheck?.similarityScore || 85}%)</span>
                  </div>
                  {item.duplicateCheck?.duplicateReason && (
                    <p className="text-[11px] text-amber-800 line-clamp-2">
                      {item.duplicateCheck.duplicateReason}
                    </p>
                  )}
                </div>
              )}

              {/* Tags & Author */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <span className="truncate max-w-[140px] font-medium text-neutral-600">
                  {item.authorOrChannel || platformInfo.shortName}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    id={`btn-copy-card-${item.id}`}
                    type="button"
                    onClick={(e) => handleCopy(e, item)}
                    title="Copiar enlace"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <a
                    id={`link-ext-card-${item.id}`}
                    href={item.originalUrl || item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir enlace original"
                    className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    id={`btn-view-card-${item.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem(item);
                    }}
                    title="Ver detalle"
                    className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`btn-delete-card-${item.id}`}
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
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

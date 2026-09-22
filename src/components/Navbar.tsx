import React from 'react';
import { Bookmark, Sparkles, Plus, AlertTriangle, KeyRound } from 'lucide-react';
import { SavedLinkItem } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { UserMenu } from './UserMenu';
import { APP_VERSION } from '../constants/version';
import { useAiStatus } from '../services/aiStatusService';

interface NavbarProps {
  items: SavedLinkItem[];
  onOpenAddModal: () => void;
  filterDuplicateOnly: boolean;
  onToggleDuplicateFilter: () => void;
  onOpenAuthModal: () => void;
  onOpenSupabaseModal?: () => void;
  onOpenEditProfile?: () => void;
  onOpenUsersManagement?: () => void;
  onOpenSettings?: () => void;
  onOpenGeminiGuide?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  items,
  onOpenAddModal,
  filterDuplicateOnly,
  onToggleDuplicateFilter,
  onOpenAuthModal,
  onOpenSupabaseModal,
  onOpenEditProfile,
  onOpenUsersManagement,
  onOpenSettings,
  onOpenGeminiGuide,
}) => {
  const { isKeyMissing, status } = useAiStatus();
  const isNetlifyEnv = status?.environment === 'netlify';
  const duplicateCount = items.filter(
    (i) => i.duplicateCheck?.isDuplicateTopic || i.isExactDuplicateOf
  ).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-2xs">
      {/* Mobile Layout (< sm): First line = Logo + Name + Description; Second line = Install app, Save link, User Box */}
      <div className="sm:hidden px-4 py-2.5 space-y-2.5">
        {/* Line 1: Logo, Name, Description */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/25 shrink-0">
            <Bookmark className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base font-bold text-neutral-900 tracking-tight leading-tight">
                ReewAI
              </h1>
              {isKeyMissing ? (
                <button
                  id="btn-nav-gemini-alert-mobile"
                  type="button"
                  onClick={onOpenGeminiGuide}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 animate-pulse"
                  title="GEMINI_API_KEY no configurada en Netlify. Pulsa para ver guía."
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Sin GEMINI_API_KEY</span>
                </button>
              ) : (
                <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                  IA
                </span>
              )}
              <span className="text-[9px] font-mono font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/80">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 truncate leading-snug">
              Reel & Web Saver AI • Guarda y resume sin duplicar
            </p>
          </div>
        </div>

        {/* Line 2: Install App, Save Link, User Box */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 shrink-0">
            {duplicateCount > 0 && (
              <button
                id="btn-toggle-duplicate-filter-nav-mobile"
                type="button"
                onClick={onToggleDuplicateFilter}
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  filterDuplicateOnly
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title="Filtrar duplicados"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px] font-bold">{duplicateCount} dup.</span>
              </button>
            )}
            <PWAInstallButton />
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-add-link-header-mobile"
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Guardar Enlace</span>
            </button>
            <UserMenu
              onOpenAuthModal={onOpenAuthModal}
              onOpenSupabaseModal={onOpenSupabaseModal}
              onOpenEditProfile={onOpenEditProfile}
              onOpenUsersManagement={onOpenUsersManagement}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      </div>

      {/* Desktop & Tablet Layout (>= sm) */}
      <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 shrink-0">
            <Bookmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight flex items-baseline gap-1.5">
                <span>ReewAI</span>
                <span className="text-xs sm:text-sm font-normal text-neutral-500">(Reel & Web Saver AI)</span>
              </h1>
              {isKeyMissing ? (
                <button
                  id="btn-nav-gemini-alert-desktop"
                  type="button"
                  onClick={onOpenGeminiGuide}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                  title={
                    isNetlifyEnv
                      ? 'Falta configurar o activar GEMINI_API_KEY en Netlify. Haz clic para ver el diagnóstico.'
                      : 'GEMINI_API_KEY no detectada en esta vista previa. Si la configuraste en Netlify, pruébala directamente en tu enlace de Netlify.'
                  }
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>
                    {isNetlifyEnv ? 'Falta GEMINI_API_KEY en Netlify' : 'Falta GEMINI_API_KEY (Vista previa)'}
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  <Sparkles className="w-3 h-3 text-violet-600" />
                  Multi-usuario + IA
                </span>
              )}
              <span className="inline-flex items-center text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200/80">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-neutral-500 truncate">
              Guarda y resume reels de Instagram, Facebook y webs sin duplicar contenido
            </p>
          </div>
        </div>

        {/* Action Controls: PWA, Save Link, User Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {duplicateCount > 0 && (
            <button
              id="btn-toggle-duplicate-filter-nav"
              type="button"
              onClick={onToggleDuplicateFilter}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filterDuplicateOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Filtrar enlaces marcados como temas similares o duplicados"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{duplicateCount} duplicados</span>
            </button>
          )}

          <PWAInstallButton />

          <button
            id="btn-add-link-header"
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-neutral-900/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Guardar Enlace</span>
          </button>

          {/* Professional User Management */}
          <div className="pl-1 border-l border-neutral-200">
            <UserMenu
              onOpenAuthModal={onOpenAuthModal}
              onOpenSupabaseModal={onOpenSupabaseModal}
              onOpenEditProfile={onOpenEditProfile}
              onOpenUsersManagement={onOpenUsersManagement}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

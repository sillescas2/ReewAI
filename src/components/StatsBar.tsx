import React, { useRef } from 'react';
import { Search, Filter, Table, LayoutGrid, X, Download, Upload, AlertTriangle, ChevronLeft, ChevronRight, Globe, Video, Instagram, Facebook, Layers, Tag } from 'lucide-react';
import { PlatformType } from '../types';

interface StatsBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedPlatform: PlatformType | 'all';
  onPlatformChange: (p: PlatformType | 'all') => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  categories: string[];
  categoryColors?: Record<string, string>;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  filterDuplicateOnly: boolean;
  onToggleDuplicateFilter: () => void;
  totalFilteredCount: number;
  totalAllCount: number;
  onExportData: () => void;
  onImportData?: (items: any[]) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedPlatform,
  onPlatformChange,
  selectedCategory,
  onCategoryChange,
  categories,
  categoryColors,
  viewMode,
  onViewModeChange,
  filterDuplicateOnly,
  onToggleDuplicateFilter,
  totalFilteredCount,
  totalAllCount,
  onExportData,
  onImportData,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.items || []);
        if (Array.isArray(list) && list.length > 0 && onImportData) {
          onImportData(list);
        }
      } catch (err) {
        console.error('Error importing JSON:', err);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const platforms: Array<{
    id: PlatformType | 'all';
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'all',
      label: 'Todas las plataformas',
      shortLabel: 'Todas',
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      id: 'instagram',
      label: 'Instagram Reels',
      shortLabel: 'Instagram',
      icon: <Instagram className="w-3.5 h-3.5 text-pink-500" />,
    },
    {
      id: 'facebook',
      label: 'Facebook Reels',
      shortLabel: 'Facebook',
      icon: <Facebook className="w-3.5 h-3.5 text-blue-500" />,
    },
    {
      id: 'web',
      label: 'Artículos Web',
      shortLabel: 'Webs',
      icon: <Globe className="w-3.5 h-3.5 text-emerald-500" />,
    },
    {
      id: 'youtube',
      label: 'YouTube',
      shortLabel: 'YouTube',
      icon: <Video className="w-3.5 h-3.5 text-red-500" />,
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      shortLabel: 'TikTok',
      icon: <Video className="w-3.5 h-3.5 text-neutral-800" />,
    },
  ];

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white border-b border-neutral-200 py-3.5 px-3 sm:px-6 lg:px-8 space-y-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            id="input-search-query"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, resumen, autor, URL o tags..."
            className="w-full pl-9 pr-9 py-2 text-sm bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
          />
          {searchQuery && (
            <button
              id="btn-clear-search"
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Platform filter dropdown + Duplicate filter + View switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filter Dropdown (formerly category filter) */}
          <div className="relative">
            <select
              id="select-platform-filter"
              value={selectedPlatform}
              onChange={(e) => onPlatformChange(e.target.value as PlatformType | 'all')}
              className="text-xs sm:text-sm bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-2 pr-7 text-neutral-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer"
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Duplicates only toggle */}
          <button
            id="btn-filter-duplicates"
            type="button"
            onClick={onToggleDuplicateFilter}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filterDuplicateOnly
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filterDuplicateOnly ? 'text-white' : 'text-amber-500'}`} />
            <span>Duplicados</span>
          </button>

          {/* Hidden File Input for JSON import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Export & Import Data Buttons */}
          <div className="flex items-center gap-1">
            <button
              id="btn-export-data"
              type="button"
              onClick={onExportData}
              title="Exportar colección como archivo JSON (para llevar a otro dispositivo)"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {onImportData && (
              <button
                id="btn-import-data"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Importar enlaces desde archivo JSON guardado en el móvil o PC"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Importar</span>
              </button>
            )}
          </div>

          {/* Table / Grid view toggle */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              id="btn-view-table"
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
            <button
              id="btn-view-cards"
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs - Replaces former platform tabs strip */}
      <div className="max-w-7xl mx-auto pt-1">
        {/* Header line for category label + count on mobile & desktop */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pb-1.5">
          <div className="flex items-center gap-1.5 font-medium text-neutral-700">
            <Tag className="w-3.5 h-3.5 text-neutral-500" />
            <span>Filtrar por categoría:</span>
          </div>

          <div className="whitespace-nowrap">
            Mostrando <span className="font-bold text-neutral-900">{totalFilteredCount}</span> de{' '}
            <span className="font-semibold text-neutral-700">{totalAllCount}</span> enlaces
          </div>
        </div>

        {/* Scrollable Categories Row with visual indicators and navigation buttons */}
        <div className="relative flex items-center group">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-white shadow-sm border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shrink-0 mr-1.5 transition-colors cursor-pointer"
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Main button strip: flex, overflow-x-auto, with touch momentum scrolling */}
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto overflow-y-hidden py-1 px-0.5 scroll-smooth overscroll-x-contain [scrollbar-width:thin] touch-pan-x"
            style={{
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* 'Todas las categorías' Tab */}
            <button
              id="btn-category-all"
              type="button"
              onClick={() => onCategoryChange('all')}
              className={`inline-flex items-center gap-1.5 text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                selectedCategory === 'all'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="font-semibold">Todas</span>
            </button>

            {/* Individual Category Tabs */}
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const color = categoryColors?.[cat];
              return (
                <button
                  key={cat}
                  id={`btn-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={`inline-flex items-center gap-2 text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                    isActive
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300'
                  }`}
                >
                  {color ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: color }}
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
                  )}
                  <span className="font-semibold">{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-white shadow-sm border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shrink-0 ml-1.5 transition-colors cursor-pointer"
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Navigation Indicator / Helper for quick access */}
        <div className="sm:hidden flex items-center justify-between text-[11px] text-neutral-400 pt-1 px-0.5">
          <span>← Desliza horizontalmente para ver todas las categorías →</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="p-1 rounded-md bg-neutral-100 text-neutral-600 active:bg-neutral-200"
              aria-label="Desplazar izquierda"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="p-1 rounded-md bg-neutral-100 text-neutral-600 active:bg-neutral-200"
              aria-label="Desplazar derecha"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


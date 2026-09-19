import { PlatformType } from '../types';

export function getPlatformInfo(platform: PlatformType) {
  switch (platform) {
    case 'instagram':
      return {
        name: 'Instagram Reel',
        shortName: 'Instagram',
        badgeClass: 'bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 text-pink-700 border-pink-200/80',
        textClass: 'text-pink-600',
        iconColor: '#E1306C',
      };
    case 'facebook':
      return {
        name: 'Facebook Reel',
        shortName: 'Facebook',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        textClass: 'text-blue-600',
        iconColor: '#1877F2',
      };
    case 'tiktok':
      return {
        name: 'TikTok Video',
        shortName: 'TikTok',
        badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
        textClass: 'text-neutral-900',
        iconColor: '#000000',
      };
    case 'youtube':
      return {
        name: 'YouTube Shorts',
        shortName: 'YouTube',
        badgeClass: 'bg-red-50 text-red-700 border-red-200/80',
        textClass: 'text-red-600',
        iconColor: '#FF0000',
      };
    case 'web':
    default:
      return {
        name: 'Sitio Web / Artículo',
        shortName: 'Web',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        textClass: 'text-emerald-600',
        iconColor: '#059669',
      };
  }
}

export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function formatTimeAgo(isoDate: string): string {
  try {
    const now = Date.now();
    const past = new Date(isoDate).getTime();
    const diffHours = Math.floor((now - past) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Hace un momento';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return formatDate(isoDate);
  } catch {
    return isoDate;
  }
}

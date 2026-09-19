import { PlatformType, AnalyzeLinkResponse, TopicDuplicateCheck } from '../types';

/**
 * Client-Side Link Analyzer & Fallback
 * Used when the backend server is unreachable (e.g. when deployed statically to Netlify, GitHub Pages or Vercel
 * without an Express backend running, which returns HTML/404 on /api/analyze-link).
 */

export function detectClientPlatform(rawUrl: string): PlatformType {
  const url = rawUrl.toLowerCase();
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) return 'facebook';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'web';
}

export function cleanNormalizedUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    parsed.searchParams.delete('igsh');
    parsed.searchParams.delete('stkn');
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('utm_term');
    parsed.searchParams.delete('utm_content');
    parsed.searchParams.delete('mibextid');
    parsed.searchParams.delete('fbclid');
    parsed.searchParams.delete('ref');
    parsed.searchParams.delete('source');
    return parsed.toString().toLowerCase().replace(/\/+$/, '');
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

// Extract content ID / shortcode for popular social video platforms
export function extractMediaId(rawUrl: string, platform: PlatformType): string | null {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const pathname = parsed.pathname;

    if (platform === 'instagram') {
      const match = pathname.match(/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
      if (match) return match[1];
    } else if (platform === 'facebook') {
      const match = pathname.match(/(?:reel|reels|videos|watch|share\/v)\/([A-Za-z0-9_-]+)/i);
      if (match) return match[1];
      const vParam = parsed.searchParams.get('v');
      if (vParam) return vParam;
    } else if (platform === 'tiktok') {
      const match = pathname.match(/video\/([0-9]+)/i);
      if (match) return match[1];
    } else if (platform === 'youtube') {
      const vMatch = parsed.searchParams.get('v');
      if (vMatch) return vMatch;
      const shortMatch = pathname.match(/(?:shorts\/|embed\/)([A-Za-z0-9_-]+)/i);
      if (shortMatch) return shortMatch[1];
      if (parsed.hostname.includes('youtu.be')) {
        const id = pathname.replace(/^\/+/, '').split('/')[0];
        if (id) return id;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// Stopwords list to prevent false duplicates based on generic template words
const GENERIC_STOPWORDS = new Set([
  'instagram', 'instagram.com', 'facebook', 'facebook.com', 'tiktok', 'tiktok.com',
  'youtube', 'youtube.com', 'reel', 'reels', 'video', 'videos', 'corto', 'cortos',
  'recurso', 'guardado', 'guardada', 'guardados', 'guardadas', 'enlace', 'enlaces',
  'contenido', 'general', 'para', 'desde', 'sobre', 'artículo', 'articulo', 'tutorial',
  'consulta', 'proyectos', 'aplicar', 'ideas', 'técnicas', 'tecnicas', 'clave', 'extraidas',
  'extraídas', 'formato', 'sintetizado', 'optimizado', 'revision', 'revisión', 'rápida',
  'rapida', 'distracciones', 'categorizado', 'busqueda', 'búsqueda', 'instantanea', 'instantánea',
  'biblioteca', 'personal', 'creador', 'canal', 'cuenta', 'post', 'publicacion', 'publicación',
  'información', 'informacion', 'practica', 'práctica', 'conceptos', 'referencia', 'espacio',
  'trabajo', 'aprender', 'detalle', 'enfoque', 'enfocado', 'visto', 'estudio', 'esta', 'este',
  'estos', 'estas', 'como', 'todo', 'toda', 'todos', 'todas', 'hacer', 'tener', 'hace', 'momento'
]);

function extractMeaningfulKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents for comparison
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_STOPWORDS.has(w));
}

interface ExistingSummaryItem {
  id: string;
  url: string;
  originalUrl?: string;
  platform?: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
}

export async function analyzeLinkClientFallback(
  rawUrl: string,
  userNote: string | undefined,
  existingItems: ExistingSummaryItem[] = [],
  allowedCategories: string[] = [],
  manualTitle?: string,
  manualSummary?: string
): Promise<AnalyzeLinkResponse> {
  const url = rawUrl.trim();
  const normalized = cleanNormalizedUrl(url);
  const platform = detectClientPlatform(url);
  const mediaId = extractMediaId(url, platform);

  // 1. Check exact duplicate by normalized URL or identical media ID
  const exactMatch = existingItems.find((item) => {
    const itemNorm = cleanNormalizedUrl(item.originalUrl || item.url);
    if (itemNorm === normalized) return true;
    if (mediaId) {
      const itemMediaId = extractMediaId(item.originalUrl || item.url, item.platform as PlatformType || platform);
      if (itemMediaId && itemMediaId === mediaId) return true;
    }
    return false;
  });

  // 2. Extract slug, domain and author hints
  let domain = '';
  let pathname = '';
  let potentialAuthor = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = parsed.hostname.replace(/^www\./, '');
    pathname = parsed.pathname;

    // Detect creator handle in URL if present (e.g. instagram.com/creador_xyz/reel/...)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['p', 'reel', 'reels', 'tv'].includes(segments[1])) {
      potentialAuthor = `@${segments[0]}`;
    }
  } catch {
    domain = 'web';
  }

  // Generate readable words from URL path if it's an article/blog slug
  const slugWords = pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]/g, ' ')
    .replace(/\.(html|php|aspx|jsp)$/, '')
    .trim() || '';

  // Text to analyze for topic and category
  const effectiveDescription = manualSummary?.trim() || '';
  const combinedText = `${url} ${effectiveDescription} ${manualTitle || ''} ${userNote || ''} ${slugWords} ${domain}`.toLowerCase();

  let category = allowedCategories[0] || 'Sin categorías';
  let estimatedTime = 'Lectura 3 min';
  let sampleThumbnail = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60';
  let tags: string[] = [];

  if (platform === 'instagram') {
    estimatedTime = 'Reel 45s';
    sampleThumbnail = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60';
    tags = ['Instagram', 'Reel'];
  } else if (platform === 'facebook') {
    estimatedTime = 'Reel 50s';
    sampleThumbnail = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60';
    tags = ['Facebook', 'Reel'];
  } else if (platform === 'tiktok') {
    estimatedTime = 'Video 60s';
    sampleThumbnail = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60';
    tags = ['TikTok', 'Video'];
  } else if (platform === 'youtube') {
    estimatedTime = 'Video 3 min';
    sampleThumbnail = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60';
    tags = ['YouTube', 'Video'];
  } else {
    tags = ['Web', 'Lectura', domain];
  }

  // Topic classification mapped to user categories
  const findMatchingAllowed = (keywords: string[]): string | undefined => {
    return allowedCategories.find((c) => {
      const lowerCat = c.toLowerCase();
      return keywords.some((k) => lowerCat.includes(k));
    });
  };

  if (combinedText.includes('receta') || combinedText.includes('cocina') || combinedText.includes('pizza') || combinedText.includes('comida') || combinedText.includes('pasta') || combinedText.includes('postre')) {
    category = findMatchingAllowed(['receta', 'cocina', 'gastronomia']) || allowedCategories[0] || 'Cocina y Recetas';
    tags.push('Cocina', 'Recetas');
    sampleThumbnail = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60';
  } else if (combinedText.includes('marketing') || combinedText.includes('creador') || combinedText.includes('gancho') || combinedText.includes('retencion') || combinedText.includes('algoritmo') || combinedText.includes('ventas') || combinedText.includes('vender')) {
    category = findMatchingAllowed(['marketing', 'ventas', 'negocios']) || allowedCategories[0] || 'Marketing Digital';
    tags.push('Marketing', 'Estrategia', 'Crecimiento');
    sampleThumbnail = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60';
  } else if (combinedText.includes('ai') || combinedText.includes('ia') || combinedText.includes('tech') || combinedText.includes('router') || combinedText.includes('wifi') || combinedText.includes('informatica') || combinedText.includes('codigo') || combinedText.includes('software')) {
    category = findMatchingAllowed(['tecnolog', 'ia', 'informatica', 'software']) || allowedCategories[0] || 'Tecnología e IA';
    tags.push('Tecnología', 'Informática');
    sampleThumbnail = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60';
  } else if (combinedText.includes('ahorro') || combinedText.includes('banco') || combinedText.includes('dinero') || combinedText.includes('finanza') || combinedText.includes('inversion') || combinedText.includes('cripto')) {
    category = findMatchingAllowed(['finanz', 'dinero', 'invers']) || allowedCategories[0] || 'Finanzas e Inversión';
    tags.push('Finanzas', 'Ahorro', 'Inversión');
    sampleThumbnail = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=500&auto=format&fit=crop&q=60';
  } else if (combinedText.includes('habito') || combinedText.includes('rutina') || combinedText.includes('tiempo') || combinedText.includes('productiv') || combinedText.includes('organizacion')) {
    category = findMatchingAllowed(['productiv', 'habito', 'organiz']) || allowedCategories[0] || 'Productividad & Hábitos';
    tags.push('Productividad', 'Hábitos');
  } else if (combinedText.includes('fitness') || combinedText.includes('gym') || combinedText.includes('salud') || combinedText.includes('ejercicio') || combinedText.includes('entrenamiento')) {
    category = findMatchingAllowed(['salud', 'fitness', 'deporte']) || allowedCategories[0] || 'Fitness y Salud';
    tags.push('Fitness', 'Salud');
  } else {
    category = allowedCategories[0] || 'Sin categorías';
  }

  // Derive title with priority on manualTitle
  let title = '';
  if (manualTitle && manualTitle.trim().length >= 2) {
    title = manualTitle.trim();
  } else if (userNote && userNote.trim().length >= 4) {
    title = userNote.trim();
  } else if (effectiveDescription) {
    const firstLine = effectiveDescription.split('\n')[0].replace(/#\S+/g, '').trim();
    title = firstLine.length >= 4 ? firstLine.slice(0, 80) : '';
  }
  
  if (!title) {
    if (slugWords && slugWords.length > 5 && !slugWords.match(/^[0-9a-zA-Z_-]{9,25}$/)) {
      title = slugWords.charAt(0).toUpperCase() + slugWords.slice(1);
    } else if (platform === 'instagram') {
      title = mediaId ? `Reel de Instagram (${mediaId})` : `Reel de Instagram (${domain})`;
    } else if (platform === 'facebook') {
      title = mediaId ? `Reel de Facebook (${mediaId})` : `Video Reel de Facebook (${domain})`;
    } else if (platform === 'tiktok') {
      title = mediaId ? `Video de TikTok #${mediaId.slice(-6)}` : `Video de TikTok (${domain})`;
    } else if (platform === 'youtube') {
      title = mediaId ? `Video de YouTube (${mediaId})` : `Video de YouTube (${domain})`;
    } else {
      title = `Artículo de ${domain}`;
    }
  }

  // Derive author
  let authorOrChannel = potentialAuthor || `@${domain.split('.')[0]}`;
  if (platform === 'instagram' && !potentialAuthor) {
    authorOrChannel = 'Creador Instagram';
  } else if (platform === 'facebook' && !potentialAuthor) {
    authorOrChannel = 'Creador Facebook';
  }

  // Derive summary prioritizing manualSummary
  let summary = '';
  if (manualSummary && manualSummary.trim().length >= 4) {
    summary = `Descripción transcrita del Reel: "${manualSummary.trim()}". Categorizado en ${category} para consulta rápida.`;
  } else if (userNote && userNote.trim().length >= 4) {
    summary = `Contenido enfocado en: "${userNote.trim()}". Guardado con notas y categorizado como ${category} para consulta rápida.`;
  } else if (mediaId) {
    summary = `Video Reel de ${platform === 'instagram' ? 'Instagram' : platform} [ID: ${mediaId}]. Guardado en tu biblioteca para consulta rápida y referencia.`;
  } else {
    summary = `Recurso guardado desde ${domain || platform}. Contenido indexado para acceso rápido y consulta en tus proyectos.`;
  }

  const keyTakeaways = [
    userNote
      ? `Nota clave del usuario: "${userNote.trim()}".`
      : `Video original de ${platform === 'instagram' ? 'Instagram' : platform} guardado para referencia.`,
    `Categorizado en "${category}" para búsqueda y organización rápida.`,
    'Acceso directo al enlace original sin perder el contenido ni las notas.'
  ];

  // 3. Duplicate check against existing items
  let duplicateCheck: TopicDuplicateCheck = {
    isDuplicateTopic: false,
    similarityScore: 0,
  };

  if (exactMatch) {
    duplicateCheck = {
      isDuplicateTopic: true,
      duplicateReason: `Ya tienes guardado exactamente este mismo enlace en tu biblioteca: "${exactMatch.title}".`,
      similarExistingTitle: exactMatch.title,
      similarExistingId: exactMatch.id,
      similarityScore: 100,
    };
  } else {
    // Compare ONLY meaningful semantic keywords (excluding generic stopwords)
    const newKeywords = extractMeaningfulKeywords(title + ' ' + (userNote || ''));

    // If there are no substantive keywords (e.g. just raw Reel IDs with no note), DO NOT flag as duplicate!
    if (newKeywords.length >= 2) {
      for (const item of existingItems) {
        // If they are from the same platform and have DIFFERENT media IDs, they are different videos
        const itemMediaId = extractMediaId(item.originalUrl || item.url, item.platform as PlatformType || platform);
        if (mediaId && itemMediaId && mediaId !== itemMediaId && (!userNote || userNote.length < 6)) {
          // Distinct media IDs and no deep user note -> different content!
          continue;
        }

        const existingKeywords = extractMeaningfulKeywords(item.title + ' ' + (item.summary || ''));
        if (existingKeywords.length === 0) continue;

        let commonMatches = 0;
        const matchedWords: string[] = [];
        for (const kw of newKeywords) {
          if (existingKeywords.includes(kw)) {
            commonMatches++;
            matchedWords.push(kw);
          }
        }

        // Must match at least 3 substantive topic words, or 2 very long specific words (>6 chars)
        const hasStrongMatch = commonMatches >= 3 || (commonMatches >= 2 && matchedWords.every((w) => w.length >= 6));

        if (hasStrongMatch) {
          const score = Math.min(90, Math.round(50 + commonMatches * 15));
          duplicateCheck = {
            isDuplicateTopic: true,
            duplicateReason: `Coincidencia temática con "${item.title}" (${item.category}). Palabras en común: ${matchedWords.join(', ')}.`,
            similarExistingTitle: item.title,
            similarExistingId: item.id,
            similarityScore: score,
          };
          break;
        }
      }
    }
  }

  // Constrain category to user's allowed categories
  let finalCategory = category;
  if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
    const match = allowedCategories.find((c) => c.toLowerCase() === category.toLowerCase());
    if (match) {
      finalCategory = match;
    } else {
      const defaultMatch = allowedCategories.find((c) => c.toLowerCase() === 'sin categorías');
      finalCategory = defaultMatch || allowedCategories[0] || 'Sin categorías';
    }
  }

  return {
    success: true,
    data: {
      platform,
      title,
      summary,
      keyTakeaways,
      category: finalCategory,
      tags: Array.from(new Set(tags)).slice(0, 5),
      estimatedTime,
      authorOrChannel,
      thumbnailUrl: sampleThumbnail,
      duplicateCheck,
      exactDuplicateFound: exactMatch
        ? {
            id: exactMatch.id,
            title: exactMatch.title,
            url: exactMatch.url,
          }
        : undefined,
    },
  };
}


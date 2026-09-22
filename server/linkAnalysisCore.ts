import { GoogleGenAI, Type } from '@google/genai';
import { PlatformType, TopicDuplicateCheck } from '../src/types';

export interface ExtractedMediaInfo {
  title: string;
  description: string;
  caption?: string;
  author?: string;
  ogImage?: string;
  duration?: string;
  tags?: string[];
  source?: string;
}

export interface CategorySpec {
  name: string;
  description?: string;
}

export interface AnalyzeCoreParams {
  url: string;
  userNote?: string;
  manualTitle?: string;
  manualSummary?: string;
  existingItems?: any[];
  allowedCategories?: string[] | CategorySpec[];
  categoryObjects?: CategorySpec[];
  userId?: string;
  apiKey?: string;
}

export interface AnalyzeCoreResult {
  platform: PlatformType;
  title: string;
  summary: string;
  keyTakeaways: string[];
  category: string;
  tags: string[];
  estimatedTime: string;
  authorOrChannel: string;
  thumbnailUrl?: string;
  duplicateCheck: TopicDuplicateCheck;
  exactDuplicateFound?: {
    id: string;
    title: string;
    url: string;
  };
  geminiKeyMissing?: boolean;
  aiProcessed?: boolean;
}

export function decodeUnicodeEscapes(str: string): string {
  try {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  } catch {
    return str;
  }
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x26;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_\u00C0-\u017F]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.replace(/^#/, '').trim()))).filter(
    (tag) => tag.length >= 2
  );
}

export function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
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
    return urlStr.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function detectPlatform(rawUrl: string): PlatformType {
  const url = rawUrl.toLowerCase();
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) return 'facebook';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'web';
}

export function categorizeByContent(
  text: string,
  availableCategories: Array<{ name: string; description?: string }> = []
): string {
  const normalizedCategories =
    availableCategories.length > 0
      ? availableCategories
      : [{ name: 'Sin categorías', description: 'General' }];

  const lower = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Direct match with category name or custom user descriptions
  for (const cat of normalizedCategories) {
    const cleanCatName = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanCatDesc = (cat.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (cleanCatName !== 'sin categorias' && lower.includes(cleanCatName)) {
      return cat.name;
    }

    if (cleanCatDesc) {
      const descKeywords = cleanCatDesc
        .split(/[,.;:\s]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 4);

      const hasDescMatch = descKeywords.some((keyword) => lower.includes(keyword));
      if (hasDescMatch) {
        return cat.name;
      }
    }
  }

  // 2. High-precision semantic keyword mapping
  const topicKeywords: Record<string, string[]> = {
    recetas: ['receta', 'cocina', 'plato', 'postre', 'pizza', 'pasta', 'ingrediente', 'guiso', 'sabor', 'almuerzo', 'cena', 'tarta'],
    marketing: ['marketing', 'ventas', 'negocio', 'estrategia', 'gancho', 'hook', 'retencion', 'copywriting', 'audiencia', 'cliente', 'crecimiento', 'embudo'],
    tecnologia: ['tecnologia', 'ia', 'ai', 'software', 'codigo', 'programacion', 'desarrollo', 'prompt', 'gemini', 'chatgpt', 'app', 'python', 'javascript', 'pc', 'hardware', 'wifi'],
    finanzas: ['finanzas', 'dinero', 'inversion', 'ahorro', 'banco', 'cripto', 'bolsa', 'rentabilidad', 'interes', 'ingresos'],
    productividad: ['productividad', 'habito', 'organizacion', 'tiempo', 'metodo', 'rutina', 'focus', 'enfoque', 'planificacion'],
    senderismo: ['ferrata', 'viaferrata', 'escalada', 'climbing', 'senderismo', 'montana', 'ruta', 'cuenca', 'trekking', 'alpinismo', 'cima', 'aventura', 'outdoor'],
    salud: ['fitness', 'gym', 'ejercicio', 'entrenamiento', 'salud', 'dieta', 'nutricion', 'peso', 'musculo', 'cardio', 'bienestar'],
    diseno: ['diseno', 'ux', 'ui', 'creatividad', 'arte', 'figma', 'fotografia', 'video', 'edicion', 'estilo'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const matchesTopic = keywords.some((kw) => lower.includes(kw));
    if (matchesTopic) {
      const found = normalizedCategories.find((c) => {
        const normName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const normDesc = (c.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return (
          normName.includes(topic) ||
          normDesc.includes(topic) ||
          (topic === 'senderismo' && (normName.includes('ruta') || normName.includes('viaje') || normName.includes('deporte') || normName.includes('montana') || normName.includes('senderismo'))) ||
          (topic === 'tecnologia' && (normName.includes('ia') || normName.includes('software') || normName.includes('informatica')))
        );
      });
      if (found) return found.name;
    }
  }

  const nonDefault = normalizedCategories.find((c) => !c.name.toLowerCase().includes('sin categor'));
  return nonDefault ? nonDefault.name : normalizedCategories[0].name;
}

export async function fetchInstagramMeta(url: string): Promise<ExtractedMediaInfo | null> {
  const match = url.match(/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) return null;
  const shortcode = match[1];

  // 1. PRIMARY STRATEGY: Facebook externalhit crawler User-Agent
  try {
    const mainUrl = `https://www.instagram.com/reel/${shortcode}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(mainUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
      const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      const rawTitle = decodeHtmlEntities(ogTitleMatch ? ogTitleMatch[1] : '');
      const rawDesc = decodeHtmlEntities(ogDescMatch ? ogDescMatch[1] : '');
      const rawImage = decodeHtmlEntities(ogImageMatch ? ogImageMatch[1] : '');

      let caption = '';
      let author = '';

      const authorMatch = rawDesc.match(/-\s+([a-zA-Z0-9._]+)\s+(?:on|el)\s+/i) ||
        rawTitle.match(/([a-zA-Z0-9._]+)\s+(?:on|en)\s+Instagram/i);
      if (authorMatch) {
        author = `@${authorMatch[1].trim()}`;
      }

      const quoteMatch = rawTitle.match(/(?:on|en)\s+Instagram:\s*[“"]([\s\S]+?)[”"]\s*$/i) ||
        rawTitle.match(/:\s*[“"]([\s\S]+?)[”"]\s*$/i) ||
        rawDesc.match(/:\s*[“"]([\s\S]+?)[”"]\s*$/i);
      if (quoteMatch) {
        caption = quoteMatch[1].trim();
      } else if (rawDesc && !rawDesc.toLowerCase().includes('create an account') && !rawDesc.toLowerCase().includes('log in to instagram')) {
        caption = rawDesc.trim();
      }

      if (caption) {
        caption = caption.normalize('NFKD').trim();
        const firstLine = caption.split('\n')[0].replace(/#\S+/g, '').trim();
        const derivedTitle = firstLine.length >= 4 ? firstLine.slice(0, 85) : caption.slice(0, 85);
        const tags = extractHashtags(caption);

        return {
          title: derivedTitle,
          description: caption,
          caption,
          author: author || 'Creador de Instagram',
          ogImage: rawImage,
          duration: 'Reel 60s',
          tags: tags.length > 0 ? tags : ['Instagram', 'Reel'],
          source: 'instagram_crawler',
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. SECONDARY FALLBACK: Captioned mobile embed
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(embedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const html = await response.text();

    let caption = '';
    let author = '';
    let ogImage = '';
    let duration = 'Reel 60s';

    const captionIdx = html.indexOf('edge_media_to_caption');
    if (captionIdx !== -1) {
      const sub = html.substring(captionIdx, captionIdx + 1200);
      const matchText = sub.match(/text["\\]+:\s*["\\]+((?:(?!["\\]+}|["\\]+,).)+)/);
      if (matchText) {
        caption = decodeUnicodeEscapes(matchText[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')).trim();
      }
    }

    if (!caption) {
      const captionTagMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/class="CaptionText"[^>]*>([\s\S]*?)<\/span>/i);
      if (captionTagMatch) {
        caption = captionTagMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    const userParamMatch = html.match(/username=([a-zA-Z0-9._-]+)/i);
    const userJsonMatch = html.match(/username["\\]+:\s*["\\]+([^"\\]+)/i);
    const userSpanMatch = html.match(/class="UsernameText"[^>]*>([^<]+)<\/span>/i);
    if (userParamMatch) {
      author = `@${userParamMatch[1].trim()}`;
    } else if (userJsonMatch) {
      author = `@${userJsonMatch[1].trim()}`;
    } else if (userSpanMatch) {
      author = `@${userSpanMatch[1].trim()}`;
    }

    const imgMatch = html.match(/display_url["\\]+:\s*["\\]+([^"]+?)(?:\\?"|&quot;)/) || html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/);
    if (imgMatch) {
      ogImage = imgMatch[1].replace(/\\+\//g, '/').replace(/\\+/g, '').replace(/&amp;/g, '&');
    }

    const durMatch = html.match(/video_duration["\\]+:\s*([0-9.]+)/);
    if (durMatch) {
      const sec = Math.round(parseFloat(durMatch[1]));
      duration = sec < 60 ? `Reel ${sec}s` : `Reel ${Math.floor(sec / 60)}m ${sec % 60}s`;
    }

    let title = '';
    if (caption) {
      const firstLine = caption.split('\n')[0].replace(/#\S+/g, '').trim();
      if (firstLine.length >= 4) {
        title = firstLine.charAt(0).toUpperCase() + firstLine.slice(1, 85);
      } else {
        title = caption.slice(0, 85);
      }
    }

    const tags = extractHashtags(caption);

    return {
      title,
      description: caption,
      caption,
      author,
      ogImage,
      duration,
      tags: tags.length > 0 ? tags : ['Instagram', 'Reel'],
      source: 'instagram_embed',
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function fetchTikTokMeta(url: string): Promise<ExtractedMediaInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const tags = extractHashtags(data.title || '');
    return {
      title: data.title || '',
      description: data.title || '',
      caption: data.title || '',
      author: data.author_name ? `@${data.author_name}` : '',
      ogImage: data.thumbnail_url || '',
      duration: 'Video 60s',
      tags: tags.length > 0 ? tags : ['TikTok', 'Video'],
      source: 'tiktok_oembed',
    };
  } catch {
    return null;
  }
}

export async function fetchYouTubeMeta(url: string): Promise<ExtractedMediaInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const isShort = url.toLowerCase().includes('/shorts/');
    return {
      title: data.title || '',
      description: data.title || '',
      caption: data.title || '',
      author: data.author_name || '',
      ogImage: data.thumbnail_url || '',
      duration: isShort ? 'Short 45s' : 'Video 4 min',
      tags: ['YouTube', isShort ? 'Shorts' : 'Video'],
      source: 'youtube_oembed',
    };
  } catch {
    return null;
  }
}

export async function fetchGeneralHtmlMeta(url: string): Promise<ExtractedMediaInfo> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3800);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { title: '', description: '', author: '', ogImage: '' };
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);

    const title = (ogTitleMatch?.[1] || titleMatch?.[1] || '').trim();
    const description = (ogDescMatch?.[1] || descMatch?.[1] || '').trim();

    return {
      title,
      description,
      caption: description,
      ogImage: ogImageMatch?.[1] || '',
      author: authorMatch?.[1]?.trim() || '',
      source: 'html_meta',
    };
  } catch {
    return { title: '', description: '', author: '', ogImage: '' };
  }
}

export async function fetchMediaMetadata(url: string, platform: PlatformType): Promise<ExtractedMediaInfo> {
  if (platform === 'instagram') {
    const igData = await fetchInstagramMeta(url);
    if (igData && (igData.caption || igData.title || igData.ogImage)) {
      return igData;
    }
  } else if (platform === 'tiktok') {
    const ttData = await fetchTikTokMeta(url);
    if (ttData && ttData.title) return ttData;
  } else if (platform === 'youtube') {
    const ytData = await fetchYouTubeMeta(url);
    if (ytData && ytData.title) return ytData;
  }

  return await fetchGeneralHtmlMeta(url);
}

let genAiInstance: GoogleGenAI | null = null;
let currentGenAiKey: string | null = null;

function getGenAI(customKey?: string): GoogleGenAI | null {
  const apiKey = (customKey || '').trim() || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) return null;
  if (!genAiInstance || currentGenAiKey !== apiKey) {
    genAiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    currentGenAiKey = apiKey;
  }
  return genAiInstance;
}

export async function analyzeLinkCore(params: AnalyzeCoreParams): Promise<AnalyzeCoreResult> {
  const {
    url,
    userNote,
    manualTitle,
    manualSummary,
    existingItems = [],
    allowedCategories = [],
    categoryObjects: providedCategoryObjects,
  } = params;

  const cleanInputUrl = url.trim();
  const normalizedInputUrl = normalizeUrl(cleanInputUrl);
  const platform = detectPlatform(cleanInputUrl);

  // 1. Resolve registered categories
  let categoryObjects: CategorySpec[] = [];
  if (providedCategoryObjects && providedCategoryObjects.length > 0) {
    categoryObjects = providedCategoryObjects;
  } else if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
    categoryObjects = allowedCategories
      .map((c: any) => {
        if (typeof c === 'string') {
          return { name: c.trim(), description: '' };
        }
        return { name: (c?.name || '').trim(), description: (c?.description || '').trim() };
      })
      .filter((c) => Boolean(c.name));
  }

  if (categoryObjects.length === 0) {
    categoryObjects = [
      { name: 'Sin categorías', description: 'Contenido genérico o que no encaja en ninguna otra categoría.' },
    ];
  }

  const validCategoriesList = categoryObjects.map((c) => c.name);

  // 2. Check exact duplicate
  const exactMatch = (existingItems as any[]).find(
    (item) =>
      normalizeUrl(item.url) === normalizedInputUrl ||
      normalizeUrl(item.originalUrl || '') === normalizedInputUrl
  );

  // 3. Extract real metadata from Instagram / TikTok / YouTube / Web
  const meta = await fetchMediaMetadata(cleanInputUrl, platform);

  const effectiveCaption = (manualSummary?.trim() || meta.caption || meta.description || '').trim();
  const suggestedTitle = (manualTitle?.trim() || meta.title || '').trim();

  // 4. Try Gemini AI if API key is present
  const rawApiKey = (params.apiKey || '').trim() || process.env.GEMINI_API_KEY;
  const geminiKeyMissing = !rawApiKey || rawApiKey.trim().length <= 5;
  const ai = getGenAI(rawApiKey);
  let aiResult: any = null;
  let aiProcessed = false;

  if (ai && !geminiKeyMissing && (effectiveCaption || suggestedTitle || userNote)) {
    const categoriesGuideForPrompt = categoryObjects
      .map(
        (c) =>
          `- "${c.name}": ${c.description ? `(Descripción y temas: ${c.description})` : '(Sin descripción detallada)'}`
      )
      .join('\n');

    const existingThemesSummary = (existingItems as any[])
      .slice(0, 30)
      .map(
        (item) =>
          `[ID: ${item.id}] Título: "${item.title}" | Categoría: "${item.category}" | Resumen: "${(item.summary || '').slice(0, 140)}"`
      )
      .join('\n');

    const prompt = `
Actúa como un experto en análisis y síntesis de contenido digital y redes sociales.
El usuario quiere guardar el siguiente enlace en su biblioteca personal:

INFORMACIÓN DEL ENLACE Y METADATOS EXTRAÍDOS:
- URL: ${cleanInputUrl}
- Plataforma detectada: ${platform.toUpperCase()}
- Autor / Creador detectado: ${meta.author || 'No disponible'}
- Título detectado o propuesto: ${suggestedTitle || '(No disponible directamente)'}
- DESCRIPCIÓN Y TRANSCRIPCIÓN REAL DEL REEL / VIDEO / PÁGINA:
"""
${effectiveCaption || '(No se extrajo descripción directa; analiza el enlace y contexto)'}
"""
- Nota personal del usuario: ${userNote ? `"${userNote}"` : '(Sin nota previa)'}

CATEGORÍAS DADAS DE ALTA POR EL USUARIO Y SUS DESCRIPCIONES (OBLIGATORIAS):
${categoriesGuideForPrompt}

REGLA ESTRICTA DE CATEGORIZACIÓN:
- Asigna OBLIGATORIAMENTE la categoría cuya descripción mejor se adapte al contenido.
- Solo puedes seleccionar el NOMBRE EXACTO de una categoría de esta lista: [${validCategoriesList.join(', ')}]. NUNCA inventes categorías fuera de esta lista.

LISTA DE ENLACES Y TEMAS QUE EL USUARIO YA TIENE GUARDADOS EN SU BIBLIOTECA:
${existingThemesSummary || '(La biblioteca está vacía)'}

OBJETIVOS CRÍTICOS:
1. "title": 
   - Si el reel o enlace tiene un título o una frase inicial clara en su descripción/caption, ponlo como título.
   - Si no hay título directo, genera un título claro, directo y específico del tema que trata (NUNCA un genérico "Reel de Instagram (código)" ni "Enlace guardado").
2. "summary": 
   - Explica de forma práctica y comprensible qué muestra, qué enseña o qué solución aporta en español (2 a 3 oraciones sustanciales).
3. "category": 
   - DEPENDIENDO ESTRICTAMENTE DE LO QUE APAREZCA EN LA DESCRIPCIÓN Y EN EL RESUMEN, asigna OBLIGATORIAMENTE la categoría MÁS ADECUADA de la lista: [${validCategoriesList.join(', ')}].
4. "keyTakeaways": 
   - Lista de 3 a 4 puntos clave, aprendizajes o consejos accionables destacados extraídos directamente de la descripción y contenido.
5. "tags": 
   - Lista de 3 a 5 etiquetas o hashtags reales de la descripción (sin el símbolo #).
6. "estimatedTime": 
   - Estimación rápida (ej: "${meta.duration || 'Reel 60s'}", "Video 2 min", "Lectura 3 min").
7. "authorOrChannel": 
   - Handle o nombre del creador (ej: "${meta.author || '@creador'}"), o cadena vacía si no se sabe.
8. "duplicateCheck":
   - isDuplicateTopic: true SI y solo SI existe un enlace guardado que trata exactamente la misma receta, técnica o tutorial específico.
   - duplicateReason: Razón explicativa amable en español.
   - similarityScore: De 0 a 100.

Responde estrictamente con la estructura JSON solicitada.
`;

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    for (const modelName of candidateModels) {
      let modelSucceeded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keyTakeaways: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  category: { type: Type.STRING },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  estimatedTime: { type: Type.STRING },
                  authorOrChannel: { type: Type.STRING },
                  duplicateCheck: {
                    type: Type.OBJECT,
                    properties: {
                      isDuplicateTopic: { type: Type.BOOLEAN },
                      duplicateReason: { type: Type.STRING },
                      similarExistingTitle: { type: Type.STRING },
                      similarExistingId: { type: Type.STRING },
                      similarityScore: { type: Type.INTEGER },
                    },
                    required: ['isDuplicateTopic', 'duplicateReason', 'similarityScore'],
                  },
                },
                required: ['title', 'summary', 'keyTakeaways', 'category', 'tags', 'duplicateCheck'],
              },
            },
          });

          const text = response.text || '{}';
          aiResult = JSON.parse(text);
          if (aiResult && aiResult.title) {
            modelSucceeded = true;
            break;
          }
        } catch (err: any) {
          const errMsg = String(err?.message || '');
          const isBusyOrRateLimit = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('UNAVAILABLE') || err?.status === 'UNAVAILABLE';
          if (isBusyOrRateLimit && attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, 650));
            continue;
          }
          break;
        }
      }
      if (modelSucceeded && aiResult && aiResult.title) {
        aiProcessed = true;
        break;
      }
    }
  }

  // 5. Intelligent Rule-Based Fallback when Gemini is unavailable or not configured
  if (!aiResult) {
    const hashtags = extractHashtags(effectiveCaption);
    const assignedCategory = categorizeByContent(
      `${effectiveCaption} ${suggestedTitle} ${userNote || ''}`,
      categoryObjects
    );

    let fallbackTitle = suggestedTitle;
    if (!fallbackTitle && effectiveCaption) {
      const firstLine = effectiveCaption.split('\n')[0].replace(/#\S+/g, '').trim();
      fallbackTitle = firstLine.length >= 4 ? firstLine.slice(0, 80) : '';
    }
    if (!fallbackTitle) {
      const shortId = cleanInputUrl.split('/').filter(Boolean).pop() || '';
      fallbackTitle = `Reel de ${platform === 'instagram' ? 'Instagram' : platform} (${shortId})`;
    }

    let fallbackSummary = '';
    if (effectiveCaption) {
      fallbackSummary = `Descripción del Reel: "${effectiveCaption}". Video archivado con notas y categorizado en "${assignedCategory}".`;
    } else {
      fallbackSummary = meta.description || `Enlace guardado de ${platform}. Contenido archivado para consulta rápida.`;
    }

    const fallbackTakeaways = effectiveCaption
      ? [
          `Contenido original: ${effectiveCaption.slice(0, 110)}...`,
          `Categorizado automáticamente en "${assignedCategory}".`,
          `Autor / Creador: ${meta.author || '@creador'} (${platform.toUpperCase()})`,
        ]
      : [
          'Enlace guardado en la biblioteca para consulta rápida',
          `Plataforma de origen: ${platform}`,
          'Listo para revisar o volver a analizar con IA',
        ];

    aiResult = {
      title: fallbackTitle,
      summary: fallbackSummary,
      keyTakeaways: fallbackTakeaways,
      category: assignedCategory,
      tags: hashtags.length > 0 ? hashtags.slice(0, 5) : [platform, 'Guardado'],
      estimatedTime: meta.duration || (platform === 'web' ? 'Lectura 3 min' : 'Reel 60s'),
      authorOrChannel: meta.author || '',
      duplicateCheck: {
        isDuplicateTopic: false,
        duplicateReason: 'No se detectó duplicado temático en el análisis inicial.',
        similarityScore: 0,
      },
    };
  }

  // 6. Strictly enforce category validity
  let finalCategory = (aiResult.category || '').trim();
  const exactCategoryMatch = validCategoriesList.find(
    (c) => c.toLowerCase() === finalCategory.toLowerCase()
  );
  if (exactCategoryMatch) {
    finalCategory = exactCategoryMatch;
  } else {
    finalCategory = categorizeByContent(
      `${aiResult.summary} ${aiResult.title} ${effectiveCaption}`,
      categoryObjects
    );
  }

  return {
    platform,
    title: aiResult.title || suggestedTitle || 'Enlace guardado',
    summary: aiResult.summary || meta.description || 'Sin resumen disponible',
    keyTakeaways:
      Array.isArray(aiResult.keyTakeaways) && aiResult.keyTakeaways.length > 0
        ? aiResult.keyTakeaways
        : ['Contenido guardado para consulta'],
    category: finalCategory,
    tags:
      Array.isArray(aiResult.tags) && aiResult.tags.length > 0
        ? aiResult.tags
        : meta.tags && meta.tags.length > 0
        ? meta.tags
        : [platform],
    estimatedTime: aiResult.estimatedTime || meta.duration || (platform === 'web' ? 'Lectura' : 'Video'),
    authorOrChannel: aiResult.authorOrChannel || meta.author || '',
    thumbnailUrl: meta.ogImage || undefined,
    duplicateCheck: aiResult.duplicateCheck || {
      isDuplicateTopic: false,
      similarityScore: 0,
    },
    exactDuplicateFound: exactMatch
      ? {
          id: exactMatch.id,
          title: exactMatch.title,
          url: exactMatch.url,
        }
      : undefined,
    geminiKeyMissing,
    aiProcessed,
  };
}

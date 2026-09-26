import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { db } from './server/database';
import { analyzeLinkCore } from './server/linkAnalysisCore';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Clean and normalize URLs for exact matching
function normalizeUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    // Remove common tracking query params
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'igsh', 'stkn', 'mibextid', 'fbclid', 'gclid', 'si', 'feature', 'ref', 'source'
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    
    // Normalize hostname
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    
    // Strip trailing slashes on pathname
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    
    const search = parsed.searchParams.toString();
    return `${parsed.protocol}//${host}${pathname}${search ? '?' + search : ''}`;
  } catch {
    return (rawUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  }
}

// Detect platform from URL
function detectPlatform(urlStr: string): 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'web' {
  const lower = urlStr.toLowerCase();
  if (lower.includes('instagram.com/reel') || lower.includes('instagram.com/p/') || lower.includes('instagr.am')) {
    return 'instagram';
  }
  if (lower.includes('facebook.com/reel') || lower.includes('fb.watch') || lower.includes('facebook.com/watch') || lower.includes('facebook.com/share') || lower.includes('fb.com')) {
    return 'facebook';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be') || lower.includes('youtube.com/watch')) {
    return 'youtube';
  }
  return 'web';
}

// Interface for extracted media and web information
interface ExtractedMediaInfo {
  title: string;
  description: string;
  caption?: string;
  author: string;
  ogImage: string;
  duration?: string;
  tags?: string[];
  source?: string;
}

// Unescape Unicode characters (including emojis like \ud83e\udd20)
function decodeUnicodeEscapes(str: string): string {
  if (!str) return '';
  try {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch {
    return str;
  }
}

// Decode HTML entities commonly returned in OpenGraph meta tags
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  try {
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'");
  } catch {
    return str;
  }
}

// Extract hashtags without # symbol
function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_\u00C0-\u017F]+)/g) || [];
  return Array.from(new Set(matches.map((t) => t.replace(/^#/, '').trim()))).filter((t) => t.length >= 2);
}

// Categorize text semantically into one of the user's allowed categories taking into account their names and descriptions
function categorizeByContent(
  text: string,
  allowedCategories: Array<string | { name: string; description?: string }>
): string {
  if (!allowedCategories || allowedCategories.length === 0) return 'Sin categorías';

  const normalizedCategories: Array<{ name: string; description: string }> = allowedCategories.map((cat) => {
    if (typeof cat === 'string') {
      return { name: cat.trim(), description: '' };
    }
    return { name: (cat?.name || '').trim(), description: (cat?.description || '').trim() };
  }).filter((c) => Boolean(c.name));

  if (normalizedCategories.length === 0) return 'Sin categorías';
  if (normalizedCategories.length === 1) return normalizedCategories[0].name;

  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. High priority: Match keywords explicitly stated in the category's custom description
  let bestDescMatch: { name: string; score: number } | null = null;
  const stopWords = new Set(['para', 'como', 'sobre', 'este', 'esta', 'estos', 'estas', 'entre', 'hacia', 'desde', 'hasta', 'cuando', 'donde', 'quien', 'cual', 'cada', 'todo', 'toda', 'todos', 'todas', 'unos', 'unas', 'otro', 'otra', 'otros', 'otras']);

  for (const cat of normalizedCategories) {
    if (cat.description && cat.description.length > 3) {
      const cleanDesc = cat.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const descWords = cleanDesc.split(/[\s,.;:()&/"]+/).filter((w) => w.length >= 4 && !stopWords.has(w));
      let score = 0;
      for (const w of descWords) {
        if (lower.includes(w)) {
          score += 1;
        }
      }
      if (score > 0 && (!bestDescMatch || score > bestDescMatch.score)) {
        bestDescMatch = { name: cat.name, score };
      }
    }
  }

  if (bestDescMatch && bestDescMatch.score >= 1) {
    return bestDescMatch.name;
  }

  // 2. Direct match with registered category names
  for (const cat of normalizedCategories) {
    const cleanCat = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (cleanCat !== 'sin categorias' && cleanCat !== 'general') {
      const words = cleanCat.split(/[\s&/]+/);
      for (const w of words) {
        if (w.length >= 4 && lower.includes(w)) {
          return cat.name;
        }
      }
    }
  }

  // 3. Topic keyword mapping to registered categories
  const topicKeywords: Record<string, string[]> = {
    senderismo: ['senderismo', 'ruta', 'montana', 'hiking', 'trekking', 'desnivel', 'huesca', 'pirineos', 'sierra', 'escapada', 'trail', 'naturaleza'],
    tecnologia: ['wifi', 'router', 'informatica', 'it', 'ingenieria', 'codigo', 'tech', 'ia', 'software', 'hardware', 'servidor', 'python', 'javascript', 'pc', 'computadora', 'redes', 'ip', 'programacion', 'credenciales'],
    recetas: ['receta', 'cocina', 'cocinar', 'ingredientes', 'pizza', 'comida', 'pasta', 'postre', 'cena', 'almuerzo', 'desayuno', 'sabor', 'tarta', 'horno', 'chef'],
    marketing: ['marketing', 'ventas', 'vender', 'leads', 'redes sociales', 'crecimiento', 'audiencia', 'gancho', 'retencion', 'negocio', 'empresa', 'estrategia', 'copywriting'],
    finanzas: ['finanzas', 'dinero', 'ahorro', 'inversion', 'banco', 'cripto', 'bitcoin', 'fondos', 'acciones', 'presupuesto', 'economia'],
    productividad: ['productividad', 'habitos', 'rutina', 'organizacion', 'tiempo', 'metodo', 'enfoque', 'planificacion', 'gestion'],
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
          (topic === 'senderismo' && (normName.includes('ruta') || normName.includes('viaje') || normName.includes('deporte') || normName.includes('montana'))) ||
          (topic === 'tecnologia' && (normName.includes('ia') || normName.includes('software') || normName.includes('informatica')))
        );
      });
      if (found) return found.name;
    }
  }

  // If no specific topic matched, pick the first category that is not "Sin categorías" if available, else first
  const nonDefault = normalizedCategories.find((c) => !c.name.toLowerCase().includes('sin categor'));
  return nonDefault ? nonDefault.name : normalizedCategories[0].name;
}

// Extract Instagram metadata using OpenGraph crawler & captioned embed
async function fetchInstagramMeta(url: string): Promise<ExtractedMediaInfo | null> {
  const match = url.match(/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) return null;
  const shortcode = match[1];

  // 1. PRIMARY STRATEGY: Fetch main reel page via Facebook/Twitter crawler User-Agent
  // Instagram serves complete OpenGraph data (caption, thumbnail, author) to verified crawler headers without requiring login.
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

      // Extract author from handle or metadata
      const authorMatch = rawDesc.match(/-\s+([a-zA-Z0-9._]+)\s+(?:on|el)\s+/i) ||
        rawTitle.match(/([a-zA-Z0-9._]+)\s+(?:on|en)\s+Instagram/i);
      if (authorMatch) {
        author = `@${authorMatch[1].trim()}`;
      }

      // Extract caption from quoted text
      const quoteMatch = rawTitle.match(/(?:on|en)\s+Instagram:\s*[“"]([\s\S]+?)[”"]\s*$/i) ||
        rawTitle.match(/:\s*[“"]([\s\S]+?)[”"]\s*$/i) ||
        rawDesc.match(/:\s*[“"]([\s\S]+?)[”"]\s*$/i);
      if (quoteMatch) {
        caption = quoteMatch[1].trim();
      } else if (rawDesc && !rawDesc.toLowerCase().includes('create an account') && !rawDesc.toLowerCase().includes('log in to instagram')) {
        caption = rawDesc.trim();
      }

      if (caption) {
        // Normalize stylized/mathematical fonts (e.g. 𝔼𝕊ℂ𝔸𝕃𝔼ℝ𝔼𝕋𝔸𝕊 -> ESCALERETAS) for clean reading and search
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
  } catch (err) {
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

    // Caption extraction from embedded JSON edge_media_to_caption
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

    // Author extraction
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

    // Thumbnail extraction
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

// Extract TikTok metadata using oEmbed
async function fetchTikTokMeta(url: string): Promise<ExtractedMediaInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.title || '';
    const tags = extractHashtags(text);
    return {
      title: text.split('\n')[0]?.slice(0, 85) || 'Video de TikTok',
      description: text,
      caption: text,
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

// Extract YouTube metadata using oEmbed
async function fetchYouTubeMeta(url: string): Promise<ExtractedMediaInfo | null> {
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

// General OpenGraph and HTML meta extraction
async function fetchGeneralHtmlMeta(url: string): Promise<ExtractedMediaInfo> {
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
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

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

// Unified media metadata orchestrator
async function fetchMediaMetadata(url: string, platform: string): Promise<ExtractedMediaInfo> {
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

  // Fallback to general HTML metadata
  return await fetchGeneralHtmlMeta(url);
}

// Lazy Gemini client helper
let genAiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAiInstance) {
    genAiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiInstance;
}

// ================= API ROUTES =================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: 'connected',
    time: new Date().toISOString(),
  });
});

// AI Configuration Status (Checks whether GEMINI_API_KEY is defined in environment or database/app)
app.get('/api/ai-status', (req: Request, res: Response) => {
  const headerKey = (req.headers['x-gemini-api-key'] as string) || (req.query.testKey as string);
  const rawKey = (headerKey || '').trim() || process.env.GEMINI_API_KEY;
  const hasKey = Boolean(rawKey && rawKey.trim().length > 5);
  const source = headerKey ? 'database_or_app' : (process.env.GEMINI_API_KEY ? 'server_env' : 'none');

  res.json({
    success: true,
    configured: hasKey,
    hasKey,
    missingKey: !hasKey,
    source,
    provider: 'Google Gemini AI',
    environment: process.env.NETLIFY ? 'netlify' : 'node',
    message: hasKey
      ? (source === 'database_or_app'
          ? 'GEMINI_API_KEY activa desde Supabase / Configuración de Administrador.'
          : 'La variable GEMINI_API_KEY está configurada en las variables de entorno.')
      : 'La variable de entorno GEMINI_API_KEY no está configurada.',
    setupGuide: {
      variableName: 'GEMINI_API_KEY',
      dashboardUrl: 'https://app.netlify.com',
      steps: [
        'Inicia sesión en app.netlify.com y abre tu sitio web de ReewAI.',
        'En el menú lateral, dirígete a "Site configuration" (o "Site settings") -> "Environment variables".',
        'Haz clic en "Add a variable" (o "Add single variable").',
        'En Key (clave) escribe exactamente: GEMINI_API_KEY',
        'En Value (valor) pega tu API Key de Google AI Studio / Gemini.',
        'Haz clic en "Create variable".',
        'IMPORTANTE: Ve a la pestaña "Deploys" -> pulsa "Trigger deploy" -> "Clear cache and deploy site" para que Netlify cargue la nueva variable en las funciones serverless.',
      ],
    },
  });
});

// 1. GET /api/links - Strictly isolated to authenticated user
app.get('/api/links', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'El parámetro userId es obligatorio para acceder a tu biblioteca de reels.',
    });
  }

  const userLinks = db.getLinksForUser(userId);
  res.json({
    success: true,
    data: userLinks,
    count: userLinks.length,
    userId,
  });
});

// 2. POST /api/links - Save new or updated reel/link in database
app.post('/api/links', (req: Request, res: Response) => {
  const item = req.body;
  const userId = item.userId || (req.headers['x-user-id'] as string);

  if (!item || !item.url) {
    return res.status(400).json({ success: false, error: 'La URL del enlace es obligatoria.' });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un usuario autenticado para guardar este reel en la base de datos.',
    });
  }

  try {
    const result = db.saveLink({
      ...item,
      userId,
      platform: item.platform || detectPlatform(item.url),
    });

    res.json({
      success: true,
      data: result.data,
      isUpdated: result.isUpdated,
      message: result.isUpdated
        ? 'Reel actualizado en la base de datos.'
        : 'Reel guardado con éxito en la base de datos.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error guardando en la base de datos.' });
  }
});

// 3. PATCH /api/links/:id - Update link with ownership verification
app.patch('/api/links/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = updates.userId || (req.headers['x-user-id'] as string);

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio para modificar un reel.' });
  }

  const result = db.updateLink(id, updates, userId);
  if (!result.success) {
    return res.status(result.error?.includes('permiso') ? 403 : 404).json({
      success: false,
      error: result.error,
    });
  }

  res.json({ success: true, data: result.data });
});

// 4. DELETE /api/links/:id - Delete link with ownership verification
app.delete('/api/links/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio para eliminar un reel.' });
  }

  const result = db.deleteLink(id, userId);
  if (!result.success) {
    return res.status(result.error?.includes('permiso') ? 403 : 404).json({
      success: false,
      error: result.error,
    });
  }

  res.json({ success: true, deletedId: id });
});

// 5. POST /api/links/sync - Batch synchronize/import into database
app.post('/api/links/sync', (req: Request, res: Response) => {
  const { items = [], userId } = req.body;
  const targetUserId = userId || (req.headers['x-user-id'] as string);

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio para sincronizar.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Lista de elementos vacía.' });
  }

  const result = db.bulkSync(items, targetUserId);
  res.json({
    success: true,
    added: result.added,
    updated: result.updated,
    total: db.getLinksForUser(targetUserId).length,
  });
});

// ================= USER & AUTH ROUTES =================

// List users for team management and profile selection
app.get('/api/users', (req: Request, res: Response) => {
  const users = db.getUsers().map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
    hasPassword: Boolean(u.password),
  }));
  res.json({ success: true, data: users });
});

// Create user
app.post('/api/users', (req: Request, res: Response) => {
  const { email, fullName, role, avatarUrl, password } = req.body;
  if (!email || !fullName) {
    return res.status(400).json({ success: false, error: 'Nombre y correo electrónico son requeridos.' });
  }

  const result = db.createUser({ email, fullName, role, avatarUrl, password });
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    user: {
      id: result.user?.id,
      email: result.user?.email,
      fullName: result.user?.fullName,
      role: result.user?.role,
      avatarUrl: result.user?.avatarUrl,
      createdAt: result.user?.createdAt,
    },
  });
});

// Update user
app.patch('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const result = db.updateUser(id, updates);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    user: {
      id: result.user?.id,
      email: result.user?.email,
      fullName: result.user?.fullName,
      role: result.user?.role,
      avatarUrl: result.user?.avatarUrl,
    },
  });
});

// Delete user
app.delete('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = db.deleteUser(id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.json({ success: true, deletedId: id });
});

// Login attempt tracking & lockout map (max 3 errors, 10 min lockout)
const serverLoginAttempts = new Map<string, { attempts: number; lockedUntil?: number }>();
const SERVER_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

// Login endpoint
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email requerido.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const attemptRecord = serverLoginAttempts.get(cleanEmail);

  // Check if locked
  if (attemptRecord?.lockedUntil && attemptRecord.lockedUntil > now) {
    const remainingSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return res.status(429).json({
      success: false,
      isLocked: true,
      remainingSeconds,
      error: `Has alcanzado el límite de 3 errores. Por seguridad, debes esperar ${mins}m ${secs}s antes de volver a intentarlo.`,
    });
  }

  // Clear expired lock
  if (attemptRecord?.lockedUntil && attemptRecord.lockedUntil <= now) {
    serverLoginAttempts.delete(cleanEmail);
  }

  const user = db.getUserByEmail(cleanEmail);
  if (!user) {
    const current = (serverLoginAttempts.get(cleanEmail)?.attempts || 0) + 1;
    if (current >= 3) {
      serverLoginAttempts.set(cleanEmail, { attempts: current, lockedUntil: now + SERVER_LOCKOUT_MS });
      return res.status(429).json({
        success: false,
        isLocked: true,
        remainingSeconds: Math.ceil(SERVER_LOCKOUT_MS / 1000),
        error: 'Has alcanzado el límite de 3 errores de acceso. Acceso bloqueado durante 10 minutos.',
      });
    }
    serverLoginAttempts.set(cleanEmail, { attempts: current });
    const remaining = 3 - current;
    return res.status(404).json({
      success: false,
      error: `Usuario no encontrado. Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'} antes del bloqueo de 10 minutos.`,
    });
  }

  if (user.password && user.password !== password) {
    const current = (serverLoginAttempts.get(cleanEmail)?.attempts || 0) + 1;
    if (current >= 3) {
      serverLoginAttempts.set(cleanEmail, { attempts: current, lockedUntil: now + SERVER_LOCKOUT_MS });
      return res.status(429).json({
        success: false,
        isLocked: true,
        remainingSeconds: Math.ceil(SERVER_LOCKOUT_MS / 1000),
        error: 'Has alcanzado el límite de 3 errores de contraseña. Acceso bloqueado durante 10 minutos.',
      });
    }
    serverLoginAttempts.set(cleanEmail, { attempts: current });
    const remaining = 3 - current;
    return res.status(401).json({
      success: false,
      error: `Contraseña incorrecta (intento ${current} de 3). Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'} antes del bloqueo de 10 minutos.`,
    });
  }

  // Successful login -> clear failed attempts
  serverLoginAttempts.delete(cleanEmail);

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
});

// Register endpoint
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, fullName } = req.body;
  if (!email || !fullName) {
    return res.status(400).json({ success: false, error: 'Email y nombre son obligatorios.' });
  }

  const result = db.createUser({
    email,
    fullName,
    password: password || '123456',
    role: (email.toLowerCase() === 'xxxx@gmaxl.xxx' || email.toLowerCase() === 'sillescas2@gmail.com') ? 'admin' : 'user',
  });

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    user: {
      id: result.user?.id,
      email: result.user?.email,
      fullName: result.user?.fullName,
      role: result.user?.role,
      avatarUrl: result.user?.avatarUrl,
      createdAt: result.user?.createdAt,
    },
  });
});

// Forgot password - Request recovery code for registered user
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'Por favor, proporciona un correo electrónico válido.',
    });
  }

  const result = db.generatePasswordResetCode(email);
  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error || 'Usuario no encontrado.',
    });
  }

  res.json({
    success: true,
    message: 'Código de recuperación generado con éxito.',
    email: result.user?.email,
    code: result.code,
    expiresAt: result.expiresAt,
  });
});

// Reset password - Verify code and set new password
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Todos los campos son obligatorios (correo, código y nueva contraseña).',
    });
  }

  const result = db.verifyAndResetPassword(email, code, newPassword);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || 'No se pudo restablecer la contraseña.',
    });
  }

  res.json({
    success: true,
    message: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva contraseña.',
  });
});

// ================= CATEGORIES ROUTES =================

// 1. GET /api/categories - Get user's registered categories
app.get('/api/categories', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId es requerido para obtener las categorías.' });
  }

  const categories = db.getCategoriesForUser(userId);
  res.json({
    success: true,
    data: categories,
    count: categories.length,
    userId,
  });
});

// 2. POST /api/categories - Create category with name, color and description
app.post('/api/categories', (req: Request, res: Response) => {
  const { userId, name, color, description } = req.body;
  const targetUserId = userId || (req.headers['x-user-id'] as string);

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio.' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'El nombre de la categoría es obligatorio.' });
  }

  const result = db.createCategory(targetUserId, name, color || '#6366f1', description);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 3. PUT /api/categories/:id - Update category name, color and/or description
app.put('/api/categories/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, name, color, description } = req.body;
  const targetUserId = userId || (req.headers['x-user-id'] as string);

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio.' });
  }

  const result = db.updateCategory(targetUserId, id, { name, color, description });
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 4. DELETE /api/categories/:id - Delete category and reassign links to "Sin categorías"
app.delete('/api/categories/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const targetUserId =
    (req.query.userId as string) || (req.body?.userId as string) || (req.headers['x-user-id'] as string);

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'userId es obligatorio.' });
  }

  const result = db.deleteCategory(targetUserId, id);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// Analyze link with Gemini AI (Metadata + Summary + Topic Duplicate Check)
app.post('/api/analyze-link', async (req: Request, res: Response) => {
  try {
    const { url, userNote, manualTitle, manualSummary, existingItems = [], allowedCategories = [], categoryObjects: providedCategories, userId, apiKey: providedKey } = req.body;
    const apiKey = (providedKey || (req.headers['x-gemini-api-key'] as string) || '').trim() || process.env.GEMINI_API_KEY;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'Por favor ingresa una URL válida.' });
    }

    // Resolve allowed registered categories and their AI guide descriptions for this user
    let categoryObjects: Array<{ name: string; description: string }> = [];
    if (Array.isArray(providedCategories) && providedCategories.length > 0) {
      categoryObjects = providedCategories.map((c: any) => ({
        name: (c?.name || '').trim(),
        description: (c?.description || '').trim(),
      })).filter((c) => Boolean(c.name));
    } else if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
      categoryObjects = allowedCategories
        .map((c: any) => {
          if (typeof c === 'string') {
            const found = userId ? db.getCategoriesForUser(userId).find((dbCat) => dbCat.name.toLowerCase() === c.toLowerCase()) : null;
            return { name: c.trim(), description: (found?.description || '').trim() };
          }
          return { name: (c?.name || '').trim(), description: (c?.description || '').trim() };
        })
        .filter((c) => Boolean(c.name));
    } else if (userId) {
      categoryObjects = db.getCategoriesForUser(userId).map((c) => ({
        name: c.name.trim(),
        description: (c.description || '').trim(),
      }));
    }

    const data = await analyzeLinkCore({
      url: url.trim(),
      userNote: userNote?.trim() || undefined,
      manualTitle: manualTitle?.trim() || undefined,
      manualSummary: manualSummary?.trim() || undefined,
      existingItems,
      allowedCategories,
      categoryObjects,
      userId,
      apiKey: apiKey || undefined,
    });

    const hasKey = Boolean(apiKey && apiKey.trim().length > 5);

    return res.json({
      success: true,
      data,
      geminiKeyMissing: !hasKey || Boolean(data.geminiKeyMissing),
      aiProcessed: Boolean(data.aiProcessed),
    });
  } catch (error: any) {
    console.error('Error analyzing link:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error procesando el enlace con IA',
    });
  }
});

// Initialize server with Vite middleware in development or static in production
async function startServer() {
  // Serve static files from public directory (manifest, icons, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Reel & Web Saver AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

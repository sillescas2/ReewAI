import { analyzeLinkCore } from '../../server/linkAnalysisCore';

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

export const handler = async (event: NetlifyEvent) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    const {
      url,
      userNote,
      manualTitle,
      manualSummary,
      existingItems = [],
      allowedCategories = [],
      categoryObjects = [],
      userId,
      apiKey: providedApiKey,
    } = body;

    const apiKey = (providedApiKey || event.headers['x-gemini-api-key'] || '').trim() || process.env.GEMINI_API_KEY;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ success: false, error: 'Por favor ingresa una URL válida.' }),
      };
    }

    const result = await analyzeLinkCore({
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: result,
        geminiKeyMissing: !hasKey || Boolean(result.geminiKeyMissing),
        aiProcessed: Boolean(result.aiProcessed),
      }),
    };
  } catch (error: any) {
    console.error('[Netlify Function analyze-link error]:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error procesando el enlace con IA en Netlify',
      }),
    };
  }
};

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

  const rawKey = process.env.GEMINI_API_KEY;
  const hasKey = Boolean(rawKey && rawKey.trim().length > 5);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
    body: JSON.stringify({
      success: true,
      configured: hasKey,
      hasKey,
      missingKey: !hasKey,
      provider: 'Google Gemini AI',
      environment: 'netlify',
      message: hasKey
        ? 'La variable GEMINI_API_KEY está configurada y lista en Netlify.'
        : 'La variable de entorno GEMINI_API_KEY no está configurada en el panel de Netlify.',
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
    }),
  };
};

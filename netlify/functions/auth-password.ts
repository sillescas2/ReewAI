interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

// Temporary in-memory cache for Netlify serverless execution
const resetCache = new Map<string, { code: string; expiresAt: number }>();

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

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const action = event.queryStringParameters?.action || payload.action || 'forgot';

    if (action === 'forgot' || action === 'request') {
      const email = (payload.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Por favor, introduce una dirección de correo electrónico válida.',
          }),
        };
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      resetCache.set(email, { code, expiresAt });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Código de recuperación generado.',
          email,
          code,
          expiresAt,
        }),
      };
    }

    if (action === 'reset') {
      const email = (payload.email || '').trim().toLowerCase();
      const code = (payload.code || '').trim();
      const newPassword = (payload.newPassword || '').trim();

      if (!email || !code || !newPassword) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Todos los campos son obligatorios.',
          }),
        };
      }

      if (newPassword.length < 6) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'La nueva contraseña debe tener al menos 6 caracteres.',
          }),
        };
      }

      const record = resetCache.get(email);
      if (record && Date.now() <= record.expiresAt && record.code !== code) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Código de verificación incorrecto.',
          }),
        };
      }

      resetCache.delete(email);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Contraseña restablecida con éxito.',
        }),
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Acción no válida.' }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: err.message || 'Error interno del servidor.' }),
    };
  }
};

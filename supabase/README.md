# Configuración de Base de Datos en Supabase para ReewAI

Sigue estos sencillos pasos para crear tu base de datos profesional en Supabase:

### 1. Crear proyecto en Supabase
1. Accede a [supabase.com](https://supabase.com) e inicia sesión (o crea cuenta gratis).
2. Haz clic en **"New project"**.
3. Elige un nombre (por ejemplo: `reewai-db`), una contraseña segura para tu base de datos y la región más cercana (ej: Frankfurt o Londres para Europa).
4. Espera ~1 minuto mientras se inicializa el proyecto.

### 2. Ejecutar el Script SQL
1. En el menú lateral izquierdo de Supabase, haz clic en **"SQL Editor"** (icono con `>_`).
2. Haz clic en **"New query"**.
3. Abre el archivo `supabase/schema.sql` de este proyecto, copia todo su contenido y pégalo en el editor.
4. Haz clic en el botón verde **"Run"** (o presiona `Ctrl + Enter` / `Cmd + Enter`).
5. Verás el mensaje *"Success. No rows returned"*. ¡Tu base de datos con tablas, triggers y políticas de seguridad RLS ya está creada!

### 3. Obtener las credenciales
1. En el menú lateral, ve a **Project Settings** (icono de engranaje) -> **API**.
2. Copia:
   - **Project URL** (ejemplo: `https://xyzcompany.supabase.co`)
   - **anon / public key** (clave pública que empieza por `eyJh...`)

### 4. Configurar en ReewAI
- En local/desarrollo o en Netlify, configura las siguientes variables de entorno:
  ```env
  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
  VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
  ```
- En Netlify: **Site configuration** -> **Environment variables** -> añade ambas variables y haz un nuevo despliegue.

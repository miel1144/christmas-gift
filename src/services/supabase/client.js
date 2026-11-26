import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env ' +
      '(Vite solo expone variables con prefijo VITE_; reinicia `npm run dev` tras cambiar .env).'
  )
}

/**
 * Lo que traía la URL tras '#' al cargar la página, leído ANTES de crear el cliente:
 * Supabase lo procesa (y lo borra) al arrancar. Sirve para saber si se llegó desde
 * un enlace de recuperación de contraseña o con un enlace caducado.
 */
export const initialAuthHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

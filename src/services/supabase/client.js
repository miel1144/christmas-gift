import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env ' +
      '(Vite solo expone variables con prefijo VITE_; reinicia `npm run dev` tras cambiar .env).'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

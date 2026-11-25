import { supabase, supabaseUrl, supabasePublishableKey } from './client';

// Tablas que crea supabase/migrations/20261124000000_init_schema.sql
export const TABLES = ['profiles', 'workspaces', 'workspace_members', 'gifts', 'gift_contents'];

/**
 * Diagnóstico en dos pasos:
 *  1. Conexión: URL + publishable key contra el servicio de Auth.
 *  2. Esquema: que las tablas de la migración existan.
 * Sin sesión, RLS devuelve 0 filas sin error: eso cuenta como "existe".
 *
 * @returns {Promise<{connected: boolean, missing: string[], errors: string[]}>}
 */
export async function checkSupabase() {
  const result = { connected: false, missing: [], errors: [] };

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabasePublishableKey },
    });
    if (!res.ok) {
      result.errors.push(`Auth respondió HTTP ${res.status} (revisa URL y publishable key)`);
      return result;
    }
    result.connected = true;
  } catch (e) {
    result.errors.push(`No se pudo contactar a Supabase: ${e.message}`);
    return result;
  }

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error?.code === 'PGRST205') {
      result.missing.push(table);
    } else if (error) {
      result.errors.push(`${table}: ${error.message}`);
    }
  }

  return result;
}

/** Versión para la consola del navegador: imprime el diagnóstico. */
export async function testConnection() {
  console.log('Checking Supabase connection...');
  const { connected, missing, errors } = await checkSupabase();

  if (!connected) {
    console.error('❌ Connection Error:', errors.join(' | '));
    return false;
  }
  console.log('✅ Supabase connected (URL y publishable key válidas)');
  errors.forEach((e) => console.warn(`⚠️ ${e}`));

  if (missing.length) {
    console.warn(`⚠️ Faltan tablas: ${missing.join(', ')}. Aplica la migración en supabase/migrations/.`);
    return false;
  }
  console.log('✅ Esquema OK: todas las tablas existen');
  return true;
}

if (typeof window !== 'undefined') {
  window.testSupabase = testConnection;
}

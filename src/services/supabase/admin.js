import { supabase } from './client';

/**
 * Consultas del panel de superadmin. La seguridad real la ponen las políticas RLS
 * (is_superadmin()): un usuario normal que llamara a esto solo vería lo suyo.
 * Las cartas (gift_contents) no son legibles ni para el superadmin, y aquí no se piden.
 */

/** Todas las salas con su dueño y cuántos miembros y regalos tienen. */
export async function listAllRooms() {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, is_public, created_at, owner:profiles!workspaces_owner_id_fkey(display_name), workspace_members(count), gifts(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    isPublic: r.is_public,
    createdAt: r.created_at,
    owner: r.owner?.display_name ?? '—',
    members: r.workspace_members?.[0]?.count ?? 0,
    gifts: r.gifts?.[0]?.count ?? 0,
  }));
}

export async function listAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Cambia el rol global ('superadmin' | 'user'). El trigger protect_profile_fields solo lo permite al superadmin. */
export async function setUserRole(userId, role) {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('No se pudo cambiar el rol (¿sigues siendo superadmin?).');
}

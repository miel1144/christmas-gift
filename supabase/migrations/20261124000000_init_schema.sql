-- =============================================================================
-- Christmas Gift ASCII App — esquema inicial
-- Tablas: profiles, workspaces, workspace_members, gifts, gift_contents
-- Incluye: RLS, helpers de rol, RPCs (crear/abrir regalo, unirse por invitación)
--          y Realtime para gifts y workspace_members.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

-- Perfil público ligado a auth.users (sustituye a la tabla `users` del spec:
-- Supabase ya gestiona las cuentas en auth.users).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'user' check (role in ('superadmin', 'user')),
  avatar_ascii  text,
  created_at    timestamptz not null default now()
);

-- "Christmas Rooms"
create table public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  is_public    boolean not null default false,
  invite_code  text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at   timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Metadatos visibles del regalo (lo que se dibuja en la sala y viaja por Realtime).
create table public.gifts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  receiver_id   uuid not null references public.profiles (id) on delete cascade,
  is_locked     boolean not null default false,   -- tiene contraseña
  color         text not null default '#ff0000',
  position_x    double precision not null default 0,
  position_y    double precision not null default 0,
  opened_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index gifts_workspace_idx on public.gifts (workspace_id);
create index gifts_receiver_idx on public.gifts (receiver_id);

-- Contenido privado del regalo. Separado de `gifts` para que el mensaje y el hash
-- nunca viajen por Realtime ni sean legibles por el resto de la sala.
create table public.gift_contents (
  gift_id        uuid primary key references public.gifts (id) on delete cascade,
  message        text not null check (char_length(message) <= 5000),
  password_hash  text
);

-- -----------------------------------------------------------------------------
-- 2. HELPERS (security definer para evitar recursión de RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ¿Comparte el usuario actual alguna sala con `other`?
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS
-- -----------------------------------------------------------------------------

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide que un usuario se suba el rol o cambie su email desde el cliente.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_superadmin() then
    if new.role is distinct from old.role then
      raise exception 'Only a superadmin can change roles';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is managed by auth';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- El creador de una sala entra automáticamente como admin.
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- El owner no puede cambiarse ni perder su rol de admin desde el cliente.
create or replace function public.protect_workspace_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id and not public.is_superadmin() then
    raise exception 'Only a superadmin can transfer room ownership';
  end if;
  return new;
end;
$$;

create trigger workspaces_protect_owner
  before update on public.workspaces
  for each row execute function public.protect_workspace_owner();

create or replace function public.protect_owner_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ws_owner uuid;
begin
  -- Sin auth.uid() (dashboard, service role, cascades al borrar usuario) no se aplica.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select owner_id into ws_owner from public.workspaces where id = old.workspace_id;
  if ws_owner = old.user_id then
    if tg_op = 'DELETE' then
      -- Permitido solo cuando se borra la sala entera (cascade) o lo hace un superadmin.
      if ws_owner is not null and not public.is_superadmin() then
        raise exception 'The room owner cannot be removed';
      end if;
      return old;
    elsif new.role <> 'admin' then
      raise exception 'The room owner must stay admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workspace_members_protect_owner
  before update or delete on public.workspace_members
  for each row execute function public.protect_owner_membership();

-- En gifts, desde el cliente solo se puede mover el regalo (posición).
create or replace function public.protect_gift_fields()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- open_gift activa este bypass para poder marcar opened_at.
  if coalesce(current_setting('app.bypass_gift_guard', true), '') = 'on' then
    return new;
  end if;
  if auth.uid() is not null and (
       new.workspace_id is distinct from old.workspace_id
    or new.sender_id    is distinct from old.sender_id
    or new.receiver_id  is distinct from old.receiver_id
    or new.is_locked    is distinct from old.is_locked
    or new.opened_at    is distinct from old.opened_at
    or new.created_at   is distinct from old.created_at
  ) then
    raise exception 'Only position and color can be changed';
  end if;
  return new;
end;
$$;

create trigger gifts_protect_fields
  before update on public.gifts
  for each row execute function public.protect_gift_fields();

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.gifts             enable row level security;
alter table public.gift_contents     enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read self, roommates, or superadmin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id) or public.is_superadmin());

create policy "profiles: update self or superadmin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (id = auth.uid() or public.is_superadmin());

-- (insert lo hace el trigger; delete en cascada desde auth.users)

-- workspaces -----------------------------------------------------------------
create policy "workspaces: read public, own rooms, or superadmin"
  on public.workspaces for select to authenticated
  using (is_public or public.is_workspace_member(id) or public.is_superadmin());

create policy "workspaces: create as owner"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "workspaces: update by room admin or superadmin"
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id) or public.is_superadmin())
  with check (public.is_workspace_admin(id) or public.is_superadmin());

create policy "workspaces: delete by owner or superadmin"
  on public.workspaces for delete to authenticated
  using (owner_id = auth.uid() or public.is_superadmin());

-- workspace_members ----------------------------------------------------------
create policy "members: read members of my rooms"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_superadmin());

-- Unirse por cuenta propia solo a salas públicas y como 'member'.
-- Las privadas se unen con la RPC join_workspace(invite_code).
create policy "members: join public room"
  on public.workspace_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.is_public)
  );

create policy "members: room admin adds members"
  on public.workspace_members for insert to authenticated
  with check (public.is_workspace_admin(workspace_id) or public.is_superadmin());

create policy "members: room admin changes roles"
  on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id) or public.is_superadmin())
  with check (public.is_workspace_admin(workspace_id) or public.is_superadmin());

create policy "members: leave, or kicked by room admin"
  on public.workspace_members for delete to authenticated
  using (user_id = auth.uid() or public.is_workspace_admin(workspace_id) or public.is_superadmin());

-- gifts ----------------------------------------------------------------------
create policy "gifts: read in my rooms"
  on public.gifts for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_superadmin());

-- insert solo vía RPC create_gift (no hay policy de insert)

create policy "gifts: sender moves own gift"
  on public.gifts for update to authenticated
  using (sender_id = auth.uid() or public.is_workspace_admin(workspace_id))
  with check (sender_id = auth.uid() or public.is_workspace_admin(workspace_id));

create policy "gifts: delete by sender, room admin or superadmin"
  on public.gifts for delete to authenticated
  using (sender_id = auth.uid() or public.is_workspace_admin(workspace_id) or public.is_superadmin());

-- gift_contents --------------------------------------------------------------
-- El remitente siempre ve su mensaje; el destinatario solo si no tiene contraseña.
-- Los regalos con contraseña se abren con la RPC open_gift.
create policy "gift_contents: sender, or receiver if unlocked"
  on public.gift_contents for select to authenticated
  using (
    exists (
      select 1 from public.gifts g
      where g.id = gift_id
        and (g.sender_id = auth.uid() or (g.receiver_id = auth.uid() and not g.is_locked))
    )
  );

-- insert/update/delete solo vía RPC o cascade

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------

-- Unirse a una sala privada con el código de invitación.
create or replace function public.join_workspace(p_invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  ws uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into ws from public.workspaces where invite_code = p_invite_code;
  if ws is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  return ws;
end;
$$;

-- Regenera el código de invitación (room admin o superadmin).
create or replace function public.regenerate_invite_code(p_workspace_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  code text := encode(extensions.gen_random_bytes(6), 'hex');
begin
  if not (public.is_workspace_admin(p_workspace_id) or public.is_superadmin()) then
    raise exception 'Not allowed';
  end if;
  update public.workspaces set invite_code = code where id = p_workspace_id;
  return code;
end;
$$;

-- Crea un regalo (metadatos + contenido) de forma atómica; la contraseña se
-- hashea en el servidor con bcrypt y nunca se guarda en claro.
create or replace function public.create_gift(
  p_workspace_id uuid,
  p_receiver_id  uuid,
  p_message      text,
  p_password     text default null,
  p_color        text default '#ff0000',
  p_position_x   double precision default 0,
  p_position_y   double precision default 0
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
  locked boolean := p_password is not null and p_password <> '';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You are not a member of this room';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_receiver_id
  ) then
    raise exception 'Receiver is not a member of this room';
  end if;

  insert into public.gifts (workspace_id, sender_id, receiver_id, is_locked, color, position_x, position_y)
  values (p_workspace_id, auth.uid(), p_receiver_id, locked, p_color, p_position_x, p_position_y)
  returning id into new_id;

  insert into public.gift_contents (gift_id, message, password_hash)
  values (
    new_id,
    p_message,
    case when locked then extensions.crypt(p_password, extensions.gen_salt('bf')) end
  );

  return new_id;
end;
$$;

-- Abre un regalo: comprueba la contraseña (si tiene) y devuelve el mensaje.
-- Solo el destinatario (o el remitente) puede abrirlo.
create or replace function public.open_gift(p_gift_id uuid, p_password text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  g  public.gifts;
  c  public.gift_contents;
begin
  select * into g from public.gifts where id = p_gift_id;
  if g.id is null or auth.uid() not in (g.sender_id, g.receiver_id) then
    raise exception 'Gift not found';
  end if;

  select * into c from public.gift_contents where gift_id = p_gift_id;

  if c.password_hash is not null
     and auth.uid() <> g.sender_id
     and (p_password is null or extensions.crypt(p_password, c.password_hash) <> c.password_hash) then
    raise exception 'Wrong password';
  end if;

  if auth.uid() = g.receiver_id and g.opened_at is null then
    -- Bypass local a la transacción del trigger protect_gift_fields.
    perform set_config('app.bypass_gift_guard', 'on', true);
    update public.gifts set opened_at = now() where id = p_gift_id;
    perform set_config('app.bypass_gift_guard', 'off', true);
  end if;

  return c.message;
end;
$$;

-- Permisos de ejecución: solo usuarios autenticados.
revoke execute on function public.join_workspace(text)                 from public, anon;
revoke execute on function public.regenerate_invite_code(uuid)         from public, anon;
revoke execute on function public.create_gift(uuid, uuid, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.open_gift(uuid, text)                from public, anon;
grant  execute on function public.join_workspace(text)                 to authenticated;
grant  execute on function public.regenerate_invite_code(uuid)         to authenticated;
grant  execute on function public.create_gift(uuid, uuid, text, text, text, double precision, double precision) to authenticated;
grant  execute on function public.open_gift(uuid, text)                to authenticated;

-- -----------------------------------------------------------------------------
-- 6. REALTIME
-- -----------------------------------------------------------------------------
-- postgres_changes respeta RLS: cada cliente solo recibe cambios de sus salas.
-- gift_contents NO se publica a propósito.

alter table public.gifts             replica identity full;
alter table public.workspace_members replica identity full;

alter publication supabase_realtime add table public.gifts;
alter publication supabase_realtime add table public.workspace_members;

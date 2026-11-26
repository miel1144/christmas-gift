-- =============================================================================
-- Nombres de usuario únicos + inicio de sesión con usuario
--
-- 1. profiles.display_name pasa a ser el NOMBRE DE USUARIO: obligatorio, formato
--    fijo (3–24 caracteres: letras, números, . _ -) y único sin distinguir
--    mayúsculas. El email ya era único en auth.users; se refuerza en profiles.
-- 2. handle_new_user exige un nombre libre al registrarse.
-- 3. RPCs para el cliente:
--    - username_available(nombre)        ¿está libre? (para el registro)
--    - login_email(usuario, contraseña)  devuelve el email con el que entrar,
--      SOLO si la contraseña es correcta (así no se pueden sacar emails), con
--      límite de 10 intentos fallidos por usuario cada 15 minutos.
--
-- Datos previos (2026-11-26): 2 perfiles, sin repetidos y ya con formato válido,
-- así que no se renombra a nadie. Si al aplicar falla el índice único o el
-- check, hay datos que corregir a mano antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Restricciones
-- -----------------------------------------------------------------------------
alter table public.profiles alter column display_name set not null;

alter table public.profiles
  add constraint profiles_username_format
  check (display_name ~ '^[A-Za-z0-9._-]{3,24}$');

create unique index profiles_username_lower_key on public.profiles (lower(display_name));
create unique index profiles_email_lower_key on public.profiles (lower(email)) where email <> '';

-- -----------------------------------------------------------------------------
-- 2. Registro: el nombre viene en raw_user_meta_data.display_name
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  wanted text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if wanted = '' then
    -- Cuentas creadas sin nombre (p. ej. desde el dashboard): se deriva uno libre.
    wanted := left(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9._-]', '', 'g'), 20);
    if char_length(wanted) < 3 then wanted := 'usuario'; end if;
    while exists (select 1 from public.profiles where lower(display_name) = lower(wanted)) loop
      wanted := left(wanted, 19) || '-' || substr(md5(random()::text), 1, 4);
    end loop;
  end if;

  -- Si el nombre no es válido o está ocupado, el insert falla y el registro no se
  -- completa (el cliente lo comprueba antes con username_available).
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), wanted);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3a. ¿Nombre libre?
-- -----------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select btrim(p_username) ~ '^[A-Za-z0-9._-]{3,24}$'
     and not exists (select 1 from public.profiles where lower(display_name) = lower(btrim(p_username)));
$$;

-- -----------------------------------------------------------------------------
-- 3b. Inicio de sesión con usuario
-- -----------------------------------------------------------------------------
-- Intentos fallidos recientes (para el límite). Sin políticas: solo la toca
-- login_email (security definer); el cliente no puede leerla ni escribirla.
create table public.login_attempts (
  username_lower text not null,
  attempted_at   timestamptz not null default now()
);
create index login_attempts_lookup_idx on public.login_attempts (username_lower, attempted_at);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.login_email(p_username text, p_password text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uname text := lower(btrim(coalesce(p_username, '')));
  u_email text;
  u_hash text;
begin
  if uname = '' or coalesce(p_password, '') = '' then
    return null;
  end if;

  -- Limpieza de intentos viejos y límite por usuario.
  delete from public.login_attempts where attempted_at < now() - interval '1 day';
  if (select count(*) from public.login_attempts
      where username_lower = uname and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into u_email, u_hash
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.display_name) = uname;

  if u_hash is null then
    perform extensions.crypt(p_password, extensions.gen_salt('bf')); -- mismo tiempo exista o no
    insert into public.login_attempts (username_lower) values (uname);
    return null;
  end if;

  if extensions.crypt(p_password, u_hash) <> u_hash then
    insert into public.login_attempts (username_lower) values (uname);
    return null;
  end if;

  delete from public.login_attempts where username_lower = uname;
  return u_email;
end;
$$;

revoke execute on function public.username_available(text)      from public;
revoke execute on function public.login_email(text, text)        from public;
grant  execute on function public.username_available(text)      to anon, authenticated;
grant  execute on function public.login_email(text, text)        to anon, authenticated;

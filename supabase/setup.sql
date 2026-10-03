-- Groundhopper – Konten und Synchronisierung
-- Einmal komplett im SQL-Editor von Supabase ausführen („Run“). Mehrfaches Ausführen schadet nicht.
--
-- Aufbau:
--   * Konten, Passwörter (bcrypt) und Sitzungen liegen im eigenen Schema „groundhopper“,
--     das von außen (Data API) nicht erreichbar ist.
--   * Die App spricht ausschließlich die Funktionen gh_* im Schema „public“ an.
--     Sie prüfen Sitzung bzw. Passwort selbst und geben immer JSON zurück: { ok: true, … } oder { ok: false, error }.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists groundhopper;
revoke all on schema groundhopper from public, anon, authenticated;

create table if not exists groundhopper.accounts (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  username_key  text not null unique,           -- klein geschrieben, damit „Arne“ und „arne“ dasselbe Konto sind
  password_hash text not null,
  data          jsonb not null default '{}'::jsonb,
  rev           integer not null default 0,     -- Versionszähler: erkennt gleichzeitige Änderungen von zwei Geräten
  failed_logins integer not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists groundhopper.sessions (
  token_hash   text primary key,                -- nur der SHA-256-Hash, das Token selbst kennt nur das Gerät
  account_id   uuid not null references groundhopper.accounts(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists sessions_account_idx on groundhopper.sessions(account_id);

alter table groundhopper.accounts enable row level security;
alter table groundhopper.sessions enable row level security;
revoke all on all tables in schema groundhopper from public, anon, authenticated;

-- ---------- Hilfsfunktionen (nicht öffentlich) ----------

create or replace function groundhopper.hash_token(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function groundhopper.new_session(p_account uuid) returns text
language plpgsql set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into groundhopper.sessions (token_hash, account_id)
  values (groundhopper.hash_token(v_token), p_account);
  return v_token;
end $$;

create or replace function groundhopper.session_account(p_token text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_token is null or length(p_token) <> 64 then return null; end if;
  update groundhopper.sessions set last_used_at = now()
  where token_hash = groundhopper.hash_token(p_token)
  returning account_id into v_id;
  return v_id;
end $$;

revoke all on all functions in schema groundhopper from public, anon, authenticated;

-- ---------- Öffentliche Funktionen für die App ----------

-- Neues Konto anlegen und gleich anmelden
create or replace function public.gh_register(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_username, ''));
  v_id uuid;
begin
  if v_name !~ '^[A-Za-z0-9_.-]{3,20}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_username');
  end if;
  if p_password is null or length(p_password) < 6 or octet_length(p_password) > 72 then
    return jsonb_build_object('ok', false, 'error', 'invalid_password');
  end if;

  insert into groundhopper.accounts (username, username_key, password_hash)
  values (v_name, lower(v_name), extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  on conflict (username_key) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'username_taken');
  end if;

  return jsonb_build_object('ok', true, 'token', groundhopper.new_session(v_id),
    'username', v_name, 'rev', 0, 'data', '{}'::jsonb);
end $$;

-- Anmelden: nach 8 falschen Passwörtern ist das Konto 10 Minuten gesperrt
create or replace function public.gh_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a groundhopper.accounts%rowtype;
begin
  select * into a from groundhopper.accounts
  where username_key = lower(btrim(coalesce(p_username, '')))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wrong_credentials');
  end if;

  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'retry_after', ceil(extract(epoch from a.locked_until - now())));
  end if;

  if p_password is null or a.password_hash <> extensions.crypt(p_password, a.password_hash) then
    update groundhopper.accounts set
      failed_logins = case when a.failed_logins + 1 >= 8 then 0 else a.failed_logins + 1 end,
      locked_until  = case when a.failed_logins + 1 >= 8 then now() + interval '10 minutes' else null end
    where id = a.id;
    return jsonb_build_object('ok', false, 'error', 'wrong_credentials');
  end if;

  update groundhopper.accounts set failed_logins = 0, locked_until = null where id = a.id;

  return jsonb_build_object('ok', true, 'token', groundhopper.new_session(a.id),
    'username', a.username, 'rev', a.rev, 'data', a.data);
end $$;

-- Abmelden: nur diese Sitzung beenden, andere Geräte bleiben angemeldet
create or replace function public.gh_logout(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from groundhopper.sessions where token_hash = groundhopper.hash_token(coalesce(p_token, ''));
  return jsonb_build_object('ok', true);
end $$;

-- Sammlung vom Server holen
create or replace function public.gh_pull(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  a groundhopper.accounts%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select * into a from groundhopper.accounts where id = v_id;
  return jsonb_build_object('ok', true, 'username', a.username, 'rev', a.rev, 'data', a.data);
end $$;

-- Sammlung hochladen. p_base_rev ist der Stand, auf dem das Gerät aufbaut.
-- Hat ein anderes Gerät inzwischen etwas geändert, kommt „conflict“ samt aktuellem Stand zurück,
-- die App führt beides zusammen und versucht es erneut.
create or replace function public.gh_push(p_token text, p_data jsonb, p_base_rev integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  a groundhopper.accounts%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 5000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;

  select * into a from groundhopper.accounts where id = v_id for update;
  if a.rev <> p_base_rev then
    return jsonb_build_object('ok', false, 'error', 'conflict', 'rev', a.rev, 'data', a.data);
  end if;

  update groundhopper.accounts set data = p_data, rev = a.rev + 1, updated_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'rev', a.rev + 1);
end $$;

-- Konto endgültig löschen (Passwort zur Bestätigung). Alle Sitzungen verschwinden mit.
create or replace function public.gh_delete_account(p_token text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  a groundhopper.accounts%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select * into a from groundhopper.accounts where id = v_id for update;
  if p_password is null or a.password_hash <> extensions.crypt(p_password, a.password_hash) then
    return jsonb_build_object('ok', false, 'error', 'wrong_credentials');
  end if;
  delete from groundhopper.accounts where id = v_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function
  public.gh_register(text, text),
  public.gh_login(text, text),
  public.gh_logout(text),
  public.gh_pull(text),
  public.gh_push(text, jsonb, integer),
  public.gh_delete_account(text, text)
from public;

grant execute on function
  public.gh_register(text, text),
  public.gh_login(text, text),
  public.gh_logout(text),
  public.gh_pull(text),
  public.gh_push(text, jsonb, integer),
  public.gh_delete_account(text, text)
to anon, authenticated;

-- Data API über die neuen Funktionen informieren
notify pgrst, 'reload schema';

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
  v_visits jsonb;
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

  -- Fotos und gemeinsame Spiele gelöschter Besuche aufräumen. Die 10 Minuten Schonfrist schützen
  -- Besuche, die gerade erst angelegt und noch nicht hochgeladen sind.
  v_visits := case when jsonb_typeof(p_data->'visits') = 'array' then p_data->'visits' else '[]'::jsonb end;
  delete from groundhopper.photos p
  where p.owner = v_id and p.created_at < now() - interval '10 minutes'
    and not exists (select 1 from jsonb_array_elements(v_visits) x where x->>'id' = p.visit_id);
  delete from groundhopper.match_members m
  where m.account_id = v_id and m.status = 'accepted' and m.joined_at < now() - interval '10 minutes'
    and not exists (select 1 from jsonb_array_elements(v_visits) x where x->>'id' = m.visit_id);

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

-- ==========================================================================
-- Freunde, gemeinsame Spiele, Fotos und Profilbilder
-- ==========================================================================

-- Freundschaften: erst eine Anfrage (pending), nach dem Annehmen gegenseitig (accepted)
create table if not exists groundhopper.friendships (
  requester   uuid not null references groundhopper.accounts(id) on delete cascade,
  addressee   uuid not null references groundhopper.accounts(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on groundhopper.friendships(addressee);

-- Gemeinsam besuchtes Spiel: Wer ein Spiel abhakt und Freunde markiert, legt eine Gruppe an.
-- Markierte Freunde sind erst „pending“ und werden mit „Ja, war dabei“ zu Mitgliedern.
create table if not exists groundhopper.match_groups (
  id         uuid primary key,                  -- = Besuchs-ID dessen, der die Gruppe angelegt hat
  owner      uuid references groundhopper.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists groundhopper.match_members (
  group_id   uuid not null references groundhopper.match_groups(id) on delete cascade,
  account_id uuid not null references groundhopper.accounts(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid references groundhopper.accounts(id) on delete set null,
  visit_id   text,                              -- der Besuch in der Sammlung dieses Mitglieds
  visit      jsonb,                             -- Spieldaten für die Anfrage („Warst du dabei?“)
  created_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (group_id, account_id)
);
create index if not exists match_members_account_idx on groundhopper.match_members(account_id);

-- Fotos zu einer Erinnerung (JPEG, auf dem Gerät verkleinert) mit kleinem Vorschaubild
create table if not exists groundhopper.photos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references groundhopper.accounts(id) on delete cascade,
  visit_id   text not null,
  thumb      bytea not null,
  image      bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_owner_visit_idx on groundhopper.photos(owner, visit_id);

-- Profilbilder; v zählt hoch, damit Geräte ein neues Bild erkennen
create table if not exists groundhopper.avatars (
  account_id uuid primary key references groundhopper.accounts(id) on delete cascade,
  image      bytea not null,
  v          integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table groundhopper.friendships enable row level security;
alter table groundhopper.match_groups enable row level security;
alter table groundhopper.match_members enable row level security;
alter table groundhopper.photos enable row level security;
alter table groundhopper.avatars enable row level security;
revoke all on all tables in schema groundhopper from public, anon, authenticated;

-- ---------- Hilfsfunktionen (nicht öffentlich) ----------

create or replace function groundhopper.account_by_name(p_username text) returns uuid
language sql stable set search_path = '' as $$
  select id from groundhopper.accounts where username_key = lower(btrim(coalesce(p_username, '')))
$$;

create or replace function groundhopper.are_friends(p_a uuid, p_b uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from groundhopper.friendships f
    where f.status = 'accepted'
      and ((f.requester = p_a and f.addressee = p_b) or (f.requester = p_b and f.addressee = p_a)))
$$;

create or replace function groundhopper.avatar_v(p_account uuid) returns integer
language sql stable set search_path = '' as $$
  select v from groundhopper.avatars where account_id = p_account
$$;

-- Foto eines Besuchs sehen dürfen: der Besitzer, seine Freunde und alle, die bei dem Spiel mit dabei waren
create or replace function groundhopper.can_see_photo(p_viewer uuid, p_owner uuid, p_visit text) returns boolean
language sql stable set search_path = '' as $$
  select p_viewer = p_owner
    or groundhopper.are_friends(p_viewer, p_owner)
    or exists (
      select 1
      from groundhopper.match_members o
      join groundhopper.match_members m on m.group_id = o.group_id
      where o.account_id = p_owner and o.visit_id = p_visit and o.status = 'accepted'
        and m.account_id = p_viewer and m.status = 'accepted')
$$;

create or replace function groundhopper.b64(p bytea) returns text
language sql immutable set search_path = '' as $$
  select translate(encode(p, 'base64'), E'\n', '')
$$;

-- Base64 → JPEG-Bytes; null, wenn es kein gültiges JPEG ist
create or replace function groundhopper.jpeg(p text) returns bytea
language plpgsql immutable set search_path = '' as $$
declare
  v bytea;
begin
  v := decode(p, 'base64');
  if v is null or octet_length(v) < 4 or substring(v from 1 for 3) <> '\xffd8ff'::bytea then return null; end if;
  return v;
exception when others then
  return null;
end $$;

revoke all on all functions in schema groundhopper from public, anon, authenticated;

-- ---------- Freunde ----------

-- Alles für den Freunde-Tab auf einmal: Freunde, Anfragen, Spiel-Markierungen und gemeinsame Spiele
create or replace function public.gh_social(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  return jsonb_build_object(
    'ok', true,
    'me', (select jsonb_build_object('username', a.username, 'avatar', groundhopper.avatar_v(a.id), 'hopper', a.data->'hopper')
           from groundhopper.accounts a where a.id = v_id),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', a.username,
        'avatar', groundhopper.avatar_v(a.id),
        'hopper', a.data->'hopper',
        'since', f.accepted_at,
        'games', case when jsonb_typeof(a.data->'visits') = 'array' then jsonb_array_length(a.data->'visits') else 0 end,
        'stadiums', (select count(distinct x->>'stadiumId') from jsonb_array_elements(
          case when jsonb_typeof(a.data->'visits') = 'array' then a.data->'visits' else '[]'::jsonb end) x)
      ) order by a.username_key)
      from groundhopper.friendships f
      join groundhopper.accounts a on a.id = case when f.requester = v_id then f.addressee else f.requester end
      where f.status = 'accepted' and v_id in (f.requester, f.addressee)), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('username', a.username, 'avatar', groundhopper.avatar_v(a.id), 'hopper', a.data->'hopper', 'at', f.created_at)
        order by f.created_at desc)
      from groundhopper.friendships f join groundhopper.accounts a on a.id = f.requester
      where f.addressee = v_id and f.status = 'pending'), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('username', a.username, 'avatar', groundhopper.avatar_v(a.id), 'hopper', a.data->'hopper', 'at', f.created_at)
        order by f.created_at desc)
      from groundhopper.friendships f join groundhopper.accounts a on a.id = f.addressee
      where f.requester = v_id and f.status = 'pending'), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('group', m.group_id, 'from', a.username, 'avatar', groundhopper.avatar_v(a.id),
          'visit', m.visit, 'at', m.created_at) order by m.created_at desc)
      from groundhopper.match_members m left join groundhopper.accounts a on a.id = m.invited_by
      where m.account_id = v_id and m.status = 'pending'), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('group', g.group_id, 'visit', g.visit_id, 'members', (
        select coalesce(jsonb_agg(jsonb_build_object('username', a.username, 'avatar', groundhopper.avatar_v(a.id),
            'hopper', a.data->'hopper', 'status', m.status) order by m.created_at), '[]'::jsonb)
        from groundhopper.match_members m join groundhopper.accounts a on a.id = m.account_id
        where m.group_id = g.group_id and m.account_id <> v_id)))
      from groundhopper.match_members g
      where g.account_id = v_id and g.status = 'accepted'), '[]'::jsonb)
  );
end $$;

-- Konten nach dem Anfang des Benutzernamens suchen (ab 2 Zeichen)
create or replace function public.gh_search_users(p_token text, p_query text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_q text := lower(btrim(coalesce(p_query, '')));
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'users', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'users', coalesce((
    select jsonb_agg(jsonb_build_object(
      'username', a.username,
      'avatar', groundhopper.avatar_v(a.id),
      'relation', case
        when f.status = 'accepted' then 'friend'
        when f.requester = v_id then 'outgoing'
        when f.requester is not null then 'incoming'
        else 'none' end
    ) order by a.username_key)
    from (
      select id, username, username_key from groundhopper.accounts
      where left(username_key, length(v_q)) = v_q and id <> v_id
      order by username_key limit 20
    ) a
    left join groundhopper.friendships f
      on (f.requester = v_id and f.addressee = a.id) or (f.requester = a.id and f.addressee = v_id)), '[]'::jsonb));
end $$;

-- Freundschaftsanfrage senden. Hat der andere schon angefragt, seid ihr direkt befreundet.
create or replace function public.gh_friend_request(p_token text, p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_other uuid := groundhopper.account_by_name(p_username);
  f groundhopper.friendships%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if v_other is null or v_other = v_id then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into f from groundhopper.friendships
  where (requester = v_id and addressee = v_other) or (requester = v_other and addressee = v_id)
  for update;
  if found then
    if f.status = 'pending' and f.requester = v_other then
      update groundhopper.friendships set status = 'accepted', accepted_at = now()
      where requester = v_other and addressee = v_id;
      return jsonb_build_object('ok', true, 'relation', 'friend');
    end if;
    return jsonb_build_object('ok', true, 'relation', case when f.status = 'accepted' then 'friend' else 'outgoing' end);
  end if;

  if (select count(*) from groundhopper.friendships where requester = v_id and status = 'pending') >= 50 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  insert into groundhopper.friendships (requester, addressee) values (v_id, v_other) on conflict do nothing;
  return jsonb_build_object('ok', true, 'relation', 'outgoing');
end $$;

-- Anfrage annehmen oder ablehnen
create or replace function public.gh_friend_respond(p_token text, p_username text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_other uuid := groundhopper.account_by_name(p_username);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_accept then
    update groundhopper.friendships set status = 'accepted', accepted_at = now()
    where requester = v_other and addressee = v_id and status = 'pending';
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    -- Falls beide gleichzeitig angefragt haben
    delete from groundhopper.friendships where requester = v_id and addressee = v_other;
  else
    delete from groundhopper.friendships where requester = v_other and addressee = v_id and status = 'pending';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Freund entfernen bzw. eigene Anfrage zurückziehen
create or replace function public.gh_friend_remove(p_token text, p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_other uuid := groundhopper.account_by_name(p_username);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  delete from groundhopper.friendships
  where (requester = v_id and addressee = v_other) or (requester = v_other and addressee = v_id);
  return jsonb_build_object('ok', true);
end $$;

-- Sammlung eines Freundes ansehen – ohne seine Notizen und ohne Merkliste
create or replace function public.gh_friend(p_token text, p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  a groundhopper.accounts%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select * into a from groundhopper.accounts where id = groundhopper.account_by_name(p_username);
  if not found or not groundhopper.are_friends(v_id, a.id) then
    return jsonb_build_object('ok', false, 'error', 'not_friends');
  end if;
  return jsonb_build_object(
    'ok', true,
    'username', a.username,
    'avatar', groundhopper.avatar_v(a.id),
    'hopper', a.data->'hopper',
    'visits', coalesce((
      select jsonb_agg(x - 'notes')
      from jsonb_array_elements(case when jsonb_typeof(a.data->'visits') = 'array' then a.data->'visits' else '[]'::jsonb end) x), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('visit', o.visit_id, 'members', (
        select coalesce(jsonb_agg(jsonb_build_object('username', u.username, 'avatar', groundhopper.avatar_v(u.id),
            'hopper', u.data->'hopper', 'status', m.status) order by m.created_at), '[]'::jsonb)
        from groundhopper.match_members m join groundhopper.accounts u on u.id = m.account_id
        where m.group_id = o.group_id and m.account_id <> a.id and m.status = 'accepted')))
      from groundhopper.match_members o
      where o.account_id = a.id and o.status = 'accepted'), '[]'::jsonb)
  );
end $$;

-- ---------- Gemeinsame Spiele ----------

-- Freunde bei einem Spiel markieren. p_group: bestehende Gruppe des Besuchs oder die Besuchs-ID für eine neue.
create or replace function public.gh_tag_friends(p_token text, p_group uuid, p_visit_id text, p_visit jsonb, p_usernames text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_me groundhopper.match_members%rowtype;
  v_other uuid;
  v_name text;
  v_sent integer := 0;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_group is null or p_visit_id is null or length(p_visit_id) > 64
     or p_visit is null or jsonb_typeof(p_visit) <> 'object' or octet_length(p_visit::text) > 60000
     or coalesce(array_length(p_usernames, 1), 0) > 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;

  perform 1 from groundhopper.match_groups where id = p_group for update;
  if not found then
    insert into groundhopper.match_groups (id, owner) values (p_group, v_id);
    insert into groundhopper.match_members (group_id, account_id, status, visit_id, joined_at)
    values (p_group, v_id, 'accepted', p_visit_id, now());
  else
    select * into v_me from groundhopper.match_members where group_id = p_group and account_id = v_id;
    if not found or v_me.status <> 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'not_member');
    end if;
  end if;

  foreach v_name in array coalesce(p_usernames, '{}'::text[]) loop
    v_other := groundhopper.account_by_name(v_name);
    continue when v_other is null or v_other = v_id or not groundhopper.are_friends(v_id, v_other);
    insert into groundhopper.match_members (group_id, account_id, status, invited_by, visit)
    values (p_group, v_other, 'pending', v_id, p_visit - 'notes' - 'rating')
    on conflict do nothing;
    if found then v_sent := v_sent + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'sent', v_sent);
end $$;

-- Auf eine Markierung antworten. Bei „Ja“ verweist p_visit_id auf den Besuch in der eigenen Sammlung.
create or replace function public.gh_tag_respond(p_token text, p_group uuid, p_accept boolean, p_visit_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_accept then
    if p_visit_id is null or length(p_visit_id) > 64 then
      return jsonb_build_object('ok', false, 'error', 'invalid_data');
    end if;
    update groundhopper.match_members set status = 'accepted', visit_id = p_visit_id, visit = null, joined_at = now()
    where group_id = p_group and account_id = v_id and status = 'pending';
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
  else
    delete from groundhopper.match_members where group_id = p_group and account_id = v_id and status = 'pending';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Fotos ----------

-- Foto zu einem eigenen Besuch hochladen (höchstens 6 pro Spiel und 300 insgesamt)
create or replace function public.gh_add_photo(p_token text, p_visit_id text, p_thumb text, p_image text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_thumb bytea := groundhopper.jpeg(p_thumb);
  v_image bytea := groundhopper.jpeg(p_image);
  v_new uuid;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_visit_id is null or length(p_visit_id) > 64 or v_thumb is null or v_image is null
     or octet_length(v_thumb) > 60000 or octet_length(v_image) > 600000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;
  -- Gleichzeitige Uploads nacheinander zählen
  perform pg_advisory_xact_lock(hashtext('gh_photo:' || v_id::text));
  if (select count(*) from groundhopper.photos where owner = v_id and visit_id = p_visit_id) >= 6
     or (select count(*) from groundhopper.photos where owner = v_id) >= 300 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  insert into groundhopper.photos (owner, visit_id, thumb, image) values (v_id, p_visit_id, v_thumb, v_image)
  returning id into v_new;
  return jsonb_build_object('ok', true, 'id', v_new);
end $$;

-- Fotos zu einer Karte: die des Besitzers und die aller, die bei dem Spiel mit dabei waren (sofern sichtbar).
-- p_username null = eigene Karte.
create or replace function public.gh_photos(p_token text, p_username text, p_visit_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_owner uuid;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  v_owner := case when p_username is null then v_id else groundhopper.account_by_name(p_username) end;
  if v_owner is null or (v_owner <> v_id and not groundhopper.are_friends(v_id, v_owner)) then
    return jsonb_build_object('ok', false, 'error', 'not_friends');
  end if;
  return jsonb_build_object('ok', true, 'photos', coalesce((
    with pairs as (
      select v_owner as account_id, p_visit_id as visit_id
      union
      select m.account_id, m.visit_id
      from groundhopper.match_members o
      join groundhopper.match_members m on m.group_id = o.group_id
      where o.account_id = v_owner and o.visit_id = p_visit_id and o.status = 'accepted'
        and m.status = 'accepted' and m.visit_id is not null
    )
    select jsonb_agg(jsonb_build_object('id', p.id, 'username', a.username, 'mine', p.owner = v_id,
        'thumb', groundhopper.b64(p.thumb), 'at', p.created_at) order by p.created_at)
    from groundhopper.photos p
    join pairs on pairs.account_id = p.owner and pairs.visit_id = p.visit_id
    join groundhopper.accounts a on a.id = p.owner
    where groundhopper.can_see_photo(v_id, p.owner, p.visit_id)), '[]'::jsonb));
end $$;

-- Ein Foto in voller Größe
create or replace function public.gh_photo(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  p groundhopper.photos%rowtype;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select * into p from groundhopper.photos where id = p_id;
  if not found or not groundhopper.can_see_photo(v_id, p.owner, p.visit_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'image', groundhopper.b64(p.image));
end $$;

create or replace function public.gh_delete_photo(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  delete from groundhopper.photos where id = p_id and owner = v_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Profilbilder ----------

-- Eigenes Profilbild setzen (null = entfernen)
create or replace function public.gh_set_avatar(p_token text, p_image text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
  v_image bytea := groundhopper.jpeg(p_image);
  v_v integer;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_image is null then
    delete from groundhopper.avatars where account_id = v_id;
    return jsonb_build_object('ok', true, 'v', null);
  end if;
  if v_image is null or octet_length(v_image) > 80000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;
  insert into groundhopper.avatars (account_id, image) values (v_id, v_image)
  on conflict (account_id) do update set image = excluded.image, v = groundhopper.avatars.v + 1, updated_at = now()
  returning v into v_v;
  return jsonb_build_object('ok', true, 'v', v_v);
end $$;

-- Profilbilder mehrerer Konten auf einmal
create or replace function public.gh_avatars(p_token text, p_usernames text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := groundhopper.session_account(p_token);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if coalesce(array_length(p_usernames, 1), 0) > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;
  return jsonb_build_object('ok', true, 'avatars', coalesce((
    select jsonb_agg(jsonb_build_object('username', a.username, 'v', av.v, 'image', groundhopper.b64(av.image)))
    from groundhopper.accounts a join groundhopper.avatars av on av.account_id = a.id
    where a.username_key in (select lower(btrim(u)) from unnest(p_usernames) u)), '[]'::jsonb));
end $$;

-- ---------- Rechte ----------

revoke all on function
  public.gh_register(text, text),
  public.gh_login(text, text),
  public.gh_logout(text),
  public.gh_pull(text),
  public.gh_push(text, jsonb, integer),
  public.gh_delete_account(text, text),
  public.gh_social(text),
  public.gh_search_users(text, text),
  public.gh_friend_request(text, text),
  public.gh_friend_respond(text, text, boolean),
  public.gh_friend_remove(text, text),
  public.gh_friend(text, text),
  public.gh_tag_friends(text, uuid, text, jsonb, text[]),
  public.gh_tag_respond(text, uuid, boolean, text),
  public.gh_add_photo(text, text, text, text),
  public.gh_photos(text, text, text),
  public.gh_photo(text, uuid),
  public.gh_delete_photo(text, uuid),
  public.gh_set_avatar(text, text),
  public.gh_avatars(text, text[])
from public;

grant execute on function
  public.gh_register(text, text),
  public.gh_login(text, text),
  public.gh_logout(text),
  public.gh_pull(text),
  public.gh_push(text, jsonb, integer),
  public.gh_delete_account(text, text),
  public.gh_social(text),
  public.gh_search_users(text, text),
  public.gh_friend_request(text, text),
  public.gh_friend_respond(text, text, boolean),
  public.gh_friend_remove(text, text),
  public.gh_friend(text, text),
  public.gh_tag_friends(text, uuid, text, jsonb, text[]),
  public.gh_tag_respond(text, uuid, boolean, text),
  public.gh_add_photo(text, text, text, text),
  public.gh_photos(text, text, text),
  public.gh_photo(text, uuid),
  public.gh_delete_photo(text, uuid),
  public.gh_set_avatar(text, text),
  public.gh_avatars(text, text[])
to anon, authenticated;

-- Data API über die neuen Funktionen informieren
notify pgrst, 'reload schema';

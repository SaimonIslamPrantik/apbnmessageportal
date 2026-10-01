
-- APBn Squad Message Portal
-- Run this entire file in Supabase SQL Editor.
-- After creating your first account, set its profile role to 'admin'
-- with the bootstrap query at the bottom.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  reply_to uuid references public.messages(id) on delete set null
);

create index if not exists messages_created_at_idx
  on public.messages(created_at);

create index if not exists messages_user_id_idx
  on public.messages(user_id);

create index if not exists messages_reply_to_idx
  on public.messages(reply_to);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- Helper functions. SECURITY DEFINER avoids recursive RLS checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and banned = false
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and banned = false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated;

-- Signup profile creation. The client supplies username only after local validation;
-- the database enforces the final format as well.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u text := coalesce(new.raw_user_meta_data->>'username', '');
begin
  if u !~ '^[A-Za-z]+@[0-9]+$' then
    raise exception 'Invalid APBn username format';
  end if;

  insert into public.profiles(id, username, username_normalized)
  values (new.id, u, lower(u));

  return new;
exception
  when unique_violation then
    raise exception 'Username already exists';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Profiles
create policy "active members can read profiles"
on public.profiles for select
to authenticated
using (public.is_active_member());

create policy "admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and role in ('member','admin')
);

-- A user can update their own username only if desired later; this version does
-- not expose username editing from the UI, so no member update policy is needed.

-- Messages
create policy "active members can read messages"
on public.messages for select
to authenticated
using (public.is_active_member());

create policy "active members can send messages"
on public.messages for insert
to authenticated
with check (
  public.is_active_member()
  and user_id = auth.uid()
);

create policy "owners can soft delete messages"
on public.messages for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_member()
)
with check (
  user_id = auth.uid()
  and public.is_active_member()
);

create policy "admins can moderate messages"
on public.messages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Prevent physical message deletion from the normal browser client.
-- The UI performs a soft-delete so the timestamp/placeholder remains.
-- No DELETE policy is intentionally created.

grant select on public.profiles to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.messages to authenticated;

-- Realtime/Postgres Changes.
-- If your project already has this publication, this safely adds the table.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

-- OPTIONAL: after you have created the first account, run:
-- update public.profiles
-- set role = 'admin'
-- where username_normalized = lower('YOURUSERNAME@001');

-- You can also set an admin by UUID:
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';

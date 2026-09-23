-- Fan wall: one row per brick. Run once in the Supabase SQL editor.
-- Positions are NOT stored: brick n sits at the n-th slot of a running-bond wall,
-- so the wall is fully determined by insertion order (id).

create table if not exists public.wall_bricks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  color       text not null
              check (color in ('red','white','black','gray','yellow','blue','green','beige')),
  message     text not null check (char_length(message) between 1 and 280),
  name        text check (char_length(name) <= 40),
  lang        text check (char_length(lang) <= 12),
  approved    boolean not null default true
);

alter table public.wall_bricks enable row level security;

-- Anyone can read approved bricks.
create policy "wall_read" on public.wall_bricks
  for select to anon, authenticated using (approved);

-- Anyone can add a brick; they cannot set id/created_at/approved to anything unusual.
create policy "wall_insert" on public.wall_bricks
  for insert to anon, authenticated
  with check (approved = true and char_length(message) <= 280);

-- Nobody but the dashboard (service role) can update or delete.

-- Crude abuse brake: at most 60 bricks per minute site-wide (PostgREST has no client IP).
create or replace function public.wall_rate_limit() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from public.wall_bricks where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'wall is busy, try again in a minute';
  end if;
  return new;
end $$;

drop trigger if exists wall_rate_limit on public.wall_bricks;
create trigger wall_rate_limit before insert on public.wall_bricks
  for each row execute function public.wall_rate_limit();

-- Her founding brick (edit the message).
insert into public.wall_bricks (color, message, name, lang)
select 'red', 'Manchester is my heaven.', 'Nazym', 'en'
where not exists (select 1 from public.wall_bricks);

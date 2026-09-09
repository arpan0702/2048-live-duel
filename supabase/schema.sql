-- ============================================================
-- 2048 Live Duel: Supabase Schema & Realtime Configuration
-- ============================================================

-- 1. Users & Lifetime Records
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text default '',
  all_time_high_score numeric not null default 0,
  highest_tile_achieved numeric not null default 2,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_leaderboard on public.users (all_time_high_score desc);

-- 2. Match Rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(6) unique not null,
  status text not null default 'waiting', -- 'waiting' | 'active' | 'completed' | 'abandoned'
  player1_id uuid references public.users(id),
  player2_id uuid references public.users(id),
  player1_score numeric default 0,
  player2_score numeric default 0,
  winner_id uuid references public.users(id),
  created_at timestamptz default now()
);

-- 3. Atomic High Score Submission
create or replace function public.submit_match_score(
  p_user_id uuid,
  p_score numeric,
  p_tile numeric
) returns void language plpgsql as $$
begin
  update public.users
  set 
    all_time_high_score = greatest(all_time_high_score, p_score),
    highest_tile_achieved = greatest(highest_tile_achieved, p_tile),
    updated_at = now()
  where id = p_user_id;
end;
$$;

-- 4. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.rooms enable row level security;

-- Permissive public policies for frictionless anonymous duel users
create policy "Public users access" on public.users
  for all using (true) with check (true);

create policy "Public rooms access" on public.rooms
  for all using (true) with check (true);

-- 5. Enable Realtime Replication for Rooms
alter publication supabase_realtime add table public.rooms;

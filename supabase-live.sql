-- مسابقة الحصة المباشرة — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يعتمد على الدالة public.is_admin() التي أنشأها ملف supabase-setup.sql.

-- غرفة المسابقة: ينشئها المعلم برمز من 4 أرقام
create table if not exists public.live_rooms (
  code text primary key check (code ~ '^[0-9]{4}$'),
  grade text not null,
  model int not null,
  q int not null default -1,
  phase text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'end')),
  created_at timestamptz not null default now()
);
alter table public.live_rooms enable row level security;
drop policy if exists "signed-in users read rooms" on public.live_rooms;
create policy "signed-in users read rooms" on public.live_rooms for select to authenticated using (true);
drop policy if exists "admin manages rooms" on public.live_rooms;
create policy "admin manages rooms" on public.live_rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- الطلاب المنضمون (الاسم الأول فقط)
create table if not exists public.live_players (
  room text not null references public.live_rooms (code) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (room, user_id)
);
alter table public.live_players enable row level security;
drop policy if exists "signed-in users read players" on public.live_players;
create policy "signed-in users read players" on public.live_players for select to authenticated using (true);
drop policy if exists "students join as themselves" on public.live_players;
create policy "students join as themselves" on public.live_players for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.live_rooms r where r.code = room and r.phase <> 'end'));
drop policy if exists "admin removes players" on public.live_players;
create policy "admin removes players" on public.live_players for delete to authenticated using (public.is_admin());

-- إجابة واحدة لكل طالب في كل سؤال، ولا تُقبل إلا والسؤال مفتوح
create table if not exists public.live_answers (
  room text not null references public.live_rooms (code) on delete cascade,
  q int not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pick int not null,
  ok boolean not null,
  points int not null check (points between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (room, q, user_id)
);
alter table public.live_answers enable row level security;
drop policy if exists "signed-in users read answers" on public.live_answers;
create policy "signed-in users read answers" on public.live_answers for select to authenticated using (true);
drop policy if exists "students answer the open question" on public.live_answers;
create policy "students answer the open question" on public.live_answers for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.live_rooms r where r.code = room and r.phase = 'question' and r.q = live_answers.q));

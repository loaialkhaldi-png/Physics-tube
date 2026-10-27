-- حسابات الطلاب وإحصائيات لوحة المعلم — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run.
-- يعتمد على الدالة public.is_admin() التي أنشأها ملف supabase-setup.sql.

-- بيانات الطالب: تُنشأ تلقائياً عند التسجيل من التطبيق
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text not null default '',
  phone text not null default '',
  grade text not null default 'g10',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visits integer not null default 0
);
alter table public.profiles enable row level security;

drop policy if exists "students read own profile, admin reads all" on public.profiles;
create policy "students read own profile, admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "students update own profile" on public.profiles;
create policy "students update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admin deletes profiles" on public.profiles;
create policy "admin deletes profiles" on public.profiles
  for delete to authenticated using (public.is_admin());

-- الطالب يعدّل اسمه وجواله وصفه فقط، وليس اسم المستخدم أو الإحصائيات
revoke update on public.profiles from authenticated;
grant update (full_name, phone, grade) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username, full_name, phone, grade)
    values (
      new.id,
      lower(new.raw_user_meta_data ->> 'username'),
      left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 60),
      left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 20),
      coalesce(new.raw_user_meta_data ->> 'grade', 'g10')
    );
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- سجل الاستخدام: فتح التطبيق، فتح درس، فتح مذكرة
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('open', 'lesson', 'pdf')),
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists events_kind_time on public.events (kind, created_at);
alter table public.events enable row level security;

drop policy if exists "admin reads events" on public.events;
create policy "admin reads events" on public.events
  for select to authenticated using (public.is_admin());

create or replace function public.log_event(p_kind text, p_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('open', 'lesson', 'pdf') then return; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then return; end if;
  insert into public.events (user_id, kind, ref) values (auth.uid(), p_kind, left(p_ref, 80));
  if p_kind = 'open' then
    update public.profiles set last_seen = now(), visits = visits + 1 where id = auth.uid();
  end if;
end $$;

-- أرقام لوحة المعلم، محسوبة بتوقيت الكويت
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait';
  result json;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select json_build_object(
    'students',    (select count(*) from public.profiles),
    'new_7',       (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'by_grade',    (select coalesce(json_object_agg(grade, n), '{}'::json) from (select grade, count(*) n from public.profiles group by grade) g),
    'opens_today', (select count(*) from public.events where kind = 'open' and created_at >= today),
    'opens_7',     (select count(*) from public.events where kind = 'open' and created_at >= now() - interval '7 days'),
    'opens_30',    (select count(*) from public.events where kind = 'open' and created_at >= now() - interval '30 days'),
    'active_7',    (select count(distinct user_id) from public.events where created_at >= now() - interval '7 days'),
    'daily',       (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]'::json) from (
                      select to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') d, count(*) n
                      from public.events where kind = 'open' and created_at >= today - interval '29 days' group by 1) x),
    'top',         (select coalesce(json_agg(json_build_object('ref', ref, 'n', n, 'u', u) order by n desc), '[]'::json) from (
                      select ref, count(*) n, count(distinct user_id) u from public.events
                      where kind = 'lesson' and ref is not null group by ref order by count(*) desc limit 10) t)
  ) into result;
  return result;
end $$;

revoke execute on function public.log_event(text, text) from public, anon;
grant execute on function public.log_event(text, text) to authenticated;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.is_admin() to authenticated;

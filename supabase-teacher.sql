-- لوحة متابعة المعلم — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يحتاج أن تكون قد شغّلت قبله: supabase-setup.sql و supabase-students.sql.
-- يحفظ إجابات الطلاب في بنك الأسئلة (صح/خطأ) حتى يرى المعلم تقدّم كل طالب وأصعب الأسئلة.

create table if not exists public.answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  qid text not null,              -- مثل: g12:1-1.5  (الصف:الدرس.رقم السؤال)
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists answers_time on public.answers (created_at);
create index if not exists answers_user_time on public.answers (user_id, created_at);
alter table public.answers enable row level security;

drop policy if exists "admin reads answers" on public.answers;
create policy "admin reads answers" on public.answers
  for select to authenticated using (public.is_admin());

-- الطالب يرسل إجاباته على دفعات (حتى 60 إجابة في المرة)
create or replace function public.log_answers(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or jsonb_typeof(p) <> 'array' then return; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then return; end if;
  insert into public.answers (user_id, qid, ok)
  select auth.uid(), left(x ->> 'q', 40), coalesce((x ->> 'ok')::boolean, false)
  from (select value x from jsonb_array_elements(p) limit 60) a
  where x ? 'q';
  update public.profiles set last_seen = now() where id = auth.uid();
end $$;

-- كل أرقام لوحة المعلم في طلب واحد (p_grade: g10 أو g11 أو g12، أو null لكل الصفوف)
create or replace function public.admin_dashboard(p_grade text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait';
  result json;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  with st as (select * from public.profiles where p_grade is null or grade = p_grade),
  ans as (select a.* from public.answers a join st on st.id = a.user_id where a.created_at >= today - interval '29 days'),
  ev as (select e.* from public.events e join st on st.id = e.user_id where e.created_at >= today - interval '29 days'),
  act as (select user_id, created_at from ev union all select user_id, created_at from ans)
  select json_build_object(
    'kpi', json_build_object(
      'students',     (select count(*) from st),
      'new_7',        (select count(*) from st where created_at >= now() - interval '7 days'),
      'active_today', (select count(distinct user_id) from act where created_at >= today),
      'active_7',     (select count(distinct user_id) from act where created_at >= now() - interval '7 days'),
      'inactive_7',   (select count(*) from st where last_seen < now() - interval '7 days'),
      'ans_7',        (select count(*) from ans where created_at >= now() - interval '7 days'),
      'ok_7',         (select count(*) from ans where ok and created_at >= now() - interval '7 days'),
      'ans_p7',       (select count(*) from ans where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
      'ok_p7',        (select count(*) from ans where ok and created_at >= now() - interval '14 days' and created_at < now() - interval '7 days')
    ),
    'daily', (select coalesce(json_agg(json_build_object('d', d, 'u', u, 'a', a) order by d), '[]'::json) from (
      select d, count(distinct user_id) u, sum(isans) a from (
        select to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') d, user_id, 0 isans from ev
        union all select to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD'), user_id, 1 from ans) x group by d) y),
    'heat', (select coalesce(json_agg(json_build_object('w', w, 'h', h, 'n', n)), '[]'::json) from (
      select extract(dow from created_at at time zone 'Asia/Kuwait')::int w,
             (extract(hour from created_at at time zone 'Asia/Kuwait')::int / 3) h, count(*) n
      from act group by 1, 2) z),
    'students', (select coalesce(json_agg(s order by s.last_seen desc), '[]'::json) from (
      select st.id, st.username, st.full_name, st.phone, st.grade, st.created_at, st.last_seen, st.visits,
        (select count(*) from public.answers a where a.user_id = st.id and a.created_at >= now() - interval '7 days') ans_7,
        (select count(*) from public.answers a where a.user_id = st.id and a.ok and a.created_at >= now() - interval '7 days') ok_7,
        (select count(*) from public.answers a where a.user_id = st.id) ans_all,
        (select count(*) from public.answers a where a.user_id = st.id and a.ok) ok_all,
        (select count(*) from (select qid from public.answers a where a.user_id = st.id and a.ok group by qid having count(*) >= 2) m) mastered,
        (select count(distinct to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD')) from act where act.user_id = st.id and act.created_at >= now() - interval '7 days') days_7
      from st) s),
    'hard', (select coalesce(json_agg(h order by h.rate desc, h.n desc), '[]'::json) from (
      select qid, count(*) n, count(*) filter (where not ok) wrong,
             round(100.0 * count(*) filter (where not ok) / count(*)) rate
      from ans where p_grade is null or qid like p_grade || ':%'
      group by qid having count(*) >= 3 and count(*) filter (where not ok) > 0 order by 4 desc, 2 desc limit 12) h),
    'lessons', (select coalesce(json_agg(l order by l.lesson), '[]'::json) from (
      select split_part(qid, '.', 1) lesson, count(*) n, count(*) filter (where ok) ok, count(distinct user_id) u
      from ans where p_grade is null or qid like p_grade || ':%' group by 1) l),
    'top', (select coalesce(json_agg(json_build_object('ref', ref, 'n', n, 'u', u) order by n desc), '[]'::json) from (
      select ref, count(*) n, count(distinct user_id) u from ev
      where kind = 'lesson' and ref is not null group by ref order by count(*) desc limit 8) t)
  ) into result;
  return result;
end $$;

-- تفاصيل طالب واحد: نشاطه يومياً وأسئلته الخاطئة
create or replace function public.admin_student(p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait';
  result json;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  select json_build_object(
    'daily', (select coalesce(json_agg(json_build_object('d', d, 'a', a, 'ok', ok) order by d), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') d, count(*) a, count(*) filter (where ok) ok
      from public.answers where user_id = p_user and created_at >= today - interval '29 days' group by 1) x),
    'lessons', (select coalesce(json_agg(l order by l.lesson), '[]'::json) from (
      select split_part(qid, '.', 1) lesson, count(*) n, count(*) filter (where ok) ok
      from public.answers where user_id = p_user group by 1) l),
    'wrong', (select coalesce(json_agg(w), '[]'::json) from (
      select qid, count(*) filter (where not ok) n from public.answers where user_id = p_user
      group by qid having bool_or(not ok) and not (array_agg(ok order by created_at desc))[1]
      order by max(created_at) desc limit 15) w)
  ) into result;
  return result;
end $$;

revoke execute on function public.log_answers(jsonb) from public, anon;
grant execute on function public.log_answers(jsonb) to authenticated;
revoke execute on function public.admin_dashboard(text) from public, anon;
grant execute on function public.admin_dashboard(text) to authenticated;
revoke execute on function public.admin_student(uuid) from public, anon;
grant execute on function public.admin_student(uuid) to authenticated;

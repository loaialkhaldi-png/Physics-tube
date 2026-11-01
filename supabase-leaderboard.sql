-- لوحة المتصدرين الأسبوعية — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يحتاج أن تكون قد شغّلت قبله: supabase-teacher.sql (جدول إجابات بنك الأسئلة).
-- النقاط: كل إجابة صحيحة في بنك الأسئلة = نقطة، والسؤال الواحد يُحسب مرتين بحد أقصى في الأسبوع.
-- الأسبوع يبدأ يوم الأحد 12 منتصف الليل بتوقيت الكويت. تظهر للطلاب الأسماء الأولى فقط (مثل: سارة ك.).

create or replace function public.leaderboard(p_grade text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Kuwait')::date;
  ws timestamptz := ((d - extract(dow from d)::int)::timestamp) at time zone 'Asia/Kuwait';
  pw timestamptz := ws - interval '7 days';
  g text;
  admin boolean := coalesce(public.is_admin(), false);
  result json;
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  -- الطالب يرى صفه فقط؛ المعلم يختار الصف
  if admin then g := coalesce(p_grade, 'g12');
  else select grade into g from public.profiles where id = auth.uid();
    if g is null then raise exception 'not allowed'; end if;
  end if;
  with st as (
    select id, case when admin then full_name
      else split_part(trim(full_name), ' ', 1) || coalesce(' ' || nullif(left(split_part(trim(full_name), ' ', 2), 1), '') || '.', '') end nm
    from public.profiles where grade = g),
  wk as (
    select a.user_id, a.qid, count(*) filter (where a.ok) c, count(*) n, max(a.created_at) t
    from public.answers a join st on st.id = a.user_id
    where a.created_at >= ws and a.qid like g || ':%' group by 1, 2),
  pts as (
    select user_id, sum(least(c, 2))::int pts, sum(n)::int answered, max(t) t from wk group by 1 having sum(least(c, 2)) > 0),
  rk as (
    select p.*, st.nm, rank() over (order by p.pts desc) r from pts p join st on st.id = p.user_id),
  pv as (
    select a.user_id, sum(least(c, 2))::int pts from (
      select a.user_id, a.qid, count(*) filter (where a.ok) c from public.answers a join st on st.id = a.user_id
      where a.created_at >= pw and a.created_at < ws and a.qid like g || ':%' group by 1, 2) a
    group by 1 having sum(least(c, 2)) > 0)
  select json_build_object(
    'grade', g,
    'week_start', ws,
    'week_end', ws + interval '7 days',
    'players', (select count(*) from rk),
    'top', (select coalesce(json_agg(json_build_object('r', r, 'name', nm, 'pts', pts, 'n', answered, 'me', user_id = auth.uid()) order by r, t), '[]'::json)
            from (select * from rk order by r, t limit 10) x),
    'me', (select json_build_object('r', r, 'pts', pts, 'n', answered) from rk where user_id = auth.uid()),
    'prev', (select coalesce(json_agg(json_build_object('name', nm, 'pts', pts) order by pts desc), '[]'::json)
             from (select st.nm, pv.pts from pv join st on st.id = pv.user_id order by pv.pts desc limit 3) y)
  ) into result;
  return result;
end $$;

revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;

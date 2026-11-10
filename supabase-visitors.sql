-- عدّاد الزوار وما يجذبهم داخل التطبيق — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يعتمد على الدالة public.is_admin() التي أنشأها ملف supabase-setup.sql.
-- العدّ مجهول: رقم عشوائي يُحفظ في جهاز الزائر، بدون اسم ولا جوال ولا عنوان إنترنت.

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  vid text not null,                       -- رقم عشوائي للجهاز (ليس اسماً ولا رقماً شخصياً)
  kind text not null check (kind in ('open', 'view', 'pdf')),
  ref text,                                -- مثال: tab:notes ، lesson:g10-u0.2 ، game:xyz
  grade text,
  member boolean not null default false,   -- هل الزائر طالب مسجّل؟
  created_at timestamptz not null default now()
);
create index if not exists visits_time on public.visits (created_at);
create index if not exists visits_vid_time on public.visits (vid, created_at);
alter table public.visits enable row level security;

-- لا أحد يقرأ الجدول مباشرة؛ المعلم فقط عبر الدالة admin_visitors
drop policy if exists "admin reads visits" on public.visits;
create policy "admin reads visits" on public.visits
  for select to authenticated using (public.is_admin());
revoke all on public.visits from anon, authenticated;

-- تسجيل زيارة (يستدعيها التطبيق لأي زائر، سواء سجّل دخوله أو لا)
create or replace function public.track_visit(
  p_vid text, p_kind text, p_ref text default null, p_grade text default null, p_member boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_vid is null or length(p_vid) < 8 or length(p_vid) > 64 then return; end if;
  if p_kind not in ('open', 'view', 'pdf') then return; end if;
  -- حماية من الإغراق: 40 حدثاً كحد أقصى في الدقيقة لكل جهاز
  if (select count(*) from public.visits where vid = p_vid and created_at >= now() - interval '1 minute') >= 40 then return; end if;
  insert into public.visits (vid, kind, ref, grade, member)
  values (p_vid, p_kind, left(p_ref, 60), case when p_grade in ('g10', 'g11', 'g12') then p_grade end, coalesce(p_member, false));
end $$;

-- أرقام شاشة «الزوار» للمعلم فقط، بتوقيت الكويت
create or replace function public.admin_visitors() returns json
language plpgsql security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait';
  result json;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select json_build_object(
    'today',       (select count(distinct vid) from public.visits where created_at >= today),
    'yesterday',   (select count(distinct vid) from public.visits where created_at >= today - interval '1 day' and created_at < today),
    'u7',          (select count(distinct vid) from public.visits where created_at >= today - interval '6 days'),
    'u30',         (select count(distinct vid) from public.visits where created_at >= today - interval '29 days'),
    'total',       (select count(distinct vid) from public.visits),
    'new_today',   (select count(*) from (select vid from public.visits group by vid having min(created_at) >= today) x),
    'new_7',       (select count(*) from (select vid from public.visits group by vid having min(created_at) >= today - interval '6 days') x),
    'member_7',    (select count(distinct vid) from public.visits where member and created_at >= today - interval '6 days'),
    'since',       (select min(created_at) from public.visits),
    'daily',       (select coalesce(json_agg(json_build_object('d', d, 'u', u, 's', s, 'n', n) order by d), '[]'::json) from (
                      select to_char(created_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') d,
                             count(distinct vid) u,
                             count(*) filter (where kind = 'open') s,
                             count(*) filter (where kind <> 'open') n
                      from public.visits where created_at >= today - interval '29 days' group by 1) x),
    'sections',    (select coalesce(json_agg(json_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::json) from (
                      select split_part(ref, ':', 1) k, count(*) n, count(distinct vid) u
                      from public.visits where kind = 'view' and ref is not null and created_at >= today - interval '29 days' group by 1) x),
    'top',         (select coalesce(json_agg(json_build_object('k', k, 'ref', ref, 'n', n, 'u', u) order by k, n desc), '[]'::json) from (
                      select k, ref, n, u, row_number() over (partition by k order by n desc) rn from (
                        select case when kind = 'pdf' then 'pdf' else split_part(ref, ':', 1) end k, ref, count(*) n, count(distinct vid) u
                        from public.visits where kind in ('view', 'pdf') and ref is not null and created_at >= today - interval '29 days' group by 1, 2) a) b
                      where rn <= 8),
    'heat',        (select coalesce(json_agg(json_build_object('w', w, 'h', h, 'n', n)), '[]'::json) from (
                      select extract(dow from created_at at time zone 'Asia/Kuwait')::int w,
                             (extract(hour from created_at at time zone 'Asia/Kuwait')::int / 3) h, count(*) n
                      from public.visits where kind = 'open' and created_at >= today - interval '29 days' group by 1, 2) z),
    'grades',      (select coalesce(json_object_agg(grade, n), '{}'::json) from (
                      select grade, count(distinct vid) n from public.visits
                      where grade is not null and created_at >= today - interval '6 days' group by grade) g)
  ) into result;
  return result;
end $$;

revoke execute on function public.track_visit(text, text, text, text, boolean) from public;
grant execute on function public.track_visit(text, text, text, text, boolean) to anon, authenticated;
revoke execute on function public.admin_visitors() from public, anon;
grant execute on function public.admin_visitors() to authenticated;

-- الفصل المباشر والسبورة التفاعلية — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يعتمد على الدالة public.is_admin() التي أنشأها ملف supabase-setup.sql.

-- غرفة الفصل: يفتحها المعلم برمز من 4 أرقام، وتُحفظ فيها صفحات السبورة
create table if not exists public.class_rooms (
  code text primary key check (code ~ '^[0-9]{4}$'),
  grade text not null,
  pen uuid,                                   -- الطالب الذي معه القلم الآن (أو لا أحد)
  board jsonb not null default '{"pages":[{"s":[]}],"cur":0,"grid":true}',
  open boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.class_rooms enable row level security;
drop policy if exists "signed-in users read classes" on public.class_rooms;
create policy "signed-in users read classes" on public.class_rooms for select to authenticated using (true);
drop policy if exists "admin manages classes" on public.class_rooms;
create policy "admin manages classes" on public.class_rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- البث اللحظي (Realtime) بقنوات خاصة:
--   class:<code>   السبورة — يكتب فيها المعلم والطالب الذي معه القلم فقط، ويقرأها كل من في الفصل
--   classin:<code> مشاركة الطلاب (رفع اليد، الأسئلة، التصويت، التفاعل) — يكتب فيها ويقرأ كل من في الفصل
drop policy if exists "class members receive" on realtime.messages;
create policy "class members receive" on realtime.messages for select to authenticated
  using (exists (select 1 from public.class_rooms r where r.open
    and (realtime.topic() = 'class:' || r.code or realtime.topic() = 'classin:' || r.code)));

drop policy if exists "teacher or pen holder draws" on realtime.messages;
create policy "teacher or pen holder draws" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and exists (select 1 from public.class_rooms r where r.open
    and realtime.topic() = 'class:' || r.code and (public.is_admin() or r.pen = auth.uid())));

drop policy if exists "class members take part" on realtime.messages;
create policy "class members take part" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence') and exists (select 1 from public.class_rooms r where r.open
    and realtime.topic() = 'classin:' || r.code));

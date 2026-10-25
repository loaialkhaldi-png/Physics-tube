-- إعداد قاعدة بيانات Physics Tube
-- 1) استبدل your@email.com ببريدك (البريد نفسه الذي ستدخل به لوحة المعلم)
-- 2) الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run

-- من يحق له التعديل
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('your@email.com')
$$;

-- روابط الفيديوهات والمذكرات
create table if not exists public.content (
  key text primary key,          -- مثال: g10.1.2 = الصف العاشر، الوحدة 2، الدرس 3
  video text not null default '',
  pdf text not null default '',
  minutes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.content enable row level security;

drop policy if exists "everyone can read content" on public.content;
create policy "everyone can read content" on public.content
  for select using (true);

drop policy if exists "admin can write content" on public.content;
create policy "admin can write content" on public.content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- مكان حفظ ملفات المذكرات PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', true, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admin can upload notes" on storage.objects;
create policy "admin can upload notes" on storage.objects
  for insert to authenticated with check (bucket_id = 'notes' and public.is_admin());

drop policy if exists "admin can change notes" on storage.objects;
create policy "admin can change notes" on storage.objects
  for update to authenticated using (bucket_id = 'notes' and public.is_admin());

drop policy if exists "admin can delete notes" on storage.objects;
create policy "admin can delete notes" on storage.objects
  for delete to authenticated using (bucket_id = 'notes' and public.is_admin());

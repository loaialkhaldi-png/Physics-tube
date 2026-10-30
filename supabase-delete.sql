-- حذف الحساب من داخل التطبيق — Physics Tube
-- الصق الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة فقط).
-- يسمح للطالب بحذف حسابه بنفسه: يُحذف حسابه وملفه الشخصي وسجل نشاطه ومشاركاته في المسابقات.
-- لا يعمل على حساب المعلم، حتى لا يُحذف بالخطأ.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid() and not public.is_admin();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- =========================================================
-- الذائقة العربية: قاعدة بيانات الحسابات ولوحة المعلّم (Supabase)
-- شغّل هذا الملف كاملاً مرة واحدة في: Supabase ← SQL Editor ← New query ← Run
-- =========================================================

create extension if not exists pgcrypto;

-- ===== الجداول =====
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'student' check (role in ('student', 'teacher')),
  created_at  timestamptz not null default now()
);

create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  code        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id    uuid not null references public.classes(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- تقدّم الطالب كما يحفظه الموقع (المراحل، أفضل النتائج، التراكيب المحفوظة)
create table if not exists public.progress (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- محاولات اختبارات المراحل
create table if not exists public.attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  level       int  not null check (level between 1 and 10),
  score       int  not null,
  total       int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.attempts(user_id, created_at desc);

-- كل إجابة (لتحليل مواطن الضعف)
create table if not exists public.answers (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  qtype       text not null,
  item        text not null,          -- التركيب العرنجي أو عنوان النص
  item_kind   text not null check (item_kind in ('dict', 'text')),
  ok          boolean not null,
  level       int,
  context     text not null default 'practice' check (context in ('practice', 'test')),
  created_at  timestamptz not null default now()
);
create index if not exists answers_user_idx on public.answers(user_id, created_at desc);

-- ===== دوال مساعدة =====
create or replace function public.is_teacher_of(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members m join classes c on c.id = m.class_id
    where m.student_id = sid and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.owns_class(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = cid and teacher_id = auth.uid());
$$;

create or replace function public.member_of(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and student_id = auth.uid());
$$;

-- إنشاء الملف الشخصي تلقائياً عند التسجيل
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when new.raw_user_meta_data->>'role' = 'teacher' then 'teacher' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- إنشاء فصل برمز انضمام فريد (للمعلّم فقط)
create or replace function public.create_class(p_name text)
returns public.classes language plpgsql security definer set search_path = public as $$
declare
  c classes;
  v_code text;
begin
  if my_role() is distinct from 'teacher' then raise exception 'للمعلّمين فقط'; end if;
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1IL', ''), 1, 6));
    exit when char_length(v_code) = 6 and not exists (select 1 from classes where code = v_code);
  end loop;
  insert into classes (teacher_id, name, code) values (auth.uid(), trim(p_name), v_code) returning * into c;
  return c;
end;
$$;

-- انضمام الطالب إلى فصل برمزه
create or replace function public.join_class(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
  select * into c from classes where code = upper(trim(p_code));
  if not found then raise exception 'رمز الفصل غير صحيح'; end if;
  insert into class_members (class_id, student_id) values (c.id, auth.uid()) on conflict do nothing;
  return json_build_object('id', c.id, 'name', c.name);
end;
$$;

-- نظرة عامة على طلاب فصل (للمعلّم صاحب الفصل)
create or replace function public.class_overview(p_class uuid)
returns table (
  student_id uuid, full_name text, joined_at timestamptz, data jsonb, progress_at timestamptz,
  answers_total bigint, answers_ok bigint, attempts_total bigint, last_active timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from classes where id = p_class and teacher_id = auth.uid()) then
    raise exception 'ليس لك هذا الفصل';
  end if;
  return query
  select m.student_id, p.full_name, m.joined_at, coalesce(pr.data, '{}'::jsonb), pr.updated_at,
         (select count(*) from answers a where a.user_id = m.student_id),
         (select count(*) from answers a where a.user_id = m.student_id and a.ok),
         (select count(*) from attempts t where t.user_id = m.student_id),
         greatest(pr.updated_at,
                  (select max(a.created_at) from answers a where a.user_id = m.student_id),
                  (select max(t.created_at) from attempts t where t.user_id = m.student_id))
  from class_members m
  join profiles p on p.id = m.student_id
  left join progress pr on pr.user_id = m.student_id
  where m.class_id = p_class
  order by p.full_name;
end;
$$;

-- أكثر التراكيب والنصوص إشكالاً في الفصل
create or replace function public.class_item_stats(p_class uuid, p_limit int default 15)
returns table (item text, item_kind text, total bigint, wrong bigint, students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from classes where id = p_class and teacher_id = auth.uid()) then
    raise exception 'ليس لك هذا الفصل';
  end if;
  return query
  select a.item, a.item_kind, count(*), count(*) filter (where not a.ok), count(distinct a.user_id)
  from answers a join class_members m on m.student_id = a.user_id and m.class_id = p_class
  group by a.item, a.item_kind
  having count(*) >= 2
  order by count(*) filter (where not a.ok)::float / count(*) desc, count(*) desc
  limit p_limit;
end;
$$;

-- الدقّة حسب نوع السؤال في الفصل
create or replace function public.class_qtype_stats(p_class uuid)
returns table (qtype text, total bigint, ok bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from classes where id = p_class and teacher_id = auth.uid()) then
    raise exception 'ليس لك هذا الفصل';
  end if;
  return query
  select a.qtype, count(*), count(*) filter (where a.ok)
  from answers a join class_members m on m.student_id = a.user_id and m.class_id = p_class
  group by a.qtype order by a.qtype;
end;
$$;

-- ===== أمان الصفوف (RLS) =====
alter table public.profiles      enable row level security;
alter table public.classes       enable row level security;
alter table public.class_members enable row level security;
alter table public.progress      enable row level security;
alter table public.attempts      enable row level security;
alter table public.answers       enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_teacher_of(id));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

drop policy if exists "classes read" on public.classes;
create policy "classes read" on public.classes for select
  using (teacher_id = auth.uid() or public.member_of(id));
drop policy if exists "classes teacher update" on public.classes;
create policy "classes teacher update" on public.classes for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "classes teacher delete" on public.classes;
create policy "classes teacher delete" on public.classes for delete using (teacher_id = auth.uid());

drop policy if exists "members read" on public.class_members;
create policy "members read" on public.class_members for select
  using (student_id = auth.uid() or public.owns_class(class_id));
drop policy if exists "members leave or remove" on public.class_members;
create policy "members leave or remove" on public.class_members for delete
  using (student_id = auth.uid() or public.owns_class(class_id));

drop policy if exists "progress own" on public.progress;
create policy "progress own" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "progress teacher read" on public.progress;
create policy "progress teacher read" on public.progress for select using (public.is_teacher_of(user_id));

drop policy if exists "attempts own" on public.attempts;
create policy "attempts own" on public.attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "attempts teacher read" on public.attempts;
create policy "attempts teacher read" on public.attempts for select using (public.is_teacher_of(user_id));

drop policy if exists "answers own" on public.answers;
create policy "answers own" on public.answers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "answers teacher read" on public.answers;
create policy "answers teacher read" on public.answers for select using (public.is_teacher_of(user_id));

grant execute on function public.create_class(text), public.join_class(text),
  public.class_overview(uuid), public.class_item_stats(uuid, int), public.class_qtype_stats(uuid) to authenticated;

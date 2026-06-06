-- ============================================================
--  Dreamers Edu — Supabase Database Schema
--  Supabase Dashboard > SQL Editor mein poora paste karke "Run" dabayein.
-- ============================================================

-- 1) STUDENTS table
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  roll        text not null unique,
  category    text not null,            -- class11 | class12 | nda | cds
  created_at  timestamptz default now()
);

-- 2) TESTS table
create table if not exists public.tests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  category    text not null,
  test_name   text not null,
  test_date   date,
  subjects    jsonb not null default '[]'::jsonb,
  total       numeric default 0,
  max_total   numeric default 0,
  percentage  numeric default 0,
  created_at  timestamptz default now()
);

create index if not exists tests_student_idx on public.tests(student_id);

-- ============================================================
--  Row Level Security (RLS)
--  Read: sabko allowed (students apna data roll se dekh sakein)
--  Write (add/edit/delete): sirf logged-in Director ko allowed
-- ============================================================

alter table public.students enable row level security;
alter table public.tests    enable row level security;

-- public read
create policy "read_students_all" on public.students
  for select using (true);
create policy "read_tests_all" on public.tests
  for select using (true);

-- only authenticated (Director) can write
create policy "write_students_auth" on public.students
  for all to authenticated using (true) with check (true);
create policy "write_tests_auth" on public.tests
  for all to authenticated using (true) with check (true);

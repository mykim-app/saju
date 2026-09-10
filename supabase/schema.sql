-- ─────────────────────────────────────────────────────────────
-- 사주 사이트용 설정
-- MBTI 사이트와 같은 Supabase 프로젝트의 SQL Editor 에서 한 번 실행하세요.
-- 관리자 명단(admins)과 관리자 확인 함수(is_admin)는 MBTI 사이트에서 만든 것을
-- 그대로 씁니다. 이미 있으면 건드리지 않고, 없을 때만 새로 만듭니다.
-- 여러 번 실행해도 기존 기록은 지워지지 않습니다.
-- ─────────────────────────────────────────────────────────────

-- 1) 관리자 명단 (MBTI 사이트에서 이미 만들었다면 그대로 둠)
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 2) 관리자 확인 함수 (없을 때만 만듦)
do $outer$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    execute $f$
      create function public.is_admin() returns boolean
      language sql stable security definer set search_path = public as $b$
        select exists (
          select 1 from public.admins
          where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        );
      $b$;
    $f$;
  end if;
end
$outer$;
-- 관리자 화면이 로그인 직후 관리자 여부를 묻는 데 쓴다(기존 권한은 건드리지 않고 더하기만 함).
grant execute on function public.is_admin() to authenticated;

-- 3) 사주 기록 표
create table if not exists public.saju_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 20),
  gender text not null check (gender in ('M', 'F')),
  calendar text not null check (calendar in ('solar', 'lunar')),
  is_leap boolean not null default false,
  birth_date text not null check (birth_date ~ '^\d{4}-\d{2}-\d{2}$'),
  solar_date date not null,
  birth_time text check (birth_time is null or birth_time ~ '^\d{2}:\d{2}$'),
  region text not null default 'seoul' check (char_length(region) <= 20),
  yajasi boolean not null default false,
  pillars text not null check (char_length(pillars) <= 20),
  day_master text check (char_length(day_master) <= 10)
);
create index if not exists saju_results_created_at_idx on public.saju_results (created_at desc);

alter table public.saju_results enable row level security;
revoke all on public.saju_results from anon, authenticated;
grant insert on public.saju_results to anon, authenticated;
grant select, delete on public.saju_results to authenticated;

-- 누구나 등록할 수 있다(읽기는 불가).
drop policy if exists "누구나 등록" on public.saju_results;
create policy "누구나 등록"
  on public.saju_results for insert
  to anon, authenticated
  with check (true);

-- 조회·삭제는 관리자만.
drop policy if exists "관리자 조회" on public.saju_results;
create policy "관리자 조회"
  on public.saju_results for select
  to authenticated
  using (public.is_admin());

drop policy if exists "관리자 삭제" on public.saju_results;
create policy "관리자 삭제"
  on public.saju_results for delete
  to authenticated
  using (public.is_admin());

-- 4) 오늘(한국 시간) 등록 인원 — 이름 등 내용은 내주지 않고 숫자만 돌려준다.
create or replace function public.saju_today_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.saju_results
  where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;
revoke all on function public.saju_today_count() from public;
grant execute on function public.saju_today_count() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 관리자 주소는 MBTI 사이트 때 이미 등록했다면 다시 넣을 필요가 없습니다.
-- 확인:  select email from public.admins;
-- 새로 등록할 때만 아래 한 줄을 따로 실행하세요(저장소에는 올리지 마세요).
--   insert into public.admins (email) values ('여기에-관리자-주소') on conflict (email) do nothing;
-- ─────────────────────────────────────────────────────────────

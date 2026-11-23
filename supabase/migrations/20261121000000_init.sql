-- 선배클래스 초기 스키마
--
-- 공개: courses, instructors, lectures, chapters, reviews, 승인된 grade_verifications
-- 본인만: profiles, orders, enrollments, chapter_progress, 미승인 grade_verifications
-- 수강생만: chapter_media (영상 재생 ID)
--
-- 결제 웹훅·운영자 작업 중 일부는 서버에서 service_role로 처리한다 (RLS 우회).
-- 성적 캡처 파일(Storage)은 4단계 마이그레이션에서 추가한다.

-- ─── 타입 ─────────────────────────────────────────────────

create type public.course_kind as enum ('major', 'cert');
create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.lecture_status as enum ('draft', 'reviewing', 'on_sale', 'hidden', 'rejected');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.purchase_option as enum ('video', 'study');
create type public.order_status as enum ('pending', 'paid', 'refunded', 'cancelled');

-- ─── 테이블 ───────────────────────────────────────────────

-- 로그인한 사람. auth.users에 가입하면 트리거로 자동 생성된다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  student_id text, -- 워터마크에 쓰는 학번
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

-- 대학 수업 분반 또는 자격증·어학 시험
create table public.courses (
  id text primary key, -- URL에 쓰는 slug (예: cose213)
  kind public.course_kind not null,
  code text, -- 학수번호
  name text not null,
  professor text,
  semester text,
  group_name text not null, -- major: 단과대학 / cert: 분야
  department text,
  students integer check (students >= 0),
  exam_date date not null, -- 환불 마감 기준일
  exam_label text not null,
  created_at timestamptz not null default now(),
  constraint major_fields check (
    kind = 'cert' or (code is not null and professor is not null and semester is not null)
  )
);

-- 강사 공개 프로필. user_id가 없으면 시드·이관 데이터다.
create table public.instructors (
  id text primary key default gen_random_uuid()::text,
  user_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  major text not null,
  admission_year smallint, -- 학번 앞 두 자리 (예: 24)
  bio text not null default '',
  created_at timestamptz not null default now()
);

-- 성적·점수 인증 신청. 캡처 파일은 Storage grade-proofs/{instructor_id}/{id}에 두고,
-- 승인·반려하면 파일을 지운다.
create table public.grade_verifications (
  id uuid primary key default gen_random_uuid(),
  instructor_id text not null references public.instructors (id) on delete cascade,
  course_id text not null references public.courses (id),
  grade text not null, -- A+, 965, 합격
  semester_label text not null, -- 화면 표시용 (2025-2학기, 2026년 10월 응시)
  proof_text text, -- 승인 후 배지에 보여줄 문구
  status public.verification_status not null default 'pending',
  reject_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);

-- 같은 강사·과목에 승인된 인증은 하나만
create unique index grade_verifications_one_approved
  on public.grade_verifications (instructor_id, course_id)
  where status = 'approved';

create table public.lectures (
  id text primary key, -- URL slug
  course_id text not null references public.courses (id),
  instructor_id text not null references public.instructors (id),
  title text not null,
  summary text not null default '',
  price integer not null check (price > 0),
  study_group_price integer check (study_group_price > 0),
  study_group_capacity integer check (study_group_capacity > 0),
  covers text[] not null default '{}',
  status public.lecture_status not null default 'draft',
  -- 아래 카운터는 트리거가 관리한다. 클라이언트는 쓸 수 없다.
  sales_count integer not null default 0,
  review_count integer not null default 0,
  rating_sum integer not null default 0,
  study_group_taken integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_group_pair check ((study_group_price is null) = (study_group_capacity is null))
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null references public.lectures (id) on delete cascade,
  position smallint not null check (position >= 0),
  title text not null,
  minutes smallint not null check (minutes > 0),
  is_preview boolean not null default false,
  unique (lecture_id, position)
);

-- 영상 재생 정보. 수강권이 있거나 맛보기 챕터일 때만 보인다.
create table public.chapter_media (
  chapter_id uuid primary key references public.chapters (id) on delete cascade,
  provider text not null,
  asset_id text not null,
  playback_id text,
  created_at timestamptz not null default now()
);

-- 결제 주문. 그로블 웹훅이 service_role로 상태를 바꾼다.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  lecture_id text not null references public.lectures (id),
  option public.purchase_option not null,
  amount integer not null check (amount > 0),
  status public.order_status not null default 'pending',
  provider text not null default 'groble',
  provider_order_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

-- 수강권. 결제 완료 시 발급, 환불 시 revoked_at을 채운다.
create table public.enrollments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lecture_id text not null references public.lectures (id),
  order_id uuid unique references public.orders (id),
  option public.purchase_option not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, lecture_id)
);

create table public.chapter_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null references public.lectures (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null, -- 시드 후기는 null
  author_label text not null, -- 작성 시점 스냅샷 (예: 컴퓨터학과 25학번)
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now(),
  unique (lecture_id, user_id)
);

create index lectures_course_id_idx on public.lectures (course_id);
create index lectures_instructor_id_idx on public.lectures (instructor_id);
create index grade_verifications_instructor_id_idx on public.grade_verifications (instructor_id);
create index grade_verifications_status_idx on public.grade_verifications (status);
create index orders_user_id_idx on public.orders (user_id);
create index orders_lecture_id_idx on public.orders (lecture_id);
create index enrollments_lecture_id_idx on public.enrollments (lecture_id);
create index enrollments_order_id_idx on public.enrollments (order_id);
create index reviews_lecture_id_idx on public.reviews (lecture_id);
create index reviews_user_id_idx on public.reviews (user_id);
create index chapter_progress_chapter_id_idx on public.chapter_progress (chapter_id);
create index grade_verifications_course_id_idx on public.grade_verifications (course_id);
create index grade_verifications_reviewed_by_idx on public.grade_verifications (reviewed_by);

-- ─── RLS 헬퍼 ─────────────────────────────────────────────
-- security definer: 정책 안에서 다른 테이블의 RLS에 막히지 않게 한다.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.my_instructor_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.instructors where user_id = (select auth.uid());
$$;

create function public.is_enrolled(p_lecture_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments
    where user_id = (select auth.uid()) and lecture_id = p_lecture_id and revoked_at is null
  );
$$;

create function public.has_approved_verification(p_instructor_id text, p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grade_verifications
    where instructor_id = p_instructor_id and course_id = p_course_id and status = 'approved'
  );
$$;

-- ─── 트리거 ───────────────────────────────────────────────

-- 가입하면 profiles 행 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lectures_touch_updated_at
  before update on public.lectures
  for each row execute function public.touch_updated_at();

-- 스터디반 정원 초과 방지
create function public.check_study_group_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  if new.option = 'study' and new.revoked_at is null then
    select study_group_capacity, study_group_taken into v_capacity, v_taken
    from public.lectures where id = new.lecture_id for update;
    if v_capacity is null then
      raise exception '스터디반이 없는 강의예요: %', new.lecture_id;
    end if;
    if v_taken >= v_capacity then
      raise exception '스터디반 정원이 찼어요: %', new.lecture_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger enrollments_check_capacity
  before insert on public.enrollments
  for each row execute function public.check_study_group_capacity();

-- 판매 수·스터디반 인원 카운터
create function public.sync_enrollment_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_active boolean := tg_op in ('UPDATE', 'DELETE') and old.revoked_at is null;
  v_new_active boolean := tg_op in ('INSERT', 'UPDATE') and new.revoked_at is null;
begin
  if v_old_active then
    update public.lectures
    set sales_count = sales_count - 1,
        study_group_taken = study_group_taken - (case when old.option = 'study' then 1 else 0 end)
    where id = old.lecture_id;
  end if;
  if v_new_active then
    update public.lectures
    set sales_count = sales_count + 1,
        study_group_taken = study_group_taken + (case when new.option = 'study' then 1 else 0 end)
    where id = new.lecture_id;
  end if;
  return null;
end;
$$;

create trigger enrollments_sync_counters
  after insert or update or delete on public.enrollments
  for each row execute function public.sync_enrollment_counters();

-- 후기 수·평점 카운터
create function public.sync_review_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.lectures
    set review_count = review_count - 1, rating_sum = rating_sum - old.rating
    where id = old.lecture_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.lectures
    set review_count = review_count + 1, rating_sum = rating_sum + new.rating
    where id = new.lecture_id;
  end if;
  return null;
end;
$$;

create trigger reviews_sync_counters
  after insert or update of rating, lecture_id or delete on public.reviews
  for each row execute function public.sync_review_counters();

-- ─── 컬럼 권한 ────────────────────────────────────────────
-- Supabase는 기본으로 anon·authenticated에 모든 권한을 준다. 쓰면 안 되는 컬럼을 막는다.

revoke insert, update on public.profiles from anon, authenticated;
grant update (student_id) on public.profiles to authenticated;

revoke insert, update on public.lectures from anon, authenticated;
grant insert (id, course_id, instructor_id, title, summary, price, study_group_price, study_group_capacity, covers, status)
  on public.lectures to authenticated;
grant update (title, summary, price, study_group_price, study_group_capacity, covers, status)
  on public.lectures to authenticated;

revoke insert, update on public.grade_verifications from anon, authenticated;
grant insert (instructor_id, course_id, grade, semester_label) on public.grade_verifications to authenticated;
grant update (status, proof_text, reject_reason, reviewed_by, reviewed_at) on public.grade_verifications to authenticated;

revoke update on public.reviews from anon, authenticated;
grant update (rating, body) on public.reviews to authenticated;

-- 결제·수강권은 서버(service_role)만 쓴다
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.enrollments from anon, authenticated;

-- ─── RLS 정책 ─────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.instructors enable row level security;
alter table public.grade_verifications enable row level security;
alter table public.lectures enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_media enable row level security;
alter table public.orders enable row level security;
alter table public.enrollments enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.reviews enable row level security;

-- profiles
create policy "본인 또는 운영자만 조회" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "본인만 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- courses
create policy "누구나 조회" on public.courses
  for select to anon, authenticated using (true);
create policy "운영자만 추가" on public.courses
  for insert to authenticated with check ((select public.is_admin()));
create policy "운영자만 수정" on public.courses
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "운영자만 삭제" on public.courses
  for delete to authenticated using ((select public.is_admin()));

-- instructors
create policy "누구나 조회" on public.instructors
  for select to anon, authenticated using (true);
create policy "본인 프로필만 생성" on public.instructors
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_instructor_id()) is null);
create policy "본인 프로필만 수정" on public.instructors
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- grade_verifications
create policy "승인된 인증은 누구나, 나머지는 본인·운영자" on public.grade_verifications
  for select to anon, authenticated
  using (
    status = 'approved'
    or instructor_id = (select public.my_instructor_id())
    or (select public.is_admin())
  );
create policy "본인 강사 프로필로만 신청" on public.grade_verifications
  for insert to authenticated
  with check (instructor_id = (select public.my_instructor_id()));
create policy "운영자만 승인·반려" on public.grade_verifications
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- lectures
create policy "판매 중이거나 본인·운영자" on public.lectures
  for select to anon, authenticated
  using (
    status = 'on_sale'
    or instructor_id = (select public.my_instructor_id())
    or (select public.is_admin())
  );
create policy "인증된 과목에만 올리기" on public.lectures
  for insert to authenticated
  with check (
    instructor_id = (select public.my_instructor_id())
    and status in ('draft', 'reviewing')
    and public.has_approved_verification(instructor_id, course_id)
  );
create policy "강사는 초안·검수 중으로만 수정" on public.lectures
  for update to authenticated
  using (instructor_id = (select public.my_instructor_id()) and status in ('draft', 'reviewing', 'rejected'))
  with check (instructor_id = (select public.my_instructor_id()) and status in ('draft', 'reviewing'));
create policy "운영자는 상태 변경" on public.lectures
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- chapters: 강의를 볼 수 있으면 목차도 볼 수 있다
create policy "강의가 보이면 조회" on public.chapters
  for select to anon, authenticated
  using (exists (select 1 from public.lectures l where l.id = lecture_id));
create policy "본인 강의 초안에만 추가" on public.chapters
  for insert to authenticated
  with check (exists (
    select 1 from public.lectures l
    where l.id = lecture_id
      and l.instructor_id = (select public.my_instructor_id())
      and l.status in ('draft', 'reviewing', 'rejected')
  ));
create policy "본인 강의 초안에서만 수정" on public.chapters
  for update to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = lecture_id
      and l.instructor_id = (select public.my_instructor_id())
      and l.status in ('draft', 'reviewing', 'rejected')
  ));
create policy "본인 강의 초안에서만 삭제" on public.chapters
  for delete to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = lecture_id
      and l.instructor_id = (select public.my_instructor_id())
      and l.status in ('draft', 'reviewing', 'rejected')
  ));

-- chapter_media: 맛보기, 수강생, 강의 주인, 운영자만
create policy "맛보기·수강생·강사·운영자만 조회" on public.chapter_media
  for select to anon, authenticated
  using (exists (
    select 1 from public.chapters c
    join public.lectures l on l.id = c.lecture_id
    where c.id = chapter_id
      and (
        (c.is_preview and l.status = 'on_sale')
        or public.is_enrolled(l.id)
        or l.instructor_id = (select public.my_instructor_id())
        or (select public.is_admin())
      )
  ));

-- orders / enrollments: 조회만 (쓰기는 service_role)
create policy "본인 주문 또는 운영자" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 수강권 또는 운영자" on public.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- chapter_progress
create policy "본인 진도만 조회" on public.chapter_progress
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "수강 중인 강의 진도만 기록" on public.chapter_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chapters c
      where c.id = chapter_id and public.is_enrolled(c.lecture_id)
    )
  );
create policy "본인 진도만 수정" on public.chapter_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- reviews
create policy "누구나 조회" on public.reviews
  for select to anon, authenticated using (true);
create policy "수강생만 작성" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_enrolled(lecture_id));
create policy "본인 후기만 수정" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "본인 후기만 삭제" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 헬퍼 함수는 정책에서만 쓴다. 외부에서 RPC로 직접 부르지 못하게 한다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_study_group_capacity() from public, anon, authenticated;
revoke execute on function public.sync_enrollment_counters() from public, anon, authenticated;
revoke execute on function public.sync_review_counters() from public, anon, authenticated;

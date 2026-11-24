-- 결제 준비: 주문(pending) → (5단계 그로블 웹훅) → 수강권, 후기 작성, 환불 뒤 재구매
--
-- 1. enrollments: 기본 키를 id로 바꾸고, 살아 있는 수강권은 (user_id, lecture_id)당 하나만.
--    환불(revoked_at)된 수강권은 남겨 두고 다시 살 수 있다. 스터디반 정원은 되살리거나 옵션을 바꿀 때도 확인한다.
-- 2. orders: 학생은 (lecture_id, option)만 보내 pending 주문을 만든다. 금액·사용자·상태는 트리거가 정한다.
--    paid·refunded 전환은 서버(service_role, 웹훅)만 한다. 주문 내용은 바꿀 수 없다.
-- 3. reviews: 학생은 (lecture_id, rating, body)만 보낸다. 작성자·표시 이름("학과 NN학번")·시각은 트리거가 채운다.
-- 4. lectures: 판매를 멈춘 강의도 수강권이 있으면 볼 수 있다.
-- 5. 익명 사용자는 instructors·reviews·grade_verifications를 공개 컬럼만 읽는다(user_id 등은 숨김).

-- ─── 1. 수강권 ────────────────────────────────────────────

alter table public.enrollments drop constraint enrollments_pkey;
alter table public.enrollments add column id uuid not null default gen_random_uuid();
alter table public.enrollments add constraint enrollments_pkey primary key (id);

create unique index enrollments_one_active on public.enrollments (user_id, lecture_id) where revoked_at is null;
create index enrollments_user_created_idx on public.enrollments (user_id, created_at desc);

create or replace function private.check_study_group_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  if new.option <> 'study' or new.revoked_at is not null then
    return new;
  end if;
  -- 이미 자리를 차지하고 있던 스터디반 수강권이면 다시 세지 않는다
  if tg_op = 'UPDATE' and old.option = 'study' and old.revoked_at is null and old.lecture_id = new.lecture_id then
    return new;
  end if;

  select study_group_capacity, study_group_taken into v_capacity, v_taken
  from public.lectures where id = new.lecture_id for update;
  if v_capacity is null then
    raise exception '스터디반이 없는 강의예요.' using errcode = 'P0001', hint = 'no_study_group';
  end if;
  if v_taken >= v_capacity then
    raise exception '스터디반 정원이 찼어요.' using errcode = 'P0001', hint = 'study_group_full';
  end if;
  return new;
end;
$$;

create or replace trigger enrollments_check_capacity
  before insert or update of revoked_at, option on public.enrollments
  for each row execute function private.check_study_group_capacity();

-- ─── 2. 주문 ──────────────────────────────────────────────

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_pending_lookup_idx on public.orders (user_id, lecture_id, option, created_at desc) where status = 'pending';

grant insert (lecture_id, option) on public.orders to authenticated;

create policy "본인 주문 만들기" on public.orders
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- 호출자 권한으로 실행한다(누가 만들었는지 current_user로 판단). 읽는 표는 모두 본인에게 보이는 행만 필요하다
create function private.prepare_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.lecture_status;
  v_price integer;
  v_study_price integer;
  v_capacity integer;
  v_taken integer;
  v_owner uuid;
begin
  -- 서버(service_role)·운영자 SQL은 그대로 통과
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'P0001', hint = 'login_required';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and onboarded_at is not null) then
    raise exception '가입 마무리를 먼저 해 주세요.' using errcode = 'P0001', hint = 'onboarding_required';
  end if;

  select l.status, l.price, l.study_group_price, l.study_group_capacity, l.study_group_taken, i.user_id
  into v_status, v_price, v_study_price, v_capacity, v_taken, v_owner
  from public.lectures l
  join public.instructors i on i.id = l.instructor_id
  where l.id = new.lecture_id;

  if not found or v_status <> 'on_sale' then
    raise exception '지금은 판매하지 않는 강의예요.' using errcode = 'P0001', hint = 'not_on_sale';
  end if;
  if v_owner = v_uid then
    raise exception '내 강의는 구매할 수 없어요.' using errcode = 'P0001', hint = 'own_lecture';
  end if;
  if exists (
    select 1 from public.enrollments
    where user_id = v_uid and lecture_id = new.lecture_id and revoked_at is null
  ) then
    raise exception '이미 수강 중인 강의예요.' using errcode = 'P0001', hint = 'already_enrolled';
  end if;

  if new.option = 'study' then
    if v_study_price is null then
      raise exception '스터디반이 없는 강의예요.' using errcode = 'P0001', hint = 'no_study_group';
    end if;
    if v_taken >= v_capacity then
      raise exception '스터디반 정원이 찼어요.' using errcode = 'P0001', hint = 'study_group_full';
    end if;
    new.amount := v_study_price;
  else
    new.amount := v_price;
  end if;

  new.user_id := v_uid;
  new.status := 'pending';
  new.provider := 'groble';
  new.provider_order_id := null;
  new.paid_at := null;
  new.refunded_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger orders_prepare
  before insert on public.orders
  for each row execute function private.prepare_order();

-- 상태 전환 규칙 (서버만 바꿀 수 있지만, 서버 실수도 막는다)
create function private.guard_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.lecture_id <> old.lecture_id
     or new.option <> old.option or new.amount <> old.amount then
    raise exception '주문 내용은 바꿀 수 없어요.' using errcode = 'P0001', hint = 'order_immutable';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid' and new.status = 'refunded')
    ) then
      raise exception '주문 상태를 %에서 %(으)로 바꿀 수 없어요.', old.status, new.status
        using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    if new.status = 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
    elsif new.status = 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_guard_update
  before update on public.orders
  for each row execute function private.guard_order_update();

-- ─── 3. 후기 ──────────────────────────────────────────────

alter table public.reviews
  add constraint reviews_body_length check (char_length(btrim(body)) between 1 and 1000);

revoke insert on public.reviews from anon, authenticated;
grant insert (lecture_id, rating, body) on public.reviews to authenticated;

create function private.prepare_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_major text;
  v_student_id text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select major, student_id into v_major, v_student_id
    from public.profiles
    where id = (select auth.uid()) and onboarded_at is not null;
    if v_major is null or v_student_id is null then
      raise exception '가입 마무리를 먼저 해 주세요.' using errcode = 'P0001', hint = 'onboarding_required';
    end if;
    new.user_id := (select auth.uid());
    new.author_label := v_major || ' ' || substring(v_student_id from 3 for 2) || '학번';
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.lecture_id := old.lecture_id;
    new.author_label := old.author_label;
    new.created_at := old.created_at;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger reviews_prepare
  before insert or update on public.reviews
  for each row execute function private.prepare_review();

-- ─── 4. 판매를 멈춘 강의도 수강생은 본다 ─────────────────

create policy "수강 중이면 조회" on public.lectures
  for select to authenticated
  using (private.is_enrolled(id));

-- ─── 5. 익명 사용자는 공개 컬럼만 ─────────────────────────

revoke select on public.instructors from anon;
grant select (id, name, major, admission_year, bio, created_at) on public.instructors to anon;

revoke select on public.reviews from anon;
grant select (id, lecture_id, author_label, rating, body, created_at) on public.reviews to anon;

revoke select on public.grade_verifications from anon;
grant select (id, instructor_id, course_id, grade, semester_label, proof_text, status) on public.grade_verifications to anon;

revoke execute on function private.prepare_order() from public, anon, authenticated;
revoke execute on function private.guard_order_update() from public, anon, authenticated;
revoke execute on function private.prepare_review() from public, anon, authenticated;

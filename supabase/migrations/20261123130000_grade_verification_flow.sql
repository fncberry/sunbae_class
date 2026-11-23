-- 4단계: 성적 인증 절차 (강사 지원 → 운영자 승인·반려 → 캡처 삭제)
--
-- 1. 비공개 Storage 버킷 grade-proofs: {auth.uid()}/{신청 id}.{확장자}, 이미지(jpg·png·webp)·PDF, 10MB 이하
--    본인 폴더에만 올리고 볼 수 있다. 운영자는 전체를 보고 지운다. 공개 URL은 없다.
-- 2. grade_verifications
--    - proof_path: 캡처 파일 경로. 결정(승인·반려) 뒤 파일을 지우면 null로 바꾼다.
--    - 목록에 없는 대학 수업은 requested_* 칸에 적어서 신청한다. 운영자가 승인하면서 과목을 만들고 course_id를 채운다.
--    - 같은 과목에 대기 중인 신청은 하나만. 이미 승인된 과목에는 다시 신청할 수 없다.
--    - 처리자·처리 시각은 트리거가 정한다. 승인에는 인증 문구, 반려에는 사유가 필요하다.
--    - 승인되면 학생 계정의 role을 instructor로 바꾼다.
-- 3. instructors: 공개 표시 이름은 닉네임, 학과·학번은 프로필에서 트리거가 채운다(실명은 공개하지 않는다).
-- 4. lectures: 반려 사유(reject_reason). 운영자만 쓴다.

-- ─── 1. 캡처 버킷 ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('grade-proofs', 'grade-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "성적 캡처: 본인 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'grade-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'pdf')
  );

create policy "성적 캡처: 본인 또는 운영자만 조회" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'grade-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

create policy "성적 캡처: 운영자만 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'grade-proofs' and (select private.is_admin()));

-- ─── 2. 인증 신청 ─────────────────────────────────────────

alter table public.grade_verifications
  alter column course_id drop not null,
  add column proof_path text,
  add column requested_code text,
  add column requested_name text,
  add column requested_professor text,
  add column requested_semester text,
  add column requested_track public.course_track,
  add column requested_group text,
  add column requested_department text;

alter table public.grade_verifications
  -- 과목을 고르거나, 목록에 없는 대학 수업이면 직접 적는다
  add constraint verification_course_or_request check (
    course_id is not null
    or (
      requested_code is not null and requested_name is not null and requested_professor is not null
      and requested_semester is not null and requested_track is not null and requested_group is not null
    )
  ),
  add constraint verification_requested_lengths check (
    char_length(requested_code) <= 20 and char_length(requested_name) <= 60
    and char_length(requested_professor) <= 30 and char_length(requested_semester) <= 30
    and char_length(requested_group) <= 30 and char_length(requested_department) <= 40
  ),
  add constraint verification_grade_length check (char_length(btrim(grade)) between 1 and 20),
  add constraint verification_decision_fields check (
    status = 'pending'
    or (status = 'approved' and course_id is not null and nullif(btrim(proof_text), '') is not null)
    or (status = 'rejected' and nullif(btrim(reject_reason), '') is not null)
  );

-- 같은 과목에 대기 중인 신청은 하나만
create unique index grade_verifications_one_pending
  on public.grade_verifications (instructor_id, course_id)
  where status = 'pending' and course_id is not null;
create unique index grade_verifications_one_pending_request
  on public.grade_verifications (instructor_id, upper(requested_code), lower(requested_professor))
  where status = 'pending' and course_id is null;

-- 신청할 때 쓸 수 있는 칸 (id는 캡처 파일 이름과 맞추려고 클라이언트가 정한다)
revoke insert, update on public.grade_verifications from anon, authenticated;
grant insert (
  id, instructor_id, course_id, grade, semester_label, proof_path,
  requested_code, requested_name, requested_professor, requested_semester,
  requested_track, requested_group, requested_department
) on public.grade_verifications to authenticated;
-- 운영자가 결정할 때 쓰는 칸 (RLS가 운영자만 허용). reviewed_by·reviewed_at은 트리거가 정한다
grant update (status, proof_text, reject_reason, course_id, proof_path) on public.grade_verifications to authenticated;

create function private.guard_verification_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 운영자 작업(SQL Editor, 시드, service_role)은 그대로 통과
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.status := 'pending';
  new.proof_text := null;
  new.reject_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.submitted_at := now();
  new.grade := btrim(new.grade);

  -- 캡처는 먼저 본인 폴더에 올리고, 그 경로로 신청한다
  if new.proof_path is null
     or split_part(new.proof_path, '/', 1) <> (select auth.uid())::text
     or split_part(split_part(new.proof_path, '/', 2), '.', 1) <> new.id::text then
    raise exception '성적 캡처를 올린 뒤에 신청해 주세요.' using errcode = 'P0001', hint = 'proof_required';
  end if;

  -- 목록에서 고른 과목이면 직접 적은 칸은 무시한다
  if new.course_id is not null then
    new.requested_code := null;
    new.requested_name := null;
    new.requested_professor := null;
    new.requested_semester := null;
    new.requested_track := null;
    new.requested_group := null;
    new.requested_department := null;

    if exists (
      select 1 from public.grade_verifications
      where instructor_id = new.instructor_id and course_id = new.course_id and status = 'approved'
    ) then
      raise exception '이미 인증된 과목이에요.' using errcode = 'P0001', hint = 'already_approved';
    end if;
  end if;

  return new;
end;
$$;

create trigger grade_verifications_guard_insert
  before insert on public.grade_verifications
  for each row execute function private.guard_verification_insert();

create function private.guard_verification_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception '이미 처리된 신청이에요.' using errcode = 'P0001', hint = 'already_decided';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;

  if new.status = 'approved' then
    new.reject_reason := null;
  elsif new.status = 'rejected' then
    new.proof_text := null;
  end if;

  return new;
end;
$$;

create trigger grade_verifications_guard_review
  before update on public.grade_verifications
  for each row execute function private.guard_verification_review();

-- 승인되면 학생을 강사로
create function private.promote_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update public.profiles p
    set role = 'instructor'
    from public.instructors i
    where i.id = new.instructor_id and p.id = i.user_id and p.role = 'student';
  end if;
  return null;
end;
$$;

create trigger grade_verifications_promote
  after update of status on public.grade_verifications
  for each row execute function private.promote_on_approval();

-- ─── 3. 강사 공개 프로필 ──────────────────────────────────

-- 강사 프로필은 서버가 만든 id로 한 사람당 하나. 이름·학과·학번은 트리거가 채우고, 본인은 소개만 고친다
revoke insert, update on public.instructors from anon, authenticated;
grant insert (user_id, bio) on public.instructors to authenticated;
grant update (bio) on public.instructors to authenticated;

create function private.fill_instructor_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
  v_major text;
  v_student_id text;
  v_onboarded timestamptz;
begin
  if new.user_id is null then
    return new; -- 시드·이관 강사
  end if;

  select nickname, major, student_id, onboarded_at
  into v_nickname, v_major, v_student_id, v_onboarded
  from public.profiles where id = new.user_id;

  if v_onboarded is null then
    raise exception '가입 마무리(학번·학과·닉네임)를 끝내야 강사로 지원할 수 있어요.'
      using errcode = 'P0001', hint = 'onboarding_required';
  end if;

  new.name := v_nickname;
  new.major := v_major;
  new.admission_year := substring(v_student_id from 3 for 2)::smallint;
  new.bio := coalesce(btrim(new.bio), '');
  return new;
end;
$$;

create trigger instructors_fill_from_profile
  before insert or update on public.instructors
  for each row execute function private.fill_instructor_from_profile();

-- 닉네임·학과를 바꾸면 강사 공개 프로필도 같이 바뀐다
create function private.sync_instructor_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.onboarded_at is not null
     and (new.nickname is distinct from old.nickname or new.major is distinct from old.major
          or new.student_id is distinct from old.student_id) then
    update public.instructors set bio = bio where user_id = new.id; -- fill 트리거가 다시 채운다
  end if;
  return null;
end;
$$;

create trigger profiles_sync_instructor
  after update on public.profiles
  for each row execute function private.sync_instructor_profile();

-- ─── 4. 강의 반려 사유 ────────────────────────────────────

alter table public.lectures add column reject_reason text;
grant update (reject_reason) on public.lectures to authenticated;

-- 호출자 권한으로 실행한다(누가 고쳤는지 current_user로 판단하므로 security definer를 쓰지 않는다)
create function private.guard_lecture_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 강사는 반려 사유를 쓸 수 없다. 다시 검수를 요청하면 지난 사유를 지운다
  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    new.reject_reason := case when new.status = 'reviewing' then null else old.reject_reason end;
  end if;

  if new.status = 'rejected' and old.status <> 'rejected' and nullif(btrim(new.reject_reason), '') is null then
    raise exception '반려 사유를 적어 주세요.' using errcode = 'P0001', hint = 'reason_required';
  end if;
  if new.status = 'on_sale' then
    new.reject_reason := null;
  end if;
  return new;
end;
$$;

create trigger lectures_guard_review
  before update on public.lectures
  for each row execute function private.guard_lecture_review();

revoke execute on function private.guard_verification_insert() from public, anon, authenticated;
revoke execute on function private.guard_verification_review() from public, anon, authenticated;
revoke execute on function private.promote_on_approval() from public, anon, authenticated;
revoke execute on function private.fill_instructor_from_profile() from public, anon, authenticated;
revoke execute on function private.sync_instructor_profile() from public, anon, authenticated;
revoke execute on function private.guard_lecture_review() from public, anon, authenticated;

-- 첫 로그인 후 온보딩: 학번·학과·약관 동의를 받는다.
--
-- - 학번: 강의 영상 워터마크에 쓴다. 온보딩을 마치면 본인이 바꿀 수 없다(운영자만).
--   다른 사람 학번을 적어 워터마크를 남에게 돌리는 걸 막으려고 한 학번은 한 계정에만 쓸 수 있다.
-- - 학과: 후기 작성자 표시(예: 컴퓨터학과 24학번), 강사 지원에 쓴다. 나중에 바꿀 수 있다.
-- - 약관 동의 시각과 온보딩 완료 시각은 서버(트리거)가 정한다. 클라이언트가 보낸 값은 믿지 않는다.

alter table public.profiles
  add column major text,
  add column terms_agreed_at timestamptz,
  add column onboarded_at timestamptz;

alter table public.profiles
  add constraint profiles_student_id_format check (student_id ~ '^(19|20)[0-9]{8}$'),
  add constraint profiles_major_length check (char_length(btrim(major)) between 2 and 40),
  add constraint profiles_onboarded_complete check (
    onboarded_at is null or (student_id is not null and major is not null and terms_agreed_at is not null)
  );

create unique index profiles_student_id_key on public.profiles (student_id) where student_id is not null;

-- 본인이 쓸 수 있는 칸: 학번, 학과, 약관 동의 (role·onboarded_at은 계속 막힘)
grant update (student_id, major, terms_agreed_at) on public.profiles to authenticated;

create function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 운영자 작업(SQL Editor, service_role)은 그대로 통과
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.onboarded_at is not null and new.student_id is distinct from old.student_id then
    raise exception '학번은 바꿀 수 없어요. 잘못 적었다면 운영진에게 알려 주세요.'
      using errcode = 'P0001', hint = 'student_id_locked';
  end if;

  new.major := nullif(btrim(new.major), '');

  -- 동의 시각은 처음 동의할 때 서버 시각으로 한 번만 기록. 동의 철회는 탈퇴로 처리한다.
  if old.terms_agreed_at is null and new.terms_agreed_at is not null then
    new.terms_agreed_at := now();
  else
    new.terms_agreed_at := old.terms_agreed_at;
  end if;

  new.onboarded_at := old.onboarded_at;
  if new.onboarded_at is null
     and new.student_id is not null and new.major is not null and new.terms_agreed_at is not null then
    new.onboarded_at := now();
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

revoke execute on function private.guard_profile_update() from public, anon, authenticated;

-- 온보딩에서 이름과 닉네임도 받는다.
--
-- - 이름(실명): 강사 지원·정산·운영 확인용. 공개하지 않는다. 고려대 구글 계정 이름으로 미리 채운다.
-- - 닉네임: 후기·질문 등 서비스 안에서 보이는 이름. 대소문자 무시하고 겹칠 수 없다.
--   운영진·서비스를 사칭할 수 있는 단어는 막는다.
-- 둘 다 나중에 바꿀 수 있다. 온보딩 완료 조건에 둘 다 들어간다.

alter table public.profiles
  add column name text,
  add column nickname text;

alter table public.profiles
  add constraint profiles_name_format check (char_length(name) between 2 and 30),
  add constraint profiles_nickname_format check (
    nickname ~ '^[가-힣A-Za-z0-9_.]{2,12}$'
    and nickname !~* '(운영|관리자|admin|선배클래스|sunbae)'
  ),
  add constraint profiles_onboarded_has_names check (
    onboarded_at is null or (name is not null and nickname is not null)
  ) not valid;

create unique index profiles_nickname_key on public.profiles (lower(nickname)) where nickname is not null;

-- 이미 온보딩을 마친 계정이 있다면 이름·닉네임을 받도록 다시 온보딩
update public.profiles set onboarded_at = null where onboarded_at is not null and (name is null or nickname is null);
alter table public.profiles validate constraint profiles_onboarded_has_names;

grant update (name, nickname) on public.profiles to authenticated;

create or replace function private.guard_profile_update()
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
  new.name := nullif(btrim(new.name), '');
  new.nickname := nullif(btrim(new.nickname), '');

  -- 동의 시각은 처음 동의할 때 서버 시각으로 한 번만 기록. 동의 철회는 탈퇴로 처리한다.
  if old.terms_agreed_at is null and new.terms_agreed_at is not null then
    new.terms_agreed_at := now();
  else
    new.terms_agreed_at := old.terms_agreed_at;
  end if;

  -- 온보딩을 마친 뒤에는 필수 값을 비울 수 없다
  if old.onboarded_at is not null and (new.major is null or new.name is null or new.nickname is null) then
    raise exception '이름, 닉네임, 학과는 비워 둘 수 없어요.' using errcode = 'P0001', hint = 'required_field';
  end if;

  new.onboarded_at := old.onboarded_at;
  if new.onboarded_at is null
     and new.student_id is not null and new.major is not null and new.terms_agreed_at is not null
     and new.name is not null and new.nickname is not null then
    new.onboarded_at := now();
  end if;

  return new;
end;
$$;

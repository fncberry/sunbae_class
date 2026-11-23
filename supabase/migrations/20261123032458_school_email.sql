-- 학교 이메일만 가입·이메일 변경 허용.
-- 로그인 폼에서도 검사하지만, 공개 키로 Auth API를 직접 부르면 폼을 건너뛸 수 있어서 DB에서 막는다.

create table private.allowed_email_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '@')
);

insert into private.allowed_email_domains (domain) values ('korea.ac.kr');

create function private.enforce_school_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  -- 이메일 없는 계정(전화번호 등)은 만들 수 없다
  if not exists (select 1 from private.allowed_email_domains where domain = v_domain) then
    raise exception '학교 이메일(@korea.ac.kr)로만 가입할 수 있어요'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_school_email() from public, anon, authenticated;

create trigger enforce_school_email_on_insert
  before insert on auth.users
  for each row execute function private.enforce_school_email();

create trigger enforce_school_email_on_update
  before update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function private.enforce_school_email();

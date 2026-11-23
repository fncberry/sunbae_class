-- RLS 헬퍼·트리거 함수를 API에 노출되지 않는 private 스키마로 옮긴다.
-- public 스키마의 함수는 /rest/v1/rpc/* 로 누구나 부를 수 있기 때문 (Supabase 보안 어드바이저 0028, 0029).
-- 정책과 트리거는 함수를 OID로 참조하므로 스키마를 옮겨도 그대로 동작한다.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.my_instructor_id() set schema private;
alter function public.is_enrolled(text) set schema private;
alter function public.has_approved_verification(text, text) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.touch_updated_at() set schema private;
alter function public.check_study_group_capacity() set schema private;
alter function public.sync_enrollment_counters() set schema private;
alter function public.sync_review_counters() set schema private;

-- 정책 평가에 필요한 헬퍼만 실행 권한을 준다
revoke execute on all functions in schema private from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.my_instructor_id() to anon, authenticated, service_role;
grant execute on function private.is_enrolled(text) to anon, authenticated, service_role;
grant execute on function private.has_approved_verification(text, text) to anon, authenticated, service_role;

-- lectures UPDATE 정책 두 개를 하나로 합친다 (어드바이저 0006: 정책마다 매 행 평가)
drop policy "강사는 초안·검수 중으로만 수정" on public.lectures;
drop policy "운영자는 상태 변경" on public.lectures;
create policy "강사는 초안·검수 중으로만, 운영자는 상태까지 수정" on public.lectures
  for update to authenticated
  using (
    (instructor_id = (select private.my_instructor_id()) and status in ('draft', 'reviewing', 'rejected'))
    or (select private.is_admin())
  )
  with check (
    (instructor_id = (select private.my_instructor_id()) and status in ('draft', 'reviewing'))
    or (select private.is_admin())
  );

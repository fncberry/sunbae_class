-- 운영자는 환불 요청을 판단할 때 수강생 진도를 본다 (환불 규칙: 30% 미만 시청)
-- 정책을 하나로 유지한다 (어드바이저 0006: 같은 동작에 정책이 여러 개면 매 행 모두 평가)

drop policy "본인 진도만 조회" on public.chapter_progress;
create policy "본인 또는 운영자 진도 조회" on public.chapter_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

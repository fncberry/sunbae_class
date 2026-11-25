-- 7단계: 선배에게 질문
-- 수강생이 강의(챕터)에 질문하고, 그 강의를 올린 선배가 답한다.
-- 수강생·강의 주인·운영자만 본다(공개 아님). 작성자 표시는 후기처럼 "학과 NN학번" 스냅샷.

-- ─── 헬퍼 ─────────────────────────────────────────────────

create function private.owns_lecture(p_lecture_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lectures
    where id = p_lecture_id and instructor_id = (select private.my_instructor_id())
  );
$$;

revoke execute on function private.owns_lecture(text) from public, anon;
grant execute on function private.owns_lecture(text) to authenticated, service_role;

-- ─── 표 ───────────────────────────────────────────────────

create table public.lecture_questions (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null references public.lectures (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  author_label text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 4000),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lecture_questions_lecture on public.lecture_questions (lecture_id, created_at desc);
create index lecture_questions_unanswered on public.lecture_questions (lecture_id) where answer is null;
create index lecture_questions_user on public.lecture_questions (user_id);
create index lecture_questions_chapter on public.lecture_questions (chapter_id);
create index lecture_questions_answered_by on public.lecture_questions (answered_by);

alter table public.lecture_questions enable row level security;

-- 질문은 (강의, 챕터, 내용)만, 수정은 내용·답변만 보낸다. 나머지는 트리거가 채운다
revoke all on public.lecture_questions from anon, authenticated;
grant select, delete on public.lecture_questions to authenticated;
grant insert (lecture_id, chapter_id, body) on public.lecture_questions to authenticated;
grant update (body, answer) on public.lecture_questions to authenticated;

create policy "수강생·강의 주인·운영자 조회" on public.lecture_questions
  for select to authenticated
  using (
    (select private.is_enrolled(lecture_id))
    or (select private.owns_lecture(lecture_id))
    or (select private.is_admin())
  );

create policy "수강생만 질문" on public.lecture_questions
  for insert to authenticated
  with check ((select private.is_enrolled(lecture_id)));

create policy "작성자·강의 주인·운영자 수정" on public.lecture_questions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.owns_lecture(lecture_id))
    or (select private.is_admin())
  )
  with check (
    user_id = (select auth.uid())
    or (select private.owns_lecture(lecture_id))
    or (select private.is_admin())
  );

create policy "답변 전 작성자 또는 운영자 삭제" on public.lecture_questions
  for delete to authenticated
  using ((user_id = (select auth.uid()) and answer is null) or (select private.is_admin()));

-- ─── 트리거 ───────────────────────────────────────────────

-- 질문 작성: 작성자·표시 이름·시각은 서버가 채운다. 챕터는 같은 강의의 것만
create function private.prepare_question()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_major text;
  v_student_id text;
begin
  if current_user in ('authenticated', 'anon') then
    new.user_id := (select auth.uid());
  end if;

  select major, student_id into v_major, v_student_id
  from public.profiles
  where id = new.user_id and onboarded_at is not null;
  if v_major is null or v_student_id is null then
    raise exception '가입 마무리를 먼저 해 주세요.' using errcode = 'P0001', hint = 'onboarding_required';
  end if;

  if new.chapter_id is not null and not exists (
    select 1 from public.chapters where id = new.chapter_id and lecture_id = new.lecture_id
  ) then
    raise exception '이 강의의 챕터가 아니에요.' using errcode = 'P0001', hint = 'chapter_mismatch';
  end if;

  new.author_label := v_major || ' ' || substring(v_student_id from 3 for 2) || '학번';
  new.body := btrim(new.body);
  new.answer := null;
  new.answered_by := null;
  new.answered_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger lecture_questions_prepare
  before insert on public.lecture_questions
  for each row execute function private.prepare_question();

-- 수정: 질문 내용은 답변 전 작성자만, 답변은 강의 주인·운영자만
create function private.guard_question_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  if current_user in ('authenticated', 'anon') then
    v_admin := private.is_admin();
    if new.body is distinct from old.body
       and not v_admin
       and not (old.user_id = (select auth.uid()) and old.answer is null) then
      raise exception '답변이 달린 질문은 고칠 수 없어요.' using errcode = 'P0001', hint = 'question_locked';
    end if;
    if new.answer is distinct from old.answer
       and not v_admin
       and not private.owns_lecture(old.lecture_id) then
      raise exception '이 강의의 선배만 답할 수 있어요.' using errcode = 'P0001', hint = 'not_owner';
    end if;
  end if;

  new.body := btrim(new.body);
  if new.answer is distinct from old.answer then
    new.answer := nullif(btrim(new.answer), '');
    new.answered_by := case when new.answer is null then null else (select auth.uid()) end;
    new.answered_at := case when new.answer is null then null else now() end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger lecture_questions_guard_update
  before update on public.lecture_questions
  for each row execute function private.guard_question_update();

revoke execute on function private.prepare_question() from public, anon, authenticated;
revoke execute on function private.guard_question_update() from public, anon, authenticated;

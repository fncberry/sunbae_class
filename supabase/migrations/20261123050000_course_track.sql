-- 대학 수업(kind = 'major')을 전공/교양으로 나눈다.
-- 과목 찾기 화면에서 전공은 단과대학별로, 교양은 한 목록으로 보여준다.
-- 자격증·어학(kind = 'cert')은 이 구분이 없으므로 null이다.

create type public.course_track as enum ('major', 'liberal');

alter table public.courses add column track public.course_track;

-- 기존 대학 수업은 전부 전공으로 둔다
update public.courses set track = 'major' where kind = 'major';

alter table public.courses
  add constraint track_by_kind check ((kind = 'major') = (track is not null));

create index courses_kind_track_idx on public.courses (kind, track);

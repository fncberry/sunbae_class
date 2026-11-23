// lib/mock-data.ts → supabase/seed.sql
// 실행: npm run db:seed:generate
//
// 판매 수·평점·후기 수는 목업 숫자를 그대로 카운터에 넣는다. 시드에는 실제 주문·후기 작성자가 없어서,
// 이후 실제 수강권·후기가 생기면 트리거가 이 값에 더해 나간다.

import { writeFileSync } from "node:fs";
import { courses, instructors, lectures, reviews, verificationQueue } from "../lib/mock-data.ts";

const q = (v: string | number | boolean | null | undefined): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${v.replaceAll("'", "''")}'`;
};
const arr = (vs: string[]) => `array[${vs.map(q).join(", ")}]::text[]`;
const row = (vs: string[]) => `  (${vs.join(", ")})`;

const statusMap = { "초안": "draft", "검수 중": "reviewing", "판매 중": "on_sale", "숨김": "hidden", "반려": "rejected" } as const;

const out: string[] = [
  "-- ⚠️ scripts/generate-seed.ts가 만든 파일입니다. 직접 고치지 말고 lib/mock-data.ts를 고친 뒤 다시 생성하세요.",
  "-- 과목·교수·사람 이름은 모두 예시입니다.",
  "",
  "begin;",
  "",
];

out.push(
  "insert into public.courses (id, kind, code, name, professor, semester, track, group_name, department, students, exam_date, exam_label) values",
  courses
    .map((c) =>
      row([
        q(c.id), q(c.kind), q(c.code), q(c.name), q(c.professor), q(c.semester), q(c.track),
        q(c.group), q(c.department), q(c.students), q(c.examDate), q(c.examLabel),
      ]),
    )
    .join(",\n") + ";",
  "",
);

// 인증 대기열 신청자도 강사 프로필이 있어야 신청을 만들 수 있다
const applicants = verificationQueue.map((v) => ({ id: `applicant-${v.id}`, name: v.applicant, major: v.major }));

out.push(
  "insert into public.instructors (id, name, major, admission_year, bio) values",
  [
    ...instructors.map((i) => row([q(i.id), q(i.name), q(i.major), q(i.admissionYear), q(i.bio)])),
    ...applicants.map((a) => row([q(a.id), q(a.name), q(a.major), "null", "''"])),
  ].join(",\n") + ";",
  "",
);

out.push(
  "insert into public.grade_verifications (instructor_id, course_id, grade, semester_label, proof_text, status, submitted_at, reviewed_at) values",
  [
    ...instructors.map((i) =>
      row([q(i.id), q(i.verifiedCourseId), q(i.grade), q(i.verifiedSemester), q(i.proof), "'approved'", "now()", "now()"]),
    ),
    ...verificationQueue.map((v) =>
      row([q(`applicant-${v.id}`), q(v.courseId), q(v.grade), q(v.semester), "null", "'pending'", q(`${v.submittedAt}T09:00:00+09:00`), "null"]),
    ),
  ].join(",\n") + ";",
  "",
);

out.push(
  "insert into public.lectures (id, course_id, instructor_id, title, summary, price, study_group_price, study_group_capacity, covers, status, sales_count, review_count, rating_sum, study_group_taken) values",
  lectures
    .map((l) =>
      row([
        q(l.id), q(l.courseId), q(l.instructorId), q(l.title), q(l.summary), q(l.price),
        q(l.studyGroup?.price), q(l.studyGroup?.capacity), arr(l.covers), q(statusMap[l.status]),
        q(l.sales), q(l.reviewCount), q(Math.round(l.rating * l.reviewCount)),
        q(l.studyGroup ? l.studyGroup.capacity - l.studyGroup.remaining : 0),
      ]),
    )
    .join(",\n") + ";",
  "",
);

out.push(
  "insert into public.chapters (lecture_id, position, title, minutes, is_preview) values",
  lectures
    .flatMap((l) => l.chapters.map((ch, i) => row([q(l.id), q(i), q(ch.title), q(ch.minutes), q(Boolean(ch.preview))])))
    .join(",\n") + ";",
  "",
);

// 시드 후기는 카운터에 이미 들어 있으므로, 트리거를 잠시 끄고 넣는다
out.push(
  "alter table public.reviews disable trigger reviews_sync_counters;",
  "insert into public.reviews (lecture_id, author_label, rating, body, created_at) values",
  reviews.map((r) => row([q(r.lectureId), q(r.author), q(r.rating), q(r.text), q(`${r.date}T12:00:00+09:00`)])).join(",\n") + ";",
  "alter table public.reviews enable trigger reviews_sync_counters;",
  "",
  "commit;",
  "",
);

const path = new URL("../supabase/seed.sql", import.meta.url);
writeFileSync(path, out.join("\n"));
console.log(`seed.sql 생성: ${path.pathname}`);

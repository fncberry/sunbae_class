// 강사 센터: 로그인한 사람 기준 데이터. 사람마다 다르므로 캐시하지 않는다.

import "server-only";
import { createServerSupabase } from "./supabase/server";
import type { Tables } from "./database.types";
import type { Course } from "./types";
import { toCourse } from "./data";

export type MyVerification = {
  id: string;
  status: Tables<"grade_verifications">["status"];
  grade: string;
  semester: string;
  submittedAt: string;
  rejectReason: string | null;
  proofText: string | null;
  /** 목록에서 고른 과목, 또는 승인되면서 만들어진 과목 */
  course: Course | null;
  /** 직접 적은 과목 (승인 전) */
  requested: { code: string; name: string; professor: string } | null;
};

export type MyChapter = { title: string; minutes: number };

export type MyLecture = {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  price: number;
  covers: string[];
  chapters: MyChapter[];
  status: Tables<"lectures">["status"];
  rejectReason: string | null;
  sales: number;
  updatedAt: string;
};

export type InstructorCenter = {
  instructor: Pick<Tables<"instructors">, "id" | "name" | "major" | "admission_year" | "bio"> | null;
  verifications: MyVerification[];
  /** 승인된 과목 (강의를 올릴 수 있는 과목) */
  approvedCourses: Course[];
  lectures: MyLecture[];
};

type VerificationRow = Tables<"grade_verifications"> & { course: Tables<"courses"> | null };
type LectureRow = Tables<"lectures"> & { chapters: Tables<"chapters">[] };

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

export function toMyLecture(row: LectureRow): MyLecture {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    summary: row.summary,
    price: row.price,
    covers: row.covers,
    chapters: [...row.chapters].sort((a, b) => a.position - b.position).map((c) => ({ title: c.title, minutes: c.minutes })),
    status: row.status,
    rejectReason: row.reject_reason,
    sales: row.sales_count,
    updatedAt: row.updated_at,
  };
}

export async function getInstructorCenter(userId: string): Promise<InstructorCenter> {
  const sb = await createServerSupabase();
  const { data: instructor, error } = await sb
    .from("instructors")
    .select("id, name, major, admission_year, bio")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("강사 프로필", error);
  if (!instructor) return { instructor: null, verifications: [], approvedCourses: [], lectures: [] };

  const [verRes, lecRes] = await Promise.all([
    sb
      .from("grade_verifications")
      .select("*, course:courses(*)")
      .eq("instructor_id", instructor.id)
      .order("submitted_at", { ascending: false })
      .overrideTypes<VerificationRow[], { merge: false }>(),
    sb
      .from("lectures")
      .select("*, chapters(*)")
      .eq("instructor_id", instructor.id)
      .order("updated_at", { ascending: false })
      .overrideTypes<LectureRow[], { merge: false }>(),
  ]);
  if (verRes.error) fail("성적 인증 신청", verRes.error);
  if (lecRes.error) fail("내 강의", lecRes.error);

  const verifications: MyVerification[] = verRes.data.map((v) => ({
    id: v.id,
    status: v.status,
    grade: v.grade,
    semester: v.semester_label,
    submittedAt: v.submitted_at,
    rejectReason: v.reject_reason,
    proofText: v.proof_text,
    course: v.course ? toCourse(v.course) : null,
    requested:
      v.requested_code && v.requested_name && v.requested_professor
        ? { code: v.requested_code, name: v.requested_name, professor: v.requested_professor }
        : null,
  }));

  const approved = new Map<string, Course>();
  for (const v of verifications) if (v.status === "approved" && v.course) approved.set(v.course.id, v.course);

  return {
    instructor,
    verifications,
    approvedCourses: [...approved.values()],
    lectures: lecRes.data.map(toMyLecture),
  };
}

/** 강의 수정 화면: 내 강의 하나 */
export async function getMyLecture(instructorId: string, lectureId: string): Promise<MyLecture | null> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lectures")
    .select("*, chapters(*)")
    .eq("id", lectureId)
    .eq("instructor_id", instructorId)
    .overrideTypes<LectureRow[], { merge: false }>();
  if (error) fail(`강의 ${lectureId}`, error);
  return data[0] ? toMyLecture(data[0]) : null;
}

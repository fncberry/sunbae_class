// 운영자 화면 데이터. 운영자 세션으로 읽고(RLS가 운영자에게 전체를 열어 준다) 캐시하지 않는다.

import "server-only";
import { createServerSupabase } from "./supabase/server";
import type { Tables } from "./database.types";
import type { Course } from "./types";
import { toCourse } from "./data";
import { toMyLecture, type MyLecture } from "./instructor-center";

export type Applicant = {
  instructorId: string;
  /** 실명·학번은 운영자 화면에서만 */
  name: string | null;
  studentId: string | null;
  nickname: string;
  major: string;
};

export type PendingVerification = {
  id: string;
  applicant: Applicant;
  course: Course | null;
  requested: {
    code: string;
    name: string;
    professor: string;
    track: "major" | "liberal";
    group: string;
    department: string | null;
  } | null;
  grade: string;
  semester: string;
  submittedAt: string;
  hasProof: boolean;
};

/** 결정은 났는데 캡처를 아직 못 지운 신청 (다시 지우기 대상) */
export type LeftoverProof = { id: string; path: string; status: string; reviewedAt: string | null };

export type ReviewLecture = MyLecture & { course: Course; instructor: Applicant };

type ProfileBits = Pick<Tables<"profiles">, "name" | "student_id" | "nickname" | "major">;
type InstructorBits = Pick<Tables<"instructors">, "id" | "name" | "major"> & { profile: ProfileBits | null };

function toApplicant(i: InstructorBits): Applicant {
  return {
    instructorId: i.id,
    name: i.profile?.name ?? null,
    studentId: i.profile?.student_id ?? null,
    nickname: i.profile?.nickname ?? i.name,
    major: i.profile?.major ?? i.major,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

const INSTRUCTOR_SELECT = "id, name, major, profile:profiles(name, student_id, nickname, major)";

export async function listPendingVerifications(): Promise<PendingVerification[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("grade_verifications")
    .select(`*, course:courses(*), instructor:instructors!inner(${INSTRUCTOR_SELECT})`)
    .eq("status", "pending")
    .order("submitted_at")
    .overrideTypes<
      (Tables<"grade_verifications"> & { course: Tables<"courses"> | null; instructor: InstructorBits })[],
      { merge: false }
    >();
  if (error) fail("인증 대기열", error);

  return data.map((v) => ({
    id: v.id,
    applicant: toApplicant(v.instructor),
    course: v.course ? toCourse(v.course) : null,
    requested:
      v.requested_code && v.requested_name && v.requested_professor && v.requested_track && v.requested_group
        ? {
            code: v.requested_code,
            name: v.requested_name,
            professor: v.requested_professor,
            track: v.requested_track,
            group: v.requested_group,
            department: v.requested_department,
          }
        : null,
    grade: v.grade,
    semester: v.semester_label,
    submittedAt: v.submitted_at,
    hasProof: !!v.proof_path,
  }));
}

export async function listLeftoverProofs(): Promise<LeftoverProof[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("grade_verifications")
    .select("id, proof_path, status, reviewed_at")
    .neq("status", "pending")
    .not("proof_path", "is", null)
    .order("reviewed_at");
  if (error) fail("남은 캡처", error);
  return data.map((v) => ({ id: v.id, path: v.proof_path ?? "", status: v.status, reviewedAt: v.reviewed_at }));
}

export async function listReviewingLectures(): Promise<ReviewLecture[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lectures")
    .select(`*, chapters(*), course:courses!inner(*), instructor:instructors!inner(${INSTRUCTOR_SELECT})`)
    .eq("status", "reviewing")
    .order("updated_at")
    .overrideTypes<
      (Tables<"lectures"> & { chapters: Tables<"chapters">[]; course: Tables<"courses">; instructor: InstructorBits })[],
      { merge: false }
    >();
  if (error) fail("검수 대기 강의", error);
  return data.map((row) => ({
    ...toMyLecture(row),
    course: toCourse(row.course),
    instructor: toApplicant(row.instructor),
  }));
}

/** 운영자 메뉴에 붙는 대기 건수 */
export async function adminCounts(): Promise<{ verifications: number; lectures: number }> {
  const sb = await createServerSupabase();
  const [v, l] = await Promise.all([
    sb.from("grade_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("lectures").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
  ]);
  return { verifications: v.count ?? 0, lectures: l.count ?? 0 };
}

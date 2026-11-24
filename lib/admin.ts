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
export type AdminCounts = { verifications: number; lectures: number; payments: number };

export async function adminCounts(): Promise<AdminCounts> {
  const sb = await createServerSupabase();
  const [v, l, p] = await Promise.all([
    sb.from("grade_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("lectures").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    sb.from("payment_events").select("id", { count: "exact", head: true }).eq("result", "needs_review").is("resolved_at", null),
  ]);
  return { verifications: v.count ?? 0, lectures: l.count ?? 0, payments: p.count ?? 0 };
}

// ─── 결제 ─────────────────────────────────────────────────

/** 웹훅이 자동으로 처리하지 못해 운영자가 봐야 하는 건 (금액 불일치, 환불 요청, 부분 환불 등) */
export type PaymentIssue = {
  id: string;
  type: string;
  note: string | null;
  receivedAt: string;
  merchantUid: string | null;
  order: {
    id: string;
    amount: number;
    option: "video" | "study";
    status: Tables<"orders">["status"];
    paidAt: string | null;
    lectureId: string;
    title: string;
    examDate: string;
    examLabel: string;
    chapterCount: number;
    completedCount: number;
    buyer: { name: string | null; studentId: string | null; nickname: string | null };
  } | null;
};

type IssueRow = Pick<Tables<"payment_events">, "id" | "type" | "note" | "received_at" | "merchant_uid"> & {
  order:
    | (Pick<Tables<"orders">, "id" | "amount" | "option" | "status" | "paid_at" | "lecture_id" | "user_id"> & {
        lecture: { title: string; chapters: { id: string }[]; course: Pick<Tables<"courses">, "exam_date" | "exam_label"> };
        buyer: Pick<Tables<"profiles">, "name" | "student_id" | "nickname"> | null;
      })
    | null;
};

export async function listPaymentIssues(): Promise<PaymentIssue[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("payment_events")
    .select(
      `id, type, note, received_at, merchant_uid,
       order:orders(id, amount, option, status, paid_at, lecture_id, user_id,
         lecture:lectures!inner(title, chapters(id), course:courses!inner(exam_date, exam_label)),
         buyer:profiles(name, student_id, nickname))`,
    )
    .eq("result", "needs_review")
    .is("resolved_at", null)
    .order("received_at", { ascending: false })
    .limit(100)
    .overrideTypes<IssueRow[], { merge: false }>();
  if (error) fail("확인할 결제", error);

  return Promise.all(
    data.map(async (e): Promise<PaymentIssue> => {
      const o = e.order;
      let completedCount = 0;
      if (o) {
        const chapterIds = o.lecture.chapters.map((c) => c.id);
        if (chapterIds.length > 0) {
          const { count } = await sb
            .from("chapter_progress")
            .select("chapter_id", { count: "exact", head: true })
            .eq("user_id", o.user_id)
            .eq("completed", true)
            .in("chapter_id", chapterIds);
          completedCount = count ?? 0;
        }
      }
      return {
        id: e.id,
        type: e.type,
        note: e.note,
        receivedAt: e.received_at,
        merchantUid: e.merchant_uid,
        order: o
          ? {
              id: o.id,
              amount: o.amount,
              option: o.option,
              status: o.status,
              paidAt: o.paid_at,
              lectureId: o.lecture_id,
              title: o.lecture.title,
              examDate: o.lecture.course.exam_date,
              examLabel: o.lecture.course.exam_label,
              chapterCount: o.lecture.chapters.length,
              completedCount,
              buyer: { name: o.buyer?.name ?? null, studentId: o.buyer?.student_id ?? null, nickname: o.buyer?.nickname ?? null },
            }
          : null,
      };
    }),
  );
}

/** 결제창 링크를 붙일 강의 (판매 중·검수 중) */
export type LinkLecture = {
  id: string;
  title: string;
  status: Tables<"lectures">["status"];
  course: Course;
  price: number;
  studyPrice: number | null;
  links: { video: string | null; study: string | null };
};

export async function listLinkLectures(): Promise<LinkLecture[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lectures")
    .select("id, title, status, price, study_group_price, course:courses!inner(*), links:lecture_checkout_links(option, url)")
    .in("status", ["on_sale", "reviewing"])
    .order("status")
    .order("created_at", { ascending: false })
    .overrideTypes<
      (Pick<Tables<"lectures">, "id" | "title" | "status" | "price" | "study_group_price"> & {
        course: Tables<"courses">;
        links: Pick<Tables<"lecture_checkout_links">, "option" | "url">[];
      })[],
      { merge: false }
    >();
  if (error) fail("결제창 링크", error);

  return data.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    course: toCourse(l.course),
    price: l.price,
    studyPrice: l.study_group_price,
    links: {
      video: l.links.find((x) => x.option === "video")?.url ?? null,
      study: l.links.find((x) => x.option === "study")?.url ?? null,
    },
  }));
}

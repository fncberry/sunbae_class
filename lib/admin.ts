// 운영자 화면 데이터. 운영자 세션으로 읽고(RLS가 운영자에게 전체를 열어 준다) 캐시하지 않는다.

import "server-only";
import { createServerSupabase } from "./supabase/server";
import type { Tables } from "./database.types";
import type { Course } from "./types";
import { toCourse } from "./data";
import { toMyLecture, type MyLecture } from "./instructor-center";
import { instructorShare, kstToday } from "./format";
import { SETTLEMENT_SELECT, toAccount, toSettlement, type PayoutAccount, type Settlement } from "./settlements";

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
export type AdminCounts = { verifications: number; lectures: number; payments: number; settlements: number };

export async function adminCounts(): Promise<AdminCounts> {
  const sb = await createServerSupabase();
  const [v, l, p, st] = await Promise.all([
    sb.from("grade_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("lectures").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    sb.from("payment_events").select("id", { count: "exact", head: true }).eq("result", "needs_review").is("resolved_at", null),
    sb.from("settlements").select("id", { count: "exact", head: true }).is("paid_at", null),
  ]);
  return { verifications: v.count ?? 0, lectures: l.count ?? 0, payments: p.count ?? 0, settlements: st.count ?? 0 };
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

// ─── 정산 ─────────────────────────────────────────────────

/** 정산할 수 있는 강사: 시험이 끝났고 아직 정산하지 않은 결제가 있다 */
export type SettleCandidate = {
  instructor: Applicant;
  account: PayoutAccount | null;
  orderCount: number;
  gross: number;
  payout: number;
};

export type AdminSettlement = Settlement & {
  instructor: Applicant;
  account: PayoutAccount | null;
  /** 정산에 담은 뒤 환불된 결제 수 (지급 전이면 취소하고 다시 만든다) */
  refundedCount: number;
};

/** 정산 뒤 환불된 결제 (최근 90일). 이미 보낸 돈이면 다음 정산에서 따로 빼야 한다 */
export type RefundAfterSettlement = {
  orderId: string;
  amount: number;
  refundedAt: string | null;
  title: string;
  instructor: Applicant;
  period: string;
  settlementPaid: boolean;
};

type AccountRow = Pick<Tables<"instructor_payout_accounts">, "bank" | "account_number" | "holder" | "updated_at">;

async function instructorsWithAccounts(ids: string[]) {
  const map = new Map<string, { instructor: Applicant; account: PayoutAccount | null }>();
  if (ids.length === 0) return map;
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("instructors")
    .select(`${INSTRUCTOR_SELECT}, account:instructor_payout_accounts(bank, account_number, holder, updated_at)`)
    .in("id", ids)
    .overrideTypes<(InstructorBits & { account: AccountRow | null })[], { merge: false }>();
  if (error) fail("정산 강사", error);
  for (const i of data) map.set(i.id, { instructor: toApplicant(i), account: toAccount(i.account) });
  return map;
}

export async function listSettleCandidates(): Promise<SettleCandidate[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("orders")
    .select("amount, lecture:lectures!inner(instructor_id, course:courses!inner(exam_date))")
    .eq("status", "paid")
    .is("settlement_id", null)
    .overrideTypes<{ amount: number; lecture: { instructor_id: string; course: { exam_date: string } } }[], { merge: false }>();
  if (error) fail("정산할 결제", error);

  const today = kstToday();
  const byInstructor = new Map<string, { count: number; gross: number }>();
  for (const o of data) {
    if (o.lecture.course.exam_date >= today) continue;
    const cur = byInstructor.get(o.lecture.instructor_id) ?? { count: 0, gross: 0 };
    byInstructor.set(o.lecture.instructor_id, { count: cur.count + 1, gross: cur.gross + o.amount });
  }

  const people = await instructorsWithAccounts([...byInstructor.keys()]);
  return [...byInstructor.entries()]
    .flatMap(([id, sum]) => {
      const p = people.get(id);
      return p ? [{ ...p, orderCount: sum.count, gross: sum.gross, payout: instructorShare(sum.gross) }] : [];
    })
    .sort((a, b) => b.gross - a.gross);
}

export async function listSettlements(paid: boolean): Promise<AdminSettlement[]> {
  const sb = await createServerSupabase();
  let q = sb.from("settlements").select(`${SETTLEMENT_SELECT}, orders(status)`);
  q = paid ? q.not("paid_at", "is", null).order("paid_at", { ascending: false }).limit(30) : q.is("paid_at", null).order("created_at");
  const { data, error } = await q.overrideTypes<
    (Parameters<typeof toSettlement>[0] & { orders: { status: Tables<"orders">["status"] }[] })[],
    { merge: false }
  >();
  if (error) fail(paid ? "지급한 정산" : "지급 대기 정산", error);

  const people = await instructorsWithAccounts([...new Set(data.map((s) => s.instructor_id))]);
  return data.flatMap((s) => {
    const p = people.get(s.instructor_id);
    if (!p) return [];
    return [{ ...toSettlement(s), ...p, refundedCount: s.orders.filter((o) => o.status === "refunded").length }];
  });
}

export async function listRefundsAfterSettlement(): Promise<RefundAfterSettlement[]> {
  const sb = await createServerSupabase();
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await sb
    .from("orders")
    .select("id, amount, refunded_at, lecture:lectures!inner(title, instructor_id), settlement:settlements!inner(period, paid_at)")
    .eq("status", "refunded")
    .not("settlement_id", "is", null)
    .gte("refunded_at", since)
    .order("refunded_at", { ascending: false })
    .overrideTypes<
      (Pick<Tables<"orders">, "id" | "amount" | "refunded_at"> & {
        lecture: { title: string; instructor_id: string };
        settlement: { period: string; paid_at: string | null };
      })[],
      { merge: false }
    >();
  if (error) fail("정산 뒤 환불", error);

  const people = await instructorsWithAccounts([...new Set(data.map((o) => o.lecture.instructor_id))]);
  return data.flatMap((o) => {
    const p = people.get(o.lecture.instructor_id);
    if (!p) return [];
    return [
      {
        orderId: o.id,
        amount: o.amount,
        refundedAt: o.refunded_at,
        title: o.lecture.title,
        instructor: p.instructor,
        period: o.settlement.period,
        settlementPaid: o.settlement.paid_at !== null,
      },
    ];
  });
}

// 수강생: 로그인한 사람 기준 수강권·진도·주문. 사람마다 다르므로 캐시하지 않는다(요청 안에서만 React cache로 한 번).

import "server-only";
import { cache } from "react";
import type { CurrentUser } from "./auth";
import { toCourse } from "./data";
import type { Tables } from "./database.types";
import { createServerSupabase } from "./supabase/server";
import type { Course } from "./types";

type PurchaseOption = Tables<"orders">["option"];

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

// ─── 강의 상세에서 보는 내 상태 ─────────────────────────────

export type ViewerAccess = {
  /** 살아 있는 수강권 */
  enrollment: { option: PurchaseOption } | null;
  /** 내가 올린 강의 */
  isOwner: boolean;
  myReview: { rating: number; body: string } | null;
};

export const getViewerAccess = cache(async (user: CurrentUser, lectureId: string): Promise<ViewerAccess> => {
  const sb = await createServerSupabase();
  const [enr, lec, rev] = await Promise.all([
    sb
      .from("enrollments")
      .select("option")
      .eq("user_id", user.id)
      .eq("lecture_id", lectureId)
      .is("revoked_at", null)
      .maybeSingle(),
    sb.from("lectures").select("instructor:instructors!inner(user_id)").eq("id", lectureId).maybeSingle(),
    sb.from("reviews").select("rating, body").eq("user_id", user.id).eq("lecture_id", lectureId).maybeSingle(),
  ]);
  if (enr.error) fail("수강권", enr.error);
  if (lec.error) fail("강의 주인", lec.error);
  if (rev.error) fail("내 후기", rev.error);

  const owner = (lec.data?.instructor as { user_id: string | null } | null)?.user_id ?? null;
  return {
    enrollment: enr.data ? { option: enr.data.option } : null,
    isOwner: owner !== null && owner === user.id,
    myReview: rev.data,
  };
});

// ─── 시청 ─────────────────────────────────────────────────

export type WatchChapter = {
  id: string;
  position: number;
  title: string;
  minutes: number;
  preview: boolean;
  completed: boolean;
};

export type WatchLecture = {
  id: string;
  title: string;
  course: Course;
  instructorName: string;
  /** 수강생·강의 주인·운영자는 전체, 그 밖에는 맛보기만 */
  access: "full" | "preview";
  /** 진도를 기록하는 사람(수강생)인지 */
  enrolled: boolean;
  /** 내가 올린 강의 (질문에 답할 수 있음) */
  owner: boolean;
  chapters: WatchChapter[];
};

type WatchRow = Pick<Tables<"lectures">, "id" | "title"> & {
  course: Tables<"courses">;
  instructor: { name: string; user_id: string | null };
  chapters: Pick<Tables<"chapters">, "id" | "position" | "title" | "minutes" | "is_preview">[];
};

/**
 * 시청 화면 데이터. 강의가 보이지 않으면 null(판매 중이 아니고, 수강생·주인·운영자도 아님).
 * 판매를 멈춘 강의도 수강권이 있으면 RLS가 보여준다.
 */
export async function getWatchLecture(user: CurrentUser, lectureId: string): Promise<WatchLecture | null> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lectures")
    .select("id, title, course:courses!inner(*), instructor:instructors!inner(name, user_id), chapters(id, position, title, minutes, is_preview)")
    .eq("id", lectureId)
    .overrideTypes<WatchRow[], { merge: false }>();
  if (error) fail(`강의 ${lectureId}`, error);
  const row = data[0];
  if (!row) return null;

  const access = await getViewerAccess(user, lectureId);
  const enrolled = access.enrollment !== null;
  const owner = row.instructor.user_id === user.id;
  const full = enrolled || owner || user.role === "admin";

  const chapterIds = row.chapters.map((c) => c.id);
  let completed = new Set<string>();
  if (enrolled && chapterIds.length > 0) {
    const progress = await sb
      .from("chapter_progress")
      .select("chapter_id")
      .eq("user_id", user.id)
      .eq("completed", true)
      .in("chapter_id", chapterIds);
    if (progress.error) fail("진도", progress.error);
    completed = new Set(progress.data.map((p) => p.chapter_id));
  }

  return {
    id: row.id,
    title: row.title,
    course: toCourse(row.course),
    instructorName: row.instructor.name,
    access: full ? "full" : "preview",
    enrolled,
    owner,
    chapters: [...row.chapters]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        position: c.position,
        title: c.title,
        minutes: c.minutes,
        preview: c.is_preview,
        completed: completed.has(c.id),
      })),
  };
}

// ─── 내 강의 (/my) ─────────────────────────────────────────

export type MyEnrollment = {
  lectureId: string;
  title: string;
  course: Course;
  option: PurchaseOption;
  since: string;
  chapterCount: number;
  completedCount: number;
};

export type MyOrder = {
  id: string;
  lectureId: string;
  /** 판매가 끝나 볼 수 없는 강의면 null */
  title: string | null;
  option: PurchaseOption;
  amount: number;
  status: Tables<"orders">["status"];
  createdAt: string;
};

type EnrollmentRow = Pick<Tables<"enrollments">, "lecture_id" | "option" | "created_at"> & {
  lecture: (Pick<Tables<"lectures">, "id" | "title"> & { course: Tables<"courses">; chapters: { id: string }[] }) | null;
};

export async function listMyEnrollments(user: CurrentUser): Promise<MyEnrollment[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("enrollments")
    .select("lecture_id, option, created_at, lecture:lectures(id, title, course:courses!inner(*), chapters(id))")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .overrideTypes<EnrollmentRow[], { merge: false }>();
  if (error) fail("내 수강권", error);

  const rows = data.filter((r): r is EnrollmentRow & { lecture: NonNullable<EnrollmentRow["lecture"]> } => r.lecture !== null);
  const chapterIds = rows.flatMap((r) => r.lecture.chapters.map((c) => c.id));
  const done = new Set<string>();
  if (chapterIds.length > 0) {
    const progress = await sb
      .from("chapter_progress")
      .select("chapter_id")
      .eq("user_id", user.id)
      .eq("completed", true)
      .in("chapter_id", chapterIds);
    if (progress.error) fail("진도", progress.error);
    for (const p of progress.data) done.add(p.chapter_id);
  }

  return rows.map((r) => ({
    lectureId: r.lecture.id,
    title: r.lecture.title,
    course: toCourse(r.lecture.course),
    option: r.option,
    since: r.created_at,
    chapterCount: r.lecture.chapters.length,
    completedCount: r.lecture.chapters.filter((c) => done.has(c.id)).length,
  }));
}

type OrderRow = Pick<Tables<"orders">, "id" | "lecture_id" | "option" | "amount" | "status" | "created_at"> & {
  lecture: { title: string } | null;
};

const ORDER_SELECT = "id, lecture_id, option, amount, status, created_at, lecture:lectures(title)";

function toMyOrder(r: OrderRow): MyOrder {
  return {
    id: r.id,
    lectureId: r.lecture_id,
    title: r.lecture?.title ?? null,
    option: r.option,
    amount: r.amount,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function listMyOrders(user: CurrentUser): Promise<MyOrder[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<OrderRow[], { merge: false }>();
  if (error) fail("결제 내역", error);
  return data.map(toMyOrder);
}

/** 내 주문 하나. 남의 주문이면 RLS 때문에 null */
export async function getMyOrder(user: CurrentUser, orderId: string): Promise<MyOrder | null> {
  // uuid가 아니면 DB까지 가지 않는다
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return null;
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("user_id", user.id)
    .overrideTypes<OrderRow[], { merge: false }>();
  if (error) fail(`주문 ${orderId}`, error);
  return data[0] ? toMyOrder(data[0]) : null;
}

"use server";

import { refresh, updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createServerSupabase } from "@/lib/supabase/server";
import { PROOF_BUCKET, clean } from "@/lib/verification";

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabase>>;

export type DecisionState =
  | { status: "idle" }
  | { status: "done"; at: number; warning?: string }
  | { status: "error"; at: number; message: string };

async function adminOnly() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/** 캡처 삭제 후 경로를 비운다. 실패하면 경로가 남아서 '못 지운 캡처' 목록에 나온다. */
async function deleteProof(sb: SupabaseServer, id: string, path: string): Promise<boolean> {
  const removed = await sb.storage.from(PROOF_BUCKET).remove([path]);
  if (removed.error) {
    console.error("[admin] proof delete failed", id, path, removed.error.message);
    return false;
  }
  const cleared = await sb.from("grade_verifications").update({ proof_path: null }).eq("id", id);
  if (cleared.error) {
    console.error("[admin] proof_path clear failed", id, cleared.error.message);
    return false;
  }
  return true;
}

const COURSE_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 성적 인증 승인·반려. 처리자·처리 시각은 DB 트리거가 기록하고, 승인되면 트리거가 역할을 강사로 바꾼다.
 * 목록에 없던 과목이면 여기서 과목을 만든다. 결정이 저장되면 캡처를 바로 지운다.
 */
export async function decideVerification(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const at = Date.now();
  const fail = (message: string): DecisionState => ({ status: "error", at, message });
  if (!(await adminOnly())) return fail("운영자만 처리할 수 있어요.");

  const id = clean(formData.get("id"), 40);
  const decision = formData.get("decision");
  if (decision !== "approve" && decision !== "reject") return fail("승인인지 반려인지 골라 주세요.");

  const sb = await createServerSupabase();
  const { data: v, error: readError } = await sb.from("grade_verifications").select("*").eq("id", id).maybeSingle();
  if (readError || !v) return fail("신청을 찾지 못했어요. 새로고침해 주세요.");
  if (v.status !== "pending") return fail("이미 처리된 신청이에요.");

  if (decision === "reject") {
    const reason = clean(formData.get("rejectReason"), 200);
    if (!reason) return fail("반려 사유를 적어 주세요. 신청자에게 그대로 보여요.");
    const { data, error } = await sb
      .from("grade_verifications")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (!error) return fail("이미 처리된 신청이에요. 새로고침해 주세요.");
      console.error("[admin] reject verification", error.code, error.message);
      return fail(error.code === "P0001" ? error.message : "반려하지 못했어요. 다시 시도해 주세요.");
    }
  } else {
    const proofText = clean(formData.get("proofText"), 120);
    if (!proofText) return fail("강의 페이지에 보일 인증 문구를 적어 주세요.");

    let courseId = v.course_id;
    if (!courseId) {
      // 직접 적은 과목: 과목 id가 이미 있으면 그 과목에 연결하고, 없으면 새로 만든다
      courseId = clean(formData.get("courseId"), 40).toLowerCase();
      if (!COURSE_ID.test(courseId)) return fail("과목 id는 영문 소문자·숫자·-로 적어 주세요. (예: cose341)");
      const existing = await sb.from("courses").select("id").eq("id", courseId).maybeSingle();
      if (!existing.data) {
        const examDate = clean(formData.get("examDate"), 10);
        if (!ISO_DATE.test(examDate)) return fail("시험일을 골라 주세요. 환불 기한의 기준이 돼요.");
        const courseSemester = clean(formData.get("courseSemester"), 30);
        if (!courseSemester) return fail("이번에 열리는 학기를 적어 주세요. (예: 2026-2학기)");
        const name = clean(formData.get("courseName"), 60) || v.requested_name;
        const professor = clean(formData.get("courseProfessor"), 30) || v.requested_professor;
        const code = (clean(formData.get("courseCode"), 20) || v.requested_code)?.toUpperCase();
        if (!name || !professor || !code || !v.requested_track || !v.requested_group) {
          return fail("과목 정보가 모자라요. 학수번호, 과목명, 교수님을 확인해 주세요.");
        }
        const created = await sb.from("courses").insert({
          id: courseId,
          kind: "major",
          track: v.requested_track,
          code,
          name,
          professor,
          semester: courseSemester,
          group_name: v.requested_group,
          department: clean(formData.get("courseDepartment"), 40) || v.requested_department,
          exam_date: examDate,
          exam_label: clean(formData.get("examLabel"), 20) || "기말고사",
        });
        if (created.error) {
          console.error("[admin] create course", created.error.code, created.error.message);
          return fail("과목을 만들지 못했어요. 입력값을 확인해 주세요.");
        }
      }
    }

    const { data, error } = await sb
      .from("grade_verifications")
      .update({ status: "approved", proof_text: proofText, course_id: courseId })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (!error) return fail("이미 처리된 신청이에요. 새로고침해 주세요.");
      console.error("[admin] approve verification", error.code, error.message);
      return fail(error.code === "P0001" ? error.message : "승인하지 못했어요. 다시 시도해 주세요.");
    }
  }

  const deleted = v.proof_path ? await deleteProof(sb, id, v.proof_path) : true;

  updateTag("catalog");
  refresh();
  return deleted
    ? { status: "done", at }
    : { status: "done", at, warning: "결정은 저장했는데 캡처를 지우지 못했어요. 아래 목록에서 다시 지워 주세요." };
}

/** 결정 뒤 못 지운 캡처를 다시 지운다 */
export async function retryProofDelete(formData: FormData): Promise<void> {
  if (!(await adminOnly())) return;
  const id = clean(formData.get("id"), 40);
  const sb = await createServerSupabase();
  const { data } = await sb.from("grade_verifications").select("proof_path, status").eq("id", id).maybeSingle();
  if (data?.proof_path && data.status !== "pending") await deleteProof(sb, id, data.proof_path);
  refresh();
}

/** 강의 검수: 판매 시작 또는 반려(사유 필수) */
export async function reviewLecture(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const at = Date.now();
  const fail = (message: string): DecisionState => ({ status: "error", at, message });
  if (!(await adminOnly())) return fail("운영자만 처리할 수 있어요.");

  const id = clean(formData.get("id"), 80);
  const decision = formData.get("decision");
  const sb = await createServerSupabase();

  let update: { status: "on_sale" } | { status: "rejected"; reject_reason: string };
  if (decision === "approve") {
    update = { status: "on_sale" };
  } else if (decision === "reject") {
    const reason = clean(formData.get("rejectReason"), 300);
    if (!reason) return fail("반려 사유를 적어 주세요. 강사에게 그대로 보여요.");
    update = { status: "rejected", reject_reason: reason };
  } else {
    return fail("판매 시작인지 반려인지 골라 주세요.");
  }

  const { data, error } = await sb.from("lectures").update(update).eq("id", id).eq("status", "reviewing").select("id").maybeSingle();
  if (error || !data) {
    console.error("[admin] review lecture", error?.code, error?.message);
    return fail("처리하지 못했어요. 강사가 그사이 고쳤을 수 있어요. 새로고침해 주세요.");
  }

  updateTag("catalog");
  refresh();
  return { status: "done", at };
}

export type LinkState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; at: number; message: string };

const GROBLE_LINK = /^https:\/\/(www\.)?groble\.im\/[A-Za-z0-9/_.~%-]+$/;

/** 강의 결제창 링크 저장. 비우면 지운다(그 방식은 결제를 받지 않는 상태가 된다). */
export async function saveCheckoutLinks(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const at = Date.now();
  const fail = (message: string): LinkState => ({ status: "error", at, message });
  if (!(await adminOnly())) return fail("운영자만 바꿀 수 있어요.");

  const lectureId = clean(formData.get("lectureId"), 80);
  const sb = await createServerSupabase();

  for (const option of ["video", "study"] as const) {
    if (!formData.has(option)) continue;
    const url = clean(formData.get(option), 300);
    const { error } = url
      ? GROBLE_LINK.test(url)
        ? await sb.from("lecture_checkout_links").upsert({ lecture_id: lectureId, option, url })
        : { error: { code: "invalid", message: "" } }
      : await sb.from("lecture_checkout_links").delete().eq("lecture_id", lectureId).eq("option", option);
    if (error) {
      if (error.code === "invalid") return fail("그로블 결제창 주소(https://groble.im/…)를 ? 없이 넣어 주세요.");
      console.error("[admin] checkout link", error.code, error.message);
      return fail("저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  refresh();
  return { status: "saved", at };
}

/** 확인할 결제를 '확인함'으로 표시. 시각·처리자는 DB 트리거가 채운다 */
export async function resolvePaymentIssue(formData: FormData): Promise<void> {
  if (!(await adminOnly())) return;
  const id = clean(formData.get("id"), 200);
  const sb = await createServerSupabase();
  const { error } = await sb.from("payment_events").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) console.error("[admin] resolve payment", error.code, error.message);
  refresh();
}

// ─── 정산 ─────────────────────────────────────────────────

export type SettleState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; at: number; message: string };

const SETTLE_ERRORS: Record<string, string> = {
  nothing_to_settle: "정산할 결제가 없어요.",
  no_account: "강사가 받을 계좌를 아직 등록하지 않았어요.",
  already_paid: "이미 지급한 정산이에요.",
};

function settleFail(at: number, what: string, error: { code?: string; message: string; hint?: string | null }): SettleState {
  const known = error.hint ? SETTLE_ERRORS[error.hint] : undefined;
  if (!known) console.error(`[admin] ${what}`, error.code, error.message);
  return { status: "error", at, message: known ?? "처리하지 못했어요. 다시 시도해 주세요." };
}

/** 정산 만들기: 강사만 고르면 금액·담을 결제는 DB 트리거가 정한다 */
export async function createSettlement(_prev: SettleState, formData: FormData): Promise<SettleState> {
  const at = Date.now();
  if (!(await adminOnly())) return { status: "error", at, message: "운영자만 할 수 있어요." };
  const instructorId = clean(formData.get("id"), 80);
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("settlements")
    .insert({ instructor_id: instructorId } as Database["public"]["Tables"]["settlements"]["Insert"]);
  if (error) return settleFail(at, "create settlement", error);
  refresh();
  return { status: "done", at };
}

/** 계좌이체를 마친 뒤 지급 완료로 표시. 시각·보낸 계좌는 DB 트리거가 기록한다 */
export async function markSettlementPaid(_prev: SettleState, formData: FormData): Promise<SettleState> {
  const at = Date.now();
  if (!(await adminOnly())) return { status: "error", at, message: "운영자만 할 수 있어요." };
  const id = clean(formData.get("id"), 40);
  const sb = await createServerSupabase();
  const { data, error } = await sb.from("settlements").update({ paid_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return settleFail(at, "mark settlement paid", error);
  if (data.length === 0) return { status: "error", at, message: "정산을 찾지 못했어요." };
  refresh();
  return { status: "done", at };
}

/** 지급 전 정산 취소: 담겼던 결제는 다시 정산 대기로 돌아간다 */
export async function cancelSettlement(_prev: SettleState, formData: FormData): Promise<SettleState> {
  const at = Date.now();
  if (!(await adminOnly())) return { status: "error", at, message: "운영자만 할 수 있어요." };
  const id = clean(formData.get("id"), 40);
  const sb = await createServerSupabase();
  const { data, error } = await sb.from("settlements").delete().eq("id", id).is("paid_at", null).select("id");
  if (error) return settleFail(at, "cancel settlement", error);
  if (data.length === 0) return { status: "error", at, message: "지급 전 정산만 취소할 수 있어요." };
  refresh();
  return { status: "done", at };
}

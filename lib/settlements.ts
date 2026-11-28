// 정산: 강사 몫은 결제 금액의 80%(그로블 수수료는 운영 몫). 시험일이 지나 환불될 수 없는 결제만 월 1회 정산한다.
// 정산 행은 운영자가 강사만 골라 만들고, 금액·담긴 결제는 DB 트리거(private.prepare_settlement)가 정한다.

import "server-only";
import type { Tables } from "./database.types";
import { instructorShare, kstToday } from "./format";
import { createServerSupabase } from "./supabase/server";
import { createServiceSupabase } from "./supabase/service";

export type PayoutAccount = { bank: string; accountNumber: string; holder: string; updatedAt: string };

export type Settlement = {
  id: string;
  instructorId: string;
  period: string;
  orderCount: number;
  gross: number;
  payout: number;
  sharePercent: number;
  createdAt: string;
  paidAt: string | null;
  paidTo: string | null;
};

/** 아직 정산하지 않은 결제 합계. ready는 시험이 끝나 다음 정산에 들어갈 몫, waiting은 시험 전(환불 가능)인 몫 */
export type Unsettled = {
  ready: { count: number; gross: number; payout: number };
  waiting: { count: number; gross: number; payout: number };
};

export const SETTLEMENT_SELECT =
  "id, instructor_id, period, order_count, gross_amount, payout_amount, share_percent, created_at, paid_at, paid_to";

type SettlementRow = Pick<
  Tables<"settlements">,
  | "id"
  | "instructor_id"
  | "period"
  | "order_count"
  | "gross_amount"
  | "payout_amount"
  | "share_percent"
  | "created_at"
  | "paid_at"
  | "paid_to"
>;

export function toSettlement(r: SettlementRow): Settlement {
  return {
    id: r.id,
    instructorId: r.instructor_id,
    period: r.period,
    orderCount: r.order_count,
    gross: r.gross_amount,
    payout: r.payout_amount,
    sharePercent: r.share_percent,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    paidTo: r.paid_to,
  };
}

export function toAccount(
  r: Pick<Tables<"instructor_payout_accounts">, "bank" | "account_number" | "holder" | "updated_at"> | null,
): PayoutAccount | null {
  return r ? { bank: r.bank, accountNumber: r.account_number, holder: r.holder, updatedAt: r.updated_at } : null;
}

/** 결제 목록을 시험 전/후로 나눠 합친다. examDate는 YYYY-MM-DD */
export function splitUnsettled(rows: { amount: number; examDate: string }[], today = kstToday()): Unsettled {
  const sum = (list: { amount: number }[]) => {
    const gross = list.reduce((s, o) => s + o.amount, 0);
    return { count: list.length, gross, payout: instructorShare(gross) };
  };
  return {
    ready: sum(rows.filter((o) => o.examDate < today)),
    waiting: sum(rows.filter((o) => o.examDate >= today)),
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

export type MySettlements = {
  account: PayoutAccount | null;
  settlements: Settlement[];
  /** 서버 키가 없으면(로컬 개발) null */
  unsettled: Unsettled | null;
};

/** 강사 센터: 내 계좌, 정산 내역, 아직 정산하지 않은 금액. instructorId는 세션에서 찾은 내 강사 id만 넘긴다 */
export async function getMySettlements(instructorId: string): Promise<MySettlements> {
  const sb = await createServerSupabase();
  const [accRes, setRes] = await Promise.all([
    sb.from("instructor_payout_accounts").select("bank, account_number, holder, updated_at").eq("instructor_id", instructorId).maybeSingle(),
    sb.from("settlements").select(SETTLEMENT_SELECT).eq("instructor_id", instructorId).order("created_at", { ascending: false }).limit(60),
  ]);
  if (accRes.error) fail("정산 계좌", accRes.error);
  if (setRes.error) fail("정산 내역", setRes.error);

  // 강사는 구매자 주문을 직접 못 읽는다(RLS). 금액 합계만 서버 키로 읽어서 넘긴다
  let unsettled: Unsettled | null = null;
  const service = createServiceSupabase();
  if (service) {
    const { data, error } = await service
      .from("orders")
      .select("amount, lecture:lectures!inner(instructor_id, course:courses!inner(exam_date))")
      .eq("status", "paid")
      .is("settlement_id", null)
      .eq("lecture.instructor_id", instructorId)
      .overrideTypes<{ amount: number; lecture: { instructor_id: string; course: { exam_date: string } } }[], { merge: false }>();
    if (error) fail("정산 예정 금액", error);
    unsettled = splitUnsettled(data.map((o) => ({ amount: o.amount, examDate: o.lecture.course.exam_date })));
  }

  return { account: toAccount(accRes.data), settlements: setRes.data.map(toSettlement), unsettled };
}

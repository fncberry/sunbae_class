import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  adminCounts,
  listRefundsAfterSettlement,
  listSettleCandidates,
  listSettlements,
  type AdminSettlement,
  type Applicant,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { INSTRUCTOR_SHARE_PERCENT, koDateOf, periodLabel, won } from "@/lib/format";
import type { PayoutAccount } from "@/lib/settlements";
import { cancelSettlement, createSettlement, markSettlementPaid } from "../actions";
import { adminNav } from "../nav";
import { SettleButton } from "./SettleButton";

export const metadata: Metadata = { title: "선배클래스", robots: { index: false } };

export default function AdminSettlementsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AdminSettlements />
    </Suspense>
  );
}

async function AdminSettlements() {
  await requireAdmin("/admin/settlements");
  const [candidates, unpaid, paid, refunds, counts] = await Promise.all([
    listSettleCandidates(),
    listSettlements(false),
    listSettlements(true),
    listRefundsAfterSettlement(),
    adminCounts(),
  ]);

  return (
    <DashboardShell area="운영자" nav={adminNav("settlements", counts)}>
      <div className="max-w-5xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">정산</h1>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">
          강사 몫은 결제 금액의 {INSTRUCTOR_SHARE_PERCENT}%예요. 시험일이 지난 결제만 정산할 수 있어요. 계좌이체를 마친 뒤 지급 완료를 눌러 주세요.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">정산할 금액</h2>
          {candidates.length === 0 ? (
            <p className="mt-3 text-ink-soft">정산할 결제가 없어요.</p>
          ) : (
            <ul className="mt-4 border-t border-ink">
              {candidates.map((c) => (
                <li key={c.instructor.instructorId} className="grid gap-3 border-b border-rule py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0 text-sm">
                    <Person who={c.instructor} />
                    <p className="mt-2">
                      결제 {c.orderCount}건 · 판매 {won(c.gross)} · <span className="font-semibold">보낼 금액 {won(c.payout)}</span>
                    </p>
                    <Account account={c.account} />
                  </div>
                  <SettleButton action={createSettlement} id={c.instructor.instructorId} label="정산 만들기" primary />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-16">
          <h2 className="text-lg font-semibold">지급 대기 {unpaid.length}건</h2>
          {unpaid.length === 0 ? (
            <p className="mt-3 text-ink-soft">보낼 정산이 없어요.</p>
          ) : (
            <ul className="mt-4 border-t border-ink">
              {unpaid.map((s) => (
                <UnpaidItem key={s.id} settlement={s} />
              ))}
            </ul>
          )}
        </section>

        {refunds.length > 0 && (
          <section className="mt-16">
            <h2 className="text-lg font-semibold">정산 뒤 환불된 결제 {refunds.length}건</h2>
            <p className="mt-1 text-sm text-ink-soft">이미 보낸 정산이면 다음에 보낼 금액에서 강사 몫만큼 빼야 해요.</p>
            <ul className="mt-4 border-t border-rule text-sm">
              {refunds.map((r) => (
                <li key={r.orderId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-3">
                  <span>
                    {r.title} · {won(r.amount)} · {r.instructor.nickname}
                  </span>
                  <span className="text-ink-soft">
                    {periodLabel(r.period)} 정산 {r.settlementPaid ? "(지급함)" : "(지급 전)"}
                    {r.refundedAt && ` · ${koDateOf(r.refundedAt)} 환불`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16">
          <h2 className="text-lg font-semibold">지급 완료</h2>
          {paid.length === 0 ? (
            <p className="mt-3 text-ink-soft">아직 보낸 정산이 없어요.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-ink-soft">
                <tr className="border-b border-ink">
                  <th className="py-2.5 font-normal">강사</th>
                  <th className="py-2.5 font-normal">정산 달</th>
                  <th className="py-2.5 text-right font-normal">보낸 금액</th>
                  <th className="py-2.5 pl-6 font-normal">보낸 날</th>
                  <th className="py-2.5 pl-6 font-normal">계좌</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((s) => (
                  <tr key={s.id} className="border-b border-rule align-top">
                    <td className="py-3">{s.instructor.nickname}</td>
                    <td className="py-3">{periodLabel(s.period)}</td>
                    <td className="py-3 text-right">{won(s.payout)}</td>
                    <td className="py-3 pl-6">{s.paidAt && koDateOf(s.paidAt)}</td>
                    <td className="py-3 pl-6 text-ink-soft">{s.paidTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function UnpaidItem({ settlement: s }: { settlement: AdminSettlement }) {
  return (
    <li className="grid gap-3 border-b border-rule py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0 text-sm">
        <Person who={s.instructor} />
        <p className="mt-2">
          {periodLabel(s.period)} 정산 · 결제 {s.orderCount}건 · 판매 {won(s.gross)} ·{" "}
          <span className="font-semibold">보낼 금액 {won(s.payout)}</span>
        </p>
        <Account account={s.account} />
        {s.refundedCount > 0 && (
          <p className="mt-2 font-semibold">정산에 담은 뒤 환불된 결제가 {s.refundedCount}건 있어요. 취소하고 다시 만들어 주세요.</p>
        )}
      </div>
      <div className="flex gap-2">
        <SettleButton action={cancelSettlement} id={s.id} label="취소" confirmText="이 정산을 취소할까요? 담긴 결제는 다시 정산 대기로 돌아가요." />
        <SettleButton
          action={markSettlementPaid}
          id={s.id}
          label="지급 완료"
          primary
          confirmText={`${s.instructor.nickname}님에게 ${won(s.payout)} 계좌이체를 마쳤나요?`}
        />
      </div>
    </li>
  );
}

function Person({ who }: { who: Applicant }) {
  return (
    <p>
      <span className="font-semibold">{who.nickname}</span>
      <span className="ml-2 text-ink-soft">
        {who.name ?? "이름 없음"} · {who.studentId ?? "학번 없음"} · {who.major}
      </span>
    </p>
  );
}

function Account({ account }: { account: PayoutAccount | null }) {
  return account ? (
    <p className="mt-1 text-ink-soft">
      {account.bank} {account.accountNumber} {account.holder}
    </p>
  ) : (
    <p className="mt-1 font-semibold">계좌 없음</p>
  );
}

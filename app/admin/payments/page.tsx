import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { adminCounts, listLinkLectures, listPaymentIssues, type PaymentIssue } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { OPTION_LABEL, koDate, koDateOf, won } from "@/lib/format";
import { resolvePaymentIssue } from "../actions";
import { adminNav } from "../nav";
import { CheckoutLinkForm } from "./CheckoutLinkForm";

export const metadata: Metadata = { title: "선배클래스", robots: { index: false } };

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AdminPayments />
    </Suspense>
  );
}

const TYPE_LABEL: Record<string, string> = {
  "payment.completed": "결제",
  "payment.cancel_requested": "환불 요청",
  "payment.refunded": "환불",
};

const STATUS_LABEL = { pending: "결제 대기", paid: "결제 완료", refunded: "환불됨", cancelled: "취소됨" } as const;

async function AdminPayments() {
  await requireAdmin("/admin/payments");
  const [issues, lectures, counts] = await Promise.all([listPaymentIssues(), listLinkLectures(), adminCounts()]);

  return (
    <DashboardShell area="운영자" nav={adminNav("payments", counts)}>
      <div className="max-w-5xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">결제</h1>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">확인할 결제 {issues.length}건</h2>
          {issues.length === 0 ? (
            <p className="mt-3 text-ink-soft">확인할 결제가 없어요.</p>
          ) : (
            <ul className="mt-4 border-t border-ink">
              {issues.map((e) => (
                <IssueItem key={e.id} issue={e} />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-16">
          <h2 className="text-lg font-semibold">결제창 링크</h2>
          {lectures.length === 0 ? (
            <p className="mt-3 text-ink-soft">판매 중인 강의가 없어요.</p>
          ) : (
            <ul className="mt-4 border-t border-ink">
              {lectures.map((l) => (
                <CheckoutLinkForm key={l.id} lecture={l} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function IssueItem({ issue: e }: { issue: PaymentIssue }) {
  const o = e.order;
  const ratio = o && o.chapterCount > 0 ? o.completedCount / o.chapterCount : 0;

  return (
    <li className="grid gap-3 border-b border-rule py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0 text-sm">
        <p>
          <span className="font-semibold">{TYPE_LABEL[e.type] ?? e.type}</span>
          <span className="ml-2 text-ink-faint">{koDateOf(e.receivedAt)}</span>
        </p>
        {e.note && <p className="mt-1">{e.note}</p>}
        {o ? (
          <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-ink-soft">
            <dt>강의</dt>
            <dd className="text-ink">
              {o.title} · {OPTION_LABEL[o.option]} · {won(o.amount)}
            </dd>
            <dt>구매자</dt>
            <dd className="text-ink">
              {o.buyer.name ?? "이름 없음"} ({o.buyer.studentId ?? "학번 없음"}), {o.buyer.nickname ?? "닉네임 없음"}
            </dd>
            <dt>진도</dt>
            <dd className={ratio >= 0.3 ? "font-semibold text-ink" : "text-ink"}>
              {o.chapterCount}강 중 {o.completedCount}강 ({Math.round(ratio * 100)}%)
            </dd>
            <dt>환불 기한</dt>
            <dd className="text-ink">
              {koDate(o.examDate)} {o.examLabel}까지
            </dd>
            <dt>주문 상태</dt>
            <dd className="text-ink">{STATUS_LABEL[o.status]}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-ink-soft">연결된 주문이 없어요. 그로블 결제번호: {e.merchantUid ?? "없음"}</p>
        )}
      </div>
      <form action={resolvePaymentIssue}>
        <input type="hidden" name="id" value={e.id} />
        <button type="submit" className="rounded-ui border border-ink-faint px-4 py-2 text-sm hover:border-ink">
          확인했어요
        </button>
      </form>
    </li>
  );
}

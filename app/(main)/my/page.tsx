import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { OPTION_LABEL, courseLabel, koDateOf, won } from "@/lib/format";
import { listMyEnrollments, listMyOrders, type MyOrder } from "@/lib/learning";

export const metadata: Metadata = { title: "내 강의 | 선배클래스", robots: { index: false } };

export default function MyPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <h1 className="font-serif text-[34px] font-bold leading-[1.3]">내 강의</h1>
      <Suspense fallback={<div className="mt-10 h-64 rounded-ui bg-wash" aria-busy="true" />}>
        <MyContent />
      </Suspense>
    </div>
  );
}

async function MyContent() {
  const user = await requireUser("/my");
  const [enrollments, orders] = await Promise.all([listMyEnrollments(user), listMyOrders(user)]);

  return (
    <>
      {enrollments.length === 0 ? (
        <p className="mt-8 text-ink-soft">
          아직 수강 중인 강의가 없어요.{" "}
          <Link href="/courses" className="font-medium text-ink underline underline-offset-4">
            과목 찾기
          </Link>
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {enrollments.map((e) => {
            const ratio = e.chapterCount ? e.completedCount / e.chapterCount : 0;
            return (
              <li key={e.lectureId} className="rounded-ui border border-rule p-5">
                <p className="text-sm text-ink-soft">{courseLabel(e.course)}</p>
                <Link href={`/watch/${e.lectureId}`} className="mt-1 block font-serif text-lg font-bold underline-offset-4 hover:underline">
                  {e.title}
                </Link>
                <p className="mt-3 text-sm">
                  {e.chapterCount}강 중 {e.completedCount}강 다 봤어요
                  <span className="text-ink-faint"> · {OPTION_LABEL[e.option]}</span>
                </p>
                <div className="mt-2 h-[3px] bg-rule">
                  <div className="h-full bg-ink" style={{ width: `${ratio * 100}%` }} />
                </div>
                <Link
                  href={`/watch/${e.lectureId}`}
                  className="mt-4 inline-block rounded-ui bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85"
                >
                  이어서 보기
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-16 font-serif text-2xl font-bold">결제 내역</h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-ink-soft">결제 내역이 없어요.</p>
      ) : (
        <ul className="mt-4 border-t border-rule">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-4 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{o.title ?? "판매가 끝난 강의"}</span>
                <span className="text-ink-faint">
                  {koDateOf(o.createdAt)} · {OPTION_LABEL[o.option]}
                </span>
              </span>
              <span className="shrink-0">{won(o.amount)}</span>
              <span className="w-24 shrink-0 text-right">
                <OrderStatus order={o} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OrderStatus({ order }: { order: MyOrder }) {
  if (order.status === "pending") {
    return (
      <Link href={`/checkout/${order.id}`} className="font-medium underline underline-offset-4">
        결제 대기
      </Link>
    );
  }
  const label = { paid: "결제 완료", refunded: "환불", cancelled: "취소" }[order.status];
  return <span className="text-ink-soft">{label}</span>;
}

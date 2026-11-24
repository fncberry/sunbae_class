import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLecture } from "@/lib/data";
import { OPTION_LABEL, koDate, koDateOf, won } from "@/lib/format";
import { getCheckoutLink, grobleCheckoutUrl } from "@/lib/groble";
import { getMyOrder } from "@/lib/learning";

export const metadata: Metadata = { title: "결제 | 선배클래스", robots: { index: false } };

export default function CheckoutPage(props: PageProps<"/checkout/[orderId]">) {
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-16">
      <Suspense fallback={<div className="h-80" aria-busy="true" />}>
        <CheckoutContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function CheckoutContent({ params }: { params: PageProps<"/checkout/[orderId]">["params"] }) {
  const { orderId } = await params;
  const user = await requireUser(`/checkout/${orderId}`);
  const order = await getMyOrder(user, orderId);
  if (!order) notFound();

  const [lecture, link] = await Promise.all([
    order.title ? getLecture(order.lectureId) : null,
    order.status === "pending" ? getCheckoutLink(order.lectureId, order.option) : null,
  ]);
  const payUrl = link ? grobleCheckoutUrl(link, order.id) : null;

  return (
    <>
      <h1 className="font-serif text-[30px] font-bold leading-[1.3]">{HEADING[order.status]}</h1>

      <dl className="mt-8 grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-3 border-y border-rule py-5 text-sm">
        <dt className="text-ink-faint">강의</dt>
        <dd>
          {order.title ? (
            <Link href={`/lectures/${order.lectureId}`} className="underline-offset-4 hover:underline">
              {order.title}
            </Link>
          ) : (
            "판매가 끝난 강의"
          )}
        </dd>
        <dt className="text-ink-faint">구매 방식</dt>
        <dd>{OPTION_LABEL[order.option]}</dd>
        <dt className="text-ink-faint">금액</dt>
        <dd className="font-semibold">{won(order.amount)}</dd>
        <dt className="text-ink-faint">주문일</dt>
        <dd>{koDateOf(order.createdAt)}</dd>
      </dl>

      {order.status === "pending" &&
        (payUrl ? (
          <>
            <a
              href={payUrl}
              className="mt-8 block w-full rounded-ui bg-pen py-3.5 text-center font-semibold text-paper hover:bg-pen-dark"
            >
              그로블에서 {won(order.amount)} 결제하기
            </a>
            <p className="mt-3 text-center text-sm text-ink-soft">결제가 끝나면 내 강의에서 바로 볼 수 있어요.</p>
          </>
        ) : (
          <p role="status" className="mt-8 rounded-ui bg-wash px-4 py-3 text-sm">
            아직 결제를 받을 수 없어요.
          </p>
        ))}

      {order.status === "paid" && (
        <Link
          href={`/watch/${order.lectureId}`}
          className="mt-8 block w-full rounded-ui bg-ink py-3.5 text-center font-semibold text-paper hover:bg-ink/85"
        >
          강의 보러 가기
        </Link>
      )}

      {lecture && order.status !== "refunded" && order.status !== "cancelled" && (
        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          {koDate(lecture.course.examDate)} {lecture.course.examLabel} 당일까지, 30% 미만으로 들었다면 전액 환불돼요.
        </p>
      )}

      <Link href="/my" className="mt-10 inline-block text-sm text-ink-soft underline underline-offset-4">
        내 강의와 결제 내역
      </Link>
    </>
  );
}

const HEADING = {
  pending: "결제하기",
  paid: "결제가 끝났어요",
  refunded: "환불된 주문이에요",
  cancelled: "취소된 주문이에요",
} as const;

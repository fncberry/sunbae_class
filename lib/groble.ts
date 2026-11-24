// 그로블 결제 링크. 서버 환경 변수 GROBLE_CHECKOUT_URL에 템플릿을 넣는다.
// 예: https://groble.example/checkout?ref={orderId}&item={lectureId}-{option}
// 쓸 수 있는 자리: {orderId} {lectureId} {option} {amount}. 값은 URL 인코딩해서 넣는다.
// 결제 완료·환불은 5단계 웹훅(app/api/webhooks/groble)이 orders·enrollments에 반영한다.

import "server-only";

export type CheckoutTarget = { id: string; lectureId: string; option: "video" | "study"; amount: number };

/** 결제 링크. 템플릿이 없거나 https 주소가 아니면 null(결제를 받을 수 없는 상태). */
export function grobleCheckoutUrl(order: CheckoutTarget): string | null {
  const template = process.env.GROBLE_CHECKOUT_URL?.trim();
  if (!template) return null;

  const filled = template
    .replaceAll("{orderId}", encodeURIComponent(order.id))
    .replaceAll("{lectureId}", encodeURIComponent(order.lectureId))
    .replaceAll("{option}", encodeURIComponent(order.option))
    .replaceAll("{amount}", encodeURIComponent(String(order.amount)));

  try {
    const url = new URL(filled);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

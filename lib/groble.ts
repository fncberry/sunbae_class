// 그로블 결제창 + 웹훅
// 가이드: https://www.groble.im/help/guides/webhook, https://www.groble.im/help/guides/payment-window
//
// - 결제창 링크는 강의·구매 방식마다 운영자가 등록한다(lecture_checkout_links).
// - 링크 뒤에 ?ref=<주문 id>를 붙이면 결제 완료 웹훅의 sellerReference로 돌아온다.
// - 웹훅(app/api/webhooks/groble)은 서명을 확인하고 payment_events에 넣는다. 반영은 DB 트리거가 한다.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerSupabase } from "./supabase/server";

type Option = "video" | "study";

/** 결제창 링크에 우리 주문번호를 붙인다. 그로블 주소가 아니면 null(결제를 받을 수 없는 상태). */
export function grobleCheckoutUrl(link: string, orderId: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || !/^(www\.)?groble\.im$/.test(url.hostname)) return null;
    url.searchParams.set("ref", orderId);
    return url.toString();
  } catch {
    return null;
  }
}

/** 운영자가 등록한 결제창 링크 (로그인한 사용자만 읽을 수 있다) */
export async function getCheckoutLink(lectureId: string, option: Option): Promise<string | null> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lecture_checkout_links")
    .select("url")
    .eq("lecture_id", lectureId)
    .eq("option", option)
    .maybeSingle();
  if (error) throw new Error(`결제창 링크 조회 실패: ${error.message}`);
  return data?.url ?? null;
}

/** 서명 허용 범위(초). 가이드: ±5분 */
const TOLERANCE_SECONDS = 300;

/**
 * 웹훅 서명 확인: HEX(HMAC-SHA256(secret, "{timestamp}.{raw_body}")).
 * 시크릿을 다시 발급한 뒤 24시간은 X-Groble-Signature-Previous(이전 시크릿 서명)도 온다.
 */
export function verifyGrobleSignature(
  secret: string,
  rawBody: Buffer,
  timestamp: string | null,
  signatures: (string | null)[],
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]))
    .digest();

  return signatures.some((sig) => {
    const hex = sig?.trim();
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) return false;
    return timingSafeEqual(Buffer.from(hex, "hex"), expected);
  });
}

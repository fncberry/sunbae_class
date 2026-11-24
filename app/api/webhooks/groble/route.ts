// 그로블 웹훅: 서명 확인 → payment_events에 기록. 주문·수강권 반영은 DB 트리거(private.apply_payment_event)가 한다.
//
// 응답 코드에 따른 그로블 동작(가이드 기준)
// - 2xx: 끝. 다시 보내지 않는다
// - 401·400: 최종 실패. 다시 보내지 않는다
// - 500~504: 1분·5분·30분·2시간·6시간·12시간·24시간 뒤 다시 보낸다
// 그래서 설정이 빠졌거나 DB가 잠깐 안 될 때는 503·500으로 답해 재전송을 받는다.

import { revalidateTag } from "next/cache";
import { verifyGrobleSignature } from "@/lib/groble";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

export async function POST(req: Request) {
  const secret = process.env.GROBLE_WEBHOOK_SECRET?.trim();
  const sb = createServiceSupabase();
  if (!secret || !sb) {
    console.error("[groble] GROBLE_WEBHOOK_SECRET 또는 SUPABASE_SECRET_KEY가 없어요");
    return Response.json({ ok: false }, { status: 503 });
  }

  const raw = Buffer.from(await req.arrayBuffer());
  const signed = verifyGrobleSignature(secret, raw, req.headers.get("x-groble-timestamp"), [
    req.headers.get("x-groble-signature"),
    req.headers.get("x-groble-signature-previous"),
  ]);
  if (!signed) return Response.json({ ok: false, error: "bad signature" }, { status: 401 });

  let body: { id?: unknown; type?: unknown };
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const type = typeof body?.type === "string" ? body.type : "";
  const key = (req.headers.get("x-groble-idempotency-key") ?? (typeof body.id === "string" ? body.id : "")).trim().slice(0, 200);
  if (!type || !key) return Response.json({ ok: false, error: "missing id or type" }, { status: 400 });

  const { data, error } = await sb
    .from("payment_events")
    .insert({ id: key, type, payload: body as Json })
    .select("result, order_id")
    .single();

  if (error) {
    // 같은 전송을 이미 받았다
    if (error.code === "23505") return Response.json({ ok: true, result: "duplicate" });
    console.error("[groble] 기록 실패", type, error.code, error.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  if (data.result === "needs_review") console.warn("[groble] 운영자 확인 필요", type, key, data.order_id);
  // 판매 수·스터디반 인원이 바뀌었다
  if (data.result === "applied") revalidateTag("catalog", "max");

  return Response.json({ ok: true, result: data.result });
}

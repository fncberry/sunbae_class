// 성적 캡처 열기: 운영자만. 누를 때마다 5분짜리 서명 URL을 새로 만들어 넘긴다.
// 페이지에 URL을 미리 박아 두면 화면을 오래 열어 둘 때 만료되고, 링크가 기록에 남는다.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/verification";

const SIGNED_URL_SECONDS = 5 * 60;

export async function GET(_req: Request, ctx: RouteContext<"/admin/proofs/[verificationId]">) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new NextResponse(null, { status: 404 });

  const { verificationId } = await ctx.params;
  const sb = await createServerSupabase();
  const { data } = await sb.from("grade_verifications").select("proof_path").eq("id", verificationId).maybeSingle();
  if (!data?.proof_path) {
    return new NextResponse("캡처가 없어요. 이미 처리돼서 지워졌을 수 있어요.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const signed = await sb.storage.from(PROOF_BUCKET).createSignedUrl(data.proof_path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) {
    console.error("[admin] signed url", verificationId, signed.error?.message);
    return new NextResponse("캡처를 열지 못했어요.", { status: 502, headers: { "cache-control": "no-store" } });
  }

  const res = NextResponse.redirect(signed.data.signedUrl, 302);
  res.headers.set("cache-control", "no-store");
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}

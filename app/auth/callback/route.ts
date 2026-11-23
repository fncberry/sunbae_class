// 로그인 메일 링크가 돌아오는 곳. 세션 쿠키를 만들고 원래 가려던 화면으로 보낸다.
// - ?code=...                : 기본 메일 템플릿 (PKCE)
// - ?token_hash=...&type=... : 메일 템플릿을 token_hash 방식으로 바꿨을 때

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerSupabase();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("[auth/callback] exchangeCodeForSession", error.code, error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.error("[auth/callback] verifyOtp", error.code, error.message);
  }

  if (!ok) {
    return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}

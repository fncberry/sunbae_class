// 구글 로그인 뒤 Supabase가 돌려보내는 곳. 세션 쿠키를 만들고 원래 가려던 화면으로 보낸다.
// - 성공: ?code=...  (PKCE)
// - 실패: ?error=...&error_description=...
//   학교 메일이 아니면 DB 트리거가 가입을 막고, Supabase는 "Database error saving new user"를 돌려준다.

import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const toLogin = (error: "domain" | "cancelled" | "failed") =>
    NextResponse.redirect(new URL(`/login?error=${error}&next=${encodeURIComponent(next)}`, origin));

  const oauthError = searchParams.get("error");
  if (oauthError) {
    const description = searchParams.get("error_description") ?? "";
    console.error("[auth/callback]", oauthError, searchParams.get("error_code"), description);
    if (oauthError === "access_denied") return toLogin("cancelled");
    if (/database error saving new user/i.test(description)) return toLogin("domain");
    return toLogin("failed");
  }

  const code = searchParams.get("code");
  if (!code) return toLogin("failed");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession", error.code, error.message);
    return toLogin("failed");
  }
  return NextResponse.redirect(new URL(next, origin));
}

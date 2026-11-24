// 모든 요청 전에 실행: Supabase 세션 쿠키를 갱신하고, 로그인이 필요한 경로는 빠르게 로그인 페이지로 보낸다.
// 여기서의 확인은 1차일 뿐이다. 실제 권한 검사는 lib/auth.ts를 거치는 페이지·서버 액션에서 한다.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = ["/instructor", "/admin", "/watch", "/onboarding", "/my", "/checkout"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // 세션 쿠키를 내보내는 응답은 CDN에 캐시되면 안 된다
        for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  // 만료된 토큰을 갱신한다. getClaims와 응답 사이에 다른 코드를 넣지 않는다.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 파일·이미지·폰트, 외부 웹훅(세션 없음)은 건너뛴다
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

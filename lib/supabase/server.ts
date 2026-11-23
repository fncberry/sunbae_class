// 로그인한 사용자 기준 Supabase 클라이언트 (서버 컴포넌트·서버 액션·라우트 핸들러용).
// 요청마다 새로 만든다. 쿠키를 읽으므로 "use cache" 안에서는 쓸 수 없고, <Suspense> 안에서 써야 한다.

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가 맡으므로 무시해도 된다.
        }
      },
    },
  });
}

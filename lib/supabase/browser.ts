// 브라우저에서 쓰는 Supabase 클라이언트. 로그인 세션 쿠키를 그대로 쓰므로 RLS가 본인 권한으로 적용된다.
// 서버 액션은 요청 본문이 1MB로 제한돼서, 성적 캡처(최대 10MB)는 브라우저가 Storage에 바로 올린다.

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경 변수가 없어요.");
  client = createBrowserClient<Database>(url, key);
  return client;
}

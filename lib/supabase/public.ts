// 로그인과 무관한 공개 데이터 조회용 Supabase 클라이언트 (서버 전용).
// 쿠키·세션을 쓰지 않아서 "use cache" 함수 안에서 써도 된다. 권한은 anon 역할의 RLS를 따른다.
// 로그인한 사용자 기준 조회는 3단계에서 @supabase/ssr 서버 클라이언트로 따로 만든다.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | null = null;

export function publicSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 없어요. .env.example을 .env.local로 복사해서 채워 주세요.",
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

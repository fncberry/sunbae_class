// 로그인과 무관한 공개 데이터 조회용 Supabase 클라이언트 (서버 전용).
// 쿠키·세션을 쓰지 않아서 "use cache" 함수 안에서 써도 된다. 권한은 anon 역할의 RLS를 따른다.
// 로그인한 사용자 기준 조회는 ./server.ts의 createServerSupabase()를 쓴다.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

let client: SupabaseClient<Database> | null = null;

export function publicSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const { url, key } = supabaseEnv();
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

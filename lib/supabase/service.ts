// 서버 전용 Supabase 클라이언트 (secret 키, RLS를 거치지 않는다).
// 그로블 웹훅처럼 로그인한 사용자가 없는 서버 작업에서만 쓴다. 절대 클라이언트 코드에서 import하지 않는다.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** SUPABASE_SECRET_KEY가 없으면 null */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

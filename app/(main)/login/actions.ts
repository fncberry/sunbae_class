"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SCHOOL_EMAIL_DOMAIN, safeNextPath } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 고려대 구글 계정으로 로그인. 처음이면 계정이 만들어진다.
 * 고려대 메일은 Google Workspace라 @korea.ac.kr 계정이 곧 구글 계정이다.
 * 다른 도메인은 DB 트리거(private.enforce_school_email)가 가입을 막는다. hd는 계정 선택 화면 힌트일 뿐.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { hd: SCHOOL_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    console.error("[login] signInWithOAuth", error?.status, error?.code, error?.message);
    redirect(`/login?error=failed&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

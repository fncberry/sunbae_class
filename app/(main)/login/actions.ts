"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SCHOOL_EMAIL_DOMAIN, safeNextPath } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const SCHOOL_EMAIL = new RegExp(`^[^\\s@]+@${SCHOOL_EMAIL_DOMAIN.replaceAll(".", "\\.")}$`);

/** 학교 메일로 로그인 링크 보내기. 처음이면 계정이 만들어진다. */
export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(formData.get("next"));

  if (!SCHOOL_EMAIL.test(email)) {
    return { status: "error", email, message: `@${SCHOOL_EMAIL_DOMAIN} 메일 주소를 적어 주세요.` };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error("[login] signInWithOtp", error.status, error.code, error.message);
    return { status: "error", email, message: loginErrorMessage(error) };
  }
  return { status: "sent", email };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function loginErrorMessage(error: { status?: number; code?: string; message: string }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "메일을 너무 자주 보냈어요. 1분쯤 뒤에 다시 시도해 주세요.";
  }
  if (error.code === "email_address_not_authorized") {
    return "지금은 메일을 보낼 수 없어요. 운영진에게 알려 주세요. (메일 발송 설정 필요)";
  }
  // DB 트리거(학교 메일 제한, check_violation 23514)에서 막힌 경우
  if (error.code === "23514" || error.message.includes("학교 이메일")) {
    return `@${SCHOOL_EMAIL_DOMAIN} 메일로만 가입할 수 있어요.`;
  }
  return "로그인 메일을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.";
}

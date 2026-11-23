// 로그인 상태 확인 (Data Access Layer). 권한 검사는 여기를 거친다.
// proxy.ts의 리다이렉트는 빠른 1차 확인일 뿐이고, 실제 검사는 페이지·서버 액션에서 이 함수들로 한다.

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import type { Enums } from "./database.types";

export const SCHOOL_EMAIL_DOMAIN = "korea.ac.kr";

export type CurrentUser = {
  id: string;
  email: string;
  role: Enums<"user_role">;
  studentId: string | null;
};

/** 로그인한 사용자. 없으면 null. 한 요청 안에서는 한 번만 조회한다. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabase();
  // getClaims는 JWT 서명을 검증한다 (쿠키 값을 그대로 믿지 않는다)
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, student_id")
    .eq("id", data.claims.sub)
    .maybeSingle();
  if (!profile) return null;

  return { id: profile.id, email: profile.email, role: profile.role, studentId: profile.student_id };
});

/** 로그인이 필요한 화면. 로그인 안 했으면 로그인 페이지로 보내고, 끝나면 nextPath로 돌아온다. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return user;
}

/** 운영자 전용 화면. 운영자가 아니면 화면이 있다는 것도 알리지 않는다(404). */
export async function requireAdmin(nextPath: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") notFound();
  return user;
}

/** 로그인 후 돌아갈 경로. 다른 사이트로 보내는 주소(//evil.com, /\evil.com)는 막는다. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

/** 워터마크·화면 표시용 학번. 학번을 아직 안 적었으면 메일 아이디를 쓴다. */
export function viewerLabel(user: CurrentUser): string {
  return user.studentId ?? user.email.split("@")[0];
}

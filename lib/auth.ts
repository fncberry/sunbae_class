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
  major: string | null;
  /** 실명. 본인·운영자만 */
  name: string | null;
  /** 서비스 안에서 보이는 이름 */
  nickname: string | null;
  /** 학번·학과·약관 동의를 마쳤는지 */
  onboarded: boolean;
};

/** 로그인한 사용자. 없으면 null. 한 요청 안에서는 한 번만 조회한다. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabase();
  // getClaims는 JWT 서명을 검증한다 (쿠키 값을 그대로 믿지 않는다)
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, student_id, major, name, nickname, onboarded_at")
    .eq("id", data.claims.sub)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    studentId: profile.student_id,
    major: profile.major,
    name: profile.name,
    nickname: profile.nickname,
    onboarded: profile.onboarded_at !== null,
  };
});

/** 로그인만 확인한다. 온보딩 화면처럼 온보딩 전에도 열려야 하는 곳에서 쓴다. */
export async function requireSignedIn(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return user;
}

/**
 * 로그인 + 온보딩이 필요한 화면. 로그인 안 했으면 로그인으로, 온보딩 전이면 온보딩으로 보내고,
 * 끝나면 nextPath로 돌아온다. (시청 워터마크에 학번이 필요하므로 온보딩 전에는 열지 않는다)
 */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await requireSignedIn(nextPath);
  if (!user.onboarded) redirect(onboardingPath(nextPath));
  return user;
}

export function onboardingPath(nextPath: string): string {
  return `/onboarding?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}

/** 운영자 전용 화면. 운영자가 아니면 화면이 있다는 것도 알리지 않는다(404). */
export async function requireAdmin(nextPath: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") notFound();
  return user;
}

const NEXT_BASE = "https://sunbae-class.invalid";

/**
 * 로그인 후 돌아갈 경로. 같은 사이트 안의 경로만 통과시킨다.
 * 브라우저와 같은 규칙으로 URL을 해석해서 비교하므로 //evil.com, /\evil.com, /%09/evil.com 같은 변형도 막는다.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(next, NEXT_BASE);
  } catch {
    return "/";
  }
  if (url.origin !== NEXT_BASE) return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  // 정리한 뒤에도 //로 시작하면 브라우저가 다른 호스트로 읽을 수 있다
  if (path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}

/** 워터마크·화면 표시용 학번. 학번을 아직 안 적었으면 메일 아이디를 쓴다. */
export function viewerLabel(user: CurrentUser): string {
  return user.studentId ?? user.email.split("@")[0];
}

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath, safeNextPath } from "@/lib/auth";
import { checkNickname, normalizeMajor, normalizeName, normalizeStudentId } from "@/lib/onboarding";
import { createServerSupabase } from "@/lib/supabase/server";

export type OnboardingField = "name" | "nickname" | "studentId" | "major" | "agree";
export type OnboardingValues = Record<Exclude<OnboardingField, "agree">, string>;

export type OnboardingState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: OnboardingField; values: OnboardingValues };

/** 이름·닉네임·학번·학과·동의 저장. 동의 시각과 완료 시각은 DB 트리거가 정한다. */
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const next = safeNextPath(formData.get("next"));
  const values: OnboardingValues = {
    name: String(formData.get("name") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    major: String(formData.get("major") ?? ""),
  };
  const fail = (message: string, field?: OnboardingField): OnboardingState => ({ status: "error", message, field, values });

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(onboardingPath(next))}`);
  if (user.onboarded) redirect(next);

  const name = normalizeName(values.name);
  if (!name) return fail("이름을 2자 이상 적어 주세요.", "name");
  const nick = checkNickname(values.nickname);
  if (!nick.ok) {
    return nick.reason === "reserved"
      ? fail("운영진이나 서비스로 오해할 수 있는 닉네임은 쓸 수 없어요.", "nickname")
      : fail("닉네임은 한글·영문·숫자·_·. 로 2~12자, 띄어쓰기 없이 적어 주세요.", "nickname");
  }
  const studentId = normalizeStudentId(values.studentId);
  if (!studentId) return fail("학번 10자리를 숫자로 적어 주세요. (예: 2024320001)", "studentId");
  const major = normalizeMajor(values.major);
  if (!major) return fail("학과 이름을 적어 주세요.", "major");
  if (formData.get("agree") !== "on") return fail("개인정보 수집·이용에 동의해야 시작할 수 있어요.", "agree");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      name,
      nickname: nick.nickname,
      student_id: studentId,
      major,
      terms_agreed_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("onboarded_at")
    .maybeSingle();

  if (error) {
    console.error("[onboarding] update profiles", error.code, error.message);
    if (error.code === "23505") {
      return error.message.includes("nickname")
        ? fail("이미 누가 쓰고 있는 닉네임이에요. 다른 닉네임을 적어 주세요.", "nickname")
        : fail("이미 다른 계정에 등록된 학번이에요. 본인 학번이 맞다면 운영진에게 알려 주세요.", "studentId");
    }
    if (error.code === "P0001") return fail(error.message, "studentId");
    if (error.code === "23514") return fail("입력한 값을 다시 확인해 주세요.");
    return fail("저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
  }
  if (!data?.onboarded_at) return fail("저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");

  // 헤더(레이아웃)는 화면을 옮겨도 다시 그려지지 않으므로, 닉네임이 바로 보이게 새로 받아온다
  refresh();
  redirect(next);
}

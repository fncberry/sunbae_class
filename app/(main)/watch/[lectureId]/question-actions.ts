"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { ANSWER_MAX, QUESTION_MAX } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";

export type QuestionState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; message: string; at: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "이 강의를 수강 중일 때만 쓸 수 있어요.";
  return fallback;
}

/** 질문하기. 작성자·표시 이름("학과 NN학번")·시각은 DB 트리거가 정한다. 수강생만(RLS). */
export async function askQuestion(_prev: QuestionState, formData: FormData): Promise<QuestionState> {
  const lectureId = String(formData.get("lectureId") ?? "");
  const chapterRaw = String(formData.get("chapterId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const fail = (message: string): QuestionState => ({ status: "error", message, at: Date.now() });

  const back = `/watch/${encodeURIComponent(lectureId)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!user.onboarded) redirect(onboardingPath(back));

  if (body.length === 0 || body.length > QUESTION_MAX) return fail(`질문은 1~${QUESTION_MAX}자로 적어 주세요.`);

  const sb = await createServerSupabase();
  const { error } = await sb.from("lecture_questions").insert({
    lecture_id: lectureId,
    chapter_id: UUID.test(chapterRaw) ? chapterRaw : null,
    body,
  } as Database["public"]["Tables"]["lecture_questions"]["Insert"]);
  if (error) {
    console.error("[question] ask", error.code, error.message);
    return fail(errorMessage(error, "질문을 올리지 못했어요. 잠시 뒤에 다시 시도해 주세요."));
  }

  refresh();
  return { status: "saved", at: Date.now() };
}

/** 답변하기·고치기. 강의 주인·운영자만(트리거). 답변자·시각은 DB가 정한다. */
export async function answerQuestion(_prev: QuestionState, formData: FormData): Promise<QuestionState> {
  const id = String(formData.get("id") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  const fail = (message: string): QuestionState => ({ status: "error", message, at: Date.now() });

  const user = await getCurrentUser();
  if (!user) return fail("로그인해 주세요.");
  if (!UUID.test(id)) return fail("질문을 찾지 못했어요.");
  if (answer.length === 0 || answer.length > ANSWER_MAX) return fail(`답변은 1~${ANSWER_MAX}자로 적어 주세요.`);

  const sb = await createServerSupabase();
  const { data, error } = await sb.from("lecture_questions").update({ answer }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    if (error) console.error("[question] answer", error.code, error.message);
    return fail(error ? errorMessage(error, "답변을 저장하지 못했어요.") : "이 강의의 선배만 답할 수 있어요.");
  }

  refresh();
  return { status: "saved", at: Date.now() };
}

/** 답변 전 내 질문 지우기 (RLS: 답변 전 작성자) */
export async function deleteQuestion(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const user = await getCurrentUser();
  if (!user) return;
  const sb = await createServerSupabase();
  const { error } = await sb.from("lecture_questions").delete().eq("id", id).eq("user_id", user.id);
  if (error) console.error("[question] delete", error.code, error.message);
  refresh();
}

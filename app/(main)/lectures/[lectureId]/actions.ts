"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { REVIEW_MAX } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";

export type ReviewState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; message: string; at: number };

/** 후기 쓰기·고치기. 작성자·표시 이름("학과 NN학번")·시각은 DB 트리거가 정한다. 수강생만(RLS). */
export async function saveReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const lectureId = String(formData.get("lectureId") ?? "");
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  const fail = (message: string): ReviewState => ({ status: "error", message, at: Date.now() });

  const back = `/lectures/${encodeURIComponent(lectureId)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!user.onboarded) redirect(onboardingPath(back));

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("별점을 골라 주세요.");
  if (body.length === 0 || body.length > REVIEW_MAX) return fail(`후기는 1~${REVIEW_MAX}자로 적어 주세요.`);

  const sb = await createServerSupabase();
  const existing = await sb
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("lecture_id", lectureId)
    .maybeSingle();

  const { error } = existing.data
    ? await sb.from("reviews").update({ rating, body }).eq("id", existing.data.id)
    : await sb
        .from("reviews")
        .insert({ lecture_id: lectureId, rating, body } as Database["public"]["Tables"]["reviews"]["Insert"]);

  if (error) {
    console.error("[review] save", error.code, error.message);
    if (error.code === "P0001") return fail(error.message);
    if (error.code === "42501") return fail("수강 중인 강의에만 후기를 쓸 수 있어요.");
    if (error.code === "23514") return fail(`후기는 1~${REVIEW_MAX}자로 적어 주세요.`);
    return fail("후기를 저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
  }

  updateTag("catalog");
  refresh();
  return { status: "saved", at: Date.now() };
}

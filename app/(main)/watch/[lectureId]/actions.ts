"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * "다 봤어요": 챕터를 완료로 기록한다. 수강 중인 강의만 기록된다(RLS).
 * 6단계에서 플레이어가 시청 시간(watched_seconds)을 기록하면 보조 기능으로 남긴다.
 */
export async function markChapterDone(formData: FormData) {
  const lectureId = String(formData.get("lectureId") ?? "");
  const chapterId = String(formData.get("chapterId") ?? "");
  const nextPosition = formData.get("nextPosition");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/watch/${lectureId}`)}`);

  const sb = await createServerSupabase();
  const { error } = await sb
    .from("chapter_progress")
    .upsert(
      { user_id: user.id, chapter_id: chapterId, completed: true, updated_at: new Date().toISOString() },
      { onConflict: "user_id,chapter_id" },
    );
  if (error) {
    console.error("[watch] mark done", error.code, error.message);
    refresh();
    return;
  }

  if (typeof nextPosition === "string" && /^\d+$/.test(nextPosition)) {
    redirect(`/watch/${encodeURIComponent(lectureId)}?c=${nextPosition}`);
  }
  refresh();
}

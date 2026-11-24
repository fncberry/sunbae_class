"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createServerSupabase } from "@/lib/supabase/server";

export type CheckoutState = { status: "idle" } | { status: "error"; message: string; at: number };

const REUSE_PENDING_MS = 24 * 60 * 60 * 1000;

/**
 * 결제 버튼. pending 주문을 만들고(금액·주문자는 DB 트리거가 정한다) 결제 화면으로 보낸다.
 * 24시간 안에 만든 같은 강의·같은 방식의 pending 주문이 있으면 그 주문을 다시 쓴다.
 */
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const lectureId = String(formData.get("lectureId") ?? "");
  const option = formData.get("option") === "study" ? "study" : "video";
  const back = `/lectures/${encodeURIComponent(lectureId)}`;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!user.onboarded) redirect(onboardingPath(back));

  const sb = await createServerSupabase();
  const since = new Date(Date.now() - REUSE_PENDING_MS).toISOString();
  const reuse = await sb
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("lecture_id", lectureId)
    .eq("option", option)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reuse.data) redirect(`/checkout/${reuse.data.id}`);

  // 금액·주문자·상태는 트리거가 채우고 클라이언트에는 쓰기 권한도 없으므로 보내지 않는다 (생성 타입은 트리거를 모른다)
  const created = await sb
    .from("orders")
    .insert({ lecture_id: lectureId, option } as Database["public"]["Tables"]["orders"]["Insert"])
    .select("id")
    .single();
  if (created.error) {
    console.error("[checkout] insert orders", created.error.code, created.error.message);
    const message =
      created.error.code === "P0001" ? created.error.message : "주문을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.";
    return { status: "error", message, at: Date.now() };
  }
  redirect(`/checkout/${created.data.id}`);
}

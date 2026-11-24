"use client";

import { useActionState } from "react";
import type { LinkLecture } from "@/lib/admin";
import { courseShortLabel, won } from "@/lib/format";
import { saveCheckoutLinks, type LinkState } from "../actions";

export function CheckoutLinkForm({ lecture: l }: { lecture: LinkLecture }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(saveCheckoutLinks, { status: "idle" });
  const missing = !l.links.video || (l.studyPrice !== null && !l.links.study);

  return (
    <li className="border-b border-rule py-5">
      <p className="text-sm text-ink-soft">
        {courseShortLabel(l.course)}
        {l.status === "reviewing" && <span className="ml-2 text-ink-faint">검수 중</span>}
      </p>
      <h3 className="mt-1 font-semibold">
        {l.title}
        {missing && <span className="ml-2 rounded-ui bg-wash px-1.5 py-0.5 text-xs font-medium">결제창 없음</span>}
      </h3>

      <form action={action} className="mt-3 grid max-w-3xl gap-3">
        <input type="hidden" name="lectureId" value={l.id} />
        <LinkField name="video" label={`영상 강의 ${won(l.price)}`} value={l.links.video} />
        {l.studyPrice !== null && <LinkField name="study" label={`스터디반 ${won(l.studyPrice)}`} value={l.links.study} />}
        <div className="flex items-center gap-3 text-sm">
          <button
            type="submit"
            disabled={pending}
            className="rounded-ui bg-ink px-4 py-2 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
          >
            저장
          </button>
          {state.status === "saved" && <span className="text-ink-soft">저장했어요.</span>}
          {state.status === "error" && (
            <span role="alert" className="text-pen">
              {state.message}
            </span>
          )}
        </div>
      </form>
    </li>
  );
}

function LinkField({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <label className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr] sm:items-center">
      <span className="text-ink-soft">{label}</span>
      <input
        type="url"
        name={name}
        defaultValue={value ?? ""}
        placeholder="https://groble.im/payment/…"
        className="w-full rounded-ui border border-ink-faint bg-paper px-3 py-2 placeholder:text-ink-faint focus:border-ink"
      />
    </label>
  );
}

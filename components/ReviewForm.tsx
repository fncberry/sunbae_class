"use client";

import { useActionState, useState } from "react";
import { saveReview, type ReviewState } from "@/app/(main)/lectures/[lectureId]/actions";
import { REVIEW_MAX } from "@/lib/format";

export function ReviewForm({
  lectureId,
  existing,
}: {
  lectureId: string;
  existing: { rating: number; body: string } | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(saveReview, { status: "idle" });
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [length, setLength] = useState(existing?.body.length ?? 0);

  return (
    <form action={action} className="rounded-ui border border-rule p-5">
      <input type="hidden" name="lectureId" value={lectureId} />
      <fieldset>
        <legend className="text-sm font-semibold">{existing ? "내 후기 고치기" : "후기 쓰기"}</legend>
        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-ui border text-sm ${
                n <= rating ? "border-ink bg-ink text-paper" : "border-ink-faint hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                required
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm">
        <span className="sr-only">후기</span>
        <textarea
          name="body"
          required
          maxLength={REVIEW_MAX}
          rows={4}
          defaultValue={existing?.body}
          onChange={(e) => setLength(e.target.value.length)}
          placeholder="시험에 실제로 도움이 됐는지 적어 주세요."
          className="w-full rounded-ui border border-ink-faint p-3 text-base leading-relaxed placeholder:text-ink-faint focus:border-ink"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-ink-faint">
          {length}/{REVIEW_MAX}자 · 작성자는 학과와 학번으로만 표시돼요
        </span>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-ui bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {pending ? "저장하는 중…" : existing ? "고치기" : "올리기"}
        </button>
      </div>
      {state.status === "error" && (
        <p key={state.at} role="alert" className="mt-3 text-sm text-pen">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p key={state.at} role="status" className="mt-3 text-sm text-ink-soft">
          저장했어요.
        </p>
      )}
    </form>
  );
}

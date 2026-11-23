"use client";

import { useActionState, useState, useTransition } from "react";
import type { ReviewLecture } from "@/lib/admin";
import { courseShortLabel, minutesLabel, totalMinutes, won } from "@/lib/format";
import { reviewLecture, type DecisionState } from "../actions";

export function LectureReviewItem({ lecture: l }: { lecture: ReviewLecture }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(reviewLecture, { status: "idle" });
  const [rejecting, setRejecting] = useState(false);
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => action(formData));
  }

  if (state.status === "done") {
    return <li className="border-b border-rule py-4 text-ink-faint">{l.title}: 처리했어요.</li>;
  }

  return (
    <li className="border-b border-rule py-6">
      <p className="text-sm text-ink-soft">{courseShortLabel(l.course)}</p>
      <h2 className="mt-1 text-lg font-semibold">{l.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {l.instructor.name ?? "이름 없음"} ({l.instructor.studentId ?? "학번 없음"}), 공개 이름 {l.instructor.nickname}, {l.instructor.major}
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p className="max-w-[62ch]">{l.summary || <span className="text-ink-faint">소개 없음</span>}</p>
          {l.covers.length > 0 && (
            <ul className="space-y-1">
              {l.covers.map((c) => (
                <li key={c} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-faint">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm text-ink-soft">
            {won(l.price)}, 강의 {l.chapters.length}개, {minutesLabel(totalMinutes(l))}
          </p>
          <ol className="mt-2 text-sm">
            {l.chapters.map((c, i) => (
              <li key={`${i}-${c.title}`} className="flex justify-between gap-3 border-t border-rule py-1.5">
                <span>
                  {c.title}
                  {i === 0 && <span className="ml-1.5 text-ink-faint">맛보기</span>}
                </span>
                <span className="shrink-0 text-ink-soft">{c.minutes}분</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5">
        <input type="hidden" name="id" value={l.id} />
        {rejecting && (
          <label className="mb-3 block max-w-2xl text-sm">
            <span className="font-medium">반려 사유</span>
            <textarea
              name="rejectReason"
              required
              rows={2}
              maxLength={300}
              autoFocus
              placeholder="3강 자료가 교수님 강의자료 슬라이드를 그대로 쓰고 있어요. 직접 정리한 내용으로 바꿔 주세요."
              className="mt-1.5 w-full rounded-ui border border-ink-faint bg-paper px-3 py-2 text-[15px] placeholder:text-ink-faint focus:border-ink"
            />
            <span className="mt-1 block text-ink-soft">강사에게 그대로 보여요.</span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {rejecting ? (
            <>
              {/* key가 다르면 버튼이 새로 만들어져서, '반려'를 누른 클릭이 이 버튼의 제출로 이어지지 않는다 */}
              <button
                key="confirm-reject"
                type="submit"
                name="decision"
                value="reject"
                disabled={pending}
                className="rounded-ui bg-ink px-4 py-2 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
              >
                반려하기
              </button>
              <button type="button" onClick={() => setRejecting(false)} className="px-2 text-ink-soft hover:text-ink">
                취소
              </button>
            </>
          ) : (
            <>
              <button
                key="open-reject"
                type="button"
                onClick={() => setRejecting(true)}
                className="rounded-ui border border-ink-faint px-4 py-2 hover:border-ink"
              >
                반려
              </button>
              <button
                type="submit"
                name="decision"
                value="approve"
                disabled={pending}
                className="rounded-ui bg-ink px-4 py-2 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
              >
                판매 시작
              </button>
            </>
          )}
          {state.status === "error" && (
            <p role="alert" className="ml-2 text-pen">
              {state.message}
            </p>
          )}
        </div>
      </form>
    </li>
  );
}

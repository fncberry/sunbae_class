"use client";

import { useActionState, useState } from "react";
import { answerQuestion, type QuestionState } from "@/app/(main)/watch/[lectureId]/question-actions";
import { ANSWER_MAX } from "@/lib/format";

/** 강의 주인·운영자 답변. 이미 답했으면 "답변 고치기"를 눌러야 입력칸이 열린다 */
export function AnswerForm({ questionId, existing }: { questionId: string; existing: string | null }) {
  const [state, action, pending] = useActionState<QuestionState, FormData>(answerQuestion, { status: "idle" });
  const [editing, setEditing] = useState(existing === null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  if (state.status === "saved" && state.at !== savedAt) {
    setSavedAt(state.at);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
        답변 고치기
      </button>
    );
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="id" value={questionId} />
      <label className="block text-sm">
        <span className="sr-only">답변</span>
        <textarea
          name="answer"
          required
          maxLength={ANSWER_MAX}
          rows={3}
          defaultValue={existing ?? ""}
          placeholder="답변을 적어 주세요."
          className="w-full rounded-ui border border-ink-faint p-3 text-base leading-relaxed placeholder:text-ink-faint focus:border-ink"
        />
      </label>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <button
          type="submit"
          disabled={pending}
          className="rounded-ui bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {pending ? "저장하는 중…" : existing ? "답변 고치기" : "답변 올리기"}
        </button>
        {existing !== null && (
          <button type="button" onClick={() => setEditing(false)} className="px-1 text-ink-soft hover:text-ink">
            취소
          </button>
        )}
        {state.status === "error" && (
          <span key={state.at} role="alert" className="text-pen">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

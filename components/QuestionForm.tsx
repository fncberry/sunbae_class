"use client";

import { useActionState, useState } from "react";
import { askQuestion, type QuestionState } from "@/app/(main)/watch/[lectureId]/question-actions";
import { QUESTION_MAX } from "@/lib/format";

export function QuestionForm({ lectureId, chapterId, chapterTitle }: { lectureId: string; chapterId: string; chapterTitle: string }) {
  const [state, action, pending] = useActionState<QuestionState, FormData>(askQuestion, { status: "idle" });
  const [length, setLength] = useState(0);
  // 올리고 나면 입력칸을 비운다(폼을 새로 그린다)
  const formKey = state.status === "saved" ? state.at : "new";

  return (
    <form key={formKey} action={action} className="rounded-ui border border-rule p-4">
      <input type="hidden" name="lectureId" value={lectureId} />
      <input type="hidden" name="chapterId" value={chapterId} />
      <label className="block text-sm">
        <span className="font-semibold">{chapterTitle}에 질문하기</span>
        <textarea
          name="body"
          required
          maxLength={QUESTION_MAX}
          rows={3}
          onChange={(e) => setLength(e.target.value.length)}
          placeholder="몇 분쯤, 어떤 부분이 헷갈렸는지 적어 주세요."
          className="mt-2 w-full rounded-ui border border-ink-faint p-3 text-base leading-relaxed placeholder:text-ink-faint focus:border-ink"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-ink-faint">
          {length}/{QUESTION_MAX}자 · 학과와 학번으로만 표시돼요
        </span>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-ui bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {pending ? "올리는 중…" : "질문 올리기"}
        </button>
      </div>
      {state.status === "error" && (
        <p key={state.at} role="alert" className="mt-3 text-sm text-pen">
          {state.message}
        </p>
      )}
    </form>
  );
}

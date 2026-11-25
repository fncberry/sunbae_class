import { deleteQuestion } from "@/app/(main)/watch/[lectureId]/question-actions";
import { koDateOf } from "@/lib/format";
import type { LectureQuestion } from "@/lib/questions";
import { AnswerForm } from "./AnswerForm";

/** 강의 질문 목록. canAnswer면 각 질문 아래에 답변 칸을 보여준다(강의 주인·운영자) */
export function QuestionList({
  questions,
  chapterTitles,
  canAnswer,
}: {
  questions: LectureQuestion[];
  chapterTitles: Map<string, string>;
  canAnswer: boolean;
}) {
  if (questions.length === 0) {
    return <p className="mt-4 text-sm text-ink-soft">아직 질문이 없어요.</p>;
  }

  return (
    <ul className="mt-4 border-t border-rule">
      {questions.map((q) => (
        <li key={q.id} className="border-b border-rule py-5">
          <p className="text-sm text-ink-faint">
            {q.chapterId && chapterTitles.get(q.chapterId) ? `${chapterTitles.get(q.chapterId)} · ` : ""}
            {q.authorLabel} · {koDateOf(q.createdAt)}
            {q.mine && <span className="ml-1.5 text-ink-soft">내 질문</span>}
          </p>
          <p className="mt-1.5 whitespace-pre-line leading-relaxed">{q.body}</p>

          {q.answer ? (
            <div className="mt-3 border-l-2 border-ink pl-4">
              <p className="text-sm font-semibold">선배 답변</p>
              <p className="mt-1 whitespace-pre-line leading-relaxed">{q.answer}</p>
            </div>
          ) : (
            !canAnswer && <p className="mt-2 text-sm text-ink-soft">답변을 기다리는 중이에요.</p>
          )}

          {canAnswer && <AnswerForm questionId={q.id} existing={q.answer} />}

          {q.mine && !q.answer && (
            <form action={deleteQuestion} className="mt-2">
              <input type="hidden" name="id" value={q.id} />
              <button type="submit" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
                질문 지우기
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

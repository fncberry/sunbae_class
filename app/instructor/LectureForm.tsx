"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { saveLecture, type LectureField, type LectureState } from "./actions";

type Chapter = { key: number; title: string; minutes: string };

const fieldClass =
  "rounded-ui border border-ink-faint bg-paper px-3 text-[15px] placeholder:text-ink-faint focus:border-ink aria-[invalid=true]:border-pen";
const inputClass = `mt-2 w-full ${fieldClass}`;

export type LectureFormValues = {
  id: string;
  title: string;
  summary: string;
  price: number;
  covers: string[];
  chapters: { title: string; minutes: number }[];
};

export function LectureForm({
  courses,
  lecture,
  courseLabel,
  notice,
}: {
  /** 새로 만들 때 고를 수 있는 과목 (승인된 과목) */
  courses: { id: string; label: string }[];
  lecture?: LectureFormValues;
  /** 수정할 때 보여줄 과목 이름 (과목은 바꿀 수 없다) */
  courseLabel?: string;
  /** 새로 만든 직후 등 페이지가 알려줄 문구 */
  notice?: string;
}) {
  const [state, action, pending] = useActionState<LectureState, FormData>(saveLecture, { status: "idle" });
  const error = state.status === "error" ? state : null;
  const invalid = (f: LectureField) => (error?.field === f ? true : undefined);

  const [, startTransition] = useTransition();
  const [chapters, setChapters] = useState<Chapter[]>(() => {
    const initial = lecture?.chapters.length
      ? lecture.chapters.map((c) => ({ title: c.title, minutes: String(c.minutes) }))
      : [
          { title: "0강. 맛보기", minutes: "" },
          { title: "", minutes: "" },
        ];
    return initial.map((c, i) => ({ ...c, key: i }));
  });
  const [keySeed, setKeySeed] = useState(chapters.length);

  function addChapter() {
    setChapters((cs) => [...cs, { key: keySeed, title: "", minutes: "" }]);
    setKeySeed((k) => k + 1);
  }
  function update(key: number, patch: Partial<Chapter>) {
    setChapters((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function remove(key: number) {
    setChapters((cs) => (cs.length > 1 ? cs.filter((c) => c.key !== key) : cs));
  }

  // <form action>은 저장 뒤 입력값을 기본값으로 되돌리므로, 직접 보내서 실패해도 적은 내용이 남게 한다
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => action(formData));
  }

  const message = error?.message ?? (state.status === "saved" ? state.message : notice);

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-7">
      {lecture && <input type="hidden" name="lectureId" value={lecture.id} />}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_160px]">
        {lecture ? (
          <div className="text-sm">
            <span className="font-medium">과목</span>
            <p className="mt-2 flex h-11 items-center text-[15px]">{courseLabel}</p>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="font-medium">과목</span>
            <select name="courseId" required defaultValue={courses[0]?.id} aria-invalid={invalid("course")} className={`${inputClass} h-11`}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium">가격 (원)</span>
          <input
            name="price"
            required
            inputMode="numeric"
            defaultValue={lecture?.price ?? 5900}
            aria-invalid={invalid("price")}
            className={`${inputClass} h-11`}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">강의 제목</span>
        <input
          name="title"
          required
          minLength={4}
          maxLength={60}
          defaultValue={lecture?.title}
          placeholder="자료구조 기말 정리, 트리와 그래프"
          aria-invalid={invalid("title")}
          className={`${inputClass} h-11`}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">소개</span>
        <textarea
          name="summary"
          rows={3}
          maxLength={400}
          defaultValue={lecture?.summary}
          placeholder="어떤 시험을 어떻게 준비하는 강의인지 두세 문장으로 적어 주세요."
          aria-invalid={invalid("summary")}
          className={`${inputClass} py-2.5 leading-relaxed`}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">다루는 내용</span>
        <textarea
          name="covers"
          rows={4}
          defaultValue={lecture?.covers.join("\n")}
          placeholder={"AVL 회전을 그림 하나로 판별하는 법\n다익스트라 표 채우기에서 자주 틀리는 지점"}
          aria-invalid={invalid("covers")}
          aria-describedby="covers-help"
          className={`${inputClass} py-2.5 leading-relaxed`}
        />
        <span id="covers-help" className="mt-2 block text-ink-faint">
          한 줄에 하나씩, 8줄까지
        </span>
      </label>

      <fieldset aria-invalid={invalid("chapters")}>
        <legend className="text-sm font-medium">강의 목록</legend>
        <p className="mt-1 text-sm text-ink-faint">첫 번째 강의는 누구나 볼 수 있는 맛보기예요. 길이는 대략 적고, 영상을 올리면 맞춰져요.</p>
        <ol className="mt-3 space-y-2">
          {chapters.map((c, i) => (
            <li key={c.key} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-ink-faint">{i + 1}</span>
              <input
                name="chapterTitle"
                value={c.title}
                onChange={(e) => update(c.key, { title: e.target.value })}
                maxLength={60}
                placeholder={i === 0 ? "0강. 맛보기" : `${i}강. 제목`}
                aria-label={`${i + 1}번째 강의 제목`}
                className={`${fieldClass} h-10 min-w-0 flex-1`}
              />
              <input
                name="chapterMinutes"
                value={c.minutes}
                onChange={(e) => update(c.key, { minutes: e.target.value.replace(/[^0-9]/g, "") })}
                inputMode="numeric"
                placeholder="분"
                aria-label={`${i + 1}번째 강의 길이(분)`}
                className={`${fieldClass} h-10 w-20 shrink-0 text-right`}
              />
              <button
                type="button"
                onClick={() => remove(c.key)}
                disabled={chapters.length === 1}
                aria-label={`${i + 1}번째 강의 빼기`}
                className="grid size-10 shrink-0 place-items-center rounded-ui text-ink-soft hover:bg-wash hover:text-ink disabled:opacity-30"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={addChapter}
          disabled={chapters.length >= 30}
          className="mt-3 inline-flex items-center gap-1.5 pl-8 text-sm text-ink-soft hover:text-ink disabled:opacity-40"
        >
          <Plus size={15} aria-hidden /> 강의 추가
        </button>
      </fieldset>

      <p className="text-sm text-ink-soft">기출문제 원본이나 교수님 강의자료를 그대로 쓰면 공개되지 않아요.</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="rounded-ui border border-ink-faint px-5 py-3 text-sm font-medium hover:border-ink disabled:opacity-60"
        >
          초안 저장
        </button>
        <button
          type="submit"
          name="intent"
          value="review"
          disabled={pending}
          className="rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          저장하고 검수 요청
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${error ? "text-pen" : "text-ink-soft"}`}>
          {pending ? "저장하는 중" : message}
        </p>
      </div>
    </form>
  );
}

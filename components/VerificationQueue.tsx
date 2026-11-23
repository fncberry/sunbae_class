"use client";

import { useActionState, useState, useTransition } from "react";
import { decideVerification, type DecisionState } from "@/app/admin/actions";
import type { PendingVerification } from "@/lib/admin";

const inputClass =
  "mt-1.5 h-10 w-full rounded-ui border border-ink-faint bg-paper px-3 text-[15px] placeholder:text-ink-faint focus:border-ink";

/** "2025-2학기" → "2025년 2학기" */
function semesterText(s: string) {
  return s.replace(/^(\d{4})-(\d)학기$/, "$1년 $2학기");
}

const kstDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

export function VerificationQueue({ rows }: { rows: PendingVerification[] }) {
  if (rows.length === 0) return <p className="text-ink-soft">확인할 신청이 없어요.</p>;
  return (
    <ul className="border-t border-ink">
      {rows.map((r) => (
        <VerificationItem key={r.id} row={r} />
      ))}
    </ul>
  );
}

function VerificationItem({ row: r }: { row: PendingVerification }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(decideVerification, { status: "idle" });
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [, startTransition] = useTransition();
  // <form action>은 실패해도 입력값을 지우므로 직접 보낸다
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  }
  const courseName = r.course?.name ?? r.requested?.name ?? "";

  if (state.status === "done") {
    return (
      <li className="border-b border-rule py-4 text-ink-faint">
        {r.applicant.name ?? r.applicant.nickname}, {courseName}: 처리했어요.
        {state.warning && <span className="ml-2 text-ink">{state.warning}</span>}
      </li>
    );
  }

  return (
    <li className="border-b border-rule py-5">
      <div className="grid gap-x-8 gap-y-3 md:grid-cols-[180px_minmax(0,1fr)_150px_auto]">
        <div>
          <p className="font-semibold">{r.applicant.name ?? "이름 없음"}</p>
          <p className="text-sm tabular-nums text-ink-soft">{r.applicant.studentId ?? "학번 없음"}</p>
          <p className="mt-1 text-sm text-ink-faint">
            {r.applicant.nickname}, {r.applicant.major}
          </p>
        </div>
        <div>
          {r.course ? (
            <p>
              {r.course.code ? `${r.course.code} ` : ""}
              {r.course.name}
              {r.course.professor && <span className="text-ink-soft"> ({r.course.professor})</span>}
            </p>
          ) : r.requested ? (
            <>
              <p>
                {r.requested.code} {r.requested.name} <span className="text-ink-soft">({r.requested.professor})</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                목록에 없는 과목. {r.requested.track === "liberal" ? "교양" : r.requested.group}
                {r.requested.department ? `, ${r.requested.department}` : ""}
              </p>
            </>
          ) : null}
          <p className="mt-1 text-sm text-ink-faint">{kstDay.format(new Date(r.submittedAt))} 신청</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{r.grade}</p>
          <p className="text-sm text-ink-soft">{r.semester}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2 text-sm md:justify-end">
          {r.hasProof ? (
            <a
              href={`/admin/proofs/${r.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-ui px-2 py-1.5 underline underline-offset-4 hover:bg-wash"
            >
              캡처 보기
            </a>
          ) : (
            <span className="px-2 py-1.5 text-ink-faint">캡처 없음</span>
          )}
          <button
            type="button"
            aria-expanded={open === "reject"}
            onClick={() => setOpen(open === "reject" ? null : "reject")}
            className="rounded-ui border border-ink-faint px-3 py-1.5 hover:border-ink aria-expanded:border-ink"
          >
            반려
          </button>
          <button
            type="button"
            aria-expanded={open === "approve"}
            onClick={() => setOpen(open === "approve" ? null : "approve")}
            className="rounded-ui bg-ink px-3 py-1.5 font-semibold text-paper hover:bg-ink/85"
          >
            승인
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mt-4 rounded-ui bg-wash p-4">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="decision" value={open} />

          {open === "reject" ? (
            <label className="block text-sm">
              <span className="font-medium">반려 사유</span>
              <input
                name="rejectReason"
                required
                maxLength={200}
                autoFocus
                placeholder="캡처에 교수님 이름이 보이지 않아요. 분반이 보이게 다시 올려 주세요."
                className={inputClass}
              />
              <span className="mt-1.5 block text-ink-soft">신청자에게 그대로 보여요.</span>
            </label>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium">인증 문구</span>
                <input
                  name="proofText"
                  required
                  maxLength={120}
                  defaultValue={`${semesterText(r.semester)} ${courseName} 성적을 확인했어요`}
                  className={inputClass}
                />
                <span className="mt-1.5 block text-ink-soft">강의 페이지에 성적과 함께 보여요.</span>
              </label>

              {!r.course && r.requested && (
                <fieldset className="grid gap-4 sm:grid-cols-3">
                  <legend className="mb-2 text-sm font-medium">새로 열 과목</legend>
                  <label className="block text-sm">
                    <span>과목 id (주소에 쓰여요)</span>
                    <input name="courseId" required defaultValue={r.requested.code.toLowerCase()} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>학수번호</span>
                    <input name="courseCode" defaultValue={r.requested.code} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>과목명</span>
                    <input name="courseName" defaultValue={r.requested.name} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>교수님</span>
                    <input name="courseProfessor" defaultValue={r.requested.professor} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>{r.requested.track === "liberal" ? "교양 영역" : "개설 학과"}</span>
                    <input name="courseDepartment" defaultValue={r.requested.department ?? ""} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>이번 개설 학기</span>
                    <input name="courseSemester" required placeholder="2026-2학기" className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>시험</span>
                    <input name="examLabel" defaultValue="기말고사" className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span>시험일 (환불 기한 기준)</span>
                    <input name="examDate" type="date" required className={inputClass} />
                  </label>
                  <p className="self-end text-sm text-ink-soft">과목 id가 이미 있으면 그 과목에 연결해요.</p>
                </fieldset>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-ui bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
            >
              {open === "reject" ? "반려하고 캡처 지우기" : "승인하고 캡처 지우기"}
            </button>
            <button type="button" onClick={() => setOpen(null)} className="text-sm text-ink-soft hover:text-ink">
              취소
            </button>
            {state.status === "error" && (
              <p role="alert" className="text-sm text-pen">
                {state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

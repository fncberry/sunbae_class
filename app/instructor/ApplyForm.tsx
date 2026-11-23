"use client";

import { useActionState, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { COLLEGES } from "@/lib/catalog";
import { browserSupabase } from "@/lib/supabase/browser";
import { PROOF_ACCEPT, PROOF_BUCKET, checkProofFile, proofPath } from "@/lib/verification";
import { submitVerification, type ApplyField, type ApplyState } from "./actions";

export type CourseOption = { id: string; label: string; kind: "major" | "cert"; blocked?: string };

const inputClass =
  "mt-2 h-11 w-full rounded-ui border border-ink-faint bg-paper px-3 text-[15px] placeholder:text-ink-faint focus:border-ink aria-[invalid=true]:border-pen";

export function ApplyForm({ userId, courses }: { userId: string; courses: CourseOption[] }) {
  const [state, action, saving] = useActionState<ApplyState, FormData>(submitVerification, { status: "idle" });
  const [uploading, startUpload] = useTransition();
  const [localError, setLocalError] = useState<{ message: string; field?: ApplyField } | null>(null);
  const [mode, setMode] = useState<"pick" | "request">("pick");
  const [track, setTrack] = useState<"major" | "liberal">("major");
  const [fileName, setFileName] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // 서버 결과가 새로 오면 브라우저에서 낸 오류는 지운다
  const [seenAt, setSeenAt] = useState(0);
  const at = state.status === "idle" ? 0 : state.at;
  if (at !== seenAt) {
    setSeenAt(at);
    setLocalError(null);
    if (state.status === "done") {
      // 신청이 저장되면 빈 양식으로 되돌린다. 실패하면 적은 값을 그대로 둔다
      setFileName(null);
      setMode("pick");
      setFormKey((k) => k + 1);
    }
  }

  const error = localError ?? (state.status === "error" ? state : null);
  const invalid = (f: ApplyField) => (error?.field === f ? true : undefined);
  const busy = uploading || saving;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const filled = (name: string) => String(formData.get(name) ?? "").trim() !== "";
    const missing: [boolean, string, ApplyField][] =
      mode === "pick"
        ? [[!filled("courseId"), "과목을 골라 주세요.", "course"]]
        : [
            [!filled("code"), "학수번호를 적어 주세요.", "code"],
            [!filled("name"), "과목명을 적어 주세요.", "name"],
            [!filled("professor"), "교수님 성함을 적어 주세요.", "professor"],
            [track === "major" && !filled("group"), "단과대학을 골라 주세요.", "group"],
          ];
    missing.push([!filled("grade"), "받은 성적을 적어 주세요.", "grade"], [!filled("semester"), "수강 학기를 적어 주세요.", "semester"]);
    const first = missing.find(([bad]) => bad);
    if (first) {
      setLocalError({ message: first[1], field: first[2] });
      return;
    }
    const file = formData.get("proof");
    if (!(file instanceof File) || file.size === 0) {
      setLocalError({ message: "성적 캡처 파일을 골라 주세요.", field: "proof" });
      return;
    }
    const checked = checkProofFile(file);
    if (!checked.ok) {
      setLocalError({ message: checked.message, field: "proof" });
      return;
    }
    setLocalError(null);

    startUpload(async () => {
      const id = crypto.randomUUID();
      const path = proofPath(userId, id, checked.ext);
      const { error: uploadError } = await browserSupabase()
        .storage.from(PROOF_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setLocalError({ message: "캡처를 올리지 못했어요. 잠시 뒤에 다시 시도해 주세요.", field: "proof" });
        return;
      }
      formData.delete("proof");
      formData.set("verificationId", id);
      formData.set("proofPath", path);
      // await 뒤에는 트랜지션이 끊기므로 다시 감싼다
      startUpload(() => action(formData));
    });
  }

  const done = state.status === "done" && !localError;

  return (
    <form key={formKey} onSubmit={onSubmit} className="max-w-3xl space-y-6" noValidate>
      <input type="hidden" name="mode" value={mode} />

      <fieldset>
        <legend className="text-sm font-medium">과목</legend>
        {mode === "pick" ? (
          <>
            <select name="courseId" required defaultValue="" aria-invalid={invalid("course")} className={inputClass}>
              <option value="" disabled>
                과목을 골라 주세요
              </option>
              <optgroup label="대학 수업">
                {courses.filter((c) => c.kind === "major").map((c) => (
                  <option key={c.id} value={c.id} disabled={!!c.blocked}>
                    {c.label}
                    {c.blocked ? ` (${c.blocked})` : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="자격증·어학">
                {courses.filter((c) => c.kind === "cert").map((c) => (
                  <option key={c.id} value={c.id} disabled={!!c.blocked}>
                    {c.label}
                    {c.blocked ? ` (${c.blocked})` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
            <button type="button" onClick={() => setMode("request")} className="mt-2 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
              들은 수업이 목록에 없어요
            </button>
          </>
        ) : (
          <div className="mt-2 rounded-ui border border-rule p-4">
            <p className="text-sm text-ink-soft">
              대학 수업만 직접 적을 수 있어요. 운영진이 확인하면서 과목을 새로 열어요.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)_160px]">
              <label className="block text-sm">
                <span>학수번호</span>
                <input name="code" placeholder="COSE341" autoComplete="off" aria-invalid={invalid("code")} className={`${inputClass} uppercase`} />
              </label>
              <label className="block text-sm">
                <span>과목명</span>
                <input name="name" placeholder="운영체제" autoComplete="off" maxLength={60} aria-invalid={invalid("name")} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>교수님</span>
                <input name="professor" placeholder="오정민" autoComplete="off" maxLength={30} aria-invalid={invalid("professor")} className={inputClass} />
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block text-sm">
                <span>구분</span>
                <select name="track" value={track} onChange={(e) => setTrack(e.target.value as "major" | "liberal")} className={inputClass}>
                  <option value="major">전공</option>
                  <option value="liberal">교양</option>
                </select>
              </label>
              {track === "major" ? (
                <>
                  <label className="block text-sm">
                    <span>단과대학</span>
                    <select name="group" defaultValue="" aria-invalid={invalid("group")} className={inputClass}>
                      <option value="" disabled>
                        골라 주세요
                      </option>
                      {COLLEGES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span>개설 학과</span>
                    <input name="department" placeholder="컴퓨터학과" autoComplete="off" maxLength={40} className={inputClass} />
                  </label>
                </>
              ) : (
                <label className="block text-sm sm:col-span-2">
                  <span>교양 영역</span>
                  <input name="department" placeholder="핵심교양, 학문의 기초 등" autoComplete="off" maxLength={40} className={inputClass} />
                </label>
              )}
            </div>
            <button type="button" onClick={() => setMode("pick")} className="mt-3 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
              목록에서 고를게요
            </button>
          </div>
        )}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">받은 성적이나 점수</span>
          <input name="grade" required maxLength={20} placeholder="A+" autoComplete="off" aria-invalid={invalid("grade")} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">수강 학기나 응시일</span>
          <input name="semester" required maxLength={30} placeholder="2025-2학기" autoComplete="off" aria-invalid={invalid("semester")} className={inputClass} />
        </label>
      </div>

      <div>
        <span className="text-sm font-medium">성적 캡처</span>
        <label
          aria-invalid={invalid("proof")}
          className="mt-2 flex cursor-pointer items-center gap-4 rounded-ui border border-dashed border-ink-faint px-5 py-5 hover:border-ink aria-[invalid=true]:border-pen"
        >
          <FileUp size={20} className="shrink-0 text-ink-soft" aria-hidden />
          <span className="text-sm">
            <span className="font-medium">{fileName ?? "파일 선택"}</span>
            <span className="block text-ink-soft">
              포털 성적 조회 화면이나 성적증명서. 이름, 과목, 교수님, 학기, 성적이 보여야 해요. jpg·png·webp·PDF, 10MB까지
            </span>
          </span>
          <input
            type="file"
            name="proof"
            accept={PROOF_ACCEPT}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <p className="mt-2 text-sm text-ink-faint">운영진만 볼 수 있고, 승인이나 반려를 결정하면 바로 지워져요.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {uploading ? "캡처 올리는 중" : saving ? "신청하는 중" : "인증 신청하기"}
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${error ? "text-pen" : "text-ink-soft"}`}>
          {error ? error.message : done ? "신청했어요. 결과는 위 목록에 나와요." : ""}
        </p>
      </div>
    </form>
  );
}

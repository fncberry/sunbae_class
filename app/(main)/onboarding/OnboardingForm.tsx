"use client";

import { useActionState } from "react";
import { NICKNAME_PATTERN, STUDENT_ID_PATTERN } from "@/lib/onboarding";
import { completeOnboarding, type OnboardingField, type OnboardingState } from "./actions";

const inputClass =
  "mt-2 h-12 w-full rounded-ui border border-ink-faint px-3 text-base placeholder:text-ink-faint focus:border-ink aria-[invalid=true]:border-pen";

export type OnboardingDefaults = { name: string; nickname: string; major: string };

export function OnboardingForm({
  next,
  email,
  defaults,
  fromSchoolAccount,
}: {
  next: string;
  email: string;
  defaults: OnboardingDefaults;
  /** 이름·학과를 학교 계정에서 미리 채웠는지 */
  fromSchoolAccount: boolean;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, { status: "idle" });
  const error = state.status === "error" ? state : null;
  const invalid = (field: OnboardingField) => (error?.field === field ? true : undefined);
  const value = (field: Exclude<OnboardingField, "agree" | "studentId">) => error?.values[field] ?? defaults[field];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="next" value={next} />

      <p className="text-sm text-ink-soft">
        로그인한 계정 <b className="font-medium text-ink">{email}</b>
        {fromSchoolAccount && <span className="mt-1 block text-ink-faint">이름과 학과는 학교 계정 정보로 미리 채웠어요.</span>}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">이름</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={30}
            autoComplete="name"
            placeholder="홍길동"
            defaultValue={value("name")}
            aria-invalid={invalid("name")}
            aria-describedby="name-help"
            className={inputClass}
          />
          <span id="name-help" className="mt-2 block leading-relaxed text-ink-faint">
            다른 사람에게 보이지 않아요. 강사 지원과 정산 확인에만 써요.
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium">닉네임</span>
          <input
            name="nickname"
            required
            pattern={NICKNAME_PATTERN}
            minLength={2}
            maxLength={12}
            autoComplete="nickname"
            placeholder="자료구조정복"
            defaultValue={value("nickname")}
            aria-invalid={invalid("nickname")}
            aria-describedby="nickname-help"
            className={inputClass}
          />
          <span id="nickname-help" className="mt-2 block leading-relaxed text-ink-faint">
            후기·질문에 보이는 이름이에요. 한글·영문·숫자 2~12자, 나중에 바꿀 수 있어요.
          </span>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">학번</span>
        <input
          name="studentId"
          required
          inputMode="numeric"
          autoComplete="off"
          pattern={STUDENT_ID_PATTERN}
          maxLength={10}
          placeholder="2024320001"
          defaultValue={error?.values.studentId}
          aria-invalid={invalid("studentId")}
          aria-describedby="student-id-help"
          className={inputClass}
        />
        <span id="student-id-help" className="mt-2 block leading-relaxed text-ink-faint">
          구매한 강의 영상에 흐리게 표시돼요. 저장한 뒤에는 바꿀 수 없으니 정확히 적어 주세요.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">학과</span>
        <input
          name="major"
          required
          minLength={2}
          maxLength={40}
          autoComplete="off"
          placeholder="컴퓨터학과"
          defaultValue={value("major")}
          aria-invalid={invalid("major")}
          aria-describedby="major-help"
          className={inputClass}
        />
        <span id="major-help" className="mt-2 block leading-relaxed text-ink-faint">
          후기를 쓰면 닉네임 옆에 &lsquo;컴퓨터학과 24학번&rsquo;처럼 표시돼요.
        </span>
      </label>

      <fieldset className="rounded-ui border border-rule p-4 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="agree" required aria-invalid={invalid("agree")} className="mt-0.5 size-4 accent-ink" />
          <span className="font-medium">[필수] 서비스 이용과 개인정보 수집·이용에 동의해요</span>
        </label>
        <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 pl-7 leading-relaxed text-ink-soft">
          <dt className="text-ink-faint">수집 항목</dt>
          <dd>학교 메일, 이름, 닉네임, 학번, 학과</dd>
          <dt className="text-ink-faint">쓰는 곳</dt>
          <dd>재학생 확인, 강의 영상 워터마크, 후기 작성자 표시, 강사 지원·정산 확인</dd>
          <dt className="text-ink-faint">보관 기간</dt>
          <dd>탈퇴할 때까지</dd>
        </dl>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-pen">
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-ui bg-ink py-3.5 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
      >
        {pending ? "저장하는 중…" : "시작하기"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-ui border border-ink p-6">
        <p className="font-semibold">메일을 보냈어요</p>
        <p className="mt-2 leading-relaxed text-ink-soft">
          <b className="font-medium text-ink">{state.email}</b> 받은편지함에서 로그인 링크를 눌러 주세요.
          이 브라우저에서 열어야 로그인돼요. 메일이 안 보이면 스팸함도 확인해 주세요.
        </p>
      </div>
    );
  }

  const message =
    state.status === "error"
      ? state.message
      : linkError
        ? "로그인 링크가 만료됐거나 이미 사용됐어요. 다시 받아 주세요."
        : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="font-medium">고려대 메일</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="학번이나 아이디@korea.ac.kr"
          defaultValue={state.status === "error" ? state.email : ""}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "login-error" : undefined}
          className="mt-2 h-12 w-full rounded-ui border border-ink-faint px-3 text-base placeholder:text-ink-faint focus:border-ink"
        />
      </label>
      {message && (
        <p id="login-error" role="alert" className="text-sm text-pen">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-ui bg-ink py-3.5 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
      >
        {pending ? "보내는 중…" : "로그인 링크 받기"}
      </button>
    </form>
  );
}

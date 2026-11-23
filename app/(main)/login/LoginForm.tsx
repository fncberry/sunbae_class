"use client";

import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "./actions";

export type LoginError = "domain" | "cancelled" | "failed" | null;

const MESSAGES: Record<Exclude<LoginError, null>, string> = {
  domain: "고려대 계정(@korea.ac.kr)으로만 로그인할 수 있어요. 개인 Gmail 말고 학교 계정을 골라 주세요.",
  cancelled: "로그인을 취소했어요.",
  failed: "로그인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
};

export function LoginForm({ next, error }: { next: string; error: LoginError }) {
  return (
    <form action={signInWithGoogle} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {error && (
        <p role="alert" className="text-sm leading-relaxed text-pen">
          {MESSAGES[error]}
        </p>
      )}
      <SubmitButton />
      <p className="text-sm leading-relaxed text-ink-faint">
        학교 계정 아이디는 고려대 메일 주소와 같아요.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-ui border border-ink bg-paper py-3.5 font-semibold hover:bg-wash disabled:opacity-60"
    >
      <GoogleMark />
      {pending ? "구글로 이동하는 중…" : "고려대 구글 계정으로 로그인"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

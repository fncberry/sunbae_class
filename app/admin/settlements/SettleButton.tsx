"use client";

import { useActionState } from "react";
import type { SettleState } from "../actions";

type Action = (prev: SettleState, formData: FormData) => Promise<SettleState>;

/** 정산 만들기·지급 완료·취소 버튼. confirmText가 있으면 한 번 더 묻는다 */
export function SettleButton({
  action,
  id,
  label,
  confirmText,
  primary = false,
}: {
  action: Action;
  id: string;
  label: string;
  confirmText?: string;
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettleState, FormData>(action, { status: "idle" });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={
          primary
            ? "rounded-ui bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
            : "rounded-ui border border-ink-faint px-4 py-2 text-sm hover:border-ink disabled:opacity-60"
        }
      >
        {label}
      </button>
      {state.status === "error" && (
        <span role="alert" className="max-w-[24ch] text-right text-sm text-pen">
          {state.message}
        </span>
      )}
    </form>
  );
}

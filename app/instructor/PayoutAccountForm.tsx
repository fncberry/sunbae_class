"use client";

import { useActionState } from "react";
import type { PayoutAccount } from "@/lib/settlements";
import { savePayoutAccount, type AccountField, type AccountState } from "./actions";

const inputClass =
  "mt-2 h-11 w-full rounded-ui border border-ink-faint bg-paper px-3 text-[15px] placeholder:text-ink-faint focus:border-ink aria-[invalid=true]:border-pen";

export function PayoutAccountForm({ account }: { account: PayoutAccount | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(savePayoutAccount, { status: "idle" });
  const invalid = (f: AccountField) => state.status === "error" && state.field === f;

  return (
    <form action={action} className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)_160px]">
        <label className="block text-sm">
          <span className="font-medium">은행</span>
          <input name="bank" defaultValue={account?.bank ?? ""} maxLength={30} placeholder="국민은행" autoComplete="off" aria-invalid={invalid("bank")} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">계좌번호</span>
          <input
            name="accountNumber"
            defaultValue={account?.accountNumber ?? ""}
            maxLength={40}
            inputMode="numeric"
            placeholder="123456-78-901234"
            autoComplete="off"
            aria-invalid={invalid("accountNumber")}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">예금주</span>
          <input name="holder" defaultValue={account?.holder ?? ""} maxLength={30} autoComplete="off" aria-invalid={invalid("holder")} className={inputClass} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button type="submit" disabled={pending} className="rounded-ui bg-ink px-4 py-2 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60">
          {account ? "계좌 바꾸기" : "계좌 등록"}
        </button>
        <p role="status" aria-live="polite" className={state.status === "error" ? "text-pen" : "text-ink-soft"}>
          {state.status === "saved" ? "저장했어요." : state.status === "error" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}

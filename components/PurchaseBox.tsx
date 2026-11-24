"use client";

import { useActionState, useState } from "react";
import { startCheckout, type CheckoutState } from "@/app/(main)/checkout/actions";
import { koDate, won } from "@/lib/format";

type Props = {
  lectureId: string;
  price: number;
  studyGroup?: { price: number; capacity: number; remaining: number };
  examDate: string;
  examLabel: string;
};

export function PurchaseBox({ lectureId, price, studyGroup, examDate, examLabel }: Props) {
  const [option, setOption] = useState<"video" | "study">("video");
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, { status: "idle" });
  const studyFull = studyGroup !== undefined && studyGroup.remaining <= 0;
  const selectedPrice = option === "study" && studyGroup ? studyGroup.price : price;

  return (
    <form action={action} className="rounded-ui border border-ink p-6">
      <input type="hidden" name="lectureId" value={lectureId} />
      <fieldset>
        <legend className="text-sm font-semibold text-ink-soft">구매 방식</legend>
        <div className="mt-3">
          <Option
            value="video"
            checked={option === "video"}
            onSelect={() => setOption("video")}
            title="영상 강의"
            desc="전체 강의와 정리 자료 PDF"
            price={price}
          />
          {studyGroup && (
            <Option
              value="study"
              checked={option === "study"}
              disabled={studyFull}
              onSelect={() => setOption("study")}
              title="스터디반"
              desc={
                studyFull
                  ? `영상 강의에 2주 동안 단톡방 질문 답변, 라이브 2회 추가. ${studyGroup.capacity}명 정원이 찼어요`
                  : `영상 강의에 2주 동안 단톡방 질문 답변, 라이브 2회 추가. ${studyGroup.capacity}명 중 ${studyGroup.remaining}자리 남음`
              }
              price={studyGroup.price}
            />
          )}
        </div>
      </fieldset>

      {state.status === "error" && (
        <p key={state.at} role="alert" className="mt-4 text-sm leading-relaxed text-pen">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-ui bg-pen py-3.5 font-semibold text-paper hover:bg-pen-dark disabled:opacity-60"
      >
        {pending ? "주문 만드는 중…" : `${won(selectedPrice)} 결제하기`}
      </button>
      <p className="mt-2 text-center text-xs text-ink-faint">그로블 결제 페이지로 이동해요</p>

      <ul className="mt-6 space-y-2.5 border-t border-rule pt-5 text-sm leading-relaxed text-ink-soft">
        <li>{koDate(examDate)} {examLabel} 당일까지, 30% 미만으로 들었다면 전액 환불돼요.</li>
        <li>결제하면 바로 볼 수 있어요.</li>
        <li>영상에 내 학번이 흐리게 표시돼요.</li>
      </ul>
    </form>
  );
}

function Option({
  value,
  checked,
  disabled,
  onSelect,
  title,
  desc,
  price,
}: {
  value: "video" | "study";
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  price: number;
}) {
  return (
    <label
      className={`flex items-start gap-3 border-t border-rule py-4 first:border-t-0 first:pt-1 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="option"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-[5px] shrink-0 accent-ink"
      />
      <span className="flex-1">
        <span className="flex items-baseline justify-between gap-4">
          <span className={checked ? "font-semibold" : ""}>{title}</span>
          <span className={checked ? "font-semibold" : "text-ink-soft"}>{won(price)}</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{desc}</span>
      </span>
    </label>
  );
}

"use client";

import { useState } from "react";
import { koDate, won } from "@/lib/format";

type Props = {
  price: number;
  studyGroup?: { price: number; capacity: number; remaining: number };
  examDate: string;
  examLabel: string;
};

export function PurchaseBox({ price, studyGroup, examDate, examLabel }: Props) {
  const [option, setOption] = useState<"video" | "study">("video");
  const selectedPrice = option === "study" && studyGroup ? studyGroup.price : price;

  return (
    <div className="rounded-ui border border-ink p-6">
      <fieldset>
        <legend className="text-sm font-semibold text-ink-soft">구매 방식</legend>
        <div className="mt-3">
          <Option
            checked={option === "video"}
            onSelect={() => setOption("video")}
            title="영상 강의"
            desc="전체 강의와 정리 자료 PDF"
            price={price}
          />
          {studyGroup && (
            <Option
              checked={option === "study"}
              onSelect={() => setOption("study")}
              title="스터디반"
              desc={`영상 강의에 2주 동안 단톡방 질문 답변, 라이브 2회 추가. ${studyGroup.capacity}명 중 ${studyGroup.remaining}자리 남음`}
              price={studyGroup.price}
            />
          )}
        </div>
      </fieldset>

      {/* 실제 구현: 그로블 상품 링크로 이동 + 우리 쪽 주문 ID 전달 → 웹훅에서 수강권 발급 */}
      <button
        type="button"
        onClick={() => alert("목업이에요. 실제로는 그로블 결제 페이지로 넘어가요.")}
        className="mt-6 w-full rounded-ui bg-pen py-3.5 font-semibold text-paper hover:bg-pen-dark"
      >
        {won(selectedPrice)} 결제하기
      </button>
      <p className="mt-2 text-center text-xs text-ink-faint">그로블 결제 페이지로 이동해요</p>

      <ul className="mt-6 space-y-2.5 border-t border-rule pt-5 text-sm leading-relaxed text-ink-soft">
        <li>{koDate(examDate)} {examLabel} 당일까지, 30% 미만으로 들었다면 전액 환불돼요.</li>
        <li>결제하면 바로 볼 수 있어요.</li>
        <li>영상에 내 학번이 흐리게 표시돼요.</li>
      </ul>
    </div>
  );
}

function Option({
  checked,
  onSelect,
  title,
  desc,
  price,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  price: number;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-t border-rule py-4 first:border-t-0 first:pt-1">
      <input type="radio" name="purchase-option" checked={checked} onChange={onSelect} className="mt-[5px] shrink-0 accent-ink" />
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

/**
 * 성적 인증 표시. 채점할 때 빨간 펜으로 성적을 쓰고 동그라미 친 모양.
 * 화면에서 빨간 펜을 쓰는 곳은 여기와 결제 버튼뿐이다.
 */
export function VerifiedBadge({
  grade,
  label,
  size = "sm",
}: {
  grade: string;
  label?: string;
  size?: "sm" | "lg";
}) {
  const text = size === "lg" ? "text-[34px]" : "text-[24px]";
  return (
    <span className="inline-flex items-center gap-2" title="운영진이 해당 과목 성적표를 확인했어요">
      <span className={`relative inline-block px-1.5 font-hand leading-none text-pen ${text}`}>
        {grade}
        <svg
          aria-hidden
          viewBox="0 0 60 32"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -inset-x-1 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+8px)] overflow-visible"
        >
          <path
            d="M9 9 C 20 1, 50 2, 56 13 C 61 23, 40 31, 22 29 C 6 27, 1 18, 6 11 C 9 7, 15 5, 19 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {label && <span className="text-xs text-ink-soft">{label}</span>}
    </span>
  );
}

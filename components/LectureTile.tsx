import Link from "next/link";
import type { LectureWithRelations } from "@/lib/types";
import { won } from "@/lib/format";
import { LectureCover } from "./LectureCover";
import { VerifiedBadge } from "./VerifiedBadge";

/** 강의 목록 그리드의 카드 한 장 */
export function LectureTile({ lecture, className }: { lecture: LectureWithRelations; className?: string }) {
  const { course, instructor } = lecture;

  return (
    <li className={className}>
      <Link href={`/lectures/${lecture.id}`} className="group block">
        <LectureCover course={course} />
        <h3 className="mt-3 line-clamp-2 min-h-[2.8em] text-[15px] font-medium leading-[1.4] decoration-1 underline-offset-4 group-hover:underline">
          {lecture.title}
        </h3>
        <div className="mt-2 flex items-center gap-2.5 text-sm">
          <span>{instructor.name}</span>
          <VerifiedBadge grade={instructor.grade} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-ink-soft">
          {lecture.reviewCount > 0 ? (
            <span>
              평점 <b className="font-semibold text-ink">{lecture.rating}</b> ({lecture.reviewCount})
            </span>
          ) : (
            <span>후기 없음</span>
          )}
          <span>수강생 {lecture.sales}명</span>
        </p>
        <p className="mt-2.5 flex items-baseline gap-2">
          <span className="text-[17px] font-semibold">{won(lecture.price)}</span>
          {lecture.studyGroup && lecture.studyGroup.remaining > 0 && (
            <span className="text-xs text-ink-soft">스터디반 {lecture.studyGroup.remaining}자리</span>
          )}
        </p>
      </Link>
    </li>
  );
}

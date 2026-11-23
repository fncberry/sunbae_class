import Link from "next/link";
import type { LectureWithRelations } from "@/lib/types";
import { courseLabel, minutesLabel, totalMinutes, won } from "@/lib/format";
import { VerifiedBadge } from "./VerifiedBadge";

/** 강의 한 줄. 목록에서 카드 대신 행으로 쓴다. */
export function LectureCard({ lecture, showCourse = true }: { lecture: LectureWithRelations; showCourse?: boolean }) {
  const { course, instructor } = lecture;

  return (
    <li className="border-t border-rule first:border-t-0">
      <Link
        href={`/lectures/${lecture.id}`}
        className="group grid gap-x-10 gap-y-4 py-7 md:grid-cols-[minmax(0,1fr)_180px_150px]"
      >
        <div>
          {showCourse && (
            <p className="text-sm text-ink-soft">{courseLabel(course)}</p>
          )}
          <h3 className="mt-1.5 font-serif text-[21px] font-medium leading-snug decoration-1 underline-offset-[5px] group-hover:underline">
            {lecture.title}
          </h3>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">{lecture.summary}</p>
        </div>

        <div className="flex items-center gap-4 md:block">
          <p className="font-medium">{instructor.name}</p>
          <p className="text-sm text-ink-soft md:mt-0.5">
            {instructor.major} {instructor.admissionYear}학번
          </p>
          <div className="md:mt-3">
            <VerifiedBadge grade={instructor.grade} />
          </div>
        </div>

        <div className="flex items-baseline justify-between md:block md:text-right">
          <p className="text-lg font-semibold">{won(lecture.price)}</p>
          <p className="text-sm text-ink-soft md:mt-1">
            <span className="whitespace-nowrap">{minutesLabel(totalMinutes(lecture))}</span>
            <span className="md:hidden">, </span>
            <span className="whitespace-nowrap md:block">
              평점 {lecture.rating}, 후기 {lecture.reviewCount}개
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}

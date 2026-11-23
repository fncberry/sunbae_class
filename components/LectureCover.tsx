import type { Course } from "@/lib/types";
import { coverColor } from "@/lib/catalog";
import { koDate } from "@/lib/format";

/**
 * 강의 썸네일. 사진 대신 필기 노트 표지처럼 과목 정보로 그린다.
 * 대학 수업: 학수번호, 과목명, 교수님 / 자격증: 분야, 시험명, 다음 시험일
 */
export function LectureCover({ course }: { course: Course }) {
  const isClass = course.kind === "major";
  const nameSize = course.name.length > 9 ? "text-[22px]" : course.name.length > 5 ? "text-[26px]" : "text-[32px]";

  return (
    <div
      className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-ui p-4 text-paper"
      style={{
        backgroundColor: coverColor(course),
        // 노트 줄. 장식이 아니라 "필기 노트"라는 소재를 보여주는 정도로만 옅게
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0 23px, rgba(255,255,255,0.07) 23px 24px)",
      }}
      aria-hidden
    >
      {/* 노트 왼쪽 여백선 */}
      <span className="absolute inset-y-0 left-3 w-px bg-white/15" />
      <p className="relative pl-2 text-xs tracking-wide text-paper/70">{isClass ? course.code : course.group}</p>
      <p className={`relative pl-2 font-serif font-bold leading-tight ${nameSize}`}>{course.name}</p>
      <p className="relative pl-2 text-xs text-paper/70">
        {isClass ? `${course.professor} 교수님` : `다음 시험 ${koDate(course.examDate)}`}
      </p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { LectureCard } from "@/components/LectureCard";
import { courses, getCourse, getLecturesByCourse } from "@/lib/mock-data";
import { koDate } from "@/lib/format";

export function generateStaticParams() {
  return courses.map((c) => ({ courseId: c.id }));
}

export default async function CoursePage(props: PageProps<"/courses/[courseId]">) {
  const { courseId } = await props.params;
  const course = getCourse(courseId);
  if (!course) notFound();

  const courseLectures = getLecturesByCourse(course.id);
  const isMajor = course.kind === "major";

  return (
    <div className="mx-auto max-w-6xl px-6">
      <header className="grid gap-10 pb-12 pt-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Link href="/courses" className="text-sm text-ink-soft underline-offset-4 hover:underline">
            과목 찾기로 돌아가기
          </Link>
          <p className="mt-8 text-ink-soft">{isMajor ? course.code : course.group}</p>
          <h1 className="mt-1 font-serif text-[42px] font-bold leading-tight">{course.name}</h1>
          {isMajor && (
            <p className="mt-2 text-lg">
              {course.professor} 교수님 분반, {course.semester?.replace("-", "년 ")}
            </p>
          )}
        </div>
        <dl className="grid content-end gap-4 text-sm lg:col-span-4 lg:col-start-9">
          {isMajor && (
            <div className="flex justify-between border-t border-rule pt-3">
              <dt className="text-ink-soft">이번 학기 수강생</dt>
              <dd>약 {course.students}명</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-rule pt-3">
            <dt className="text-ink-soft">{isMajor ? "기말고사" : "다음 시험"}</dt>
            <dd>{koDate(course.examDate)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-3">
            <dt className="text-ink-soft">환불 마감</dt>
            <dd>{course.examLabel} 당일까지</dd>
          </div>
        </dl>
      </header>

      <section className="border-t border-ink pt-8">
        <h2 className="font-serif text-2xl font-bold">
          {isMajor ? "이 분반 강의" : "강의"} {courseLectures.length > 0 && <span className="text-ink-faint">{courseLectures.length}</span>}
        </h2>

        {courseLectures.length > 0 ? (
          <ul className="mt-2">
            {courseLectures.map((l) => (
              <LectureCard key={l.id} lecture={l} showCourse={false} />
            ))}
          </ul>
        ) : (
          <div className="mt-6 max-w-[52ch]">
            <p className="text-lg">아직 강의가 없어요.</p>
            <p className="mt-2 leading-relaxed text-ink-soft">
              {isMajor
                ? `${course.professor} 교수님 ${course.name}에서 A+를 받았다면 첫 강의를 올려 주세요. 이번 학기에 약 ${course.students}명이 듣고 있어요.`
                : `${course.name} 점수표나 합격증이 있다면 첫 강의를 올려 주세요.`}
            </p>
            <Link
              href="/instructor"
              className="mt-6 inline-block rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink/85"
            >
              강사로 지원하기
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { PurchaseBox } from "@/components/PurchaseBox";
import { SyllabusRow } from "@/components/SyllabusRow";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getLecture, listLectureIds, listReviews } from "@/lib/data";
import { courseLabel, instructorMeta, koDate, minutesLabel, totalMinutes, won } from "@/lib/format";

export async function generateStaticParams() {
  const ids = await listLectureIds();
  return ids.map((lectureId) => ({ lectureId }));
}

export default async function LecturePage(props: PageProps<"/lectures/[lectureId]">) {
  const { lectureId } = await props.params;
  const lecture = await getLecture(lectureId);
  if (!lecture) notFound();

  const { course, instructor } = lecture;
  const lectureReviews = await listReviews(lecture.id);
  const preview = lecture.chapters.find((c) => c.preview);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-10 lg:pb-0">
      <Link href={`/courses/${course.id}`} className="text-sm text-ink-soft underline-offset-4 hover:underline">
        {courseLabel(course)}
      </Link>

      <div className="mt-8 grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h1 className="font-serif text-[34px] font-bold leading-[1.3]">{lecture.title}</h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink-soft">{lecture.summary}</p>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>평점 {lecture.rating} (후기 {lecture.reviewCount}개)</span>
            <span>수강생 {lecture.sales}명</span>
            <span>
              {lecture.chapters.length}강, 총 {minutesLabel(totalMinutes(lecture))}
            </span>
          </p>

          <figure className="mt-10">
            <div className="relative grid aspect-video place-items-center rounded-ui bg-ink">
              <button
                aria-label="맛보기 재생"
                className="grid h-16 w-16 place-items-center rounded-full bg-paper text-ink hover:bg-wash"
              >
                <Play size={24} className="ml-1 fill-ink" />
              </button>
            </div>
            {preview && (
              <figcaption className="mt-3 text-sm text-ink-soft">
                무료로 볼 수 있는 맛보기: {preview.title} ({preview.minutes}분)
              </figcaption>
            )}
          </figure>

          <div className="mt-12">
            <SyllabusRow label="강사">
              <Link
                href={`/instructors/${instructor.id}`}
                className="font-serif text-xl font-bold underline-offset-4 hover:underline"
              >
                {instructor.name}
              </Link>
              <p className="mt-0.5 text-sm text-ink-soft">
                {instructorMeta(instructor)}
              </p>
              <div className="mt-4">
                <VerifiedBadge
                  grade={instructor.grade}
                  label={instructor.proof}
                  size="lg"
                />
              </div>
              <p className="mt-4 max-w-[60ch] leading-relaxed">{instructor.bio}</p>
              <Link
                href={`/instructors/${instructor.id}`}
                className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
              >
                {instructor.name} 선배의 다른 강의와 후기 보기
              </Link>
            </SyllabusRow>

            <SyllabusRow label="다루는 내용">
              <ul className="space-y-2.5 leading-relaxed">
                {lecture.covers.map((c) => (
                  <li key={c} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-faint">
                    {c}
                  </li>
                ))}
              </ul>
            </SyllabusRow>

            <SyllabusRow label="강의 목록">
              <ol>
                {lecture.chapters.map((ch) => (
                  <li
                    key={ch.title}
                    className="flex items-baseline justify-between gap-6 border-t border-rule py-3 first:border-t-0 first:pt-0"
                  >
                    <span>
                      {ch.title}
                      {ch.preview && (
                        <button className="ml-3 text-sm font-medium underline underline-offset-4">무료로 보기</button>
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-ink-soft">{ch.minutes}분</span>
                  </li>
                ))}
              </ol>
            </SyllabusRow>

            <SyllabusRow label={`후기 ${lecture.reviewCount}개`}>
              {lectureReviews.length > 0 ? (
                <ul>
                  {lectureReviews.map((r) => (
                    <li key={r.text} className="border-t border-rule py-5 first:border-t-0 first:pt-0">
                      <p className="max-w-[60ch] leading-relaxed">{r.text}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        별점 {r.rating}/5, {r.author}, {koDate(r.date)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">아직 후기가 없어요.</p>
              )}
            </SyllabusRow>
          </div>
        </div>

        <aside id="purchase" className="scroll-mt-8 lg:sticky lg:top-8 lg:self-start">
          <PurchaseBox price={lecture.price} studyGroup={lecture.studyGroup} examDate={course.examDate} examLabel={course.examLabel} />
        </aside>
      </div>

      {/* 모바일: 결제 영역이 맨 아래로 밀리므로 하단에 고정 바를 둔다 */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-ink bg-paper px-6 py-3 lg:hidden">
        <p className="text-lg font-semibold">{won(lecture.price)}{lecture.studyGroup ? "부터" : ""}</p>
        <a href="#purchase" className="rounded-ui bg-pen px-5 py-3 text-sm font-semibold text-paper">
          구매 방식 고르기
        </a>
      </div>
    </div>
  );
}

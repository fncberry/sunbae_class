import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LectureTile } from "@/components/LectureTile";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getInstructorProfile, listInstructorIds } from "@/lib/data";
import { courseShortLabel, instructorMeta, koDate } from "@/lib/format";

export async function generateStaticParams() {
  const ids = await listInstructorIds();
  return ids.map((instructorId) => ({ instructorId }));
}

export async function generateMetadata(props: PageProps<"/instructors/[instructorId]">): Promise<Metadata> {
  const { instructorId } = await props.params;
  const profile = await getInstructorProfile(instructorId);
  return { title: profile ? `${profile.instructor.name} 선배 | 선배클래스` : "선배클래스" };
}

export default async function InstructorPage(props: PageProps<"/instructors/[instructorId]">) {
  const { instructorId } = await props.params;
  const profile = await getInstructorProfile(instructorId);
  if (!profile) notFound();

  const { instructor, verifications, lectures, reviews, stats } = profile;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-10">
      <Link href="/courses" className="text-sm text-ink-soft underline-offset-4 hover:underline">
        과목 찾기로 돌아가기
      </Link>

      {/* 소개 + 요약 지표 */}
      <header className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h1 className="font-serif text-[40px] font-bold leading-tight">{instructor.name}</h1>
          <p className="mt-1 text-lg text-ink-soft">{instructorMeta(instructor)}</p>
          {instructor.bio && <p className="mt-6 max-w-[60ch] text-lg leading-relaxed">{instructor.bio}</p>}

          <ul className="mt-8 space-y-4" aria-label="인증받은 과목">
            {verifications.map((v) => (
              <li key={v.course.id} className="flex items-center gap-4">
                <VerifiedBadge grade={v.grade} size="lg" />
                <div>
                  <Link href={`/courses/${v.course.id}`} className="font-medium underline-offset-4 hover:underline">
                    {courseShortLabel(v.course)}
                  </Link>
                  {v.proof && <p className="text-sm text-ink-soft">{v.proof}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid h-fit grid-cols-2 gap-x-6 border-t border-ink lg:mt-2">
          <div className="col-span-2 border-b border-rule py-6">
            <dt className="text-sm text-ink-soft">평균 평점</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              {stats.rating !== null ? (
                <>
                  <span className="font-serif text-[44px] font-bold leading-none">{stats.rating.toFixed(1)}</span>
                  <span className="text-ink-soft">5점 만점, 후기 {stats.reviewCount}개</span>
                </>
              ) : (
                <span className="text-lg">아직 후기가 없어요</span>
              )}
            </dd>
          </div>
          <div className="py-6">
            <dt className="text-sm text-ink-soft">누적 수강생</dt>
            <dd className="mt-1 text-2xl font-semibold">{stats.students}명</dd>
          </div>
          <div className="py-6">
            <dt className="text-sm text-ink-soft">강의</dt>
            <dd className="mt-1 text-2xl font-semibold">{stats.lectureCount}개</dd>
          </div>
        </dl>
      </header>

      {/* 강의 모음 */}
      <section className="mt-16 border-t border-ink pt-8" aria-labelledby="lectures-title">
        <h2 id="lectures-title" className="font-serif text-2xl font-bold">
          강의 <span className="text-ink-faint">{lectures.length}</span>
        </h2>
        {lectures.length > 0 ? (
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {lectures.map((l) => (
              <LectureTile key={l.id} lecture={l} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-soft">지금 판매 중인 강의가 없어요.</p>
        )}
      </section>

      {/* 후기 모음 */}
      <section className="mt-16 border-t border-ink pt-8" aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="font-serif text-2xl font-bold">
          후기 <span className="text-ink-faint">{stats.reviewCount}</span>
        </h2>
        {reviews.length > 0 ? (
          <ul className="mt-4 max-w-3xl">
            {reviews.map((r, i) => (
              <li key={`${r.lectureId}-${i}`} className="border-t border-rule py-6 first:border-t-0">
                <Link href={`/lectures/${r.lectureId}`} className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                  {r.lectureTitle}
                </Link>
                <p className="mt-2 leading-relaxed">{r.text}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  별점 {r.rating}/5, {r.author}, {koDate(r.date)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-soft">아직 표시할 후기가 없어요.</p>
        )}
      </section>
    </div>
  );
}

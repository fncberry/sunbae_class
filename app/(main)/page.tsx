import Link from "next/link";
import { CourseSearch } from "@/components/CourseSearch";
import { LectureCard } from "@/components/LectureCard";
import { listCatalogCourses, listPopularLectures } from "@/lib/data";

export default async function HomePage() {
  const [catalog, popular] = await Promise.all([listCatalogCourses(), listPopularLectures(3)]);
  // 홈 검색은 대학 수업만, 강의 많은 순으로 몇 개만 보여준다. 전체는 /courses
  const coursesWithCount = catalog
    .filter((c) => c.kind === "major")
    .sort((a, b) => b.lectureCount - a.lectureCount)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* 첫 화면: 왼쪽은 무슨 서비스인지, 오른쪽은 바로 할 일(분반 찾기) */}
      <section id="find" className="grid gap-14 pb-24 pt-16 lg:grid-cols-12 lg:pt-24">
        <div className="lg:col-span-6">
          <h1 className="font-serif text-[38px] font-bold leading-[1.25] sm:text-[44px]">
            같은 교수님 수업에서
            <br />
            A+ 받은 선배가
            <br />
            시험 범위를 정리해 줘요
          </h1>
          <p className="mt-7 max-w-[34ch] text-lg leading-relaxed text-ink-soft">
            학수번호나 교수님 이름으로 내 분반을 찾아보세요. 구독 없이 필요한 과목만 결제하면 돼요.
          </p>
        </div>
        <div className="lg:col-span-5 lg:col-start-8 lg:pt-2">
          <CourseSearch courses={coursesWithCount} />
        </div>
      </section>

      <Section title="이번 주에 많이 팔린 강의" note="판매 수 기준이에요.">
        <ul>
          {popular.map((l) => (
            <LectureCard key={l.id} lecture={l} />
          ))}
        </ul>
      </Section>

      <Section title="결제 전에 확인할 것">
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">강사는 성적이나 점수를 확인받았어요</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-soft">
              대학 수업은 그 과목 성적표, 자격증·어학은 점수표나 합격증을 운영진이 확인해요. 확인이 끝나면 캡처는 지워요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">0강은 결제 전에 볼 수 있어요</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-soft">
              설명 방식이 나랑 맞는지 먼저 보고 결정하세요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">시험 날까지 환불돼요</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-soft">
              전체의 30% 미만으로 들었다면 기말고사나 시험 당일까지 전액 돌려드려요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">강의 영상은 내려받을 수 없어요</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-soft">
              스트리밍으로만 볼 수 있고, 화면에 구매자 학번이 흐리게 표시돼요.
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="강사 지원">
        <p className="max-w-[52ch] text-lg leading-relaxed">
          A+를 받은 과목이 있다면 그 과목 강의를 올릴 수 있어요. 성적표 캡처로 인증하고, 팔린 금액의 70%를 받아요.
        </p>
        <Link
          href="/instructor"
          className="mt-6 inline-block rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink/85"
        >
          강사로 지원하기
        </Link>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-ink py-14 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <h2 className="font-serif text-2xl font-bold">{title}</h2>
        {note && <p className="mt-2 text-sm text-ink-soft">{note}</p>}
      </div>
      <div className="lg:col-span-9">{children}</div>
    </section>
  );
}

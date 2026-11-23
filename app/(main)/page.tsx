import Link from "next/link";
import { CourseSearch } from "@/components/CourseSearch";
import { HomeRail } from "@/components/HomeRail";
import { LectureCover } from "@/components/LectureCover";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { listCatalogLectures } from "@/lib/data";
import type { LectureWithRelations } from "@/lib/types";

export default async function HomePage() {
  const lectures = await listCatalogLectures();

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* 첫 화면 배너: 무슨 서비스인지 + 바로 과목 검색 */}
      <section className="mt-8 grid items-center gap-10 overflow-hidden rounded-ui bg-wash px-6 py-10 sm:px-12 sm:py-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:py-16">
        <div>
          <h1 className="font-serif text-[26px] font-bold leading-[1.3] sm:text-[42px]">
            같은 교수님 수업에서
            <br />
            A+ 받은 선배가
            <br />
            시험 범위를 정리해 줘요
          </h1>
          <p className="mt-5 max-w-[38ch] leading-relaxed text-ink-soft sm:text-lg">
            학수번호나 교수님 이름으로 내 분반을 찾아보세요. 구독 없이 필요한 과목만 결제하면 돼요.
          </p>
          <div className="mt-8">
            <CourseSearch />
          </div>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <Link href="/courses?c=major" className="underline-offset-4 hover:text-ink hover:underline">전공 강의</Link>
            <Link href="/courses?c=liberal" className="underline-offset-4 hover:text-ink hover:underline">교양 강의</Link>
            <Link href="/courses?c=cert" className="underline-offset-4 hover:text-ink hover:underline">자격증·어학</Link>
          </p>
        </div>
        <CoverStack lectures={lectures} />
      </section>

      <div className="py-16">
        <HomeRail lectures={lectures} />
      </div>

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

/**
 * 배너 오른쪽 그림: 강의 카드와 같은 노트 표지를 겹쳐 놓고, 맨 위 표지에 빨간 펜 성적 표시.
 * 단과대학이 서로 다른 인기 강의 세 개를 고른다.
 */
function CoverStack({ lectures }: { lectures: LectureWithRelations[] }) {
  const picked: LectureWithRelations[] = [];
  for (const l of [...lectures].sort((a, b) => b.sales - a.sales)) {
    if (!picked.some((p) => p.course.group === l.course.group)) picked.push(l);
    if (picked.length === 3) break;
  }
  if (picked.length === 0) return null;

  const spots = [
    "left-0 top-14 -rotate-[8deg]",
    "left-16 top-2 rotate-[3deg]",
    "left-32 top-24 rotate-[-2deg]",
  ];
  const top = picked[picked.length - 1];

  return (
    <div aria-hidden className="relative hidden h-[300px] lg:block">
      {picked.map((l, i) => (
        <div key={l.id} className={`absolute w-[250px] shadow-[0_10px_30px_rgba(30,42,68,0.18)] ${spots[i]}`}>
          <LectureCover course={l.course} />
          {l === top && (
            <div className="absolute -right-4 -top-5 rotate-[10deg] rounded-ui bg-paper px-2 py-1.5">
              <VerifiedBadge grade={l.instructor.grade} size="lg" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


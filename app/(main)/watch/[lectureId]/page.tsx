import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { getLecture, listLectureIds } from "@/lib/data";

// TODO(인증 단계): 수강권 확인이 들어가면 이 페이지는 요청 시점 렌더링으로 바뀐다.
export async function generateStaticParams() {
  const ids = await listLectureIds();
  return ids.map((lectureId) => ({ lectureId }));
}

// 목업: 로그인한 수강생 (실제로는 Supabase 세션에서 가져옴)
const viewer = { studentId: "2026xxxx12" };
const currentIndex = 3;

export default async function WatchPage(props: PageProps<"/watch/[lectureId]">) {
  const { lectureId } = await props.params;
  const lecture = await getLecture(lectureId);
  if (!lecture) notFound();

  const { course, instructor } = lecture;
  const total = lecture.chapters.length;
  const current = lecture.chapters[Math.min(currentIndex, total - 1)];

  return (
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <Link href={`/lectures/${lecture.id}`} className="text-sm text-ink-soft underline-offset-4 hover:underline">
        {lecture.title}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {/* 실제로는 스트리밍 서비스 플레이어 + 서명된 재생 토큰 */}
          <div className="relative aspect-video select-none overflow-hidden rounded-ui bg-ink">
            <div className="absolute inset-0 grid place-items-center">
              <Play size={40} className="text-paper/80" />
            </div>
            {/* 구매자 학번 워터마크: 화면 녹화 유출을 줄이기 위한 표시 */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {["left-[8%] top-[14%]", "right-[10%] top-[46%]", "left-[32%] bottom-[18%]"].map((pos) => (
                <span key={pos} className={`absolute text-sm text-paper/15 ${pos}`}>
                  {viewer.studentId}
                </span>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
              <div className="h-[3px] bg-paper/20">
                <div className="h-full w-[38%] bg-paper" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-paper/60">
                <span>18:42</span>
                <span>{current.minutes}:00</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="font-serif text-2xl font-bold">{current.title}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {instructor.name} 선배,{" "}
                {course.kind === "major" ? `${course.professor} 교수님 ${course.name}` : course.name}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button className="rounded-ui border border-ink-faint px-3.5 py-2 hover:border-ink">정리 자료 PDF 받기</button>
              <button className="rounded-ui bg-ink px-3.5 py-2 text-paper hover:bg-ink/85">선배에게 질문하기</button>
            </div>
          </div>
        </div>

        <aside>
          <p className="text-sm">
            {total}강 중 <b>{currentIndex}강</b> 들었어요
          </p>
          <div className="mt-2 h-[3px] bg-rule">
            <div className="h-full bg-ink" style={{ width: `${(currentIndex / total) * 100}%` }} />
          </div>
          <ol className="mt-5">
            {lecture.chapters.map((ch, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={ch.title}>
                  <button
                    className={`flex w-full items-baseline justify-between gap-4 border-l-2 py-2.5 pl-3 text-left text-sm ${
                      active ? "border-ink font-semibold" : "border-transparent hover:border-rule"
                    } ${done ? "text-ink-faint" : ""}`}
                  >
                    <span>{ch.title}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{done ? "완료" : `${ch.minutes}분`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}

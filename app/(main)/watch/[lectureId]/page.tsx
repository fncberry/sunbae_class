import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Lock, Play } from "lucide-react";
import { requireUser, viewerLabel } from "@/lib/auth";
import { courseLabel } from "@/lib/format";
import { getWatchLecture, type WatchChapter } from "@/lib/learning";
import { markChapterDone } from "./actions";

export const metadata: Metadata = { title: "강의 보기 | 선배클래스", robots: { index: false } };

export default function WatchPage(props: PageProps<"/watch/[lectureId]">) {
  // 로그인한 사람마다 다른 화면(워터마크, 진도, 볼 수 있는 챕터)이라 전부 요청 시점에 그린다
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-6 pt-8" aria-busy="true">
          <div className="mt-10 aspect-video rounded-ui bg-wash lg:w-[calc(100%-340px)]" />
        </div>
      }
    >
      <WatchContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function WatchContent({
  params,
  searchParams,
}: {
  params: PageProps<"/watch/[lectureId]">["params"];
  searchParams: PageProps<"/watch/[lectureId]">["searchParams"];
}) {
  const [{ lectureId }, sp] = await Promise.all([params, searchParams]);
  const requested = typeof sp.c === "string" && /^\d+$/.test(sp.c) ? Number(sp.c) : null;
  const here = `/watch/${lectureId}${requested !== null ? `?c=${requested}` : ""}`;

  const user = await requireUser(here);
  const lecture = await getWatchLecture(user, lectureId);
  if (!lecture) notFound();

  const { chapters } = lecture;
  const canWatch = (ch: WatchChapter) => lecture.access === "full" || ch.preview;

  if (chapters.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <BackLink id={lecture.id} title={lecture.title} />
        <p className="mt-10 text-ink-soft">아직 올라온 강의가 없어요.</p>
      </div>
    );
  }

  // 주소로 고른 챕터 → 수강생이면 안 본 첫 챕터 → 볼 수 있는 첫 챕터
  const current =
    (requested !== null ? chapters.find((ch) => ch.position === requested) : undefined) ??
    (lecture.enrolled ? chapters.find((ch) => !ch.completed) : undefined) ??
    chapters.find(canWatch) ??
    chapters[0];
  const locked = !canWatch(current);
  const next = chapters[chapters.indexOf(current) + 1];
  const doneCount = chapters.filter((ch) => ch.completed).length;
  const viewer = viewerLabel(user);
  const buyHref = `/lectures/${lecture.id}#purchase`;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <BackLink id={lecture.id} title={lecture.title} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {/* 6단계: 스트리밍 서비스 플레이어 + 서버가 발급하는 재생 토큰 */}
          <div className="relative aspect-video select-none overflow-hidden rounded-ui bg-ink">
            {locked ? (
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-paper">
                <div>
                  <Lock size={28} className="mx-auto text-paper/70" aria-hidden />
                  <p className="mt-3 font-semibold">결제하면 볼 수 있어요</p>
                  <Link href={buyHref} className="mt-4 inline-block rounded-ui bg-pen px-5 py-2.5 text-sm font-semibold hover:bg-pen-dark">
                    구매 방식 고르기
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="absolute inset-0 grid place-items-center">
                  <Play size={40} className="text-paper/80" aria-hidden />
                </div>
                {/* 보는 사람 학번 워터마크: 화면 녹화 유출을 줄이기 위한 표시 */}
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {["left-[8%] top-[14%]", "right-[10%] top-[46%]", "left-[32%] bottom-[18%]"].map((pos) => (
                    <span key={pos} className={`absolute text-sm text-paper/15 ${pos}`}>
                      {viewer}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="font-serif text-2xl font-bold">{current.title}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {lecture.instructorName} 선배, {courseLabel(lecture.course)}
              </p>
            </div>
            {lecture.enrolled && !locked && (
              current.completed ? (
                <p className="text-sm text-ink-soft">다 본 강의예요</p>
              ) : (
                <form action={markChapterDone}>
                  <input type="hidden" name="lectureId" value={lecture.id} />
                  <input type="hidden" name="chapterId" value={current.id} />
                  {next && <input type="hidden" name="nextPosition" value={next.position} />}
                  <button type="submit" className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85">
                    다 봤어요
                  </button>
                </form>
              )
            )}
          </div>

          {lecture.access === "preview" && !locked && (
            <p className="mt-6 text-sm text-ink-soft">
              맛보기만 볼 수 있어요.{" "}
              <Link href={buyHref} className="font-medium text-ink underline underline-offset-4">
                전체 강의 구매하기
              </Link>
            </p>
          )}
        </div>

        <aside>
          {lecture.enrolled && (
            <>
              <p className="text-sm">
                {chapters.length}강 중 <b>{doneCount}강</b> 다 봤어요
              </p>
              <div className="mt-2 h-[3px] bg-rule">
                <div className="h-full bg-ink" style={{ width: `${(doneCount / chapters.length) * 100}%` }} />
              </div>
            </>
          )}
          <ol className={lecture.enrolled ? "mt-5" : ""}>
            {chapters.map((ch) => {
              const active = ch.id === current.id;
              const open = canWatch(ch);
              return (
                <li key={ch.id}>
                  <Link
                    href={`/watch/${lecture.id}?c=${ch.position}`}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-baseline justify-between gap-4 border-l-2 py-2.5 pl-3 text-left text-sm ${
                      active ? "border-ink font-semibold" : "border-transparent hover:border-rule"
                    } ${ch.completed || !open ? "text-ink-faint" : ""}`}
                  >
                    <span>{ch.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                      {!open && <Lock size={12} aria-label="잠김" />}
                      {ch.completed ? "완료" : `${ch.minutes}분`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function BackLink({ id, title }: { id: string; title: string }) {
  return (
    <Link href={`/lectures/${id}`} className="text-sm text-ink-soft underline-offset-4 hover:underline">
      {title}
    </Link>
  );
}

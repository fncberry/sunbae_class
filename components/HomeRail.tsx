"use client";

// 홈의 탭별 강의 줄. 왼쪽 소개 패널 + 오른쪽 가로로 넘기는 강의 카드.
// 카드는 과목 찾기 화면과 같은 LectureTile을 쓴다.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LectureWithRelations } from "@/lib/types";
import { courseInCategory, sortLectures } from "@/lib/catalog";
import { LectureTile } from "./LectureTile";

type Tab = {
  key: string;
  label: string;
  title: string;
  desc: string;
  href: string;
  color: string; // 소개 패널 색. 과목 표지 색과 같은 팔레트
  pick: (all: LectureWithRelations[]) => LectureWithRelations[];
};

const TABS: Tab[] = [
  {
    key: "popular",
    label: "많이 팔린 강의",
    title: "이번 학기 가장 많이 들은 강의",
    desc: "전공, 교양, 자격증까지 판매 수 순서로 모았어요.",
    href: "/courses",
    color: "#1e2a44",
    pick: (all) => sortLectures(all, "popular"),
  },
  {
    key: "major",
    label: "전공",
    title: "같은 분반 A+ 선배의 전공 강의",
    desc: "교수님 시험 스타일에 맞춰 정리한 강의예요. 단과대학별로 찾아볼 수 있어요.",
    href: "/courses?c=major",
    color: "#33475b",
    pick: (all) => sortLectures(all.filter((l) => courseInCategory(l.course, "major")), "popular"),
  },
  {
    key: "liberal",
    label: "교양",
    title: "교양 과목도 같은 교수님 기준으로",
    desc: "글쓰기 과제, 발표 평가, 서술형 시험처럼 교양에서 점수가 갈리는 부분을 다뤄요.",
    href: "/courses?c=liberal",
    color: "#7a5a1e",
    pick: (all) => sortLectures(all.filter((l) => courseInCategory(l.course, "liberal")), "popular"),
  },
  {
    key: "cert",
    label: "자격증·어학",
    title: "점수표·합격증을 인증한 선배",
    desc: "토익, 정보처리기사처럼 결과로 증명한 선배가 푸는 순서를 알려줘요.",
    href: "/courses?c=cert",
    color: "#21495f",
    pick: (all) => sortLectures(all.filter((l) => courseInCategory(l.course, "cert")), "popular"),
  },
  {
    key: "exam",
    label: "기말 임박",
    title: "기말고사가 가까운 과목부터",
    desc: "시험일이 빠른 순서예요. 환불은 각 과목 시험 당일까지 돼요.",
    href: "/courses?sort=exam",
    color: "#24493f",
    pick: (all) => sortLectures(all.filter((l) => l.course.kind === "major"), "exam"),
  },
];

export function HomeRail({ lectures }: { lectures: LectureWithRelations[] }) {
  const [active, setActive] = useState(TABS[0].key);
  const tab = TABS.find((t) => t.key === active)!;
  const items = tab.pick(lectures);
  const baseId = useId();

  return (
    <section aria-label="강의 둘러보기">
      <div role="tablist" aria-label="강의 분류" className="flex gap-7 overflow-x-auto border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`${baseId}-tab-${t.key}`}
            aria-selected={t.key === active}
            aria-controls={`${baseId}-panel`}
            onClick={() => setActive(t.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 pb-3 text-[17px] ${
              t.key === active ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab.key}`}
        className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]"
      >
        <div className="flex flex-col justify-between gap-5 rounded-ui p-5 text-paper sm:gap-8 sm:p-7" style={{ backgroundColor: tab.color }}>
          <div>
            <p className="text-sm text-paper/70">{tab.label}</p>
            <h3 className="mt-2 font-serif text-xl font-bold leading-snug sm:mt-3 sm:text-[24px]">{tab.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-paper/80 sm:mt-3 sm:text-[15px]">{tab.desc}</p>
          </div>
          <Link
            href={tab.href}
            className="inline-flex w-fit items-center gap-1 rounded-ui bg-paper px-4 py-2.5 text-sm font-semibold text-ink hover:bg-wash"
          >
            전체 보기 <ChevronRight size={16} aria-hidden />
          </Link>
        </div>

        {items.length > 0 ? (
          <Scroller key={tab.key} items={items} />
        ) : (
          <p className="self-center text-ink-soft">아직 이 분류에 올라온 강의가 없어요.</p>
        )}
      </div>
    </section>
  );
}

/** 가로로 넘기는 카드 줄. 넘칠 때만 좌우 버튼을 보여준다. */
function Scroller({ items }: { items: LectureWithRelations[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  function measure() {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function move(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="relative min-w-0">
      <ul
        ref={ref}
        onScroll={measure}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((l) => (
          <LectureTile key={l.id} lecture={l} className="w-[236px] shrink-0 snap-start" />
        ))}
      </ul>
      {!edges.start && <ArrowButton side="left" onClick={() => move(-1)} />}
      {!edges.end && <ArrowButton side="right" onClick={() => move(1)} />}
    </div>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "이전 강의" : "다음 강의"}
      // 표지 높이(236px × 10/16 ≈ 148px)의 가운데에 맞춘다
      className={`absolute top-[74px] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink-faint bg-paper text-ink hover:border-ink lg:grid ${
        side === "left" ? "-left-5" : "-right-5"
      }`}
    >
      <Icon size={20} aria-hidden />
    </button>
  );
}

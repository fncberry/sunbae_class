"use client";

// 과목 찾기 화면: 왼쪽 카테고리 + 위쪽 학과 칩 + 강의 카드 그리드.
// 카테고리·학과·정렬·보기 방식은 URL(?c=&d=&sort=&view=)에 두어서, 강의를 보고 뒤로 와도 그대로 남는다.

import Link from "next/link";
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutGrid, List, Search } from "lucide-react";
import type { Course, LectureWithRelations } from "@/lib/types";
import {
  COLLEGES,
  DEFAULT_CATEGORY,
  SORT_LABEL,
  categoryLabel,
  courseInCategory,
  isMajorCourse,
  matchesQuery,
  normalizeCategory,
  sortGroups,
  sortLectures,
  type CategoryKey,
  type Sort,
} from "@/lib/catalog";
import { LectureCard } from "./LectureCard";
import { LectureTile } from "./LectureTile";

type Props = { courses: Course[]; lectures: LectureWithRelations[] };
type View = "grid" | "list";
type State = { category: CategoryKey; dept: string | null; sort: Sort; view: View };

const DEFAULT_STATE: State = { category: DEFAULT_CATEGORY, dept: null, sort: "popular", view: "grid" };

export function CourseCatalog(props: Props) {
  // URL을 읽는 부분은 요청 시점에만 알 수 있으므로, 미리 그린 화면은 기본 상태(전공 전체)로 보여준다
  return (
    <Suspense fallback={<CatalogView {...props} state={DEFAULT_STATE} />}>
      <CatalogWithUrlState {...props} />
    </Suspense>
  );
}

function CatalogWithUrlState(props: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: State = {
    category: normalizeCategory(params.get("c"), props.courses),
    dept: params.get("d"),
    sort: (Object.keys(SORT_LABEL) as Sort[]).includes(params.get("sort") as Sort) ? (params.get("sort") as Sort) : "popular",
    view: params.get("view") === "list" ? "list" : "grid",
  };

  function update(patch: Partial<Pick<State, "sort" | "view">>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === DEFAULT_STATE[k as keyof State]) next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return <CatalogView {...props} state={state} onUpdate={update} />;
}

/** 카테고리·학과 링크. 정렬과 보기 방식은 유지한다. */
function hrefFor(state: State, category: CategoryKey, dept: string | null = null) {
  const qs = new URLSearchParams();
  if (category !== DEFAULT_CATEGORY) qs.set("c", category);
  if (dept) qs.set("d", dept);
  if (state.sort !== DEFAULT_STATE.sort) qs.set("sort", state.sort);
  if (state.view !== DEFAULT_STATE.view) qs.set("view", state.view);
  const s = qs.toString();
  return s ? `/courses?${s}` : "/courses";
}

function CatalogView({
  courses,
  lectures,
  state,
  onUpdate,
}: Props & { state: State; onUpdate?: (patch: Partial<Pick<State, "sort" | "view">>) => void }) {
  const [query, setQuery] = useState("");
  const { category, sort, view } = state;
  const asideRef = useRef<HTMLElement>(null);

  // 선택된 카테고리가 사이드바 스크롤 밖에 있으면 보이는 위치로 옮긴다 (페이지는 움직이지 않음)
  useEffect(() => {
    const aside = asideRef.current;
    const active = aside?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!aside || !active) return;
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < aside.scrollTop || bottom > aside.scrollTop + aside.clientHeight) {
      aside.scrollTop = top - aside.clientHeight / 2 + active.offsetHeight / 2;
    }
  }, [category]);
  const [root, group] = category.split(":");

  // 정해진 단과대학 전체 + 데이터에만 있는 곳
  const colleges = useMemo(
    () => sortGroups([...COLLEGES, ...courses.filter(isMajorCourse).map((c) => c.group)]),
    [courses],
  );
  const certGroups = useMemo(
    () => sortGroups(courses.filter((c) => c.kind === "cert").map((c) => c.group), []),
    [courses],
  );
  const countIn = (key: CategoryKey) => lectures.filter((l) => courseInCategory(l.course, key)).length;

  // 지금 카테고리의 강의 (검색 반영, 학과 칩은 아래에서)
  const inCategory = useMemo(
    () => lectures.filter((l) => courseInCategory(l.course, category) && matchesQuery(l, query)),
    [lectures, category, query],
  );

  // 학과 칩: 단과대학 하나를 골랐을 때는 학과, 자격증은 시험 이름
  const chipField = root === "major" && group ? "department" : root === "cert" ? "name" : null;
  const chips = useMemo(() => {
    if (!chipField) return [];
    const counts = new Map<string, number>();
    for (const l of inCategory) {
      const v = l.course[chipField] ?? "";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  }, [inCategory, chipField]);
  const dept = chipField && chips.some(([v]) => v === state.dept) ? state.dept : null;

  const shown = useMemo(
    () => sortLectures(dept && chipField ? inCategory.filter((l) => l.course[chipField] === dept) : inCategory, sort),
    [inCategory, dept, chipField, sort],
  );

  // 강의가 아직 없는 과목 (강사 모집용)
  const lectureCourseIds = new Set(lectures.map((l) => l.courseId));
  const waiting = (key: CategoryKey) =>
    courses.filter((c) => courseInCategory(c, key) && !lectureCourseIds.has(c.id));

  const title = `${categoryLabel(category)} 강의`;
  const showSections = category === "major" && !query.trim();

  return (
    <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
      {/* ── 카테고리 ───────────────────────────── */}
      {/* 화면에 고정하고, 목록이 화면보다 길면 이 안에서만 스크롤한다.
          끝까지 내리면 페이지 스크롤로 이어진다(overscroll 기본값). 스크롤바는 평소엔 옅게, 마우스를 올리면 진하게 보인다(아래에 메뉴가 더 있다는 표시). */}
      <aside
        ref={asideRef}
        className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1 [scrollbar-color:var(--color-rule)_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-ink-faint)_transparent]"
      >
        <h2 className="text-sm font-semibold text-ink-soft">강의 카테고리</h2>
        <nav className="mt-4 pb-8 text-[15px]" aria-label="강의 카테고리">
          <CategoryGroup label="전공" open={root === "major"} href={hrefFor(state, "major")}>
            <CategoryLink href={hrefFor(state, "major")} active={category === "major"} count={countIn("major")}>
              전공 전체
            </CategoryLink>
            {colleges.map((g) => (
              <CategoryLink key={g} href={hrefFor(state, `major:${g}`)} active={category === `major:${g}`} count={countIn(`major:${g}`)}>
                {g}
              </CategoryLink>
            ))}
          </CategoryGroup>

          <div className="mt-1 border-t border-rule pt-1">
            <CategoryLink href={hrefFor(state, "liberal")} active={category === "liberal"} count={countIn("liberal")} top>
              교양
            </CategoryLink>
          </div>

          <div className="mt-1 border-t border-rule pt-1">
            <CategoryGroup label="자격증·어학" open={root === "cert"} href={hrefFor(state, "cert")}>
              <CategoryLink href={hrefFor(state, "cert")} active={category === "cert"} count={countIn("cert")}>
                자격증·어학 전체
              </CategoryLink>
              {certGroups.map((g) => (
                <CategoryLink key={g} href={hrefFor(state, `cert:${g}`)} active={category === `cert:${g}`} count={countIn(`cert:${g}`)}>
                  {g}
                </CategoryLink>
              ))}
            </CategoryGroup>
          </div>
        </nav>
        {/* 아래에 메뉴가 더 있다는 표시. 스크롤바를 숨기는 환경(macOS 등)을 위해 둔다 */}
        <div aria-hidden className="pointer-events-none sticky bottom-0 -mt-8 hidden h-8 bg-gradient-to-t from-paper lg:block" />
      </aside>

      {/* 좁은 화면: 카테고리를 가로 스크롤 칩으로 */}
      <nav className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:hidden" aria-label="강의 카테고리">
        {[
          ["major", "전공 전체"],
          ...colleges.map((g) => [`major:${g}`, g]),
          ["liberal", "교양"],
          ["cert", "자격증·어학"],
        ].map(([key, label]) => (
          <Chip key={key} href={hrefFor(state, key)} active={category === key || (key === "cert" && root === "cert")}>
            {label}
          </Chip>
        ))}
      </nav>

      {/* ── 강의 목록 ───────────────────────────── */}
      <section aria-labelledby="catalog-title" className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <h1 id="catalog-title" className="font-serif text-[28px] font-bold">
            {title} <span className="text-ink-faint">{inCategory.length}</span>
          </h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex h-10 w-56 items-center gap-2 rounded-ui border border-ink-faint px-3 focus-within:border-ink">
              <Search size={16} className="shrink-0 text-ink-faint" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="과목, 교수님, 강의 제목"
                aria-label="강의 검색"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
            </label>
            <select
              aria-label="정렬"
              value={sort}
              onChange={(e) => onUpdate?.({ sort: e.target.value as Sort })}
              className="h-10 rounded-ui border border-ink-faint bg-paper px-3 text-sm"
            >
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-ui border border-ink-faint" role="group" aria-label="보기 방식">
              <ViewButton active={view === "grid"} onClick={() => onUpdate?.({ view: "grid" })} label="카드로 보기">
                <LayoutGrid size={17} />
              </ViewButton>
              <ViewButton active={view === "list"} onClick={() => onUpdate?.({ view: "list" })} label="목록으로 보기">
                <List size={17} />
              </ViewButton>
            </div>
          </div>
        </div>

        {chips.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip href={hrefFor(state, category)} active={!dept} count={inCategory.length}>
              전체
            </Chip>
            {chips.map(([value, count]) => (
              <Chip key={value} href={hrefFor(state, category, value)} active={dept === value} count={count}>
                {value}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-8">
          {showSections ? (
            // 전공 전체: 단과대학별 섹션
            colleges.map((g) => {
              const key = `major:${g}`;
              const items = sortLectures(inCategory.filter((l) => l.course.group === g), sort);
              const empty = waiting(key);
              if (items.length === 0 && empty.length === 0) return null;
              return (
                <section key={g} className="border-t border-rule pb-10 pt-6 first:border-t-0 first:pt-0" aria-label={g}>
                  <div className="mb-5 flex items-baseline justify-between gap-4">
                    <h2 className="font-serif text-xl font-bold">
                      {g} <span className="text-ink-faint">{items.length}</span>
                    </h2>
                    {items.length > 0 && (
                      <Link href={hrefFor(state, key)} className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                        {g}만 보기
                      </Link>
                    )}
                  </div>
                  <Lectures items={items} view={view} />
                  <WaitingCourses courses={empty} />
                </section>
              );
            })
          ) : shown.length > 0 ? (
            <>
              <Lectures items={shown} view={view} />
              {!query.trim() && !dept && <WaitingCourses courses={waiting(category)} />}
            </>
          ) : (
            <EmptyState query={query} label={categoryLabel(category)} waiting={query.trim() ? [] : waiting(category)} />
          )}
        </div>
      </section>
    </div>
  );
}

function Lectures({ items, view }: { items: LectureWithRelations[]; view: View }) {
  if (items.length === 0) return null;
  if (view === "list") {
    return (
      <ul className="border-y border-rule">
        {items.map((l) => (
          <LectureCard key={l.id} lecture={l} />
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((l) => (
        <LectureTile key={l.id} lecture={l} />
      ))}
    </ul>
  );
}

/** 강의가 아직 없는 과목. 강사 지원으로 이어지게 한다. */
function WaitingCourses({ courses }: { courses: Course[] }) {
  if (courses.length === 0) return null;
  return (
    <p className="mt-8 text-sm leading-relaxed text-ink-soft">
      강의를 기다리는 과목:{" "}
      {courses.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          <Link href={`/courses/${c.id}`} className="text-ink underline-offset-4 hover:underline">
            {c.name}
            {c.professor ? ` (${c.professor})` : ""}
          </Link>
        </span>
      ))}
      .{" "}
      <Link href="/instructor" className="font-medium text-ink underline underline-offset-4">
        A+를 받았다면 강사로 지원하기
      </Link>
    </p>
  );
}

function EmptyState({ query, label, waiting }: { query: string; label: string; waiting: Course[] }) {
  return (
    <div className="max-w-[56ch] border-t border-rule pt-8">
      {query.trim() ? (
        <>
          <p className="text-lg">“{query.trim()}”에 맞는 {label} 강의가 없어요.</p>
          <p className="mt-2 text-ink-soft">과목명이나 교수님 이름으로 다시 찾아보거나, 다른 카테고리를 골라 보세요.</p>
        </>
      ) : (
        <>
          <p className="text-lg">아직 {label} 강의가 없어요.</p>
          {waiting.length > 0 ? (
            <WaitingCourses courses={waiting} />
          ) : (
            <p className="mt-2 leading-relaxed text-ink-soft">
              {label} 과목에서 A+를 받았다면 첫 강의를 올려 주세요.{" "}
              <Link href="/instructor" className="font-medium text-ink underline underline-offset-4">
                강사로 지원하기
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 카테고리 묶음(전공, 자격증·어학).
 * 이름을 누르면 그 카테고리로 이동하고, 화살표는 왼쪽 메뉴만 접고 펼친다(목록은 그대로).
 */
function CategoryGroup({
  label,
  open: defaultOpen,
  href,
  children,
}: {
  label: string;
  open: boolean;
  href: string;
  children: React.ReactNode;
}) {
  // 사용자가 화살표를 누르기 전에는 지금 카테고리 기준으로 펼친다
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen;
  const listId = useId();

  return (
    <div>
      <div className="flex items-center rounded-ui hover:bg-wash">
        <Link href={href} className="flex-1 px-3 py-2 font-semibold">
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setToggled(!open)}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label} 메뉴 ${open ? "접기" : "펼치기"}`}
          className="grid h-9 w-9 place-items-center rounded-ui text-ink-faint hover:text-ink"
        >
          <ChevronDown size={16} className={`transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {/* 높이가 정해지지 않은 목록을 부드럽게 접고 펴기: grid-template-rows 0fr ↔ 1fr.
          접혔을 때는 inert로 키보드 이동에서도 빠지게 한다. */}
      <div
        id={listId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mb-2 mt-0.5 space-y-0.5 pl-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CategoryLink({
  href,
  active,
  count,
  top = false,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  top?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between rounded-ui px-3 py-2 ${top ? "font-semibold" : ""} ${
        active ? "bg-ink font-semibold text-paper" : "hover:bg-wash"
      }`}
    >
      <span>{children}</span>
      <span className={`text-sm ${active ? "text-paper/70" : "text-ink-faint"}`}>{count}</span>
    </Link>
  );
}

function Chip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-ui border px-3.5 text-sm ${
        active ? "border-ink bg-ink font-semibold text-paper" : "border-ink-faint hover:border-ink"
      }`}
    >
      {children}
      {count !== undefined && <span className={active ? "text-paper/70" : "text-ink-faint"}>{count}</span>}
    </Link>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-10 w-10 place-items-center ${active ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
    >
      {children}
    </button>
  );
}


"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CatalogCourse, CourseKind } from "@/lib/types";
import { koDate, won } from "@/lib/format";

type Sort = "exam" | "lectures" | "students";

const TABS: { kind: CourseKind; label: string; hint: string }[] = [
  { kind: "major", label: "전공·교양", hint: "그 과목 A+ 성적을 인증한 선배가 가르쳐요" },
  { kind: "cert", label: "자격증·어학", hint: "점수표나 합격증을 인증한 선배가 가르쳐요" },
];

export function CourseCatalog({ courses }: { courses: CatalogCourse[] }) {
  const [kind, setKind] = useState<CourseKind>("major");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [onlyWithLectures, setOnlyWithLectures] = useState(false);
  const [sort, setSort] = useState<Sort>("exam");

  const inTab = useMemo(() => courses.filter((c) => c.kind === kind), [courses, kind]);
  const groupOptions = useMemo(() => [...new Set(inTab.map((c) => c.group))], [inTab]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = inTab.filter((c) => {
      if (groups.length && !groups.includes(c.group)) return false;
      if (onlyWithLectures && c.lectureCount === 0) return false;
      if (!q) return true;
      return [c.code, c.name, c.professor, c.department, c.group]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    return filtered.sort((a, b) => {
      if (sort === "lectures") return b.lectureCount - a.lectureCount;
      if (sort === "students") return (b.students ?? 0) - (a.students ?? 0);
      return a.examDate.localeCompare(b.examDate);
    });
  }, [inTab, query, groups, onlyWithLectures, sort]);

  function switchTab(next: CourseKind) {
    setKind(next);
    setGroups([]);
    setQuery("");
    if (next === "cert" && sort === "students") setSort("exam");
  }

  function toggleGroup(g: string) {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  const isMajor = kind === "major";
  const hint = TABS.find((t) => t.kind === kind)!.hint;

  return (
    <div>
      <div role="tablist" aria-label="과목 종류" className="flex gap-8 border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={kind === t.kind}
            onClick={() => switchTab(t.kind)}
            className={`-mb-px border-b-2 pb-3 text-lg ${
              kind === t.kind ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{hint}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* 필터 */}
        <aside className="space-y-5 text-[15px] lg:space-y-8">
          <fieldset>
            <legend className="text-sm font-semibold text-ink-soft">{isMajor ? "단과대학" : "분야"}</legend>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 lg:block lg:space-y-2">
              {groupOptions.map((g) => (
                <label key={g} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={groups.includes(g)}
                    onChange={() => toggleGroup(g)}
                    className="h-4 w-4 accent-ink"
                  />
                  {g}
                  <span className="text-sm text-ink-faint">{inTab.filter((c) => c.group === g).length}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={onlyWithLectures}
              onChange={(e) => setOnlyWithLectures(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            강의 있는 것만
          </label>
        </aside>

        {/* 검색 + 표 */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-ui border border-ink-faint px-4 focus-within:border-ink">
              <Search size={18} className="text-ink-faint" aria-hidden />
              <input
                aria-label="검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isMajor ? "과목명, 학수번호, 교수님, 학과" : "시험 이름"}
                className="h-11 w-full bg-transparent outline-none placeholder:text-ink-faint"
              />
            </div>
            <select
              aria-label="정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 rounded-ui border border-ink-faint bg-paper px-3 text-[15px]"
            >
              <option value="exam">시험 가까운 순</option>
              <option value="lectures">강의 많은 순</option>
              {isMajor && <option value="students">수강생 많은 순</option>}
            </select>
          </div>

          <p className="mt-6 text-sm text-ink-soft">{rows.length}개</p>

          {rows.length > 0 ? (
            <table className="mt-2 w-full table-fixed text-[15px]">
              <thead className="text-left text-sm text-ink-soft">
                <tr className="border-b border-ink">
                  {isMajor && <th className="hidden w-28 py-2.5 pr-4 font-normal sm:table-cell">학수번호</th>}
                  <th className="py-2.5 pr-4 font-normal">{isMajor ? "과목" : "시험"}</th>
                  {isMajor && <th className="hidden w-24 py-2.5 pr-4 font-normal md:table-cell">교수님</th>}
                  <th className="hidden w-36 py-2.5 pr-4 font-normal md:table-cell">{isMajor ? "기말고사" : "다음 시험"}</th>
                  <th className="w-16 py-2.5 pr-4 text-right font-normal">강의</th>
                  <th className="hidden w-24 py-2.5 text-right font-normal sm:table-cell">최저가</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="relative border-b border-rule hover:bg-wash">
                    {isMajor && <td className="hidden py-4 pr-4 text-ink-soft sm:table-cell">{c.code}</td>}
                    <td className="py-4 pr-4">
                      <Link href={`/courses/${c.id}`} className="font-medium after:absolute after:inset-0">
                        {c.name}
                      </Link>
                      <span className="block text-sm text-ink-soft">{isMajor ? c.department : c.group}</span>
                      {/* 좁은 화면에서는 숨긴 열 정보를 한 줄로 */}
                      <span className="block text-sm text-ink-soft md:hidden">
                        {isMajor ? `${c.code}, ${c.professor} 교수님, ` : ""}
                        {isMajor ? "기말" : "시험"} {koDate(c.examDate)}
                      </span>
                    </td>
                    {isMajor && <td className="hidden py-4 pr-4 md:table-cell">{c.professor}</td>}
                    <td className="hidden py-4 pr-4 md:table-cell">{koDate(c.examDate)}</td>
                    <td className={`py-4 pr-4 text-right ${c.lectureCount ? "" : "text-ink-faint"}`}>
                      {c.lectureCount ? `${c.lectureCount}개` : "없음"}
                    </td>
                    <td className="hidden py-4 text-right sm:table-cell">
                      {c.minPrice ? won(c.minPrice) : <span className="text-ink-faint">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mt-4 border-t border-rule pt-6">
              <p>조건에 맞는 {isMajor ? "과목" : "시험"}이 없어요.</p>
              <p className="mt-1 text-sm text-ink-soft">
                검색어를 줄이거나 필터를 풀어 보세요. 찾는 {isMajor ? "과목" : "시험"}이 아직 없다면{" "}
                <Link href="/instructor" className="font-medium text-ink underline underline-offset-4">
                  첫 강사로 지원
                </Link>
                할 수 있어요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

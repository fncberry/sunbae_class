"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Course } from "@/lib/types";

type CourseWithCount = Course & { lectureCount: number };

export function CourseSearch({ courses }: { courses: CourseWithCount[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      [c.code, c.name, c.professor, c.department]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [courses, query]);

  return (
    <div>
      <label htmlFor="course-search" className="text-sm font-medium">
        내 분반 찾기
      </label>
      <div className="mt-2 flex items-center gap-3 rounded-ui border border-ink-faint bg-paper px-4 focus-within:border-ink">
        <Search size={18} className="text-ink-faint" aria-hidden />
        <input
          id="course-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="과목명, 학수번호, 교수님 이름"
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
        />
      </div>

      <ul className="mt-6">
        {results.map((c) => (
          <li key={c.id} className="border-t border-rule">
            <Link
              href={`/courses/${c.id}`}
              className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-x-4 py-3.5 hover:bg-wash"
            >
              <span className="pl-1 text-sm text-ink-faint">{c.code}</span>
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-sm text-ink-soft">{c.professor} 교수</span>
              </span>
              <span className={`pr-1 text-sm ${c.lectureCount > 0 ? "text-ink" : "text-ink-faint"}`}>
                {c.lectureCount > 0 ? `강의 ${c.lectureCount}개` : "강의 없음"}
              </span>
            </Link>
          </li>
        ))}
        {results.length === 0 && (
          <li className="border-t border-rule py-5 text-sm text-ink-soft">
            “{query}”에 맞는 과목이 아직 없어요. 이 과목에서 A+를 받았다면{" "}
            <Link href="/instructor" className="font-medium text-ink underline underline-offset-4">
              첫 강사로 지원
            </Link>
            할 수 있어요.
          </li>
        )}
      </ul>
      <p className="mt-5 text-sm text-ink-soft">
        <Link href="/courses" className="font-medium text-ink underline underline-offset-4">
          전체 과목 보기
        </Link>
        에서 학과별로 찾거나 자격증·어학 강의도 볼 수 있어요.
      </p>
    </div>
  );
}

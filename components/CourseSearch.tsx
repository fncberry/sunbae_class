import { Search } from "lucide-react";

/**
 * 홈 배너의 검색창. 과목 찾기(/courses?q=)로 넘어가서 결과를 보여준다.
 * 자바스크립트 없이도 동작하는 일반 폼이다.
 */
export function CourseSearch() {
  return (
    <form action="/courses" method="get" role="search" className="flex max-w-xl items-center gap-3 rounded-ui border border-ink-faint bg-paper pl-4 focus-within:border-ink">
      <Search size={18} className="shrink-0 text-ink-faint" aria-hidden />
      <input
        name="q"
        required
        aria-label="과목 검색"
        placeholder="과목명, 학수번호, 교수님 이름"
        className="h-12 w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
      />
      <button type="submit" className="m-1 shrink-0 rounded-ui bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink/85">
        찾기
      </button>
    </form>
  );
}

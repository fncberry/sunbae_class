import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-10 px-6">
        <Link href="/" className="font-serif text-xl font-bold">
          선배클래스
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] text-ink-soft md:flex">
          <Link href="/courses" className="hover:text-ink">과목 찾기</Link>
          <Link href="/instructor" className="hover:text-ink">강사 지원</Link>
          <Link href="/watch/ds-final-tree-graph" className="hover:text-ink">내 강의</Link>
        </nav>
        <button className="ml-auto rounded-ui border border-ink px-4 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper">
          고려대 메일로 로그인
        </button>
      </div>
    </header>
  );
}

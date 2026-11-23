import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(main)/login/actions";
import { getCurrentUser } from "@/lib/auth";

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
        <div className="ml-auto">
          {/* 세션을 읽는 부분만 요청 시점에 그린다. 나머지 헤더는 정적 */}
          <Suspense fallback={<LoginLink />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <LoginLink />;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="hidden text-ink-soft sm:inline" title={user.email}>
        {user.email.split("@")[0]}
        {user.role === "admin" && (
          <Link href="/admin" className="ml-3 underline underline-offset-4 hover:text-ink">
            운영
          </Link>
        )}
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded-ui border border-ink-faint px-4 py-1.5 font-medium hover:border-ink">
          로그아웃
        </button>
      </form>
    </div>
  );
}

function LoginLink() {
  return (
    <Link
      href="/login"
      className="rounded-ui border border-ink px-4 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper"
    >
      로그인
    </Link>
  );
}

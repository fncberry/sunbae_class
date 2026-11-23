import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "로그인 | 선배클래스",
  robots: { index: false },
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-12 lg:pt-24">
      <div className="lg:col-span-6">
        <h1 className="font-serif text-[34px] font-bold leading-[1.3]">고려대 메일로 로그인</h1>
        <p className="mt-5 max-w-[40ch] text-lg leading-relaxed text-ink-soft">
          비밀번호 없이, 메일로 받은 링크를 누르면 로그인돼요. 처음이면 계정이 바로 만들어져요.
        </p>
        <ul className="mt-8 max-w-[44ch] space-y-2.5 text-sm leading-relaxed text-ink-soft">
          <li>재학생 확인을 위해 @korea.ac.kr 메일만 받아요.</li>
          <li>구매한 강의 영상에는 학번이 흐리게 표시돼요.</li>
        </ul>
      </div>
      <div className="lg:col-span-5 lg:col-start-8 lg:pt-2">
        <Suspense fallback={<div className="h-[164px]" aria-hidden />}>
          <LoginFormWithParams searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginFormWithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : "/");
  return <LoginForm next={next} linkError={params.error === "link"} />;
}

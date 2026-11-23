import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSignedIn, safeNextPath } from "@/lib/auth";
import { parseSchoolAccountName } from "@/lib/onboarding";
import { createServerSupabase } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = {
  title: "가입 마무리 | 선배클래스",
  robots: { index: false },
};

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-12 lg:pt-24">
      <div className="lg:col-span-6">
        <h1 className="font-serif text-[34px] font-bold leading-[1.3]">가입 마무리</h1>
        <p className="mt-5 max-w-[40ch] text-lg leading-relaxed text-ink-soft">
          이름, 닉네임, 학번, 학과만 적으면 끝나요. 한 번만 하면 돼요.
        </p>
        <ul className="mt-8 max-w-[44ch] space-y-2.5 text-sm leading-relaxed text-ink-soft">
          <li>학번은 영상 워터마크에 들어가서, 한 학번은 한 계정에만 쓸 수 있어요.</li>
          <li>강의를 올리고 싶다면 가입 후 강사 지원에서 성적을 인증하면 돼요.</li>
        </ul>
      </div>
      <div className="lg:col-span-5 lg:col-start-8 lg:pt-2">
        <Suspense fallback={<div className="h-[680px]" aria-hidden />}>
          <OnboardingContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function OnboardingContent({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : "/");
  const user = await requireSignedIn(`/onboarding?next=${encodeURIComponent(next)}`);
  if (user.onboarded) redirect(next);

  // 고려대 구글 계정 이름(예: "홍길동[ 학부재학 / 컴퓨터학과 ]")에서 이름·학과를 읽어 미리 채운다
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const meta = (data?.claims.user_metadata ?? {}) as Record<string, unknown>;
  const school = parseSchoolAccountName(meta.full_name ?? meta.name);

  return (
    <OnboardingForm
      next={next}
      email={user.email}
      defaults={{
        name: user.name ?? school?.name ?? "",
        nickname: user.nickname ?? "",
        major: user.major ?? school?.major ?? "",
      }}
      fromSchoolAccount={!!(school?.name || school?.major)}
    />
  );
}

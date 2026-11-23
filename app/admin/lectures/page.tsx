import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { adminCounts, listReviewingLectures } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { adminNav } from "../nav";
import { LectureReviewItem } from "./LectureReviewItem";

export const metadata: Metadata = { title: "선배클래스", robots: { index: false } };

export default function AdminLecturesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AdminLectures />
    </Suspense>
  );
}

async function AdminLectures() {
  await requireAdmin("/admin/lectures");
  const [lectures, counts] = await Promise.all([listReviewingLectures(), adminCounts()]);

  return (
    <DashboardShell area="운영자" nav={adminNav("lectures", counts)}>
      <div className="max-w-5xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">강의 검수</h1>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">
          기출문제 원본이나 교수님 강의자료를 그대로 옮긴 내용이 없는지, 첫 강의가 맛보기로 볼 만한지 확인하세요. 판매를 시작하면 바로 과목 페이지에 올라가요.
        </p>
        <div className="mt-10">
          {lectures.length === 0 ? (
            <p className="text-ink-soft">검수할 강의가 없어요.</p>
          ) : (
            <ul className="border-t border-ink">
              {lectures.map((l) => (
                <LectureReviewItem key={l.id} lecture={l} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

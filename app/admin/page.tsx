import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { VerificationQueue } from "@/components/VerificationQueue";
import { adminCounts, listLeftoverProofs, listPendingVerifications } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { retryProofDelete } from "./actions";
import { adminNav } from "./nav";

// 운영자가 아닌 사람에게는 404를 보여주므로, 제목에도 운영자 화면이라는 표시를 넣지 않는다
export const metadata: Metadata = { title: "선배클래스", robots: { index: false } };

export default function AdminPage() {
  // 권한 확인 전에는 운영자 화면 구조도 보내지 않는다
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await requireAdmin("/admin");
  const [rows, leftovers, counts] = await Promise.all([listPendingVerifications(), listLeftoverProofs(), adminCounts()]);

  return (
    <DashboardShell area="운영자" nav={adminNav("verify", counts)}>
      <div className="max-w-6xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">성적 인증</h1>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">
          캡처의 이름·학번이 신청자와 같은지, 과목·교수님·학기·성적이 신청 내용과 같은지만 확인하세요. 승인하거나 반려하면 캡처는 바로 지워져요.
        </p>

        <div className="mt-10">
          <VerificationQueue rows={rows} />
        </div>

        {leftovers.length > 0 && (
          <section className="mt-14">
            <h2 className="font-semibold">지우지 못한 캡처 {leftovers.length}건</h2>
            <p className="mt-1 text-sm text-ink-soft">처리는 끝났는데 파일 삭제가 실패한 신청이에요.</p>
            <ul className="mt-3 border-t border-rule text-sm">
              {leftovers.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 border-b border-rule py-3">
                  <span className="font-mono text-ink-soft">{l.path}</span>
                  <form action={retryProofDelete}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className="rounded-ui border border-ink-faint px-3 py-1.5 hover:border-ink">
                      다시 지우기
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

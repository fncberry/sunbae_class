import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { VerificationQueue } from "@/components/VerificationQueue";
import { requireAdmin } from "@/lib/auth";
import { listVerificationRequests } from "@/lib/data";
import { courseShortLabel } from "@/lib/format";

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
  // TODO(4단계): 대기열을 grade_verifications(status='pending')에서 읽고, 승인·반려를 서버 액션으로
  const requests = await listVerificationRequests();
  const rows = requests.map(({ course, ...v }) => ({ ...v, courseLabel: courseShortLabel(course) }));

  return (
    <DashboardShell
      area="운영자"
      nav={[
        { label: "성적 인증", href: "/admin", active: true },
        { label: "강의 검수 (1)", href: "/admin" },
        { label: "결제와 환불", href: "/admin" },
        { label: "정산", href: "/admin" },
      ]}
    >
      <div className="max-w-6xl px-8 py-12">
        <p className="mb-6 rounded-ui bg-wash px-4 py-3 text-sm text-ink-soft">
          예시 화면이에요. 실제 인증 신청 대기열은 다음 단계에서 연결돼요.
        </p>
        <h1 className="font-serif text-3xl font-bold">성적 인증</h1>
        <p className="mt-2 max-w-[60ch] leading-relaxed text-ink-soft">
          대학 수업은 신청한 과목의 과목명, 교수님, 학기, 성적만, 자격증·어학은 시험명, 응시일, 점수나 합격 여부만 확인하세요.
        </p>
        <div className="mt-10">
          <VerificationQueue rows={rows} />
        </div>
      </div>
    </DashboardShell>
  );
}

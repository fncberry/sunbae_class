import { DashboardShell } from "@/components/DashboardShell";
import { VerificationQueue } from "@/components/VerificationQueue";
import { listVerificationRequests } from "@/lib/data";
import { courseShortLabel } from "@/lib/format";

export default async function AdminPage() {
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

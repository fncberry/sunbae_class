import Link from "next/link";
import { Upload } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  courseLabel,
  courses,
  currentInstructorId,
  getCourse,
  getInstructor,
  instructorShare,
  lectures,
  monthlySales,
} from "@/lib/mock-data";
import { won } from "@/lib/format";

export default function InstructorPage() {
  const me = getInstructor(currentInstructorId)!;
  const verifiedCourse = getCourse(me.verifiedCourseId)!;
  const myLectures = lectures.filter((l) => l.instructorId === me.id);
  const mainPrice = myLectures[0]?.price ?? 0;
  const thisMonth = monthlySales[monthlySales.length - 1];
  const earlier = monthlySales.slice(0, -1);
  const expectedPayout = Math.round(thisMonth.count * mainPrice * instructorShare);

  return (
    <DashboardShell
      area="강사 센터"
      nav={[
        { label: "요약", href: "/instructor", active: true },
        { label: "내 강의", href: "/instructor#lectures" },
        { label: "강의 올리기", href: "/instructor#upload" },
        { label: "정산 내역", href: "/instructor" },
      ]}
    >
      <div className="max-w-5xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">{me.name}님의 강사 센터</h1>
        <p className="mt-2 text-ink-soft">
          {me.major} {me.admissionYear}학번
        </p>

        <dl className="mt-10 grid border-y border-rule md:grid-cols-3">
          <div className="py-6 md:pr-8">
            <dt className="text-sm text-ink-soft">인증된 과목</dt>
            <dd className="mt-2 flex items-center gap-4">
              <span className="text-lg font-semibold">
                {verifiedCourse.code} {verifiedCourse.name}
              </span>
              <VerifiedBadge grade={me.grade} />
            </dd>
            <dd className="mt-1 text-sm text-ink-soft">{me.proof}</dd>
          </div>
          <div className="border-rule py-6 md:border-l md:px-8">
            <dt className="text-sm text-ink-soft">{thisMonth.month} 판매</dt>
            <dd className="mt-2 text-3xl font-semibold">{thisMonth.count}건</dd>
            <dd className="mt-1 text-sm text-ink-soft">
              {earlier.map((m) => `${m.month} ${m.count}건`).join(", ")}
            </dd>
          </div>
          <div className="border-rule py-6 md:border-l md:pl-8">
            <dt className="text-sm text-ink-soft">정산 예정 금액</dt>
            <dd className="mt-2 text-3xl font-semibold">{won(expectedPayout)}</dd>
            <dd className="mt-1 text-sm text-ink-soft">
              판매가의 {Math.round(instructorShare * 100)}%, 기말고사가 끝나고 환불 기간이 지나면 확정돼요
            </dd>
          </div>
        </dl>

        <section id="lectures" className="mt-14">
          <h2 className="font-serif text-xl font-bold">내 강의</h2>
          <table className="mt-4 w-full text-[15px]">
            <thead className="text-left text-sm text-ink-soft">
              <tr className="border-b border-ink">
                <th className="py-2.5 font-normal">강의</th>
                <th className="py-2.5 text-right font-normal">가격</th>
                <th className="py-2.5 text-right font-normal">판매</th>
                <th className="py-2.5 text-right font-normal">평점</th>
                <th className="py-2.5 pl-8 font-normal">상태</th>
              </tr>
            </thead>
            <tbody>
              {myLectures.map((l) => (
                <tr key={l.id} className="border-b border-rule">
                  <td className="py-4 pr-4">
                    <Link href={`/lectures/${l.id}`} className="underline-offset-4 hover:underline">{l.title}</Link>
                  </td>
                  <td className="py-4 text-right">{won(l.price)}</td>
                  <td className="py-4 text-right">{l.sales}건</td>
                  <td className="py-4 text-right">{l.rating}</td>
                  <td className="py-4 pl-8">{l.status}</td>
                </tr>
              ))}
              <tr className="border-b border-rule text-ink-soft">
                <td className="py-4 pr-4">자료구조 중간 복습: 정렬·탐색</td>
                <td className="py-4 text-right">{won(3900)}</td>
                <td className="py-4 text-right">-</td>
                <td className="py-4 text-right">-</td>
                <td className="py-4 pl-8">검수 중, 1~2일 걸려요</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="upload" className="mt-14">
          <h2 className="font-serif text-xl font-bold">강의 올리기</h2>
          <p className="mt-1 text-ink-soft">
            성적이나 점수를 인증한 과목만 올릴 수 있어요. 올리면 운영진이 확인한 뒤 공개돼요.
          </p>

          <div className="mt-8 grid max-w-3xl gap-6 md:grid-cols-[minmax(0,1fr)_160px]">
            <label className="block text-sm">
              <span className="font-medium">과목</span>
              <select className="mt-2 h-11 w-full rounded-ui border border-ink-faint bg-paper px-3">
                {courses
                  .filter((c) => c.id === me.verifiedCourseId)
                  .map((c) => (
                    <option key={c.id}>{courseLabel(c)}</option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">가격 (원)</span>
              <input defaultValue="5900" inputMode="numeric" className="mt-2 h-11 w-full rounded-ui border border-ink-faint px-3" />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium">강의 제목</span>
              <input
                placeholder="예: 자료구조 기말 정리, 트리와 그래프"
                className="mt-2 h-11 w-full rounded-ui border border-ink-faint px-3 placeholder:text-ink-faint"
              />
            </label>
            <div className="md:col-span-2">
              <span className="text-sm font-medium">영상 파일</span>
              <label className="mt-2 flex cursor-pointer items-center gap-4 rounded-ui border border-dashed border-ink-faint px-5 py-6 hover:border-ink">
                <Upload size={20} className="text-ink-soft" aria-hidden />
                <span className="text-sm">
                  <span className="font-medium">파일 선택</span>
                  <span className="text-ink-soft"> 또는 여기로 끌어다 놓기. 강의별로 나눠 올리면 첫 번째 영상이 무료 맛보기가 돼요.</span>
                </span>
                <input type="file" accept="video/*" multiple className="sr-only" />
              </label>
              <p className="mt-2 text-sm text-ink-soft">기출문제 원본이나 교수님 강의자료를 그대로 쓰면 공개되지 않아요.</p>
            </div>
          </div>
          <button type="button" className="mt-8 rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink/85">
            검수 요청 보내기
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}

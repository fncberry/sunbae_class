import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/data";
import { courseLabel, courseShortLabel, instructorMeta, koDateOf, won } from "@/lib/format";
import { getInstructorCenter, type MyVerification } from "@/lib/instructor-center";
import { admissionLabel } from "@/lib/onboarding";
import { listMyPendingQuestions } from "@/lib/questions";
import { AnswerForm } from "@/components/AnswerForm";
import { ApplyForm, type CourseOption } from "./ApplyForm";
import { LECTURE_STATUS_TEXT } from "./status";

export const metadata: Metadata = { title: "강사 센터 | 선배클래스", robots: { index: false } };

export default function InstructorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <InstructorCenter />
    </Suspense>
  );
}

const VERIFICATION_STATUS: Record<MyVerification["status"], string> = {
  pending: "확인 중",
  approved: "인증됨",
  rejected: "반려",
};

function verificationCourse(v: MyVerification) {
  if (v.course) return courseShortLabel(v.course);
  if (v.requested) return `${v.requested.code} ${v.requested.name} (${v.requested.professor})`;
  return "과목 정보 없음";
}

async function InstructorCenter() {
  const user = await requireUser("/instructor");
  const [center, courses] = await Promise.all([getInstructorCenter(user.id), listCourses()]);
  const { instructor, verifications, approvedCourses, lectures } = center;
  const pendingQuestions = instructor ? await listMyPendingQuestions(user, instructor.id) : [];

  // 이미 인증됐거나 확인 중인 과목은 다시 고를 수 없다
  const blocked = new Map<string, string>();
  for (const v of verifications) {
    if (!v.course) continue;
    if (v.status === "approved") blocked.set(v.course.id, "인증됨");
    else if (v.status === "pending" && !blocked.has(v.course.id)) blocked.set(v.course.id, "확인 중");
  }
  const options: CourseOption[] = courses.map((c) => ({
    id: c.id,
    kind: c.kind,
    label: courseLabel(c),
    blocked: blocked.get(c.id),
  }));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // 공개 표시 이름: 닉네임 + 학과 NN학번 (실명은 보이지 않는다)
  const publicName = instructor?.name ?? user.nickname ?? "";
  const publicMeta = instructor
    ? instructorMeta({ major: instructor.major, admissionYear: instructor.admission_year })
    : [user.major, user.studentId ? admissionLabel(user.studentId) : null].filter(Boolean).join(" ");

  return (
    <DashboardShell
      area="강사 센터"
      nav={[
        { label: "성적 인증", href: "/instructor#verify", active: true },
        { label: "내 강의", href: "/instructor#lectures" },
        ...(instructor ? [{ label: `질문 (${pendingQuestions.length})`, href: "/instructor#questions" }] : []),
      ]}
    >
      <div className="max-w-5xl px-8 py-12">
        <h1 className="font-serif text-3xl font-bold">{instructor ? `${publicName}님의 강사 센터` : "강사 지원"}</h1>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">
          {instructor
            ? `강의 페이지에는 ${publicName}(${publicMeta})로 보여요. 실명은 보이지 않아요.`
            : "같은 과목, 같은 교수님 수업에서 받은 성적을 인증하면 그 과목 강의를 올릴 수 있어요."}
        </p>

        <section id="verify" className="mt-12 scroll-mt-8">
          <h2 className="font-serif text-xl font-bold">성적 인증</h2>
          {verifications.length > 0 && (
            <ul className="mt-4 border-t border-ink">
              {verifications.map((v) => (
                <li key={v.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="font-medium">{verificationCourse(v)}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {v.semester} 수강, {v.grade}
                    </p>
                    {v.status === "rejected" && v.rejectReason && (
                      <p className="mt-2 text-sm">반려 사유: {v.rejectReason}</p>
                    )}
                    {v.status === "approved" && v.proofText && <p className="mt-2 text-sm text-ink-soft">{v.proofText}</p>}
                  </div>
                  <div className="order-first sm:order-none sm:text-right">
                    {v.status === "approved" ? (
                      <VerifiedBadge grade={v.grade} />
                    ) : (
                      <span className="text-sm font-semibold">
                        {VERIFICATION_STATUS[v.status]}
                      </span>
                    )}
                    {v.status === "pending" && <p className="mt-0.5 text-sm text-ink-faint">보통 1~2일 걸려요</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {verifications.length > 0 && <h3 className="mt-10 font-semibold">다른 과목 신청하기</h3>}
          <div className={verifications.length > 0 ? "mt-4" : "mt-6"}>
            <ApplyForm userId={user.id} courses={options} />
          </div>
        </section>

        <section id="lectures" className="mt-16 scroll-mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-xl font-bold">내 강의</h2>
            {approvedCourses.length > 0 && (
              <Link href="/instructor/lectures/new" className="text-sm font-medium underline underline-offset-4">
                새 강의 만들기
              </Link>
            )}
          </div>

          {approvedCourses.length === 0 ? (
            <p className="mt-3 text-ink-soft">성적 인증이 승인되면 그 과목 강의를 만들 수 있어요.</p>
          ) : lectures.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              아직 만든 강의가 없어요.{" "}
              <Link href="/instructor/lectures/new" className="text-ink underline underline-offset-4">
                첫 강의 초안 만들기
              </Link>
            </p>
          ) : (
            <table className="mt-4 w-full text-[15px]">
              <thead className="text-left text-sm text-ink-soft">
                <tr className="border-b border-ink">
                  <th className="py-2.5 font-normal">강의</th>
                  <th className="py-2.5 text-right font-normal">가격</th>
                  <th className="py-2.5 text-right font-normal">판매</th>
                  <th className="py-2.5 pl-8 font-normal">상태</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((l) => {
                  const course = courseById.get(l.courseId);
                  const editable = l.status === "draft" || l.status === "reviewing" || l.status === "rejected";
                  return (
                    <tr key={l.id} className="border-b border-rule align-top">
                      <td className="py-4 pr-4">
                        <Link
                          href={l.status === "on_sale" ? `/lectures/${l.id}` : `/instructor/lectures/${l.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {l.title}
                        </Link>
                        {course && <span className="mt-0.5 block text-sm text-ink-soft">{courseShortLabel(course)}</span>}
                      </td>
                      <td className="py-4 text-right">{won(l.price)}</td>
                      <td className="py-4 text-right">{l.status === "on_sale" ? `${l.sales}건` : "-"}</td>
                      <td className="py-4 pl-8">
                        <span className={l.status === "rejected" ? "font-semibold" : ""}>{LECTURE_STATUS_TEXT[l.status]}</span>
                        {l.status === "rejected" && l.rejectReason && (
                          <span className="mt-0.5 block max-w-[28ch] text-sm text-ink-soft">{l.rejectReason}</span>
                        )}
                        {editable && (
                          <Link href={`/instructor/lectures/${l.id}`} className="mt-0.5 block text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
                            {l.status === "rejected" ? "고쳐서 다시 요청" : "고치기"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {instructor && (
          <section id="questions" className="mt-16 scroll-mt-8">
            <h2 className="font-serif text-xl font-bold">답을 기다리는 질문</h2>
            {pendingQuestions.length === 0 ? (
              <p className="mt-3 text-ink-soft">답을 기다리는 질문이 없어요.</p>
            ) : (
              <ul className="mt-4 border-t border-ink">
                {pendingQuestions.map((q) => (
                  <li key={q.id} className="border-b border-rule py-5">
                    <p className="text-sm text-ink-soft">
                      <Link
                        href={`/watch/${q.lectureId}${q.chapterPosition !== null ? `?c=${q.chapterPosition}` : ""}#questions`}
                        className="underline-offset-4 hover:underline"
                      >
                        {q.lectureTitle}
                        {q.chapterTitle ? ` · ${q.chapterTitle}` : ""}
                      </Link>
                      <span className="text-ink-faint"> · {q.authorLabel} · {koDateOf(q.createdAt)}</span>
                    </p>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed">{q.body}</p>
                    <AnswerForm questionId={q.id} existing={null} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

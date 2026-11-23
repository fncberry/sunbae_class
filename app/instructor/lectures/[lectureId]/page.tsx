import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/data";
import { courseLabel } from "@/lib/format";
import { getInstructorCenter, getMyLecture } from "@/lib/instructor-center";
import { LectureForm } from "../../LectureForm";
import { LECTURE_STATUS_TEXT } from "../../status";

export const metadata: Metadata = { title: "강의 만들기 | 선배클래스", robots: { index: false } };

const STATUS_LINE: Record<keyof typeof LECTURE_STATUS_TEXT, string> = {
  draft: "초안이에요. 다 쓰면 검수를 요청해 주세요.",
  reviewing: "검수 중이에요. 고쳐서 저장하면 초안으로 돌아가요.",
  rejected: "반려됐어요. 고쳐서 다시 검수를 요청해 주세요.",
  on_sale: "판매 중이에요.",
  hidden: "숨긴 강의예요.",
};

const SAVED_NOTICE: Record<string, string> = {
  draft: "초안을 저장했어요.",
  review: "검수를 요청했어요. 보통 1~2일 걸려요.",
  partial: "강의 정보는 저장했는데 강의 목록은 저장하지 못했어요. 다시 저장해 주세요.",
};

export default function LectureEditorPage(props: PageProps<"/instructor/lectures/[lectureId]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <LectureEditor {...props} />
    </Suspense>
  );
}

async function LectureEditor({ params, searchParams }: PageProps<"/instructor/lectures/[lectureId]">) {
  const { lectureId } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/instructor/lectures/${lectureId}`);
  const [center, courses] = await Promise.all([getInstructorCenter(user.id), listCourses()]);
  if (!center.instructor) notFound();

  const isNew = lectureId === "new";
  const lecture = isNew ? null : await getMyLecture(center.instructor.id, lectureId);
  if (!isNew && !lecture) notFound();

  const course = lecture ? courses.find((c) => c.id === lecture.courseId) : undefined;
  const editable = !lecture || lecture.status === "draft" || lecture.status === "reviewing" || lecture.status === "rejected";

  return (
    <DashboardShell
      area="강사 센터"
      nav={[
        { label: "성적 인증", href: "/instructor#verify" },
        { label: "내 강의", href: "/instructor#lectures", active: true },
      ]}
    >
      <div className="max-w-5xl px-8 py-12">
        <Link href="/instructor#lectures" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          내 강의로 돌아가기
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-bold">{lecture ? lecture.title : "새 강의 만들기"}</h1>
        {lecture && <p className="mt-2 text-ink-soft">{STATUS_LINE[lecture.status]}</p>}

        {lecture?.status === "rejected" && lecture.rejectReason && (
          <div className="mt-6 max-w-3xl border-l-2 border-ink pl-4">
            <p className="text-sm font-semibold">반려 사유</p>
            <p className="mt-1 leading-relaxed">{lecture.rejectReason}</p>
          </div>
        )}

        <div className="mt-10">
          {!editable ? (
            <p className="text-ink-soft">
              판매 중이거나 숨긴 강의는 여기서 고칠 수 없어요. 바꿔야 할 내용이 있으면 운영진에게 알려 주세요.
            </p>
          ) : center.approvedCourses.length === 0 ? (
            <p className="text-ink-soft">성적 인증이 승인된 과목이 있어야 강의를 만들 수 있어요.</p>
          ) : (
            <LectureForm
              key={lecture?.id ?? "new"}
              courses={center.approvedCourses.map((c) => ({ id: c.id, label: courseLabel(c) }))}
              lecture={lecture ?? undefined}
              courseLabel={course ? courseLabel(course) : undefined}
              notice={typeof saved === "string" ? SAVED_NOTICE[saved] : undefined}
            />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

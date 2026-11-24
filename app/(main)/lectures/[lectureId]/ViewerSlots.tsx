// 강의 상세에서 보는 사람마다 달라지는 부분. 페이지의 나머지는 정적(캐시)이고, 이 부분만 요청 시점에 그린다.
// 반드시 <Suspense> 안에서 쓴다(쿠키를 읽는다).

import Link from "next/link";
import { PurchaseBox } from "@/components/PurchaseBox";
import { ReviewForm } from "@/components/ReviewForm";
import { getCurrentUser } from "@/lib/auth";
import { won } from "@/lib/format";
import { getViewerAccess } from "@/lib/learning";
import type { LectureWithRelations } from "@/lib/types";

type Lecture = Pick<LectureWithRelations, "id" | "price" | "studyGroup" | "course">;

/** 결제 상자(로그아웃·미수강), 이어서 보기(수강 중), 내 강의 안내(강사 본인) */
export async function PurchaseSlot({ lecture }: { lecture: Lecture }) {
  const user = await getCurrentUser();
  const access = user?.onboarded ? await getViewerAccess(user, lecture.id) : null;

  if (access?.enrollment) {
    return (
      <>
        <div className="rounded-ui border border-ink p-6">
          <p className="font-semibold">수강 중인 강의예요</p>
          <p className="mt-1 text-sm text-ink-soft">{access.enrollment.option === "study" ? "스터디반" : "영상 강의"}</p>
          <Link
            href={`/watch/${lecture.id}`}
            className="mt-5 block w-full rounded-ui bg-ink py-3.5 text-center font-semibold text-paper hover:bg-ink/85"
          >
            이어서 보기
          </Link>
        </div>
        <MobileBar href={`/watch/${lecture.id}`} label="이어서 보기" />
      </>
    );
  }

  if (access?.isOwner) {
    return (
      <div className="rounded-ui border border-ink p-6">
        <p className="font-semibold">내가 올린 강의예요</p>
        <Link
          href={`/instructor/lectures/${lecture.id}`}
          className="mt-5 block w-full rounded-ui border border-ink py-3.5 text-center font-semibold hover:bg-wash"
        >
          강의 관리
        </Link>
      </div>
    );
  }

  return <PurchaseFallback lecture={lecture} />;
}

/** 로그인 여부를 확인하기 전과 미수강자에게 보이는 결제 상자 */
export function PurchaseFallback({ lecture }: { lecture: Lecture }) {
  return (
    <>
      <PurchaseBox
        lectureId={lecture.id}
        price={lecture.price}
        studyGroup={lecture.studyGroup}
        examDate={lecture.course.examDate}
        examLabel={lecture.course.examLabel}
      />
      <MobileBar
        href="#purchase"
        label="구매 방식 고르기"
        price={`${won(lecture.price)}${lecture.studyGroup ? "부터" : ""}`}
      />
    </>
  );
}

/** 모바일: 결제 영역이 맨 아래로 밀리므로 하단에 고정 바를 둔다 */
function MobileBar({ href, label, price }: { href: string; label: string; price?: string }) {
  const pay = href === "#purchase";
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-ink bg-paper px-6 py-3 lg:hidden">
      <p className="text-lg font-semibold">{price}</p>
      <a
        href={href}
        className={`rounded-ui px-5 py-3 text-sm font-semibold text-paper ${pay ? "bg-pen" : "bg-ink"}`}
      >
        {label}
      </a>
    </div>
  );
}

/** 수강생에게만 후기 쓰기·고치기 */
export async function ReviewSlot({ lectureId }: { lectureId: string }) {
  const user = await getCurrentUser();
  if (!user?.onboarded) return null;
  const access = await getViewerAccess(user, lectureId);
  if (!access.enrollment) return null;
  return (
    <div className="mb-8">
      <ReviewForm lectureId={lectureId} existing={access.myReview} />
    </div>
  );
}

// 선배에게 질문: 수강생·강의 주인·운영자만 본다(RLS). 사람마다 다르므로 캐시하지 않는다.

import "server-only";
import type { CurrentUser } from "./auth";
import type { Tables } from "./database.types";
import { createServerSupabase } from "./supabase/server";

export type LectureQuestion = {
  id: string;
  lectureId: string;
  chapterId: string | null;
  /** "학과 NN학번" */
  authorLabel: string;
  body: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  mine: boolean;
};

type QuestionRow = Pick<
  Tables<"lecture_questions">,
  "id" | "lecture_id" | "chapter_id" | "author_label" | "body" | "answer" | "answered_at" | "created_at" | "user_id"
>;

const QUESTION_SELECT = "id, lecture_id, chapter_id, author_label, body, answer, answered_at, created_at, user_id";

function toQuestion(row: QuestionRow, userId: string): LectureQuestion {
  return {
    id: row.id,
    lectureId: row.lecture_id,
    chapterId: row.chapter_id,
    authorLabel: row.author_label,
    body: row.body,
    answer: row.answer,
    answeredAt: row.answered_at,
    createdAt: row.created_at,
    mine: row.user_id === userId,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

/** 강의 질문 (최신순). 볼 수 없는 사람에게는 빈 목록 */
export async function listLectureQuestions(user: CurrentUser, lectureId: string): Promise<LectureQuestion[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lecture_questions")
    .select(QUESTION_SELECT)
    .eq("lecture_id", lectureId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail(`강의 ${lectureId} 질문`, error);
  return data.map((r) => toQuestion(r, user.id));
}

export type PendingQuestion = LectureQuestion & { lectureTitle: string; chapterTitle: string | null; chapterPosition: number | null };

/** 강사 센터: 내 강의에 답을 기다리는 질문 (오래된 순) */
export async function listMyPendingQuestions(user: CurrentUser, instructorId: string): Promise<PendingQuestion[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("lecture_questions")
    .select(`${QUESTION_SELECT}, lecture:lectures!inner(title, instructor_id), chapter:chapters(title, position)`)
    .is("answer", null)
    .eq("lecture.instructor_id", instructorId)
    .order("created_at", { ascending: true })
    .limit(100)
    .overrideTypes<
      (QuestionRow & {
        lecture: { title: string; instructor_id: string };
        chapter: { title: string; position: number } | null;
      })[],
      { merge: false }
    >();
  if (error) fail("답을 기다리는 질문", error);
  return data.map((r) => ({
    ...toQuestion(r, user.id),
    lectureTitle: r.lecture.title,
    chapterTitle: r.chapter?.title ?? null,
    chapterPosition: r.chapter?.position ?? null,
  }));
}

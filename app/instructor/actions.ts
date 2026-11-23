"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createServerSupabase } from "@/lib/supabase/server";
import { PROOF_BUCKET, clean, normalizeCourseCode, parseProofPath } from "@/lib/verification";

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabase>>;

async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/instructor");
  if (!user.onboarded) redirect("/onboarding?next=/instructor");
  return user;
}

/** 내 강사 프로필 id. 없으면 만든다(이름·학과·학번은 DB 트리거가 프로필에서 채운다). */
async function ensureInstructorId(sb: SupabaseServer, userId: string): Promise<string | null> {
  const found = await sb.from("instructors").select("id").eq("user_id", userId).maybeSingle();
  if (found.data) return found.data.id;
  // name·major는 트리거가 채우고 클라이언트에는 쓰기 권한도 없으므로 보내지 않는다 (생성 타입은 트리거를 모른다)
  const created = await sb
    .from("instructors")
    .insert({ user_id: userId } as Database["public"]["Tables"]["instructors"]["Insert"])
    .select("id")
    .single();
  if (created.error) {
    console.error("[instructor] create instructors", created.error.code, created.error.message);
    // 동시에 두 번 눌렀으면 이미 생겼을 수 있다
    const again = await sb.from("instructors").select("id").eq("user_id", userId).maybeSingle();
    return again.data?.id ?? null;
  }
  return created.data.id;
}

// ─── 성적 인증 신청 ───────────────────────────────────────

export type ApplyField = "course" | "code" | "name" | "professor" | "group" | "grade" | "semester" | "proof";
export type ApplyState =
  | { status: "idle" }
  | { status: "done"; at: number }
  | { status: "error"; message: string; field?: ApplyField; at: number };

/**
 * 캡처는 브라우저가 grade-proofs/{내 id}/{신청 id}.{확장자}에 먼저 올린다.
 * 여기서는 파일이 정말 올라갔는지 확인하고 신청을 저장한다.
 */
export async function submitVerification(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const at = Date.now();
  const fail = (message: string, field?: ApplyField): ApplyState => ({ status: "error", message, field, at });
  const user = await signedInUser();

  const verificationId = clean(formData.get("verificationId"), 40);
  const path = clean(formData.get("proofPath"), 200);
  if (!parseProofPath(user.id, verificationId, path)) return fail("성적 캡처를 다시 올려 주세요.", "proof");

  const grade = clean(formData.get("grade"), 20);
  if (!grade) return fail("받은 성적을 적어 주세요. (예: A+)", "grade");
  const semester = clean(formData.get("semester"), 30);
  if (!semester) return fail("수강한 학기를 적어 주세요. (예: 2025-2학기)", "semester");

  const mode = formData.get("mode") === "request" ? "request" : "pick";
  let course: { course_id: string } | {
    requested_code: string;
    requested_name: string;
    requested_professor: string;
    requested_semester: string;
    requested_track: "major" | "liberal";
    requested_group: string;
    requested_department: string | null;
  };
  if (mode === "pick") {
    const courseId = clean(formData.get("courseId"), 40);
    if (!courseId) return fail("과목을 골라 주세요.", "course");
    course = { course_id: courseId };
  } else {
    const code = normalizeCourseCode(clean(formData.get("code"), 20));
    if (!code) return fail("학수번호를 확인해 주세요. (예: COSE213)", "code");
    const name = clean(formData.get("name"), 60);
    if (!name) return fail("과목명을 적어 주세요.", "name");
    const professor = clean(formData.get("professor"), 30).replace(/\s*교수(님)?$/, "");
    if (!professor) return fail("교수님 성함을 적어 주세요.", "professor");
    const track = formData.get("track") === "liberal" ? "liberal" : "major";
    const group = track === "liberal" ? "교양" : clean(formData.get("group"), 30);
    if (!group) return fail("단과대학을 골라 주세요.", "group");
    course = {
      requested_code: code,
      requested_name: name,
      requested_professor: professor,
      requested_semester: semester,
      requested_track: track,
      requested_group: group,
      requested_department: clean(formData.get("department"), 40) || null,
    };
  }

  const sb = await createServerSupabase();

  // 캡처가 실제로 올라갔는지 확인 (본인 폴더는 본인이 조회할 수 있다)
  const fileName = path.slice(path.indexOf("/") + 1);
  const listed = await sb.storage.from(PROOF_BUCKET).list(user.id, { search: fileName, limit: 1 });
  if (listed.error || !listed.data.some((f) => f.name === fileName)) {
    console.error("[instructor] proof missing", listed.error?.message);
    return fail("성적 캡처가 올라가지 않았어요. 파일을 다시 골라 주세요.", "proof");
  }

  const instructorId = await ensureInstructorId(sb, user.id);
  if (!instructorId) return fail("강사 프로필을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.");

  const { error } = await sb.from("grade_verifications").insert({
    id: verificationId,
    instructor_id: instructorId,
    grade,
    semester_label: semester,
    proof_path: path,
    ...course,
  });
  if (error) {
    console.error("[instructor] insert grade_verifications", error.code, error.message);
    if (error.code === "23505") return fail("이 과목은 이미 확인을 기다리고 있어요. 결과가 나온 뒤에 다시 신청해 주세요.", "course");
    if (error.code === "P0001") return fail(error.message);
    if (error.code === "23503") return fail("과목을 다시 골라 주세요.", "course");
    if (error.code === "23514") return fail("입력한 값을 다시 확인해 주세요.");
    return fail("신청하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
  }

  refresh();
  return { status: "done", at };
}

// ─── 강의 초안·검수 요청 ──────────────────────────────────

export type LectureField = "course" | "title" | "price" | "summary" | "covers" | "chapters";
export type LectureState =
  | { status: "idle" }
  | { status: "saved"; at: number; message: string }
  | { status: "error"; message: string; field?: LectureField; at: number };

const PRICE_MIN = 1000;
const PRICE_MAX = 100000;

function slugId(courseId: string) {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `${courseId}-${Array.from(rand, (n) => n.toString(36)).join("").slice(0, 8)}`;
}

/**
 * 강의 초안 저장(새로 만들기·수정). intent=review면 저장한 뒤 검수를 요청한다.
 * 수정하면 상태는 초안으로 돌아간다(검수 중·반려였어도). 승인된 과목인지는 RLS가 한 번 더 막는다.
 */
export async function saveLecture(_prev: LectureState, formData: FormData): Promise<LectureState> {
  const at = Date.now();
  const fail = (message: string, field?: LectureField): LectureState => ({ status: "error", message, field, at });
  const user = await signedInUser();
  const review = formData.get("intent") === "review";

  const lectureId = clean(formData.get("lectureId"), 80) || null;
  const courseId = clean(formData.get("courseId"), 40);
  if (!lectureId && !courseId) return fail("과목을 골라 주세요.", "course");

  const title = clean(formData.get("title"), 80);
  if (title.length < 4 || title.length > 60) return fail("제목은 4~60자로 적어 주세요.", "title");

  const price = Number(String(formData.get("price") ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isInteger(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return fail(`가격은 ${PRICE_MIN.toLocaleString()}원에서 ${PRICE_MAX.toLocaleString()}원 사이로 정해 주세요.`, "price");
  }

  const summary = String(formData.get("summary") ?? "").trim().slice(0, 400);
  const covers = String(formData.get("covers") ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•·\s]+/, "").trim())
    .filter(Boolean);
  if (covers.length > 8 || covers.some((c) => c.length > 80)) return fail("다루는 내용은 8줄까지, 한 줄에 80자까지 적어 주세요.", "covers");

  const titles = formData.getAll("chapterTitle").map((t) => clean(t, 80));
  const minutes = formData.getAll("chapterMinutes").map((m) => Number(m));
  const chapters = titles
    .map((t, i) => ({ title: t, minutes: minutes[i] }))
    .filter((c) => c.title || c.minutes);
  if (chapters.length > 30) return fail("강의는 30개까지 나눌 수 있어요.", "chapters");
  if (chapters.some((c) => !c.title || c.title.length > 60)) return fail("강의 제목을 60자 이내로 모두 적어 주세요.", "chapters");
  if (chapters.some((c) => !Number.isInteger(c.minutes) || c.minutes < 1 || c.minutes > 300)) {
    return fail("강의 길이는 1~300분으로 적어 주세요.", "chapters");
  }

  if (review) {
    if (summary.length < 10) return fail("검수를 요청하려면 소개를 10자 이상 적어 주세요.", "summary");
    if (covers.length === 0) return fail("검수를 요청하려면 다루는 내용을 한 줄 이상 적어 주세요.", "covers");
    if (chapters.length < 2) return fail("검수를 요청하려면 맛보기를 포함해 강의를 2개 이상 적어 주세요.", "chapters");
  }

  const sb = await createServerSupabase();
  const instructor = await sb.from("instructors").select("id").eq("user_id", user.id).maybeSingle();
  if (!instructor.data) return fail("성적 인증을 먼저 신청해 주세요.");

  let id = lectureId;
  if (id) {
    const { data, error } = await sb
      .from("lectures")
      .update({ title, summary, price, covers, status: "draft" })
      .eq("id", id)
      .eq("instructor_id", instructor.data.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("[instructor] update lecture", error?.code, error?.message);
      return fail("저장하지 못했어요. 판매 중인 강의는 여기서 고칠 수 없어요.");
    }
  } else {
    id = slugId(courseId);
    const { error } = await sb.from("lectures").insert({
      id,
      course_id: courseId,
      instructor_id: instructor.data.id,
      title,
      summary,
      price,
      covers,
      status: "draft",
    });
    if (error) {
      console.error("[instructor] insert lecture", error.code, error.message);
      if (error.code === "42501") return fail("성적 인증이 승인된 과목에만 강의를 올릴 수 있어요.", "course");
      return fail("저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
    }
  }

  // 목차는 통째로 바꾼다. 첫 번째 강의가 무료 맛보기
  const del = await sb.from("chapters").delete().eq("lecture_id", id);
  const ins = chapters.length
    ? await sb.from("chapters").insert(
        chapters.map((c, i) => ({ lecture_id: id, position: i, title: c.title, minutes: c.minutes, is_preview: i === 0 })),
      )
    : { error: null };
  if (del.error || ins.error) {
    console.error("[instructor] replace chapters", del.error?.message, ins.error?.message);
    redirect(`/instructor/lectures/${id}?saved=partial`);
  }

  if (review) {
    const { error } = await sb.from("lectures").update({ status: "reviewing" }).eq("id", id);
    if (error) {
      console.error("[instructor] request review", error.code, error.message);
      return fail("초안은 저장했는데 검수 요청은 못 보냈어요. 다시 눌러 주세요.");
    }
  }

  refresh();
  if (!lectureId) redirect(`/instructor/lectures/${id}?saved=${review ? "review" : "draft"}`);
  return { status: "saved", at, message: review ? "검수를 요청했어요. 보통 1~2일 걸려요." : "초안을 저장했어요." };
}

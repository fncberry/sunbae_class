// 서비스 전체에서 쓰는 도메인 타입. 나중에 Supabase 테이블 스키마와 1:1로 맞춘다.

export type CourseKind = "major" | "cert";

/**
 * 강의를 묶는 단위.
 * - major: 대학 수업 (학수번호 + 교수님 분반)
 * - cert: 자격증·어학 시험
 */
export type Course = {
  id: string;
  kind: CourseKind;
  code?: string; // 학수번호 (major만)
  name: string;
  professor?: string; // major만
  semester?: string; // major만
  group: string; // major: 단과대학 / cert: 분야
  department?: string; // major: 개설 학과
  students?: number;
  examDate: string; // 기말고사일 또는 다음 시험일 (환불 기한 기준)
  examLabel: string; // "기말고사" | "시험"
};

export type Instructor = {
  id: string;
  name: string;
  major: string;
  admissionYear: number | null; // 학번 앞 두 자리. 지원서에 없으면 null
  grade: string; // 성적(A+), 점수(965), 합격 등
  verifiedCourseId: string;
  verifiedSemester: string;
  proof: string; // 화면에 보여줄 인증 문구
  bio: string;
};

export type Chapter = {
  title: string;
  minutes: number;
  preview?: boolean;
};

export type StudyGroup = { price: number; capacity: number; remaining: number };

export type LectureStatus = "초안" | "검수 중" | "판매 중" | "숨김" | "반려";

export type Lecture = {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  summary: string;
  price: number;
  studyGroup?: StudyGroup;
  chapters: Chapter[];
  covers: string[];
  rating: number;
  reviewCount: number;
  sales: number;
  status: LectureStatus;
};

/** 목록·상세 화면에서 쓰는 강의 + 과목 + 강사. DB에서는 join 한 번으로 가져온다. */
export type LectureWithRelations = Lecture & {
  course: Course;
  instructor: Instructor;
};

export type Review = {
  lectureId: string;
  author: string;
  rating: number;
  text: string;
  date: string;
};

/** 과목 목록 화면용: 과목 + 강의 수 + 최저가 */
export type CatalogCourse = Course & { lectureCount: number; minPrice: number | null };

export type MonthlySales = { month: string; count: number };

export type VerificationRequest = {
  id: string;
  applicant: string;
  major: string;
  courseId: string;
  grade: string;
  semester: string; // 화면 표시용 (학기 또는 응시 시기)
  submittedAt: string;
};

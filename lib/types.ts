// 서비스 전체에서 쓰는 도메인 타입. 나중에 Supabase 테이블 스키마와 1:1로 맞춘다.

export type CourseKind = "major" | "cert";

/** 대학 수업의 전공/교양 구분 (kind = "major"일 때만) */
export type CourseTrack = "major" | "liberal";

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
  track?: CourseTrack; // major만: 전공/교양
  group: string; // 전공: 단과대학 / 교양: "교양" / cert: 분야
  department?: string; // 전공: 개설 학과 / 교양: 교양 영역
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

/** 강사 상세 화면: 강사 + 승인된 인증 + 판매 중 강의 + 후기 + 요약 지표 */
export type InstructorProfile = {
  instructor: Pick<Instructor, "id" | "name" | "major" | "admissionYear" | "bio">;
  /** 승인된 성적·점수 인증. 과목이 여러 개일 수 있다 */
  verifications: { course: Course; grade: string; proof: string }[];
  lectures: LectureWithRelations[];
  /** 이 강사의 강의에 달린 후기, 최신순 */
  reviews: (Review & { lectureTitle: string })[];
  stats: {
    /** 강의별 후기 수를 반영한 평균 평점. 후기가 없으면 null */
    rating: number | null;
    reviewCount: number;
    students: number;
    lectureCount: number;
  };
};


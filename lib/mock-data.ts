// ⚠️ 목업용 더미 데이터입니다. 과목·교수·사람 이름은 모두 예시이며 실제와 관계없습니다.
// 화면은 이 파일을 직접 읽지 않고 lib/data.ts의 조회 함수를 거칩니다.
// Supabase로 옮기면 이 파일은 시드(seed) 데이터로만 씁니다.

import type { Course, Instructor, Lecture, MonthlySales, Review, VerificationRequest } from "./types";

export const courses: Course[] = [
  { id: "cose213", kind: "major", code: "COSE213", name: "자료구조", professor: "박지훈", semester: "2026-2학기", group: "정보대학", department: "컴퓨터학과", students: 182, examDate: "2026-12-16", examLabel: "기말고사" },
  { id: "cose214", kind: "major", code: "COSE214", name: "알고리즘", professor: "남궁현", semester: "2026-2학기", group: "정보대학", department: "컴퓨터학과", students: 134, examDate: "2026-12-17", examLabel: "기말고사" },
  { id: "math141", kind: "major", code: "MATH141", name: "미적분학Ⅰ", professor: "최은영", semester: "2026-2학기", group: "이과대학", department: "수학과", students: 240, examDate: "2026-12-14", examLabel: "기말고사" },
  { id: "phys151", kind: "major", code: "PHYS151", name: "일반물리학Ⅰ", professor: "한상우", semester: "2026-2학기", group: "이과대학", department: "물리학과", students: 205, examDate: "2026-12-15", examLabel: "기말고사" },
  { id: "econ101", kind: "major", code: "ECON101", name: "경제원론", professor: "윤서진", semester: "2026-2학기", group: "정경대학", department: "경제학과", students: 310, examDate: "2026-12-18", examLabel: "기말고사" },
  { id: "stat201", kind: "major", code: "STAT201", name: "통계학입문", professor: "임재원", semester: "2026-2학기", group: "정경대학", department: "통계학과", students: 156, examDate: "2026-12-12", examLabel: "기말고사" },
  // 자격증·어학 (시험일은 예시)
  { id: "toeic", kind: "cert", name: "토익", group: "어학", examDate: "2026-12-13", examLabel: "시험" },
  { id: "jeongcheo", kind: "cert", name: "정보처리기사 실기", group: "IT 자격증", examDate: "2027-04-18", examLabel: "시험" },
  { id: "sqld", kind: "cert", name: "SQLD", group: "IT 자격증", examDate: "2027-03-07", examLabel: "시험" },
];

export const instructors: Instructor[] = [
  {
    id: "jung",
    name: "정하윤",
    major: "컴퓨터학과",
    admissionYear: 24,
    grade: "A+",
    verifiedCourseId: "cose213",
    verifiedSemester: "2025-2학기",
    proof: "2025년 2학기 자료구조 성적을 확인했어요",
    bio: "박지훈 교수님 자료구조 A+. 시험에서 자주 나오는 트리 회전·그래프 추적 문제를 손으로 그려가며 설명해요.",
  },
  {
    id: "oh",
    name: "오태민",
    major: "컴퓨터학과",
    admissionYear: 23,
    grade: "A+",
    verifiedCourseId: "cose213",
    verifiedSemester: "2025-2학기",
    proof: "2025년 2학기 자료구조 성적을 확인했어요",
    bio: "C 포인터가 약한 사람 기준으로 과제와 시험을 같이 잡아드립니다.",
  },
  {
    id: "kang",
    name: "강민지",
    major: "수학과",
    admissionYear: 24,
    grade: "A+",
    verifiedCourseId: "math141",
    verifiedSemester: "2025-2학기",
    proof: "2025년 2학기 미적분학Ⅰ 성적을 확인했어요",
    bio: "적분 테크닉을 유형별로 쪼개서 기말 직전에 한 번에 정리할 수 있게 만들었어요.",
  },
  {
    id: "seo",
    name: "서준혁",
    major: "물리학과",
    admissionYear: 23,
    grade: "A+",
    verifiedCourseId: "phys151",
    verifiedSemester: "2025-2학기",
    proof: "2025년 2학기 일반물리학Ⅰ 성적을 확인했어요",
    bio: "한상우 교수님 시험은 문제 길이가 길어요. 상황을 식으로 옮기는 연습에 집중합니다.",
  },
  {
    id: "yoon",
    name: "윤지아",
    major: "영어교육과",
    admissionYear: 23,
    grade: "965",
    verifiedCourseId: "toeic",
    verifiedSemester: "2026-09",
    proof: "2026년 9월 토익 성적표를 확인했어요",
    bio: "파트7에서 시간이 모자라던 걸 해결하고 965점을 받았어요. 문제 유형별로 어디부터 읽을지 정해서 풀어요.",
  },
  {
    id: "baek",
    name: "백승호",
    major: "컴퓨터학과",
    admissionYear: 22,
    grade: "합격",
    verifiedCourseId: "jeongcheo",
    verifiedSemester: "2026-2회",
    proof: "2026년 2회 정보처리기사 실기 합격을 확인했어요",
    bio: "실기에서 점수 차이가 나는 코드 해석 문제만 따로 모아서 정리했어요.",
  },
];

export const lectures: Lecture[] = [
  {
    id: "ds-final-tree-graph",
    courseId: "cose213",
    instructorId: "jung",
    title: "자료구조 기말 총정리: 트리·힙·그래프 6시간 완성",
    summary:
      "박지훈 교수님 분반 기말 범위를 출제 경향 순서대로 정리했어요. 손으로 추적하는 문제 위주입니다.",
    price: 5900,
    studyGroup: { price: 14900, capacity: 15, remaining: 4 },
    chapters: [
      { title: "0강. 오리엔테이션: 이 교수님 시험은 이렇게 나와요", minutes: 8, preview: true },
      { title: "1강. AVL 트리 회전 4가지 케이스", minutes: 52 },
      { title: "2강. 힙과 우선순위 큐, 배열 표현", minutes: 48 },
      { title: "3강. 그래프 표현과 BFS·DFS 추적", minutes: 61 },
      { title: "4강. 다익스트라·프림 손으로 돌리기", minutes: 66 },
      { title: "5강. 해싱과 충돌 처리", minutes: 39 },
      { title: "6강. 시험 스타일 문제 풀이 12선", minutes: 84 },
    ],
    covers: [
      "AVL 회전을 그림 하나로 판별하는 법",
      "BFS·DFS 방문 순서 추적 문제 풀이 루틴",
      "다익스트라 표 채우기에서 자주 틀리는 지점",
      "직접 만든 시험 스타일 문제 12개와 해설",
    ],
    rating: 4.9,
    reviewCount: 38,
    sales: 112,
    status: "판매 중",
  },
  {
    id: "ds-pointer-bootcamp",
    courseId: "cose213",
    instructorId: "oh",
    title: "자료구조 포인터 집중반: 연결 리스트부터 트리 구현까지",
    summary: "C 포인터에서 막히는 사람을 위한 과제·시험 동시 대비 강의.",
    price: 4900,
    chapters: [
      { title: "0강. 포인터 그림 그리는 법", minutes: 10, preview: true },
      { title: "1강. 단일·이중 연결 리스트", minutes: 45 },
      { title: "2강. 스택·큐 구현", minutes: 38 },
      { title: "3강. 이진 탐색 트리 삽입·삭제", minutes: 57 },
      { title: "4강. 코드 빈칸 문제 대비", minutes: 41 },
    ],
    covers: [
      "포인터 연산을 박스 그림으로 추적하기",
      "BST 삭제 3가지 경우 코드로 구현",
      "시험에 나오는 코드 빈칸 채우기 유형",
    ],
    rating: 4.7,
    reviewCount: 21,
    sales: 64,
    status: "판매 중",
  },
  {
    id: "calc-integration",
    courseId: "math141",
    instructorId: "kang",
    title: "미적분학Ⅰ 기말: 적분 테크닉 유형별 정리",
    summary: "치환·부분적분·부분분수까지, 기말에 나오는 적분 유형을 한 번에 정리해요.",
    price: 5900,
    studyGroup: { price: 13900, capacity: 15, remaining: 9 },
    chapters: [
      { title: "0강. 기말 범위와 배점 분석", minutes: 7, preview: true },
      { title: "1강. 치환적분 패턴 5가지", minutes: 44 },
      { title: "2강. 부분적분 표 그리기", minutes: 40 },
      { title: "3강. 부분분수 분해", minutes: 36 },
      { title: "4강. 이상적분과 수렴 판정", minutes: 50 },
      { title: "5강. 실전 문제 풀이", minutes: 72 },
    ],
    covers: [
      "어떤 적분법을 쓸지 3초 안에 고르는 기준",
      "부분적분 표 그리기로 계산 실수 줄이기",
      "작년 시험 스타일로 직접 만든 연습 문제",
    ],
    rating: 4.8,
    reviewCount: 29,
    sales: 87,
    status: "판매 중",
  },
  {
    id: "phys-rotation",
    courseId: "phys151",
    instructorId: "seo",
    title: "일반물리Ⅰ 기말: 회전운동·각운동량 문제풀이",
    summary: "긴 서술형 문제를 식으로 옮기는 연습에 집중한 문제풀이 강의.",
    price: 6900,
    chapters: [
      { title: "0강. 문제를 그림으로 옮기는 법", minutes: 9, preview: true },
      { title: "1강. 관성모멘트와 평행축 정리", minutes: 47 },
      { title: "2강. 토크와 회전 방정식", minutes: 53 },
      { title: "3강. 각운동량 보존", minutes: 49 },
      { title: "4강. 굴림 운동 종합 문제", minutes: 68 },
    ],
    covers: [
      "자유물체도에서 토크 방향 헷갈리지 않는 법",
      "굴림 운동에서 에너지 보존 vs 회전 방정식 선택",
      "서술형 부분점수 받는 풀이 쓰는 법",
    ],
    rating: 4.6,
    reviewCount: 14,
    sales: 41,
    status: "판매 중",
  },
  {
    id: "toeic-part7",
    courseId: "toeic",
    instructorId: "yoon",
    title: "토익 RC 파트7: 시간 안에 다 푸는 순서",
    summary: "지문 유형별로 어디부터 읽을지 정해 두고 푸는 방법. 파트7에서 시간이 모자란 사람을 위한 강의예요.",
    price: 9900,
    chapters: [
      { title: "0강. 내가 시간이 모자랐던 이유", minutes: 9, preview: true },
      { title: "1강. 단일 지문: 질문부터 읽기", minutes: 42 },
      { title: "2강. 이중 지문: 연결 고리 찾기", minutes: 47 },
      { title: "3강. 삼중 지문: 버릴 문제 고르기", minutes: 51 },
      { title: "4강. 실전 1세트 같이 풀기", minutes: 75 },
    ],
    covers: [
      "지문 유형별로 읽는 순서 정하기",
      "삼중 지문에서 시간 아끼는 문제 고르는 법",
      "실전 1세트를 시간 재고 같이 풀기",
    ],
    rating: 4.8,
    reviewCount: 17,
    sales: 58,
    status: "판매 중",
  },
  {
    id: "jeongcheo-code",
    courseId: "jeongcheo",
    instructorId: "baek",
    title: "정보처리기사 실기: 코드 해석 문제만 모아서",
    summary: "C, 자바, 파이썬 코드 결과 맞히기 문제를 언어별로 정리했어요.",
    price: 7900,
    chapters: [
      { title: "0강. 실기 코드 문제 출제 패턴", minutes: 8, preview: true },
      { title: "1강. C 포인터와 배열", minutes: 46 },
      { title: "2강. 자바 상속과 오버라이딩", minutes: 44 },
      { title: "3강. 파이썬 리스트와 슬라이싱", minutes: 31 },
      { title: "4강. 직접 만든 연습 문제 20개", minutes: 63 },
    ],
    covers: [
      "언어별로 자주 나오는 함정 정리",
      "출력 결과를 손으로 추적하는 순서",
      "직접 만든 연습 문제 20개와 해설",
    ],
    rating: 4.7,
    reviewCount: 9,
    sales: 33,
    status: "판매 중",
  },
];

export const reviews: Review[] = [
  {
    lectureId: "ds-final-tree-graph",
    author: "컴퓨터학과 25학번",
    rating: 5,
    text: "AVL 회전 판별법 하나로 시험 한 문제 그냥 먹었어요. 교수님 스타일이랑 진짜 똑같았음.",
    date: "2026-06-18",
  },
  {
    lectureId: "ds-final-tree-graph",
    author: "데이터과학과 25학번",
    rating: 5,
    text: "다익스트라 표 채우는 거 매번 틀렸는데 4강 보고 해결. 스터디반 질문 답변도 빨랐어요.",
    date: "2026-06-17",
  },
  {
    lectureId: "ds-final-tree-graph",
    author: "컴퓨터학과 24학번",
    rating: 4,
    text: "6강 문제가 좋았어요. 해싱 파트는 조금 더 길었으면.",
    date: "2026-06-15",
  },
  {
    lectureId: "calc-integration",
    author: "수학과 26학번",
    rating: 5,
    text: "부분적분 표 그리기 알고 나서 계산 실수가 확 줄었어요.",
    date: "2026-06-12",
  },
];

// 강사 대시보드용 더미 (로그인한 강사 = 정하윤 가정)
export const currentInstructorId = "jung";
export const instructorShare = 0.7; // 강사 정산 비율 (판매가 기준, 예시)

export const monthlySales: MonthlySales[] = [
  { month: "9월", count: 6 },
  { month: "10월", count: 31 },
  { month: "11월", count: 42 },
];

// 어드민 성적 인증 대기열 더미
export const verificationQueue: VerificationRequest[] = [
  { id: "v1", applicant: "이서연", major: "경제학과", courseId: "econ101", grade: "A+", semester: "2025년 2학기", submittedAt: "2026-11-18" },
  { id: "v2", applicant: "김도윤", major: "컴퓨터학과", courseId: "cose213", grade: "A+", semester: "2025년 2학기", submittedAt: "2026-11-18" },
  { id: "v3", applicant: "박채원", major: "물리학과", courseId: "phys151", grade: "A", semester: "2025년 2학기", submittedAt: "2026-11-17" },
  { id: "v4", applicant: "최우진", major: "수학과", courseId: "math141", grade: "A+", semester: "2025년 1학기", submittedAt: "2026-11-16" },
  { id: "v5", applicant: "정다은", major: "영어영문학과", courseId: "toeic", grade: "940점", semester: "2026년 10월 응시", submittedAt: "2026-11-16" },
];

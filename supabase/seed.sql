-- ⚠️ scripts/generate-seed.ts가 만든 파일입니다. 직접 고치지 말고 lib/mock-data.ts를 고친 뒤 다시 생성하세요.
-- 과목·교수·사람 이름은 모두 예시입니다.

begin;

insert into public.courses (id, kind, code, name, professor, semester, group_name, department, students, exam_date, exam_label) values
  ('cose213', 'major', 'COSE213', '자료구조', '박지훈', '2026-2학기', '정보대학', '컴퓨터학과', 182, '2026-12-16', '기말고사'),
  ('cose214', 'major', 'COSE214', '알고리즘', '남궁현', '2026-2학기', '정보대학', '컴퓨터학과', 134, '2026-12-17', '기말고사'),
  ('math141', 'major', 'MATH141', '미적분학Ⅰ', '최은영', '2026-2학기', '이과대학', '수학과', 240, '2026-12-14', '기말고사'),
  ('phys151', 'major', 'PHYS151', '일반물리학Ⅰ', '한상우', '2026-2학기', '이과대학', '물리학과', 205, '2026-12-15', '기말고사'),
  ('econ101', 'major', 'ECON101', '경제원론', '윤서진', '2026-2학기', '정경대학', '경제학과', 310, '2026-12-18', '기말고사'),
  ('stat201', 'major', 'STAT201', '통계학입문', '임재원', '2026-2학기', '정경대학', '통계학과', 156, '2026-12-12', '기말고사'),
  ('toeic', 'cert', null, '토익', null, null, '어학', null, null, '2026-12-13', '시험'),
  ('jeongcheo', 'cert', null, '정보처리기사 실기', null, null, 'IT 자격증', null, null, '2027-04-18', '시험'),
  ('sqld', 'cert', null, 'SQLD', null, null, 'IT 자격증', null, null, '2027-03-07', '시험');

insert into public.instructors (id, name, major, admission_year, bio) values
  ('jung', '정하윤', '컴퓨터학과', 24, '박지훈 교수님 자료구조 A+. 시험에서 자주 나오는 트리 회전·그래프 추적 문제를 손으로 그려가며 설명해요.'),
  ('oh', '오태민', '컴퓨터학과', 23, 'C 포인터가 약한 사람 기준으로 과제와 시험을 같이 잡아드립니다.'),
  ('kang', '강민지', '수학과', 24, '적분 테크닉을 유형별로 쪼개서 기말 직전에 한 번에 정리할 수 있게 만들었어요.'),
  ('seo', '서준혁', '물리학과', 23, '한상우 교수님 시험은 문제 길이가 길어요. 상황을 식으로 옮기는 연습에 집중합니다.'),
  ('yoon', '윤지아', '영어교육과', 23, '파트7에서 시간이 모자라던 걸 해결하고 965점을 받았어요. 문제 유형별로 어디부터 읽을지 정해서 풀어요.'),
  ('baek', '백승호', '컴퓨터학과', 22, '실기에서 점수 차이가 나는 코드 해석 문제만 따로 모아서 정리했어요.'),
  ('applicant-v1', '이서연', '경제학과', null, ''),
  ('applicant-v2', '김도윤', '컴퓨터학과', null, ''),
  ('applicant-v3', '박채원', '물리학과', null, ''),
  ('applicant-v4', '최우진', '수학과', null, ''),
  ('applicant-v5', '정다은', '영어영문학과', null, '');

insert into public.grade_verifications (instructor_id, course_id, grade, semester_label, proof_text, status, submitted_at, reviewed_at) values
  ('jung', 'cose213', 'A+', '2025-2학기', '2025년 2학기 자료구조 성적을 확인했어요', 'approved', now(), now()),
  ('oh', 'cose213', 'A+', '2025-2학기', '2025년 2학기 자료구조 성적을 확인했어요', 'approved', now(), now()),
  ('kang', 'math141', 'A+', '2025-2학기', '2025년 2학기 미적분학Ⅰ 성적을 확인했어요', 'approved', now(), now()),
  ('seo', 'phys151', 'A+', '2025-2학기', '2025년 2학기 일반물리학Ⅰ 성적을 확인했어요', 'approved', now(), now()),
  ('yoon', 'toeic', '965', '2026-09', '2026년 9월 토익 성적표를 확인했어요', 'approved', now(), now()),
  ('baek', 'jeongcheo', '합격', '2026-2회', '2026년 2회 정보처리기사 실기 합격을 확인했어요', 'approved', now(), now()),
  ('applicant-v1', 'econ101', 'A+', '2025년 2학기', null, 'pending', '2026-11-18T09:00:00+09:00', null),
  ('applicant-v2', 'cose213', 'A+', '2025년 2학기', null, 'pending', '2026-11-18T09:00:00+09:00', null),
  ('applicant-v3', 'phys151', 'A', '2025년 2학기', null, 'pending', '2026-11-17T09:00:00+09:00', null),
  ('applicant-v4', 'math141', 'A+', '2025년 1학기', null, 'pending', '2026-11-16T09:00:00+09:00', null),
  ('applicant-v5', 'toeic', '940점', '2026년 10월 응시', null, 'pending', '2026-11-16T09:00:00+09:00', null);

insert into public.lectures (id, course_id, instructor_id, title, summary, price, study_group_price, study_group_capacity, covers, status, sales_count, review_count, rating_sum, study_group_taken) values
  ('ds-final-tree-graph', 'cose213', 'jung', '자료구조 기말 총정리: 트리·힙·그래프 6시간 완성', '박지훈 교수님 분반 기말 범위를 출제 경향 순서대로 정리했어요. 손으로 추적하는 문제 위주입니다.', 5900, 14900, 15, array['AVL 회전을 그림 하나로 판별하는 법', 'BFS·DFS 방문 순서 추적 문제 풀이 루틴', '다익스트라 표 채우기에서 자주 틀리는 지점', '직접 만든 시험 스타일 문제 12개와 해설']::text[], 'on_sale', 112, 38, 186, 11),
  ('ds-pointer-bootcamp', 'cose213', 'oh', '자료구조 포인터 집중반: 연결 리스트부터 트리 구현까지', 'C 포인터에서 막히는 사람을 위한 과제·시험 동시 대비 강의.', 4900, null, null, array['포인터 연산을 박스 그림으로 추적하기', 'BST 삭제 3가지 경우 코드로 구현', '시험에 나오는 코드 빈칸 채우기 유형']::text[], 'on_sale', 64, 21, 99, 0),
  ('calc-integration', 'math141', 'kang', '미적분학Ⅰ 기말: 적분 테크닉 유형별 정리', '치환·부분적분·부분분수까지, 기말에 나오는 적분 유형을 한 번에 정리해요.', 5900, 13900, 15, array['어떤 적분법을 쓸지 3초 안에 고르는 기준', '부분적분 표 그리기로 계산 실수 줄이기', '작년 시험 스타일로 직접 만든 연습 문제']::text[], 'on_sale', 87, 29, 139, 6),
  ('phys-rotation', 'phys151', 'seo', '일반물리Ⅰ 기말: 회전운동·각운동량 문제풀이', '긴 서술형 문제를 식으로 옮기는 연습에 집중한 문제풀이 강의.', 6900, null, null, array['자유물체도에서 토크 방향 헷갈리지 않는 법', '굴림 운동에서 에너지 보존 vs 회전 방정식 선택', '서술형 부분점수 받는 풀이 쓰는 법']::text[], 'on_sale', 41, 14, 64, 0),
  ('toeic-part7', 'toeic', 'yoon', '토익 RC 파트7: 시간 안에 다 푸는 순서', '지문 유형별로 어디부터 읽을지 정해 두고 푸는 방법. 파트7에서 시간이 모자란 사람을 위한 강의예요.', 9900, null, null, array['지문 유형별로 읽는 순서 정하기', '삼중 지문에서 시간 아끼는 문제 고르는 법', '실전 1세트를 시간 재고 같이 풀기']::text[], 'on_sale', 58, 17, 82, 0),
  ('jeongcheo-code', 'jeongcheo', 'baek', '정보처리기사 실기: 코드 해석 문제만 모아서', 'C, 자바, 파이썬 코드 결과 맞히기 문제를 언어별로 정리했어요.', 7900, null, null, array['언어별로 자주 나오는 함정 정리', '출력 결과를 손으로 추적하는 순서', '직접 만든 연습 문제 20개와 해설']::text[], 'on_sale', 33, 9, 42, 0);

insert into public.chapters (lecture_id, position, title, minutes, is_preview) values
  ('ds-final-tree-graph', 0, '0강. 오리엔테이션: 이 교수님 시험은 이렇게 나와요', 8, true),
  ('ds-final-tree-graph', 1, '1강. AVL 트리 회전 4가지 케이스', 52, false),
  ('ds-final-tree-graph', 2, '2강. 힙과 우선순위 큐, 배열 표현', 48, false),
  ('ds-final-tree-graph', 3, '3강. 그래프 표현과 BFS·DFS 추적', 61, false),
  ('ds-final-tree-graph', 4, '4강. 다익스트라·프림 손으로 돌리기', 66, false),
  ('ds-final-tree-graph', 5, '5강. 해싱과 충돌 처리', 39, false),
  ('ds-final-tree-graph', 6, '6강. 시험 스타일 문제 풀이 12선', 84, false),
  ('ds-pointer-bootcamp', 0, '0강. 포인터 그림 그리는 법', 10, true),
  ('ds-pointer-bootcamp', 1, '1강. 단일·이중 연결 리스트', 45, false),
  ('ds-pointer-bootcamp', 2, '2강. 스택·큐 구현', 38, false),
  ('ds-pointer-bootcamp', 3, '3강. 이진 탐색 트리 삽입·삭제', 57, false),
  ('ds-pointer-bootcamp', 4, '4강. 코드 빈칸 문제 대비', 41, false),
  ('calc-integration', 0, '0강. 기말 범위와 배점 분석', 7, true),
  ('calc-integration', 1, '1강. 치환적분 패턴 5가지', 44, false),
  ('calc-integration', 2, '2강. 부분적분 표 그리기', 40, false),
  ('calc-integration', 3, '3강. 부분분수 분해', 36, false),
  ('calc-integration', 4, '4강. 이상적분과 수렴 판정', 50, false),
  ('calc-integration', 5, '5강. 실전 문제 풀이', 72, false),
  ('phys-rotation', 0, '0강. 문제를 그림으로 옮기는 법', 9, true),
  ('phys-rotation', 1, '1강. 관성모멘트와 평행축 정리', 47, false),
  ('phys-rotation', 2, '2강. 토크와 회전 방정식', 53, false),
  ('phys-rotation', 3, '3강. 각운동량 보존', 49, false),
  ('phys-rotation', 4, '4강. 굴림 운동 종합 문제', 68, false),
  ('toeic-part7', 0, '0강. 내가 시간이 모자랐던 이유', 9, true),
  ('toeic-part7', 1, '1강. 단일 지문: 질문부터 읽기', 42, false),
  ('toeic-part7', 2, '2강. 이중 지문: 연결 고리 찾기', 47, false),
  ('toeic-part7', 3, '3강. 삼중 지문: 버릴 문제 고르기', 51, false),
  ('toeic-part7', 4, '4강. 실전 1세트 같이 풀기', 75, false),
  ('jeongcheo-code', 0, '0강. 실기 코드 문제 출제 패턴', 8, true),
  ('jeongcheo-code', 1, '1강. C 포인터와 배열', 46, false),
  ('jeongcheo-code', 2, '2강. 자바 상속과 오버라이딩', 44, false),
  ('jeongcheo-code', 3, '3강. 파이썬 리스트와 슬라이싱', 31, false),
  ('jeongcheo-code', 4, '4강. 직접 만든 연습 문제 20개', 63, false);

alter table public.reviews disable trigger reviews_sync_counters;
insert into public.reviews (lecture_id, author_label, rating, body, created_at) values
  ('ds-final-tree-graph', '컴퓨터학과 25학번', 5, 'AVL 회전 판별법 하나로 시험 한 문제 그냥 먹었어요. 교수님 스타일이랑 진짜 똑같았음.', '2026-06-18T12:00:00+09:00'),
  ('ds-final-tree-graph', '데이터과학과 25학번', 5, '다익스트라 표 채우는 거 매번 틀렸는데 4강 보고 해결. 스터디반 질문 답변도 빨랐어요.', '2026-06-17T12:00:00+09:00'),
  ('ds-final-tree-graph', '컴퓨터학과 24학번', 4, '6강 문제가 좋았어요. 해싱 파트는 조금 더 길었으면.', '2026-06-15T12:00:00+09:00'),
  ('calc-integration', '수학과 26학번', 5, '부분적분 표 그리기 알고 나서 계산 실수가 확 줄었어요.', '2026-06-12T12:00:00+09:00');
alter table public.reviews enable trigger reviews_sync_counters;

commit;

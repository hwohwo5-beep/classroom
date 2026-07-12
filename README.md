# 클래스룸 (Classroom)

동창회 소셜 웹앱 — 우리 반이 다시 모이는 곳

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Auth**: Firebase Authentication (카카오/Google)
- **Map**: KakaoMap SDK
- **School Data**: NEIS (나이스 교육정보) API
- **Database**: Firestore (예정)

## 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일에 실제 API 키 입력

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열면 `/login` 페이지로 리다이렉트됩니다.

## 폴더 구조

```
classroom/
├── app/                          # Next.js App Router 페이지
│   ├── layout.tsx                # 루트 레이아웃 (AuthProvider 래핑)
│   ├── page.tsx                  # 루트 → /login 리다이렉트
│   ├── login/page.tsx            # [S1] 로그인 페이지
│   ├── map/page.tsx              # [S2] 학교 지도 페이지
│   ├── select/page.tsx           # [S3] 학년/반 선택 페이지
│   ├── room/page.tsx             # [S4] 교실(방) 페이지
│   └── create/page.tsx           # [S5] 콘텐츠 만들기 페이지
├── components/                   # 재사용 가능한 UI 컴포넌트
│   ├── ui/Button.tsx             # 공용 버튼
│   ├── ui/Input.tsx              # 공용 입력 필드
│   ├── SocialButton.tsx          # 소셜 로그인 버튼
│   ├── NicknameModal.tsx         # 닉네임 설정 모달
│   ├── BottomSheet.tsx           # 바텀시트
│   ├── SchoolMarker.tsx          # 학교 마커
│   └── MemberCard.tsx            # 멤버 카드
├── context/
│   └── AuthContext.tsx           # Firebase Auth Context
├── hooks/
│   └── useAuth.ts                # Auth 커스텀 훅
├── lib/                          # 외부 API/서비스 연동
│   ├── firebase.ts               # Firebase 초기화
│   ├── neis.ts                   # NEIS API
│   ├── kakaoMap.ts               # 카카오맵 SDK
│   └── room.ts                   # Firestore Room CRUD
├── types/
│   └── index.ts                  # 공통 타입 정의
├── theme/
│   └── colors.ts                 # 컬러 상수
├── .env.local.example            # 환경 변수 템플릿
└── README.md
```

## 페이지 흐름

```
/ → /login → /map → /select → /room → /create
```

| 단계 | 페이지 | 설명 |
|------|--------|------|
| S1 | `/login` | 카카오/Google 소셜 로그인 |
| S2 | `/map` | 카카오맵에서 학교 검색 및 선택 |
| S3 | `/select` | 입학 연도, 학년, 반 선택 |
| S4 | `/room` | 교실(방) 페이지 (멤버 목록, 콘텐츠 피드) |
| S5 | `/create` | "그때 vs 지금" 콘텐츠 제작 및 공유 |

## 환경 변수

`.env.local.example` 참고:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | 카카오맵 JavaScript 앱 키 |
| `NEIS_API_KEY` | NEIS 오픈API 인증 키 |

> **주의**: 실제 API 키는 절대 코드에 하드코딩하지 말고 `.env.local`에만 저장하세요.

## 개발 단계

- 현재: **Phase 0 — 프로젝트 뼈대**
- 다음: Phase 1 — Firebase Auth + 로그인
- 이후: Phase 2 — 카카오맵 + NEIS 연동
- 이후: Phase 3 — Firestore Room CRUD
- 이후: Phase 4 — 콘텐츠 제작/공유
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

// TODO: [S0] 메인 랜딩(로비) 페이지
// - 로그인 상태에 따라 3단계 분기 (loading / 미로그인 / 로그인)
// - Firestore users/{uid}/myClasses 컬렉션에서 내 반 목록 조회
// - 내 반 있으면 카드 리스트, 없으면 학교 찾기 CTA

interface MyClass {
  roomId: string;
  schoolName: string;
  year: number;
  grade: number;
  classNo: number;
  lastVisited: Timestamp | null; // Firestore serverTimestamp → Timestamp 객체
}

export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuthContext();

  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── 메뉴 바깥 클릭 시 닫기 ───
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // ─── 로그인된 사용자의 myClasses 조회 ───
  useEffect(() => {
    if (!user) {
      setMyClasses([]);
      return;
    }

    let cancelled = false;
    setClassesLoading(true);

    (async () => {
      try {
        const myClassesRef = collection(db, "users", user.uid, "myClasses");
        const q = query(myClassesRef, orderBy("lastVisited", "desc"));
        const snapshot = await getDocs(q);

        if (cancelled) return;

        const classes: MyClass[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          classes.push({
            roomId: data.roomId ?? doc.id,
            schoolName: data.schoolName ?? "",
            year: data.year ?? 0,
            grade: data.grade ?? 0,
            classNo: data.classNo ?? 0,
            lastVisited: data.lastVisited ?? null,
          });
        });
        setMyClasses(classes);
      } catch (err) {
        console.error("Failed to load myClasses:", err);
        if (!cancelled) setMyClasses([]);
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ─── 구글 로그인 핸들러 ───
  const handleGoogleSignIn = async () => {
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setLoginError(msg);
    }
  };

  // ─── lastVisited 포맷 (Timestamp 객체 → 상대시간 문자열) ───
  const formatLastVisited = (ts: Timestamp | null): string => {
    if (!ts) return ""; // serverTimestamp 아직 반영 안 됨
    try {
      const date = ts.toDate();
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHour = Math.floor(diffMs / 3600000);
      const diffDay = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return "방금";
      if (diffMin < 60) return `${diffMin}분 전`;
      if (diffHour < 24) return `${diffHour}시간 전`;
      if (diffDay < 7) return `${diffDay}일 전`;
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  // ─── 시간대 판단 ───
  const hour = new Date().getHours();
  let timeLabel: string;
  let timeEmoji: string;
  if (hour >= 6 && hour <= 10) {
    timeLabel = "등교";
    timeEmoji = "🌅";
  } else if (hour >= 11 && hour <= 14) {
    timeLabel = "점심";
    timeEmoji = "🍱";
  } else {
    timeLabel = "하교";
    timeEmoji = "🌙";
  }

  // ── 1단계: auth 로딩 중 ──
  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#e5e8eb] border-t-[#3182f6] rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[#8b95a1]">불러오는 중...</p>
        </div>
      </main>
    );
  }

   // ── 2단계: 미로그인 ──
   if (!user) {
     return (
       <main className="min-h-screen bg-[#f9fafb]">
         <div className="flex flex-col lg:flex-row h-full w-full items-center justify-center">
           {/* Left: brand area (only on lg and up) */}
           <div className="hidden lg:flex flex-1 lg:flex-1 flex-col items-center justify-center bg-gradient-to-br from-[#f04452] to-[#ff6b7a] text-white px-8">
             <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6">
               <span className="text-3xl font-bold text-white">클</span>
             </div>
             <h1 className="text-3xl font-bold text-white mb-4">교실</h1>
             <p className="text-lg text-white/90 text-center mb-8">
               우리 반이 콘텐츠가 되는 곳
             </p>
             <div className="space-y-4 text-center text-white/80">
               <div className="flex items-center justify-center gap-3">
                 <span className="text-2xl">🎬</span>
                 <div className="text-left">
                   <p className="font-medium">3초 릴스</p>
                   <p className="text-sm">하루 3초, 우리 반 기록</p>
                 </div>
               </div>
               <div className="flex items-center justify-center gap-3">
                 <span className="text-2xl">⏳</span>
                 <div className="text-left">
                   <p className="font-medium">N년 후 재회</p>
                   <p className="text-sm">시간이 지나면 다시 만나요</p>
                 </div>
               </div>
               <div className="flex items-center justify-center gap-3">
                 <span className="text-2xl">📱</span>
                 <div className="text-left">
                   <p className="font-medium">그리드 공유</p>
                   <p className="text-sm">인스타로 반 전체 한 번에</p>
                 </div>
               </div>
             </div>
           </div>
           {/* Right: login card */}
           <div className="flex-1 lg:flex-1 flex-col items-center justify-center bg-white w-full max-w-[420px] px-8">
             <div className="w-full max-w-[420px]">
               <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#f04452] to-[#ff6b7a] flex items-center justify-center mb-6 shadow-lg shadow-[#f04452]/20">
                 <span className="text-3xl font-bold text-white">클</span>
               </div>
               <h1 className="text-2xl font-bold text-[#191f28]">교실</h1>
               <p className="text-sm text-[#6b7684] mt-2 text-center">
                 우리 반이 콘텐츠가 되는 곳
               </p>

               {/* 구글 로그인 버튼 */}
               <button
                 onClick={handleGoogleSignIn}
                 className="mt-10 w-full h-[52px] rounded-[7px] bg-[#191f28] text-white font-medium text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-96"
               >
                 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                   <path
                     d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                     fill="#4285F4"
                   />
                   <path
                     d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                     fill="#34A853"
                   />
                   <path
                     d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                     fill="#FBBC05"
                   />
                   <path
                     d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                     fill="#EA4335"
                   />
                 </svg>
                 구글로 시작하기
               </button>

               {loginError && (
                 <p className="mt-3 text-xs text-[#f04452] text-center">{loginError}</p>
               )}

               {/* 하단 안내 */}
               <p className="mt-8 text-xs text-[#8b95a1] text-center">
                 로그인하면 우리 반 친구들과
                 <br />
                 3초 릴스로 추억을 남길 수 있어요
               </p>
             </div>
           </div>
         </div>
       </main>
     );
   }

  // ── 3단계: 로그인됨 → 로비 ──
  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col">
        {/* 헤더 */}
        <div className="px-5 pt-12 pb-4 border-b border-[#e5e8eb]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f04452] to-[#ff6b7a] flex items-center justify-center">
                <span className="text-sm font-bold text-white">클</span>
              </div>
              <h1 className="text-lg font-bold text-[#191f28]">교실</h1>
            </div>
            {/* 우측: 프로필 아이콘 + 드롭다운 메뉴 */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full overflow-hidden border border-[#e5e8eb] active:scale-95 transition-transform duration-96"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.nickname ?? ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-sm font-medium text-[#6b7684] bg-[#f2f4f6]">
                    {user?.nickname?.charAt(0) ?? "?"}
                  </span>
                )}
              </button>

              {/* 드롭다운 메뉴 */}
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[180px] bg-white rounded-xl shadow-lg border border-[#f2f4f6] py-1 z-50">
                  {/* 내 정보 */}
                  <div className="px-4 py-3 border-b border-[#f2f4f6]">
                    <p className="text-xs text-[#8b95a1]">내 정보</p>
                    <p className="text-sm font-medium text-[#191f28] mt-0.5 truncate">
                      {user?.nickname ?? "사용자"}
                    </p>
                  </div>

                  {/* 공지사항 */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      alert("준비 중");
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#191f28] hover:bg-[#f9fafb] flex items-center gap-2 active:bg-[#f2f4f6] transition-colors duration-96"
                  >
                    <span>📢</span> 공지사항
                  </button>

                  {/* 환경설정 */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      alert("준비 중");
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#191f28] hover:bg-[#f9fafb] flex items-center gap-2 active:bg-[#f2f4f6] transition-colors duration-96"
                  >
                    <span>⚙️</span> 환경설정
                  </button>

                  {/* 로그아웃 */}
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        await signOut();
                      } catch {
                        // 무시
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#f04452] hover:bg-[#fef2f2] flex items-center gap-2 active:bg-[#fde8e8] transition-colors duration-96 border-t border-[#f2f4f6] mt-1"
                  >
                    <span>🚪</span> 로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-[#6b7684] mt-2">
            {user.nickname || "익명"}님 안녕하세요 👋
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 px-5 pt-6 pb-8">
          {classesLoading ? (
            /* myClasses 로딩 중 */
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#e5e8eb] border-t-[#3182f6] rounded-full animate-spin" />
            </div>
          ) : myClasses.length > 0 ? (
            /* 케이스 A: 내 반 있음 */
            <>
              <h2 className="text-sm font-semibold text-[#6b7684] mb-3">내 교실</h2>
              <div className="space-y-3">
                {myClasses.map((cls) => (
                  <button
                    key={cls.roomId}
                    onClick={() => router.push(`/room?roomId=${cls.roomId}`)}
                    className="w-full text-left p-4 rounded-xl border border-[#e5e8eb] bg-white hover:bg-[#f9fafb] active:bg-[#f2f4f6] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#191f28]">
                          {cls.schoolName}
                        </h3>
                        <p className="text-sm text-[#6b7684] mt-0.5">
                          {cls.year}년 · {cls.grade}학년 {cls.classNo}반
                        </p>
                      </div>
                      {cls.lastVisited && (
                        <span className="text-xs text-[#8b95a1] shrink-0">
                          {formatLastVisited(cls.lastVisited)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 시간대 촬영 유도 배너 */}
              <button
                onClick={() => router.push(`/reels?roomId=${myClasses[0].roomId}`)}
                className="mt-5 w-full p-4 rounded-xl bg-gradient-to-r from-[#fef2f2] to-[#fff7ed] border border-[#fde8e8] text-left active:scale-[0.98] transition-transform duration-96"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{timeEmoji}</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">
                      📸 지금은 {timeLabel} 시간!
                    </p>
                    <p className="text-xs text-[#6b7684] mt-0.5">
                      우리 반 릴스 남겨볼까요?
                    </p>
                  </div>
                  <span className="ml-auto text-[#f04452] text-lg">→</span>
                </div>
              </button>

              {/* 하단 "+ 다른 학교 찾기" */}
              <button
                onClick={() => router.push("/map")}
                className="mt-3 w-full h-[44px] rounded-[7px] border border-[#e5e8eb] text-[#6b7684] text-sm font-medium flex items-center justify-center gap-1 active:scale-[0.98] transition-transform duration-96"
              >
                + 다른 학교 찾기
              </button>

              {/* 서비스 소개/감성 섹션 */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">🎬</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">3초 릴스</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">하루 3초, 우리 반 기록</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">⏳</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">N년 후 재회</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">시간이 지나면 다시 만나요</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">📱</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">그리드 공유</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">인스타로 반 전체 한 번에</p>
                  </div>
                </div>
              </div>

               {/* 앱 슬로건 푸터 */}
               <p className="mt-8 text-xs text-[#8b95a1] text-center">
                 우리 반이 콘텐츠가 되는 곳 · 교실
               </p>
            </>
          ) : (
            /* 케이스 B: 내 반 없음 */
            <div className="flex flex-col items-center justify-center py-16">
              {/* 히어로 */}
              <div className="w-16 h-16 rounded-2xl bg-[#f2f4f6] flex items-center justify-center mb-5">
                <span className="text-3xl">🏫</span>
              </div>
              <h2 className="text-xl font-bold text-[#191f28] text-center">
                우리 반, 지금 찾아보세요
              </h2>
              <p className="text-sm text-[#6b7684] mt-2 text-center">
                3초 릴스로 반 친구들과 추억을 남기고
                <br />
                우리만의 교실을 만들어보세요
              </p>

              {/* CTA */}
              <button
                onClick={() => router.push("/map")}
                className="mt-8 w-full h-[52px] rounded-[7px] bg-[#3182f6] text-white font-medium text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-96"
              >
                🔍 학교 찾기
              </button>

              {/* 서비스 소개/감성 섹션 */}
              <div className="mt-10 space-y-3 w-full">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">🎬</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">3초 릴스</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">하루 3초, 우리 반 기록</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">⏳</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">N년 후 재회</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">시간이 지나면 다시 만나요</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-[#f2f4f6]">
                  <span className="text-2xl shrink-0">📱</span>
                  <div>
                    <p className="text-sm font-bold text-[#191f28]">그리드 공유</p>
                    <p className="text-xs text-[#6b7684] mt-0.5">인스타로 반 전체 한 번에</p>
                  </div>
                </div>
              </div>

               {/* 앱 슬로건 푸터 */}
               <p className="mt-8 text-xs text-[#8b95a1] text-center">
                 우리 반이 콘텐츠가 되는 곳 · 교실
               </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
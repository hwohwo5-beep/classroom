"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";

// TODO: [S1] 로그인 페이지
// - 최초 로그인 시 NicknameModal 표시
// - 카카오 로그인 연동

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithKakao } = useAuthContext();

  // 이미 로그인된 경우 /map 으로 이동
  useEffect(() => {
    if (!loading && user) {
      router.replace("/map");
    }
  }, [user, loading, router]);

  const handleKakaoLogin = async () => {
    try {
      await signInWithKakao();
      router.push("/map");
    } catch {
      // 카카오 미구현 상태
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      router.push("/map");
    } catch (err) {
      console.error("Google login failed:", err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col items-center justify-center">
          <p className="text-[#8b95a1] text-sm">로딩 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col px-6">
        {/* 상단 여백 + 로고 영역 */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[#e8f3ff] flex items-center justify-center text-3xl mb-5">
            🎓
          </div>
          <h1 className="text-[32px] font-bold text-[#191f28] tracking-tight">
            클래스룸
          </h1>
          <p className="mt-2 text-base text-[#6b7684]">
            우리 반이 다시 모이는 곳
          </p>
        </div>

        {/* 하단 고정 버튼 영역 */}
        <div className="pb-10 space-y-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full h-14 rounded-[7px] bg-[#FEE500] text-[#191f28] font-medium text-base active:scale-[0.98] transition-transform duration-96"
          >
            카카오로 시작하기
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full h-14 rounded-[7px] bg-white border border-[#e5e8eb] text-[#191f28] font-medium text-base active:scale-[0.98] transition-transform duration-96"
          >
            Google로 시작하기
          </button>

          <p className="text-center text-xs text-[#8b95a1] pt-3">
            이용약관 및 개인정보처리방침
          </p>
        </div>
      </div>
    </main>
  );
}
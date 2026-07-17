"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/context/AuthContext";

// TODO: 공통 헤더 컴포넌트
// - 모든 페이지 상단에 sticky로 얹을 예정
// - 아직 어떤 페이지에도 import되지 않음 (다음 단계에서 layout 등에 추가)

export default function Header() {
  const router = useRouter();
  const { user, signOut } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 바깥 클릭 시 닫기
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

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e8eb]">
      <div className="w-full max-w-[420px] mx-auto h-[56px] flex items-center justify-between px-5">
        {/* 왼쪽: 뒤로가기 버튼 (←) */}
        <button
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7684] hover:bg-[#f2f4f6] active:scale-95 transition-transform text-lg font-medium leading-none"
        >
          ←
        </button>

        {/* 가운데: "반클" 로고 */}
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-[#f04452] active:scale-[0.98] transition-transform"
        >
          반클
        </button>

        {/* 오른쪽: 프로필 아이콘 + 드롭다운 메뉴 */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-8 h-8 rounded-full overflow-hidden border border-[#e5e8eb] active:scale-95 transition-transform flex items-center justify-center"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.nickname ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-sm font-medium text-[#6b7684] bg-[#f2f4f6]">
                {user?.nickname?.charAt(0) ?? "👤"}
              </span>
            )}
          </button>

          {/* 드롭다운 메뉴 */}
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[180px] bg-white rounded-xl shadow-lg border border-[#f2f4f6] py-1 z-50">
              {/* 내 정보 */}
              <div className="px-4 py-3 border-b border-[#f2f4f6]">
                <p className="text-xs text-[#8b95a1]">👤 내 정보</p>
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
                className="w-full px-4 py-2.5 text-left text-sm text-[#191f28] hover:bg-[#f9fafb] flex items-center gap-2 active:bg-[#f2f4f6] transition-colors"
              >
                <span>📢</span> 공지사항
              </button>

              {/* 설정 */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  alert("준비 중");
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-[#191f28] hover:bg-[#f9fafb] flex items-center gap-2 active:bg-[#f2f4f6] transition-colors"
              >
                <span>⚙️</span> 설정
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
                className="w-full px-4 py-2.5 text-left text-sm text-[#f04452] hover:bg-[#fef2f2] flex items-center gap-2 active:bg-[#fde8e8] transition-colors border-t border-[#f2f4f6] mt-1"
              >
                <span>🚪</span> 로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
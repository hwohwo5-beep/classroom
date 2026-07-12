"use client";

// TODO: 방 내 멤버 카드 컴포넌트
// - 프로필 사진/이모지, 닉네임, 온라인 상태 표시
// - 클릭 시 멤버 상세 정보 또는 DM (추후)

import type { Member, User } from "@/types";

interface MemberCardProps {
  member: Member;
  user: User;
  isOnline: boolean;
  onClick?: () => void;
}

export default function MemberCard({
  member,
  user,
  isOnline,
  onClick,
}: MemberCardProps) {
  // TODO: 실제 멤버 카드 UI 구현
  return (
    <div
      onClick={onClick}
      className="aspect-square rounded-xl bg-white shadow-md flex flex-col items-center justify-center relative"
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">
          {/* TODO: user.photoURL 또는 기본 이모지 */}
        </div>
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>
      <p className="text-xs text-gray-700 mt-1.5 font-medium">
        {user.nickname}
      </p>
    </div>
  );
}
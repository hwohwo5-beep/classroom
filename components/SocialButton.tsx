"use client";

// TODO: 소셜 로그인 버튼 컴포넌트
// - provider("kakao" | "google")에 따라 아이콘/색상/라벨 변경
// - onClick 시 해당 provider로 로그인 실행
// - 로딩 상태 처리

interface SocialButtonProps {
  provider: "kakao" | "google";
  onClick: () => void;
  disabled?: boolean;
}

export default function SocialButton({
  provider,
  onClick,
  disabled = false,
}: SocialButtonProps) {
  // TODO: 실제 소셜 로그인 버튼 UI 구현
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-14 rounded-2xl font-bold text-base"
    >
      {provider === "kakao" ? "카카오로 시작하기" : "Google로 시작하기"}
    </button>
  );
}
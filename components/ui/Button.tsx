"use client";

// TODO: 공용 Button 컴포넌트
// - variant: "primary" | "secondary" | "kakao" | "outline"
// - size: "sm" | "md" | "lg"
// - loading 상태 (스피너)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "kakao" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  // TODO: variant/size별 스타일 매핑, loading 스피너
  const baseClasses = "font-bold active:scale-[0.98] transition-transform";
  const sizeClasses = {
    sm: "h-9 px-4 text-xs rounded-xl",
    md: "h-12 px-6 text-sm rounded-2xl",
    lg: "h-14 px-8 text-base rounded-2xl",
  }[size];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "로딩중..." : children}
    </button>
  );
}
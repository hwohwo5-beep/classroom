"use client";

// TODO: 공용 Input 컴포넌트
// - variant: "default" | "search"
// - 에러 메시지 표시
// - label 지원

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "search";
  label?: string;
  error?: string;
}

export default function Input({
  variant = "default",
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  // TODO: variant별 스타일, 에러 상태, label
  const baseClasses =
    "w-full h-12 px-4 rounded-2xl outline-none text-sm transition-colors";
  const variantClasses = {
    default: "bg-gray-100 text-gray-800 placeholder-gray-400",
    search: "bg-white text-gray-800 placeholder-gray-400 shadow-md",
  }[variant];

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-bold text-gray-800">{label}</label>
      )}
      <input
        className={`${baseClasses} ${variantClasses} ${error ? "border border-red-400" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
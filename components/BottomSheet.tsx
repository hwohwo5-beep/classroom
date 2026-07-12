"use client";

// TODO: 바텀시트 컴포넌트
// - 학교 선택, 옵션 선택 등에 재사용
// - 드래그로 높이 조절 가능
// - 애니메이션 (위로 슬라이드 업)

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  // TODO: 실제 바텀시트 UI + 애니메이션 구현
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* 시트 */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-6 pt-5 pb-8">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
"use client";

// TODO: 닉네임 설정 모달 컴포넌트
// - 최초 로그인 시 닉네임 입력받는 모달
// - 입력값 유효성 검사 (길이, 특수문자 등)
// - 확인/취소 버튼

interface NicknameModalProps {
  isOpen: boolean;
  onSubmit: (nickname: string) => void;
  onClose: () => void;
}

export default function NicknameModal({
  isOpen,
  onSubmit,
  onClose,
}: NicknameModalProps) {
  // TODO: 실제 닉네임 모달 UI 구현
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-[320px]">
        <p className="text-lg font-bold">닉네임 설정</p>
        {/* TODO: Input + 유효성 검사 + 제출 로직 */}
      </div>
    </div>
  );
}
// TODO: [S4] 방 상세 페이지
// - roomId로 Firestore에서 Room 정보 조회
// - 멤버 목록 표시 (MemberCard)
// - 콘텐츠 피드 표시
// - "함께 콘텐츠 만들기" 버튼 → /create

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col shadow-sm">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-gray-900">S4 방 상세</h1>
            <p className="text-sm text-gray-500 mt-2">roomId: {roomId}</p>
            <p className="text-xs text-gray-400 mt-4">
              TODO: Firestore 연동 후 실제 방 데이터 표시
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
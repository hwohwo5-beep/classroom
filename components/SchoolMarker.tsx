"use client";

// TODO: 카카오맵 위에 표시할 학교 마커 컴포넌트
// - 학교 이름, 주소 표시
// - 클릭 시 해당 학교 선택

interface SchoolMarkerProps {
  schoolName: string;
  address: string;
  lat: number;
  lng: number;
  onClick?: () => void;
}

export default function SchoolMarker({
  schoolName,
  address,
  lat,
  lng,
  onClick,
}: SchoolMarkerProps) {
  // TODO: 실제 카카오맵 마커 + 오버레이 UI 구현
  return (
    <div
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-pointer"
      style={
        {
          // TODO: lat/lng를 화면 좌표로 변환 (카카오맵 SDK)
        }
      }
    >
      <div className="px-2.5 py-1 bg-white rounded-full shadow-md text-xs font-bold">
        🏫 {schoolName}
      </div>
      <div className="w-2 h-2 bg-red-500 rounded-full mt-0.5 shadow" />
    </div>
  );
}
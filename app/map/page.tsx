"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import Script from "next/script";

// TODO: [S2] 지도 페이지
// - NEIS API로 학교 목록 검색 (lib/neis.ts)
// - SchoolMarker 컴포넌트로 학교 위치 표시
// - BottomSheet로 선택한 학교 정보 표시

declare global {
  interface Window {
    kakao: any;
  }
}

interface School {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const MOCK_SCHOOLS: School[] = [
  { name: "서울고등학교", address: "서울특별시 강남구 ...", lat: 37.49, lng: 126.99 },
  { name: "경기고등학교", address: "서울특별시 강남구 ...", lat: 37.51, lng: 127.02 },
  { name: "서울대학교사범대학부설고등학교", address: "서울특별시 서초구 ...", lat: 37.48, lng: 127.00 },
  { name: "용산고등학교", address: "서울특별시 용산구 ...", lat: 37.53, lng: 126.97 },
];

export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);

  // 사용자 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // 위치 권한 거부 시 기본값(서울 시청) 유지
        }
      );
    }
  }, []);

  // 지도 초기화
  const initMap = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      const center = userLocation
        ? new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
        : new window.kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청

      const options = {
        center,
        level: 5,
      };

      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstanceRef.current = map;

      // 클러스터러 생성
      const clusterer = new window.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 3,
        gridSize: 60,
      });
      clustererRef.current = clusterer;

      // 학교 마커 생성
      const markers = MOCK_SCHOOLS.map((school) => {
        const position = new window.kakao.maps.LatLng(school.lat, school.lng);
        const marker = new window.kakao.maps.Marker({
          position,
          clickable: true,
        });

        window.kakao.maps.event.addListener(marker, "click", () => {
          setSelectedSchool(school);
        });

        return marker;
      });

      markersRef.current = markers;
      clusterer.addMarkers(markers);

      setMapLoaded(true);
    });
  }, [userLocation]);

  // SDK 로드 완료 시 지도 초기화
  const handleSDKLoad = useCallback(() => {
    initMap();
  }, [initMap]);

  // userLocation 변경 시 지도 재초기화 (처음 한 번)
  useEffect(() => {
    if (window.kakao?.maps && mapRef.current && !mapInstanceRef.current) {
      initMap();
    }
  }, [userLocation, initMap]);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    const moveLatLon = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
    mapInstanceRef.current.setCenter(moveLatLon);
  };

  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || "";

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      {/* 카카오맵 SDK 로드 */}
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false&libraries=services,clusterer`}
        strategy="beforeInteractive"
        onLoad={handleSDKLoad}
      />

      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col relative">
        {/* 상단 고정 검색바 */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4">
          <div className="flex items-center gap-2 h-[52px] px-4 bg-white rounded-xl border border-[#e5e8eb] shadow-[0_1px_3px_rgba(25,31,40,0.04)]">
            <span className="text-[#8b95a1] text-base">🔍</span>
            <input
              placeholder="학교 이름으로 찾기"
              className="flex-1 outline-none text-sm text-[#191f28] placeholder-[#8b95a1]"
              readOnly
            />
          </div>
        </div>

        {/* 지도 영역 */}
        <div ref={mapRef} className="flex-1 w-full relative">
          {!mapLoaded && (
            <div className="absolute inset-0 bg-[#f2f4f6] flex items-center justify-center z-0">
              <p className="text-[#8b95a1] text-sm">🗺️ 지도를 불러오는 중...</p>
            </div>
          )}

          {/* 현재 위치 버튼 */}
          {userLocation && mapLoaded && (
            <button
              onClick={moveToCurrentLocation}
              className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-[0_1px_3px_rgba(25,31,40,0.12)] flex items-center justify-center text-lg active:scale-90 transition-transform"
            >
              📍
            </button>
          )}
        </div>

        {/* 하단 바텀시트 */}
        <div className="bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(25,31,40,0.08)] px-6 pt-5 pb-8">
          <div className="w-10 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-4" />
          {selectedSchool ? (
            <>
              <p className="text-xs text-[#8b95a1]">선택한 학교</p>
              <h2 className="text-xl font-bold text-[#191f28] mt-1">{selectedSchool.name}</h2>
              <p className="text-sm text-[#6b7684] mt-0.5">{selectedSchool.address}</p>
              <button
                onClick={() => router.push("/select")}
                className="w-full h-[52px] rounded-[7px] bg-[#3182f6] text-white font-medium text-base mt-5 active:scale-[0.98] transition-transform duration-96"
              >
                이 학교로 시작하기
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[#6b7684]">학교를 선택해주세요</p>
              <p className="text-sm text-[#8b95a1] mt-1">지도에서 마커를 클릭하면 학교 정보가 표시됩니다</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
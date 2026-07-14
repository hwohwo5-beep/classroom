"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import type { SchoolResult } from "@/app/api/school/route";

// TODO: [S2] 지도 페이지
// - 카카오맵 + NEIS 학교 검색
// - Geocoder로 주소→좌표 변환
// - 선택한 학교 정보를 방 생성(/select)으로 전달

declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 서울시청
const DEFAULT_LEVEL = 5;
const LOAD_TIMEOUT_MS = 10000; // 10초 타임아웃

export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null);

  // 학교 검색 상태
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── 카카오맵 SDK 동적 로드 ───
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    if (!KAKAO_KEY) {
      setMapError(true);
      return;
    }

    const scriptId = "kakao-map-sdk";
    if (document.getElementById(scriptId)) {
      // 이미 로드된 경우
      scriptLoadedRef.current = true;
      loadKakaoMaps();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`;
    script.async = true;

    script.onload = () => {
      scriptLoadedRef.current = true;
      loadKakaoMaps();
    };

    script.onerror = () => {
      setMapError(true);
    };

    document.head.appendChild(script);

    // 타임아웃
    loadTimeoutRef.current = setTimeout(() => {
      if (!scriptLoadedRef.current) {
        setMapError(true);
      }
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadKakaoMaps = () => {
    if (!window.kakao?.maps) {
      // 아직 kakao 객체가 없으면 폴링
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(() => {
        attempts++;
        if (window.kakao?.maps) {
          clearInterval(interval);
          initMap();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setMapError(true);
        }
      }, 200);
      return;
    }

    window.kakao.maps.load(() => {
      initMap();
    });
  };

  // ─── 지도 초기화 ───
  const initMap = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const center = new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    const map = new window.kakao.maps.Map(mapRef.current, {
      center,
      level: DEFAULT_LEVEL,
    });
    mapInstanceRef.current = map;

    // Geocoder 생성 (services 라이브러리)
    geocoderRef.current = new window.kakao.maps.services.Geocoder();

    setMapReady(true);
  }, []);

  // ─── NEIS 학교 검색 (디바운스 400ms) ───
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length === 0) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/school?name=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data: SchoolResult[] = await res.json();
          setSearchResults(data);
          setShowDropdown(data.length > 0);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // ─── 학교 선택 → Geocoder로 좌표 변환 → 지도 이동 + 마커 ───
  const handleSelectSchool = useCallback(
    (school: SchoolResult) => {
      setSelectedSchool(school);
      setSearchInput(school.schoolName);
      setShowDropdown(false);
      setSearchResults([]);

      // Geocoder로 주소 → 좌표 변환
      if (geocoderRef.current && school.address) {
        geocoderRef.current.addressSearch(school.address, (result: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);

            // 지도 중심 이동
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(coords);
            }

            // 기존 마커 제거
            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            // 새 마커 표시
            const marker = new window.kakao.maps.Marker({
              position: coords,
              map: mapInstanceRef.current,
            });
            markerRef.current = marker;

            // 인포윈도우
            const infowindow = new window.kakao.maps.InfoWindow({
              content: `<div style="padding:6px 10px;font-size:13px;font-weight:600;color:#191f28;">${school.schoolName}</div>`,
              removable: true,
            });
            infowindow.open(mapInstanceRef.current, marker);
          }
          // 주소 변환 실패 시 마커 없이 정보만 하단 카드에 표시
        });
      }
    },
    []
  );

  // ─── 드롭다운 외부 클릭 닫기 ───
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  // ─── "이 학교로 방 만들기" → /select ───
  const handleCreateRoom = () => {
    if (!selectedSchool) return;
    // TODO: schoolName, schoolCode를 /select로 전달 (query params 또는 state)
    router.push(`/select?schoolName=${encodeURIComponent(selectedSchool.schoolName)}&schoolCode=${selectedSchool.schoolCode}`);
  };

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col relative">
        {/* 상단 검색바 */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4">
          <div className="relative">
            <div className="flex items-center gap-2 h-[52px] px-4 bg-white rounded-xl border border-[#e5e8eb] shadow-[0_2px_8px_rgba(25,31,40,0.08)]">
              <span className="text-[#8b95a1] text-base shrink-0">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="학교 이름으로 찾기"
                className="flex-1 outline-none text-sm text-[#191f28] placeholder-[#8b95a1] bg-transparent"
              />
              {searching && (
                <span className="text-[#8b95a1] text-xs shrink-0">검색 중...</span>
              )}
            </div>

            {/* 검색 결과 드롭다운 */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e8eb] rounded-xl shadow-lg z-30 max-h-[240px] overflow-y-auto"
              >
                {searchResults.length > 0 ? (
                  searchResults.map((school) => (
                    <button
                      key={school.schoolCode}
                      onClick={() => handleSelectSchool(school)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f2f4f6] active:bg-[#e8f3ff] transition-colors border-b border-[#f2f4f6] last:border-b-0"
                    >
                      <p className="text-sm font-semibold text-[#191f28]">{school.schoolName}</p>
                      <p className="text-xs text-[#6b7684] mt-0.5 truncate">{school.address}</p>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-[#8b95a1]">
                    검색 결과가 없어요
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 지도 영역 */}
        <div ref={mapRef} className="flex-1 w-full relative">
          {!mapReady && !mapError && (
            <div className="absolute inset-0 bg-[#f2f4f6] flex items-center justify-center z-0">
              <p className="text-[#8b95a1] text-sm">🗺️ 지도를 불러오는 중...</p>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 bg-[#f2f4f6] flex flex-col items-center justify-center z-0 gap-2">
              <span className="text-3xl">⚠️</span>
              <p className="text-[#6b7684] text-sm font-medium">지도를 불러올 수 없습니다</p>
              <p className="text-[#8b95a1] text-xs">잠시 후 다시 시도해주세요</p>
            </div>
          )}
        </div>

        {/* 하단 바텀시트 */}
        <div className="bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(25,31,40,0.08)] px-6 pt-5 pb-8">
          <div className="w-10 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-4" />
          {selectedSchool ? (
            <>
              <p className="text-xs text-[#8b95a1]">선택한 학교</p>
              <h2 className="text-xl font-bold text-[#191f28] mt-1">{selectedSchool.schoolName}</h2>
              <p className="text-sm text-[#6b7684] mt-0.5">{selectedSchool.address}</p>
              <button
                onClick={handleCreateRoom}
                className="w-full h-[52px] rounded-[7px] bg-[#3182f6] text-white font-medium text-base mt-5 active:scale-[0.98] transition-transform duration-96"
              >
                이 학교로 방 만들기
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[#6b7684]">학교를 선택해주세요</p>
              <p className="text-sm text-[#8b95a1] mt-1">
                🔍 검색창에 학교 이름을 입력하고 결과에서 선택하세요
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import type { SchoolResult } from "@/app/api/school/route";

// TODO: [S3] 학교/학년/반 선택 페이지
// - NEIS API로 학교 검색 (디바운스 500ms)
// - 지도에서 선택한 학교 정보를 URL 쿼리파라미터로 받아 자동 채움
// - Firestore에서 기존 Room 검색 또는 새 Room 생성
// - "우리 반 들어가기" → /room

function SelectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const grades = [1, 2, 3];
  const classes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // 연도 드롭다운: 현재연도(2026)부터 1980까지 역순
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 1980; y--) {
    years.push(y);
  }

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);

  // 학교 검색 상태
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // URL 쿼리파라미터로 전달된 학교 정보 자동 채움
  useEffect(() => {
    const schoolName = searchParams.get("schoolName");
    const schoolCode = searchParams.get("schoolCode");
    if (schoolName && schoolCode) {
      setSchoolNameInput(decodeURIComponent(schoolName));
      setSelectedSchool({
        schoolName: decodeURIComponent(schoolName),
        schoolCode,
        officeCode: "",
        address: "",
      });
    }
  }, [searchParams]);

  const canEnter =
    selectedSchool !== null &&
    selectedYear !== null &&
    selectedGrade !== null &&
    selectedClass !== null;

  // 디바운스 검색 (500ms)
  const handleSchoolInputChange = useCallback(
    (value: string) => {
      setSchoolNameInput(value);
      setSelectedSchool(null); // 새 검색 시 선택 해제

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

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
      }, 500);
    },
    []
  );

  // 학교 선택
  const handleSelectSchool = (school: SchoolResult) => {
    setSelectedSchool(school);
    setSchoolNameInput(school.schoolName);
    setShowDropdown(false);
    setSearchResults([]);
  };

  // 드롭다운 외부 클릭 시 닫기
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

  // cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col px-6 pt-6 pb-8">
        {/* 뒤로가기 */}
        <button onClick={() => router.back()} className="text-[#8b95a1] text-sm mb-3 self-start">
          ← 뒤로
        </button>

        {/* 학교 검색 */}
        <p className="text-xs text-[#8b95a1]">학교 찾기</p>
        <div className="relative mt-1">
          <input
            ref={inputRef}
            type="text"
            value={schoolNameInput}
            onChange={(e) => handleSchoolInputChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder="학교 이름을 입력하세요 (예: 서울고등학교)"
            className="w-full h-12 px-4 rounded-xl border border-[#e5e8eb] bg-[#f9fafb] text-[#191f28] text-base placeholder-[#8b95a1] outline-none focus:ring-2 focus:ring-[#3182f6] focus:border-transparent transition-all"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b95a1] text-sm">
              검색 중...
            </span>
          )}

          {/* 검색 결과 드롭다운 */}
          {showDropdown && searchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e8eb] rounded-xl shadow-lg z-20 max-h-[240px] overflow-y-auto"
            >
              {searchResults.map((school) => (
                <button
                  key={school.schoolCode}
                  onClick={() => handleSelectSchool(school)}
                  className="w-full text-left px-4 py-3 hover:bg-[#f2f4f6] active:bg-[#e8f3ff] transition-colors border-b border-[#f2f4f6] last:border-b-0"
                >
                  <p className="text-sm font-semibold text-[#191f28]">{school.schoolName}</p>
                  <p className="text-xs text-[#6b7684] mt-0.5 truncate">{school.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 학교 배지 */}
        {selectedSchool && (
          <span className="inline-block w-fit mt-2 px-3 py-1 rounded-full bg-[#e8f3ff] text-[#1b64da] text-xs font-medium">
            🕰️ 선택된 학교: {selectedSchool.schoolName}
          </span>
        )}

        {/* 입학 연도 (드롭다운) */}
        <div className="mt-8">
          <p className="text-sm font-semibold text-[#191f28] mb-3">입학 연도</p>
          <select
            value={selectedYear ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedYear(val ? Number(val) : null);
            }}
            className="w-full h-12 px-4 rounded-xl border border-[#e5e8eb] bg-[#f2f4f6] text-[#191f28] text-sm font-medium outline-none focus:ring-2 focus:ring-[#3182f6] focus:border-transparent transition-all appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 16px center",
              paddingRight: "40px",
            }}
          >
            <option value="" disabled>
              연도를 선택하세요
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>

        {/* 학년 */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-[#191f28] mb-3">학년</p>
          <div className="flex gap-2">
            {grades.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                  selectedGrade === g
                    ? "bg-[#3182f6] text-white"
                    : "bg-[#f2f4f6] text-[#333d4b]"
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>
        </div>

        {/* 반 */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-[#191f28] mb-3">반</p>
          <div className="grid grid-cols-5 gap-2">
            {classes.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedClass(c)}
                className={`h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                  selectedClass === c
                    ? "bg-[#3182f6] text-white"
                    : "bg-[#f2f4f6] text-[#333d4b]"
                }`}
              >
                {c}반
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <button
          onClick={() => canEnter && router.push("/room")}
          disabled={!canEnter}
          className={`w-full h-14 rounded-[7px] font-medium text-base mt-auto transition-all active:scale-[0.98] duration-96 ${
            canEnter
              ? "bg-[#3182f6] text-white"
              : "bg-[#f2f4f6] text-[#8b95a1] cursor-not-allowed"
          }`}
        >
          우리 반 들어가기
        </button>
      </div>
    </main>
  );
}

// useSearchParams는 Suspense 경계가 필요하므로 래핑
export default function SelectPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen bg-white flex items-center justify-center">
          <p className="text-[#8b95a1] text-sm">불러오는 중...</p>
        </div>
      </main>
    }>
      <SelectPageInner />
    </Suspense>
  );
}
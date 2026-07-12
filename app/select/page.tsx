"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// TODO: [S3] 학교/학년/반 선택 페이지
// - 지도에서 선택한 학교 정보를 props/state로 받아오기
// - Firestore에서 기존 Room 검색 또는 새 Room 생성
// - "우리 반 들어가기" → /room

export default function SelectPage() {
  const router = useRouter();

  const years = [2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012];
  const grades = [1, 2, 3];
  const classes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);

  const canEnter = selectedYear !== null && selectedGrade !== null && selectedClass !== null;

  return (
    <main className="min-h-screen bg-white flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col px-6 pt-6 pb-8">
        {/* 선택한 학교 정보 */}
        <p className="text-xs text-[#8b95a1]">선택한 학교</p>
        <h1 className="text-2xl font-bold text-[#191f28] mt-1">○○고등학교</h1>
        <span className="inline-block w-fit mt-2 px-3 py-1 rounded-full bg-[#e8f3ff] text-[#1b64da] text-xs font-medium">
          🕰️ 그땐 △△고였네요
        </span>

        {/* 입학 연도 */}
        <div className="mt-8">
          <p className="text-sm font-semibold text-[#191f28] mb-3">입학 연도</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`shrink-0 px-4 h-10 rounded-full text-sm font-medium transition-all active:scale-[0.98] ${
                  selectedYear === y
                    ? "bg-[#3182f6] text-white"
                    : "bg-[#f2f4f6] text-[#333d4b]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
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
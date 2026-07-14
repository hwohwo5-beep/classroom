import { NextRequest, NextResponse } from "next/server";

// TODO: NEIS 학교 검색 API 라우트
// - GET /api/school?name=검색어
// - NEIS_API_KEY는 서버 전용 (NEXT_PUBLIC 아님)

interface NeisRow {
  SCHUL_NM: string; // 학교명
  SD_SCHUL_CODE: string; // 학교코드
  ATPT_OFCDC_SC_CODE: string; // 시도교육청코드
  ORG_RDNMA: string; // 도로명주소
}

interface NeisResponse {
  schoolInfo?: [
    { head?: unknown },
    { row?: NeisRow[] }
  ];
  RESULT?: {
    CODE: string;
    MESSAGE: string;
  };
}

export interface SchoolResult {
  schoolName: string;
  schoolCode: string;
  officeCode: string;
  address: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name || name.trim().length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  const key = process.env.NEIS_API_KEY;
  if (!key) {
    console.error("NEIS_API_KEY is not set");
    return NextResponse.json(
      { error: "NEIS API 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${key}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(name.trim())}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error("NEIS API fetch failed:", res.status, res.statusText);
      return NextResponse.json([], { status: 502 });
    }

    const data: NeisResponse = await res.json();

    // 결과 없음: RESULT.CODE === "INFO-200"
    if (data.RESULT) {
      if (data.RESULT.CODE === "INFO-200") {
        return NextResponse.json([], { status: 200 });
      }
      // 기타 에러 코드
      console.error("NEIS API error:", data.RESULT.CODE, data.RESULT.MESSAGE);
      return NextResponse.json([], { status: 200 });
    }

    // 정상 응답: schoolInfo[1].row
    const rows = data.schoolInfo?.[1]?.row;
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json([], { status: 200 });
    }

    const results: SchoolResult[] = rows.map((row: NeisRow) => ({
      schoolName: row.SCHUL_NM || "",
      schoolCode: row.SD_SCHUL_CODE || "",
      officeCode: row.ATPT_OFCDC_SC_CODE || "",
      address: row.ORG_RDNMA || "",
    }));

    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    console.error("NEIS API unexpected error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
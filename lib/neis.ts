// TODO: NEIS(나이스) API 연동 - 학교 정보 조회
// https://open.neis.go.kr/portal/guide/openApiGuide.do

export async function searchSchools(query: string) {
  // TODO: NEIS API 호출하여 학교 목록 검색
  // const apiKey = process.env.NEIS_API_KEY;
  // const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${apiKey}&Type=json&SCHUL_NM=${encodeURIComponent(query)}`;
  throw new Error("NEIS API not implemented yet");
}

export async function getSchoolInfo(schoolId: string) {
  // TODO: NEIS API 호출하여 단일 학교 상세 정보 조회
  throw new Error("NEIS API not implemented yet");
}
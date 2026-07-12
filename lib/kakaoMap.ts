// TODO: 카카오맵 SDK 연동 - 지도 표시 및 마커
// https://apis.map.kakao.com/web/documentation/

export function loadKakaoMapScript(): Promise<void> {
  // TODO: 카카오맵 JavaScript SDK 동적 로드
  // const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
  // return new Promise((resolve, reject) => {
  //   if (window.kakao?.maps) { resolve(); return; }
  //   const script = document.createElement("script");
  //   script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
  //   script.onload = () => { kakao.maps.load(resolve); };
  //   script.onerror = reject;
  //   document.head.appendChild(script);
  // });
  throw new Error("KakaoMap SDK not implemented yet");
}

export function createMap(container: HTMLElement, lat: number, lng: number) {
  // TODO: 카카오맵 인스턴스 생성 및 반환
  throw new Error("KakaoMap not implemented yet");
}

export function addSchoolMarker(
  map: unknown,
  lat: number,
  lng: number,
  schoolName: string
) {
  // TODO: 학교 위치에 마커 추가
  throw new Error("KakaoMap marker not implemented yet");
}
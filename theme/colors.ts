// Toss Design System Palette
// CSS 변수는 globals.css에 정의, 여기는 JS/TS에서 쓸 상수

export const COLORS = {
  /** 메인 배경 */
  bg: "#ffffff",
  /** 대체 배경 */
  bgAlt: "#f9fafb",
  /** 표면 (입력창, 구분) */
  surface: "#f2f4f6",
  /** 표면 강조 (연블루) */
  surface2: "#e8f3ff",

  /** 기본 텍스트 */
  text: "#191f28",
  /** 보조 텍스트 */
  textSecondary: "#333d4b",
  /** 흐린 텍스트 */
  textMuted: "#6b7684",
  /** 더 흐린 텍스트 */
  textDim: "#8b95a1",

  /** 경계선 */
  border: "#e5e8eb",
  /** 강한 경계선 */
  borderStrong: "#d1d6db",

  /** 포인트 (Toss Blue) */
  accent: "#3182f6",
  /** 호버 */
  accentHover: "#1b64da",
  /** 딥블루 */
  accentDeep: "#1e40af",
  /** 연블루 배경 */
  accentSoft: "#e8f3ff",

  /** 성공 */
  success: "#00c896",
  /** 경고 */
  warning: "#ff9500",
  /** 위험 */
  danger: "#f04452",
  /** 정보 */
  info: "#3182f6",

  /** 카카오 브랜드 옐로우 */
  kakaoYellow: "#FEE500",
} as const;
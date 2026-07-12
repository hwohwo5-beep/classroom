// TODO: useAuthContext를 래핑한 커스텀 훅
// 추가적인 auth 관련 유틸리티 함수 제공

import { useAuthContext } from "@/context/AuthContext";

export function useAuth() {
  const auth = useAuthContext();
  // TODO: 필요 시 추가 로직 (예: 프로필 업데이트, 닉네임 변경 등)
  return auth;
}
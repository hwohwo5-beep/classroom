import { redirect } from "next/navigation";

// TODO: 로그인 상태 확인 후 /login 또는 /map 으로 분기
// - AuthContext 연동 후: 로그인 되어있으면 /map, 아니면 /login

export default function RootPage() {
  // 현재는 무조건 /login 으로 리다이렉트
  redirect("/login");
}
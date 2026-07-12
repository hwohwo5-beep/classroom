"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import type { Visibility } from "@/types";

// TODO: [S5] 콘텐츠 만들기 페이지
// - 템플릿 선택 ("그때 vs 지금" | "단체샷")
// - 사진 업로드 (그때 사진 + 지금 사진)
// - 미리보기 + 워터마크
// - 인스타 릴스 공유, 저장, 방에 올리기

const ROOM_ID = "default-room"; // TODO: 실제 roomId로 교체

export default function CreatePage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [thenFile, setThenFile] = useState<File | null>(null);
  const [nowFile, setNowFile] = useState<File | null>(null);
  const [thenPreview, setThenPreview] = useState<string | null>(null);
  const [nowPreview, setNowPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 공개 범위
  const [visibility, setVisibility] = useState<Visibility>("room");
  // 타인 동의 체크
  const [consentChecked, setConsentChecked] = useState(false);

  const thenInputRef = useRef<HTMLInputElement>(null);
  const nowInputRef = useRef<HTMLInputElement>(null);

  const hasPhotos = thenPreview !== null || nowPreview !== null;

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 허용 타입 검사
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.");
      return;
    }

    // 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      alert("10MB 이하의 사진만 업로드 가능합니다.");
      return;
    }

    setFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!user || !thenFile || !nowFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      const thenFileName = `then_${Date.now()}_${thenFile.name}`;
      const nowFileName = `now_${Date.now()}_${nowFile.name}`;

      const thenRef = ref(storage, `rooms/${ROOM_ID}/create/${thenFileName}`);
      const nowRef = ref(storage, `rooms/${ROOM_ID}/create/${nowFileName}`);

      await uploadBytes(thenRef, thenFile);
      await uploadBytes(nowRef, nowFile);

      const thenUrl = await getDownloadURL(thenRef);
      const nowUrl = await getDownloadURL(nowRef);

      // TODO: Firestore에 Content 저장 (templateType, visibility 포함)
      console.log("Uploaded:", { thenUrl, nowUrl, visibility });

      alert("업로드 완료! (Firestore 저장은 다음 단계)");
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError("사진을 올리지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  const canShareExternally = visibility === "public" && consentChecked;

  return (
    <main className="min-h-screen bg-white flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col px-6 pt-6 pb-8">
        {/* 헤더 */}
        <button onClick={() => router.back()} className="text-[#8b95a1] text-sm mb-3 self-start">
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold text-[#191f28]">그때 vs 지금 🕰️</h1>
        <p className="text-sm text-[#6b7684] mt-0.5">사진 두 장이면 릴스 완성!</p>

        {/* 템플릿 탭 */}
        <div className="flex gap-2 mt-5 mb-5">
          <button className="px-4 h-9 rounded-full bg-[#3182f6] text-white text-xs font-medium">
            그때 vs 지금
          </button>
          <button className="px-4 h-9 rounded-full bg-[#f2f4f6] text-[#333d4b] text-xs font-medium">
            단체샷
          </button>
        </div>

        {!hasPhotos ? (
          /* ── Empty State ── */
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-5xl mb-4">🕰️</span>
            <h2 className="text-lg font-bold text-[#191f28]">아직 우리 반 사진이 없어요.</h2>
            <p className="text-sm text-[#6b7684] mt-1 mb-8">첫 번째 과거 사진을 올려볼까요?</p>

            <button
              onClick={() => thenInputRef.current?.click()}
              className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base active:scale-[0.98] transition-transform duration-96"
            >
              사진 올리기
            </button>
            <button
              onClick={() => router.push("/room")}
              className="w-full h-12 rounded-[7px] text-[#6b7684] font-medium text-sm mt-2 active:scale-[0.98] transition-transform"
            >
              나중에 하기
            </button>

            <input
              ref={thenInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFileSelect(e, setThenFile, setThenPreview)}
              className="hidden"
            />
          </div>
        ) : (
          /* ── 편집 영역 ── */
          <>
            {/* 사진 슬롯 */}
            <div className="grid grid-cols-2 gap-3 h-[340px]">
              {/* 그때 슬롯 */}
              <label
                className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition-colors ${
                  thenPreview
                    ? "border-transparent bg-[#f2f4f6]"
                    : "border-[#e5e8eb] bg-[#f9fafb]"
                }`}
              >
                {thenPreview ? (
                  <img src={thenPreview} alt="그때 사진" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-3xl">📷</span>
                    <p className="text-xs text-[#6b7684] mt-2 font-medium">그때 사진</p>
                  </>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px]">
                  2015
                </span>
                <input
                  ref={thenInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileSelect(e, setThenFile, setThenPreview)}
                  className="hidden"
                />
              </label>

              {/* 지금 슬롯 */}
              <label
                className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition-colors ${
                  nowPreview
                    ? "border-transparent bg-[#f2f4f6]"
                    : "border-[#e5e8eb] bg-[#f9fafb]"
                }`}
              >
                {nowPreview ? (
                  <img src={nowPreview} alt="지금 사진" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-3xl">🤳</span>
                    <p className="text-xs text-[#6b7684] mt-2 font-medium">지금 사진</p>
                  </>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px]">
                  NOW
                </span>
                <input
                  ref={nowInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileSelect(e, setNowFile, setNowPreview)}
                  className="hidden"
                />
              </label>
            </div>

            {/* 워터마크 미리보기 */}
            <p className="text-center text-[11px] text-[#8b95a1] mt-3">
              🎓 클래스룸 · ○○고 3-5 · classroom.app
            </p>

            {/* ── 공개 범위 선택 ── */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-[#191f28] mb-3">공개 범위</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setVisibility("room");
                    setConsentChecked(false);
                  }}
                  className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                    visibility === "room"
                      ? "bg-[#3182f6] text-white"
                      : "bg-[#f2f4f6] text-[#333d4b]"
                  }`}
                >
                  우리 반에서만 보기
                </button>
                <button
                  onClick={() => setVisibility("public")}
                  className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                    visibility === "public"
                      ? "bg-[#3182f6] text-white"
                      : "bg-[#f2f4f6] text-[#333d4b]"
                  }`}
                >
                  외부 공유하기
                </button>
              </div>
            </div>

            {/* ── 타인 사진 공유 동의 (외부 공유 시에만) ── */}
            {visibility === "public" && (
              <div className="mt-4 px-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[#e5e8eb] text-[#3182f6] focus:ring-[#3182f6] accent-[#3182f6]"
                  />
                  <div>
                    <p className="text-sm text-[#191f28] font-medium">
                      사진 속 다른 사람의 공유 동의를 확인했어요.
                    </p>
                    <p className="text-xs text-[#8b95a1] mt-0.5">
                      다른 사람이 포함된 사진은 공유 전에 꼭 확인해주세요.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* 업로드 에러 */}
            {uploadError && (
              <p className="text-sm text-red-500 mt-3 text-center">{uploadError}</p>
            )}

            {/* ── 하단 액션 버튼 ── */}
            <div className="mt-auto pt-6 space-y-3">
              <button
                onClick={handleUpload}
                disabled={uploading || !thenFile || !nowFile}
                className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base disabled:opacity-40 active:scale-[0.98] transition-transform duration-96"
              >
                {uploading ? "업로드 중..." : "저장"}
              </button>

              <button
                onClick={() => alert("인스타그램으로 공유! 📲 (실제 연동은 다음 단계)")}
                disabled={!canShareExternally}
                className={`w-full h-14 rounded-[7px] font-medium text-base active:scale-[0.98] transition-transform duration-96 ${
                  canShareExternally
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white"
                    : "bg-[#f2f4f6] text-[#8b95a1] cursor-not-allowed"
                }`}
              >
                인스타그램으로 공유
              </button>

              {visibility === "public" && !consentChecked && (
                <p className="text-xs text-[#8b95a1] text-center">
                  공유하려면 사진 속 다른 사람의 동의를 확인해주세요.
                </p>
              )}

              <button
                onClick={() => router.push("/room")}
                className="w-full h-12 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] font-medium text-sm active:scale-[0.98] transition-transform"
              >
                방에 올리기
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
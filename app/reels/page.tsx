"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

// TODO:
// - 졸업연도 기반 D+N년 계산 (지금은 2007 → 19년 하드코딩)
// - Firestore 로 오늘 날짜 + 등교타임 촬영자 수 집계 (지금은 mock 6/10)
// - 점심/하교 타임슬롯 추가

const ROOM_ID = "default-room"; // TODO: 실제 roomId로 교체

export default function ReelsPage() {
  const router = useRouter();
  const { user, loading } = useAuthContext();

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // 로그인 가드
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // 카메라 시작
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
    } catch {
      setCameraError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      startCamera();
    }
    return () => {
      // 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [user, startCamera]);

  // 3초 녹화 시작
  const startRecording = () => {
    if (!streamRef.current) return;

    setRecordedBlob(null);
    setPreviewUrl(null);
    setUploaded(false);

    // iOS 사파리 코덱 분기
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setRecording(false);
        setCountdown(3);
      };

      recorder.start();
      setRecording(true);

      // 3초 카운트다운
      let count = 3;
      setCountdown(count);
      const interval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      // 3초 후 자동 stop
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 3000);
    } catch {
      setCameraError("녹화를 시작할 수 없습니다. 다른 브라우저를 시도해주세요.");
    }
  };

  // Firebase 업로드
  const handleUpload = async () => {
    if (!recordedBlob || !user) return;
    setUploading(true);

    try {
      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `${user.uid}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, `rooms/${ROOM_ID}/reels/${fileName}`);
      const snapshot = await uploadBytes(storageRef, recordedBlob);
      const videoUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "reels"), {
        videoUrl,
        uploaderName: user.nickname || "익명",
        timeSlot: "morning",
        createdAt: serverTimestamp(),
      });

      setUploaded(true);
      alert("업로드 완료!");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  // Web Share API
  const handleShare = async () => {
    if (!recordedBlob) return;

    const file = new File([recordedBlob], "vlog.mp4", { type: recordedBlob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "클래스룸 미니 브이로그",
          files: [file],
        });
        console.log("Share successful");
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // 데스크톱 폴백: 다운로드
      const a = document.createElement("a");
      a.href = previewUrl!;
      a.download = "vlog.mp4";
      a.click();
      alert("영상을 저장했어요. 인스타그램에 올려주세요!");
    }
  };

  // 로딩/로그인 가드
  if (loading || !user) {
    return (
      <main className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col">
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-[#6b7684] text-sm"
          >
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-[#191f28]">🎬 미니 브이로그</h1>
        </div>

        <div className="flex-1 flex flex-col items-center px-5 pb-6">
          {cameraError ? (
            /* 카메라 에러 */
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-4xl mb-3">📷</span>
              <p className="text-sm text-[#6b7684] text-center">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-4 h-11 px-6 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
              >
                다시 시도
              </button>
            </div>
          ) : previewUrl ? (
            /* ── 9:16 세로 카드 미리보기 ── */
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg">
                {/* 영상 풀블리드 */}
                <video
                  ref={previewRef}
                  src={previewUrl}
                  controls
                  loop
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* 상단 그라데이션 오버레이 */}
                <div className="absolute top-0 left-0 right-0 h-[20%] bg-gradient-to-b from-black/50 to-transparent" />

                {/* 하단 그라데이션 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-black/60 to-transparent" />

                {/* 헤더존 (상단, 60px 아래) */}
                <div className="absolute top-[60px] left-0 right-0 px-5">
                  <p className="text-[15px] font-medium text-white/85">
                    2007 서울고 3-10
                  </p>
                  <p className="text-[34px] font-extrabold text-white leading-tight mt-1">
                    19년 후 🕐
                  </p>
                </div>

                {/* 출첵존 (하단, 90px 위) */}
                <div className="absolute bottom-[90px] left-0 right-0 px-5">
                  <p className="text-[15px] font-semibold text-white">
                    🌅 1분단 · 오늘 등교 6/10명
                  </p>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="w-full mt-5 space-y-3">
                <button
                  onClick={handleUpload}
                  disabled={uploading || uploaded}
                  className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base disabled:opacity-40 active:scale-[0.98] transition-transform duration-96"
                >
                  {uploading ? "업로드 중..." : uploaded ? "✅ 업로드 완료" : "저장"}
                </button>

                <button
                  onClick={handleShare}
                  disabled={uploading}
                  className="w-full h-14 rounded-[7px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-medium text-base disabled:opacity-40 active:scale-[0.98] transition-transform duration-96"
                >
                  📲 인스타그램으로 공유
                </button>

                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setRecordedBlob(null);
                    startCamera();
                  }}
                  className="w-full h-12 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] font-medium text-sm active:scale-[0.98] transition-transform"
                >
                  다시 촬영하기
                </button>
              </div>
            </div>
          ) : (
            /* ── 촬영 화면 ── */
            <div className="flex-1 flex flex-col items-center w-full">
              {/* 카메라 뷰파인더 */}
              <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-2xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />

                {/* 녹화 중 오버레이 */}
                {recording && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* 링 애니메이션 */}
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50" cy="50" r="45"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="6"
                        />
                        <circle
                          cx="50" cy="50" r="45"
                          fill="none"
                          stroke="#f04452"
                          strokeWidth="6"
                          strokeDasharray={`${(countdown / 3) * 283} 283`}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white">
                        {countdown}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 촬영 버튼 */}
              <button
                onClick={startRecording}
                disabled={recording}
                className="mt-6 w-16 h-16 rounded-full bg-[#f04452] flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform shadow-lg"
              >
                <div className="w-12 h-12 rounded-full border-4 border-white" />
              </button>
              <p className="text-xs text-[#8b95a1] mt-3">
                {recording ? `${countdown}초 남음` : "버튼을 누르면 3초 녹화"}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
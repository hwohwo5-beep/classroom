"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import Header from "@/app/components/Header";

// TODO: [S2] 릴스 페이지 → "3초 출석" 그리드
// - 3초 영상 녹화 (MediaRecorder API)
// - Firebase Storage 업로드 (rooms/{roomId}/reels/{uid}_{timestamp}.webm)
// - Firestore 메타데이터 저장 (rooms/{roomId}/reels 컬렉션)
// - onSnapshot으로 저장된 영상 불러와 그리드 재생
// - 같은 uid면 덮어쓰기(재촬영)

interface ReelDoc {
  id: string;
  uid: string;
  timeSlot: string;
  videoUrl: string;
  memberId: string;
  memberName?: string;
  createdAt: Timestamp | null;
}

function ReelsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") || "default-room";
  const { user, loading: authLoading } = useAuthContext();

  const [mounted, setMounted] = useState(false);

  // 녹화 상태
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Firestore에서 불러온 출석 영상
  const [reelDocs, setReelDocs] = useState<ReelDoc[]>([]);

  // 로그인 안 됐으면 /login 으로 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Firestore 실시간 구독: 현재 roomId의 모든 출석 영상
  useEffect(() => {
    if (!mounted) return;

    const reelsRef = collection(db, "rooms", roomId, "reels");
    const q = query(reelsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: ReelDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docs.push({
          id: docSnap.id,
          uid: data.uid ?? "",
          timeSlot: data.timeSlot ?? "",
          videoUrl: data.videoUrl ?? "",
          memberId: data.memberId ?? "",
          memberName: data.memberName ?? "",
          createdAt: data.createdAt ?? null,
        });
      });
      setReelDocs(docs);
    });
    return unsubscribe;
  }, [mounted, roomId]);

  // cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
    };
  }, [recordedBlobUrl]);

  // ── 카메라 ──
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      setCameraStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "카메라 접근이 거부되었습니다.";
      setCameraError(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, [cameraStream]);

  // ── 녹화 ──
  const startRecording = useCallback(() => {
    if (!cameraStream) return;
    setRecordedBlob(null);
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl);
      setRecordedBlobUrl(null);
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(cameraStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm",
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedBlobUrl(url);
    };

    recorder.start();
    setRecording(true);
    setCountdown(3);

    // 3초 카운트다운
    let remaining = 3;
    countdownRef.current = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
        setRecording(false);
      }
    }, 1000);
  }, [cameraStream, recordedBlobUrl]);

  // ── Firebase Storage 업로드 + Firestore 저장 ──
  const saveRecording = useCallback(async () => {
    if (!recordedBlob || !user) return;

    setUploading(true);
    try {
      const memberName = user.nickname || "익명";

      // Storage 경로: rooms/{roomId}/reels/{uid}_{timestamp}.webm
      const fileName = `${user.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, `rooms/${roomId}/reels/${fileName}`);
      const snapshot = await uploadBytes(storageRef, recordedBlob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Firestore: rooms/{roomId}/reels 컬렉션
      // 같은 uid면 덮어쓰기 (setDoc with doc id = uid)
      const docRef = doc(db, "rooms", roomId, "reels", user.uid);
      await setDoc(docRef, {
        uid: user.uid,
        timeSlot: "출석",
        videoUrl: downloadUrl,
        memberId: user.uid,
        memberName,
        createdAt: serverTimestamp(),
      });

      // 녹화 모달 닫기
      setRecordedBlob(null);
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlobUrl(null);
      }
      setShowRecordModal(false);
      stopCamera();
    } catch (err) {
      console.error("Reels upload failed:", err);
      alert("영상 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }, [recordedBlob, user, recordedBlobUrl, stopCamera, roomId]);

  // ── 녹화 모달 닫기 ──
  const closeRecordModal = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRecording(false);
    setRecordedBlob(null);
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl);
      setRecordedBlobUrl(null);
    }
    setShowRecordModal(false);
    stopCamera();
  }, [recordedBlobUrl, stopCamera]);

  // ── "나도 3초 출석" 클릭 → 녹화 모달 열기 ──
  const handleAttendClick = useCallback(() => {
    setShowRecordModal(true);
    startCamera();
  }, [startCamera]);

  // ── 친구 한 명 불러오기 ──
  const handleInviteFriend = useCallback(() => {
    const inviteUrl = `${window.location.origin}/room?roomId=${roomId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        alert("초대 링크가 복사되었습니다!");
      }).catch(() => {
        alert("준비 중");
      });
    } else {
      alert("준비 중");
    }
  }, [roomId]);

  // ── 출석 인원 계산 ──
  const attendCount = reelDocs.length;

  // ── 상단 카피 ──
  const getHeaderCopy = () => {
    if (attendCount < 3) return "우리 반이 다시 모이기 시작했습니다";
    if (attendCount <= 4) return "우리 반이 다시 모이기 시작했습니다";
    if (attendCount <= 9) return `졸업 후, ${attendCount}명의 현재`;
    return `우리 반 3초 출석부 완성 · ${attendCount}명 출석 중`;
  };

  // ── 그리드 열 수 ──
  const getGridCols = () => {
    if (attendCount <= 4) return "grid-cols-2";
    if (attendCount <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  // 로딩 중이거나 로그인 안 됐으면 빈 화면
  if (!mounted || authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col relative" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col relative">
        {/* 공통 헤더 (sticky top-0 z-50, 뒤로가기 + 로고 + 프로필 메뉴 포함) */}
        <Header />

        {/* ── 상단 카피 ── */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-lg font-bold text-[#191f28]">{getHeaderCopy()}</h2>
        </div>

        {/* ── 출석 그리드 ── */}
        <div className="flex-1 px-5 pb-4 overflow-y-auto">
          {attendCount === 0 ? (
            /* ── empty 상태: 안내 + 큼직한 촬영 버튼 ── */
            <div className="flex flex-col items-center justify-center h-64 text-[#8b95a1]">
              <span className="text-4xl mb-3">🎬</span>
              <p className="text-sm">아직 출석한 친구가 없어요.</p>
              <p className="text-xs mt-1 mb-6">첫 출석을 남겨보세요!</p>
              <button
                onClick={handleAttendClick}
                className="h-[52px] px-8 rounded-[7px] bg-[#f04452] text-white font-medium text-base flex items-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-[#f04452]/20"
              >
                <span className="text-lg">📸</span>
                나도 3초 출석하기
              </button>
            </div>
          ) : (
            /* ── 출석자 1명 이상: 그리드 + 끝에 ➕ 유도 칸 ── */
            <div className={`grid ${getGridCols()} gap-2`}>
              {reelDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-[#f2f4f6]"
                >
                  {doc.videoUrl ? (
                    <video
                      src={doc.videoUrl}
                      muted
                      playsInline
                      loop
                      className="absolute inset-0 w-full h-full object-cover"
                      onMouseEnter={(e) => {
                        const v = e.target as HTMLVideoElement;
                        const playPromise = v.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(() => {
                            // Ignore errors (e.g., AbortError when interrupted by pause)
                          });
                        }
                      }}
                      onMouseLeave={(e) => {
                        const v = e.target as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#8b95a1]">
                      <span className="text-2xl">🎬</span>
                    </div>
                  )}
                  {/* 이름 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <p className="text-[10px] font-medium text-white/90 truncate">
                      {doc.memberName ?? "익명"}
                    </p>
                  </div>
                </div>
              ))}
              {/* ➕ 나도 3초 출석 유도 칸 */}
              <button
                onClick={handleAttendClick}
                className="relative aspect-square rounded-xl border-2 border-dashed border-[#f04452] bg-[#fff5f5] flex flex-col items-center justify-center gap-1 active:scale-[0.95] transition-transform hover:bg-[#fff0f0]"
              >
                <span className="text-2xl text-[#f04452]">➕</span>
                <span className="text-[11px] font-medium text-[#f04452]">나도 3초 출석</span>
              </button>
            </div>
          )}
        </div>

        {/* ── 하단 버튼: 친구 한 명 불러오기 ── */}
        <div className="px-5 pb-8 pt-2">
          <button
            onClick={handleInviteFriend}
            className="w-full h-[52px] rounded-[7px] bg-gradient-to-r from-[#f04452] to-[#ff6b7a] text-white font-medium text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-96 shadow-lg shadow-[#f04452]/20"
          >
            👥 친구 한 명 불러오기
          </button>
        </div>

        {/* ── 촬영 모달 ── */}
        {showRecordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
            <div className="relative w-full max-w-[360px] bg-[#191f28] rounded-2xl overflow-hidden shadow-2xl">
              {/* 카메라 프리뷰 */}
              <div className="relative aspect-[9/16] bg-black">
                {cameraStream ? (
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl mb-3">📷</span>
                    <p className="text-sm text-white/70 text-center px-4">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="mt-4 h-11 px-6 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white/50 text-sm">카메라 준비 중...</p>
                  </div>
                )}

                {/* 녹화 중 카운트다운 오버레이 */}
                {recording && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="relative">
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

              {/* 컨트롤 */}
              <div className="p-4 space-y-3">
                {recordedBlobUrl ? (
                  <>
                    {/* 녹화 완료: 미리보기 + 저장 */}
                    <video
                      src={recordedBlobUrl}
                      controls
                      muted
                      playsInline
                      className="w-full rounded-xl"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveRecording}
                        disabled={uploading}
                        className="flex-1 h-11 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        {uploading ? "업로드 중..." : "저장"}
                      </button>
                      <button
                        onClick={() => {
                          if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
                          setRecordedBlobUrl(null);
                          setRecordedBlob(null);
                          startRecording();
                        }}
                        disabled={uploading}
                        className="flex-1 h-11 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        다시 찍기
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {!recording ? (
                      <button
                        onClick={startRecording}
                        disabled={!cameraStream}
                        className="w-full h-12 rounded-[7px] bg-[#f04452] text-white font-medium text-base disabled:opacity-40 active:scale-[0.98] transition-transform"
                      >
                        녹화 시작 (3초)
                      </button>
                    ) : (
                      <p className="text-center text-white/70 text-sm">
                        녹화 중... {countdown}초 남음
                      </p>
                    )}
                  </>
                )}

                <button
                  onClick={closeRecordModal}
                  disabled={uploading}
                  className="w-full h-11 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReelsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen bg-white flex flex-col relative" />
      </main>
    }>
      <ReelsPageInner />
    </Suspense>
  );
}
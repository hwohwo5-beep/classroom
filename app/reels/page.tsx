"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  addDoc,
  query,
  where,
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

// TODO: [S2] 릴스 페이지
// - 3초 영상 녹화 (MediaRecorder API)
// - Firebase Storage 업로드 (rooms/{roomId}/reels/{timeSlot}/{uid}_{timestamp}.webm)
// - Firestore 메타데이터 저장 (rooms/{roomId}/reels 컬렉션)
// - onSnapshot으로 저장된 영상 불러와 그리드 재생
// - 같은 uid+timeSlot이면 덮어쓰기(재촬영)

interface Member {
  uid: string;
  name: string;
  emoji: string;
  online: boolean;
}

interface ReelDoc {
  id: string;
  uid: string;
  timeSlot: string;
  videoUrl: string;
  memberId: string;
  createdAt: Timestamp | null;
}

const ROOM_ID = "default-room"; // TODO: 실제 roomId로 교체

const TIME_SLOTS = ["등교", "점심", "하교"] as const;
type TimeSlot = (typeof TIME_SLOTS)[number];

const MEMBERS: Member[] = [
  { uid: "user1", name: "김민준", emoji: "😎", online: true },
  { uid: "user2", name: "이서연", emoji: "🥰", online: true },
  { uid: "user3", name: "박도윤", emoji: "🤓", online: false },
  { uid: "user4", name: "최지우", emoji: "😴", online: true },
  { uid: "user5", name: "정하은", emoji: "🙃", online: true },
  { uid: "user6", name: "강시우", emoji: "🤩", online: false },
  { uid: "user7", name: "윤아름", emoji: "🥳", online: true },
  { uid: "user8", name: "임태양", emoji: "🤗", online: true },
  { uid: "user9", name: "한지민", emoji: "😇", online: false },
  { uid: "user10", name: "오세훈", emoji: "🤔", online: true },
  { uid: "user11", name: "신세경", emoji: "😌", online: true },
  { uid: "user12", name: "유재석", emoji: "😜", online: false },
  { uid: "user13", name: "이광수", emoji: "🤪", online: true },
  { uid: "user14", name: "전소민", emoji: "😈", online: true },
  { uid: "user15", name: "송지효", emoji: "👻", online: false },
  { uid: "user16", name: "김종국", emoji: "🎃", online: true },
  { uid: "user17", name: "하하", emoji: "🤡", online: true },
  { uid: "user18", name: "양세찬", emoji: "👽", online: false },
  { uid: "user19", name: "조세호", emoji: "🤖", online: true },
  { uid: "user20", name: "안은진", emoji: "🎅", online: true },
  { uid: "user21", name: "박보검", emoji: "🐶", online: false },
  { uid: "user22", name: "아이유", emoji: "🐱", online: true },
  { uid: "user23", name: "차은우", emoji: "🐭", online: true },
  { uid: "user24", name: "수지", emoji: "🐹", online: false },
  { uid: "user25", name: "남주혁", emoji: "🐰", online: true },
  { uid: "user26", name: "김태리", emoji: "🦊", online: true },
  { uid: "user27", name: "변우석", emoji: "🐻", online: false },
  { uid: "user28", name: "고윤정", emoji: "🐼", online: true },
  { uid: "user29", name: "이도현", emoji: "🐨", online: true },
  { uid: "user30", name: "로운", emoji: "🐯", online: false },
  { uid: "user31", name: "김혜윤", emoji: "🦁", online: true },
  { uid: "user32", name: "최현욱", emoji: "🐮", online: true },
  { uid: "user33", name: "설인아", emoji: "🦄", online: false },
  { uid: "user34", name: "김영광", emoji: "🐧", online: true },
  { uid: "user35", name: "정채연", emoji: "🐸", online: true },
  { uid: "user36", name: "이준기", emoji: "🐙", online: false },
  { uid: "user37", name: "문채원", emoji: "🦋", online: true },
  { uid: "user38", name: "서강준", emoji: "🐝", online: true },
  { uid: "user39", name: "김세정", emoji: "🐞", online: false },
  { uid: "user40", name: "박형식", emoji: "🦉", online: true },
];

export default function ReelsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();

  const [mounted, setMounted] = useState(false);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("등교");
  const [mode, setMode] = useState<"play" | "record">("play");

  // 녹화 상태
  const [recordingMemberId, setRecordingMemberId] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Firestore에서 불러온 릴스 영상
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

  // Firestore 실시간 구독: 현재 roomId + timeSlot의 릴스 영상
  useEffect(() => {
    if (!mounted) return;

    const reelsRef = collection(db, "rooms", ROOM_ID, "reels");
    const q = query(
      reelsRef,
      where("timeSlot", "==", timeSlot),
      orderBy("createdAt", "desc")
    );
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
          createdAt: data.createdAt ?? null,
        });
      });
      setReelDocs(docs);
    });
    return unsubscribe;
  }, [mounted, timeSlot]);

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
    if (!recordedBlob || !user || !recordingMemberId) return;

    setUploading(true);
    try {
      const member = MEMBERS.find((m) => m.uid === recordingMemberId);
      const memberName = member?.name ?? "익명";

      // Storage 경로: rooms/{roomId}/reels/{timeSlot}/{uid}_{timestamp}.webm
      const fileName = `${user.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, `rooms/${ROOM_ID}/reels/${timeSlot}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, recordedBlob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Firestore: rooms/{roomId}/reels 컬렉션
      // 같은 uid+timeSlot이면 덮어쓰기 (setDoc with doc id = uid_timeSlot)
      const docId = `${user.uid}_${timeSlot}`;
      const docRef = doc(db, "rooms", ROOM_ID, "reels", docId);
      await setDoc(docRef, {
        uid: user.uid,
        timeSlot,
        videoUrl: downloadUrl,
        memberId: recordingMemberId,
        memberName,
        createdAt: serverTimestamp(),
      });

      // 녹화 모달 닫기
      setRecordedBlob(null);
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlobUrl(null);
      }
      setRecordingMemberId(null);
      stopCamera();
    } catch (err) {
      console.error("Reels upload failed:", err);
      alert("영상 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }, [recordedBlob, user, recordingMemberId, timeSlot, recordedBlobUrl, stopCamera]);

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
    setRecordingMemberId(null);
    stopCamera();
  }, [recordedBlobUrl, stopCamera]);

  // ── 멤버 클릭 → 녹화 모달 열기 ──
  const handleMemberClick = useCallback(
    (member: Member) => {
      if (!member.online) return;
      setRecordingMemberId(member.uid);
      startCamera();
    },
    [startCamera]
  );

  // ── 그리드용: 멤버별 영상 매핑 ──
  const memberVideoMap = new Map<string, string>();
  reelDocs.forEach((doc) => {
    if (doc.memberId && doc.videoUrl) {
      // 같은 memberId가 여러 개면 가장 최근 것만 사용 (orderBy desc이므로 첫 매칭)
      if (!memberVideoMap.has(doc.memberId)) {
        memberVideoMap.set(doc.memberId, doc.videoUrl);
      }
    }
  });

  const recordedCount = reelDocs.length;

  // 학교 정보 (TODO: 실제 데이터 연동)
  const schoolInfo = "○○고등학교 · 2015년 입학";
  const yearsAfter = new Date().getFullYear() - 2015;

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
        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 text-[#6b7684] text-sm"
        >
          ← 뒤로
        </button>

        {/* ── 타임슬롯 탭 ── */}
        <div className="px-5 pt-12 pb-3 flex gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => setTimeSlot(slot)}
              className={`flex-1 h-10 rounded-[7px] text-sm font-medium transition-all active:scale-[0.98] ${
                timeSlot === slot
                  ? "bg-[#191f28] text-white"
                  : "bg-[#f2f4f6] text-[#6b7684]"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>

        {/* ── 모드 전환 ── */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => setMode("play")}
            className={`flex-1 h-9 rounded-[7px] text-sm font-medium transition-all active:scale-[0.98] ${
              mode === "play"
                ? "bg-[#3182f6] text-white"
                : "bg-[#f2f4f6] text-[#6b7684]"
            }`}
          >
            📺 보기
          </button>
          <button
            onClick={() => setMode("record")}
            className={`flex-1 h-9 rounded-[7px] text-sm font-medium transition-all active:scale-[0.98] ${
              mode === "record"
                ? "bg-[#3182f6] text-white"
                : "bg-[#f2f4f6] text-[#6b7684]"
            }`}
          >
            🎥 찍기
          </button>
        </div>

        {/* ── 콘텐츠 영역 ── */}
        {mode === "play" ? (
          /* ── PLAY 모드: 저장된 영상 그리드 ── */
          <div className="flex-1 px-5 pb-8">
            {reelDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-[#8b95a1]">
                <span className="text-4xl mb-3">🎬</span>
                <p className="text-sm">아직 올라온 영상이 없어요.</p>
                <p className="text-xs mt-1">&#34;찍기&#34; 모드에서 첫 릴스를 남겨보세요!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {MEMBERS.map((member) => {
                  const videoUrl = memberVideoMap.get(member.uid);
                  return (
                    <div
                      key={member.uid}
                      className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#f2f4f6]"
                    >
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          muted
                          playsInline
                          loop
                          className="absolute inset-0 w-full h-full object-cover"
                          onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={(e) => {
                            const v = e.target as HTMLVideoElement;
                            v.pause();
                            v.currentTime = 0;
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#8b95a1]">
                          <span className="text-2xl">{member.emoji}</span>
                          <span className="text-[10px] mt-1">{member.name}</span>
                        </div>
                      )}
                      {/* 멤버 이름 오버레이 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-[10px] font-medium text-white/90 truncate">
                          {member.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── RECORD 모드: 멤버 선택 → 녹화 ── */
          <div className="flex-1 px-5 pb-8">
            <p className="text-xs text-[#8b95a1] mb-3">
              친구를 선택하고 3초 릴스를 찍어보세요! 📸
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MEMBERS.map((member) => {
                const hasVideo = memberVideoMap.has(member.uid);
                return (
                  <button
                    key={member.uid}
                    onClick={() => handleMemberClick(member)}
                    disabled={!member.online}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all active:scale-[0.95] ${
                      member.online
                        ? "bg-[#f2f4f6] hover:bg-[#e8f3ff]"
                        : "bg-[#f9fafb] opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-2xl">{member.emoji}</span>
                    <span className="text-[11px] font-medium text-[#191f28] mt-1">
                      {member.name}
                    </span>
                    {!member.online && (
                      <span className="text-[9px] text-[#8b95a1]">오프라인</span>
                    )}
                    {hasVideo && (
                      <span className="absolute top-1 right-1 text-[10px]">✅</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 촬영 모달 ── */}
        {recordingMemberId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
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
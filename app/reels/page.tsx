"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

// TODO:
// - 졸업연도 기반 D+N년 계산 (지금은 2007 → 19년 하드코딩)
// - Firestore 로 오늘 날짜 + 등교타임 촬영자 수 집계
// - 녹화본 Storage 업로드

// ── Mock 상수 ──
const schoolInfo = "2007년 ○○고등학교 3학년 10반";
const yearsAfter = 19;

const members = [
  { id: 1, name: "김민준" },
  { id: 2, name: "이서연" },
  { id: 3, name: "박도윤" },
  { id: 4, name: "최지우" },
  { id: 5, name: "정하은" },
  { id: 6, name: "강시우" },
  { id: 7, name: "윤아름" },
  { id: 8, name: "임태양" },
  { id: 9, name: "한지민" },
  { id: 10, name: "오세훈" },
];

type TimeSlot = "등교" | "점심" | "하교";
type Mode = "record" | "play";

const slidesBg: Record<TimeSlot, string> = {
  등교: "linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)",
  점심: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  하교: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
};

const slidesLabel: Record<TimeSlot, string> = {
  등교: "🌅 등교",
  점심: "🍱 점심",
  하교: "🌆 하교",
};

export default function ReelsPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("record");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("등교");

  // recordings[slot][memberId] = blob URL string
  const [recordings, setRecordings] = useState<Record<TimeSlot, Record<number, string>>>({
    등교: {},
    점심: {},
    하교: {},
  });

  // 촬영 모달
  const [recordingMemberId, setRecordingMemberId] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 촬영된 멤버 목록 (현재 timeSlot 기준)
  const recordedMemberIds = Object.keys(recordings[timeSlot]).map(Number);
  const recordedCount = recordedMemberIds.length;

  // ── 카메라 시작 ──
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setRecordedBlobUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setCameraStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
    }
  }, []);

  // ── 촬영 모달 열기 ──
  const openRecordModal = (memberId: number) => {
    setRecordingMemberId(memberId);
    startCamera();
  };

  // ── 촬영 모달 닫기 (스트림 정리) ──
  const closeRecordModal = () => {
    // 스트림 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // 타이머 정리
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCameraStream(null);
    setCameraError(null);
    setRecording(false);
    setCountdown(3);
    setRecordedBlobUrl(null);
    setRecordingMemberId(null);
  };

  // ── 녹화 시작 ──
  const startRecording = () => {
    if (!streamRef.current) return;

    setRecordedBlobUrl(null);
    setRecording(true);
    setCountdown(3);

    // 코덱 지원 자동 감지
    const types = [
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";

    if (!mimeType) {
      alert("이 브라우저는 녹화를 지원하지 않아요");
      closeRecordModal();
      return;
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
        setRecording(false);
        setCountdown(3);
      };

      recorder.start();

      // 3초 카운트다운
      let count = 3;
      countdownIntervalRef.current = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }
      }, 1000);

      // 3초 후 자동 stop
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 3000);
    } catch {
      alert("녹화를 시작할 수 없습니다. 다른 브라우저를 시도해주세요.");
      setRecording(false);
      setCountdown(3);
    }
  };

  // ── 녹화본 저장 ──
  const saveRecording = () => {
    if (!recordedBlobUrl || recordingMemberId === null) return;

    setRecordings((prev) => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        [recordingMemberId]: recordedBlobUrl,
      },
    }));

    // 스트림 정리 후 모달 닫기
    closeRecordModal();
  };

  // ── 다시 찍기 (기존 녹화본 삭제) ──
  const retakeRecording = (memberId: number) => {
    setRecordings((prev) => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        [memberId]: undefined as unknown as string,
      },
    }));
    // 모달 열기
    openRecordModal(memberId);
  };

  // ── cleanup: 컴포넌트 언마운트 시 스트림/타이머 정리 ──
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // 업데이트 → play 모드
  const handleUpdate = () => {
    setMode("play");
  };

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col">
        {/* ── 공통 헤더 ── */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-[#e5e8eb]">
          <button
            onClick={() => {
              if (mode === "play") {
                setMode("record");
              } else {
                router.push("/room");
              }
            }}
            className="text-[#6b7684] text-sm"
          >
            ← {mode === "play" ? "촬영으로" : "뒤로"}
          </button>
          <h1 className="text-lg font-bold text-[#191f28]">
            {mode === "record" ? "1분단 촬영" : "룸로그 릴스"}
          </h1>
        </div>

        {mode === "record" ? (
          /* ── record 모드 ── */
          <div className="flex-1 flex flex-col px-5 pt-4 pb-6">
            {/* 타임슬롯 탭 */}
            <div className="flex gap-2 mb-5">
              {(["등교", "점심", "하교"] as TimeSlot[]).map((slot) => (
                <button
                  key={slot}
                  onClick={() => setTimeSlot(slot)}
                  className={`flex-1 h-10 rounded-[7px] text-sm font-medium transition-all active:scale-[0.98] ${
                    timeSlot === slot
                      ? "bg-[#3182f6] text-white"
                      : "bg-[#f2f4f6] text-[#333d4b]"
                  }`}
                >
                  {slidesLabel[slot]}
                </button>
              ))}
            </div>

            {/* 10칸 그리드 (2열 x 5행) */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              {members.map((m) => {
                const blobUrl = recordings[timeSlot][m.id];
                const recorded = !!blobUrl;
                return (
                  <div
                    key={m.id}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative overflow-hidden ${
                      recorded
                        ? "bg-[#e8f3ff] border border-[#3182f6]"
                        : "bg-[#f2f4f6] border border-dashed border-[#e5e8eb]"
                    }`}
                  >
                    {recorded ? (
                      <>
                        {/* 녹화본 미리보기 */}
                        <video
                          src={blobUrl}
                          muted
                          loop
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover opacity-60"
                        />
                        <span className="absolute top-2 right-2 text-lg z-10">✅</span>
                        <p className="relative z-10 text-sm font-semibold text-[#191f28] mt-1">
                          {m.name}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retakeRecording(m.id);
                          }}
                          className="relative z-10 mt-1 h-7 px-3 rounded-[7px] bg-[#3182f6] text-white text-[11px] font-medium active:scale-[0.98] transition-transform"
                        >
                          다시 찍기
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openRecordModal(m.id)}
                        className="w-full h-full flex flex-col items-center justify-center active:scale-[0.97] transition-transform"
                      >
                        <span className="text-4xl text-[#8b95a1]">+</span>
                        <p className="text-sm font-medium text-[#6b7684] mt-2">
                          {m.name}
                        </p>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 하단 업데이트 버튼 */}
            <div className="mt-5">
              <button
                onClick={handleUpdate}
                className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base active:scale-[0.98] transition-transform duration-96"
              >
                업데이트
              </button>
            </div>
          </div>
        ) : (
          /* ── play 모드 (풀스크린) ── */
          <div className="fixed inset-0 w-[100vw] h-[100dvh] bg-black overflow-hidden z-40">
            {/* 뒤로가기 버튼 (z-[4], 헤더보다 위) */}
            <button
              onClick={() => setMode("record")}
              className="absolute top-4 left-4 z-[4] h-9 px-4 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium active:scale-[0.96] transition-transform"
            >
              ← 촬영으로
            </button>

            {recordedCount === 0 ? (
              /* 촬영된 사람 0명 → 빈 풀스크린 */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-5xl mb-4">📭</span>
                  <p className="text-white/70 text-base font-medium text-center">
                    아직 아무도 촬영하지 않았어요
                  </p>
                  <button
                    onClick={() => setMode("record")}
                    className="mt-6 h-11 px-6 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    촬영하러 가기
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── 2열 x 5행 그리드 (화면 전체, z-[1]) ── */}
                <div className="absolute inset-0 w-full h-full grid grid-cols-2 grid-rows-5 gap-[1px] z-[1]">
                  {members.map((m) => {
                    const blobUrl = recordings[timeSlot][m.id];
                    return blobUrl ? (
                      <video
                        key={m.id}
                        src={blobUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        key={m.id}
                        className="w-full h-full bg-[#2a2a2a] flex items-center justify-center"
                      >
                        <span className="text-[#555] text-[11px] font-medium">
                          {m.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ── 상단 헤더 오버레이 (z-[3], 상단 1/6 높이) ── */}
                <div
                  className="absolute top-0 left-0 right-0 z-[3] pointer-events-none"
                  style={{
                    height: "16.666%",
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
                    paddingTop: "60px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                    paddingBottom: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <p className="text-[14px] font-medium text-white/85">
                    {schoolInfo}
                  </p>
                  <p className="text-[32px] font-extrabold text-white leading-tight mt-1">
                    {yearsAfter}년 후 🕐
                  </p>
                </div>

                {/* ── 하단 출첵 카운트 오버레이 (z-[3]) ── */}
                <div
                  className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
                    paddingTop: "16px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                    paddingBottom: "60px",
                  }}
                >
                  <p className="text-[15px] font-semibold text-white/60">
                    🌅 1분단 · 오늘 {timeSlot} {recordedCount}/{members.length}명
                  </p>
                  {/* TODO: 실시간 출첵 집계 (Firestore 연동) */}
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
                      className="flex-1 h-11 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setRecordedBlobUrl(null);
                        startRecording();
                      }}
                      className="flex-1 h-11 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-sm font-medium active:scale-[0.98] transition-transform"
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
                className="w-full h-11 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-sm font-medium active:scale-[0.98] transition-transform"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

// TODO: [S4] 교실(방) 페이지
// - 감정 배지 상호 확인 시에만 공개 로직
// - DM 실제 기능 (지금은 alert 임시)

type Emotion = "heart" | "meet" | "notalk" | null;

interface Seat {
  name: string;
  online: boolean;
  emoji: string;
  emotion: Emotion;
}

interface ChalkMessage {
  id: string;
  author: string;
  text: string;
  createdAt: Timestamp | null;
}

interface AlbumPhoto {
  id: string;
  imageUrl: string;
  uploaderName: string;
  createdAt: Timestamp | null;
}

const NAMES = [
  "김민준", "이서연", "박도윤", "최지우", "정하은",
  "강시우", "윤아름", "임태양", "한지민", "오세훈",
  "신세경", "유재석", "이광수", "전소민", "송지효",
  "김종국", "하하", "양세찬", "조세호", "안은진",
  "박보검", "아이유", "차은우", "수지", "남주혁",
  "김태리", "변우석", "고윤정", "이도현", "로운",
  "김혜윤", "최현욱", "설인아", "김영광", "정채연",
  "이준기", "문채원", "서강준", "김세정", "박형식",
];

const EMOJIS = [
  "😎", "🥰", "😆", "🤓", "😴", "🙃", "😄", "😐",
  "🤩", "😏", "🥳", "🤗", "😇", "🤔", "😌", "😜",
  "🤪", "😈", "👻", "🎃", "🤡", "👽", "🤖", "🎅",
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🐯", "🦁", "🐮", "🦄", "🐧", "🐸", "🐙",
];

const EMOTIONS: (Emotion)[] = [
  "heart", "meet", null, "notalk", null,
  "heart", null, null, "meet", null,
  null, "notalk", "heart", null, null,
  "meet", null, null, "heart", "notalk",
  null, null, "meet", null, null,
  "heart", null, "notalk", null, null,
  null, "meet", null, "heart", null,
  "notalk", null, null, null, null,
];

function buildSeats(): Seat[] {
  return NAMES.map((name, i) => ({
    name,
    online: i % 2 === 0,
    emoji: EMOJIS[i % EMOJIS.length],
    emotion: EMOTIONS[i % EMOTIONS.length],
  }));
}

const emotionLabel: Record<NonNullable<Emotion>, string> = {
  heart: "❤️",
  meet: "🙋",
  notalk: "🙅",
};

const emotionName: Record<NonNullable<Emotion>, string> = {
  heart: "그리움 ❤️",
  meet: "보고 싶어요 🙋",
  notalk: "말 걸지 마요 🙅",
};

const ROOM_ID = "default-room"; // TODO: 실제 roomId로 교체

export default function RoomPage() {
  const router = useRouter();
  const { user, loading } = useAuthContext();
  const [seats] = useState<Seat[]>(buildSeats);
  const [mounted, setMounted] = useState(false);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<{ index: number; seat: Seat } | null>(null);
  const [messages, setMessages] = useState<ChalkMessage[]>([]);
  const [chalkInput, setChalkInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 앨범 상태
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<AlbumPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 로그인 안 됐으면 /login 으로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Firestore 실시간 구독 (방명록)
  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChalkMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          author: data.author ?? "익명",
          text: data.text ?? "",
          createdAt: data.createdAt ?? null,
        });
      });
      setMessages(msgs);
    });
    return unsubscribe;
  }, []);

  // Firestore 실시간 구독 (앨범)
  useEffect(() => {
    const albumRef = collection(db, "album");
    const q = query(albumRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AlbumPhoto[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          imageUrl: data.imageUrl ?? "",
          uploaderName: data.uploaderName ?? "익명",
          createdAt: data.createdAt ?? null,
        });
      });
      setPhotos(list);
    });
    return unsubscribe;
  }, []);

  // 새 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onlineCount = seats.filter((s) => s.online).length;

  const setMyEmotion = (emotion: Emotion) => {
    setShowEmotionPicker(false);
  };

  const handleSeatClick = (index: number, seat: Seat) => {
    if (!seat.name) return;
    setSelectedSeat({ index, seat });
  };

  const sendChalkMessage = async () => {
    const text = chalkInput.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const author = user?.nickname || "나";
      await addDoc(collection(db, "messages"), {
        author,
        text,
        createdAt: serverTimestamp(),
      });
      setChalkInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleChalkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChalkMessage();
    }
  };

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  // 사진 업로드
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 간단한 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("10MB 이하의 사진만 업로드 가능합니다.");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `rooms/${ROOM_ID}/album/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "album"), {
        imageUrl: downloadUrl,
        uploaderName: user.nickname || "익명",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("사진 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 로딩 중이거나 로그인 안 됐으면 빈 화면 (리다이렉트 전)
  if (!mounted || loading || !user) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col relative" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col relative">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 text-[#6b7684] text-sm"
        >
          ← 뒤로
        </button>

        {/* 헤더 */}
        <div className="px-5 pt-12 pb-4 border-b border-[#e5e8eb]">
          <h1 className="text-xl font-bold text-[#191f28]">3학년 5반</h1>
          <p className="text-sm text-[#6b7684] mt-0.5">○○고 · 2015년</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f3ff] text-[#1b64da] text-xs font-medium">
            <span>🟢</span>
            <span>🟢 40석 중 {onlineCount}명 착석</span>
          </div>
        </div>

        {/* 방명록 (구 칠판) */}
        <div className="px-5 pt-4 pb-2">
          <div className="border border-[#e5e8eb] rounded-xl px-4 py-3.5 bg-white">
            <p className="text-xs font-semibold text-[#6b7684] mb-2">📝 우리 반 한마디</p>

            {/* 메시지 영역 */}
            <div className="max-h-[120px] overflow-y-auto space-y-1.5 text-left">
              {messages.length === 0 && (
                <p className="text-[#8b95a1] text-xs text-center italic">
                  아직 아무 메시지가 없어요. 첫 마디를 남겨보세요!
                </p>
              )}
              {messages.map((msg) => (
                <p
                  key={msg.id}
                  className="text-sm leading-snug"
                  style={{
                    color: msg.author === user?.nickname || msg.author === "나" ? "#3182f6" : "#191f28",
                  }}
                >
                  <span className="font-semibold">{msg.author}</span>
                  <span className="opacity-40">: </span>
                  {msg.text}
                  {msg.createdAt && (
                    <span className="text-[10px] text-[#8b95a1] ml-1">{formatTime(msg.createdAt)}</span>
                  )}
                </p>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력창 */}
            <div className="mt-2.5 flex gap-2">
              <input
                value={chalkInput}
                onChange={(e) => setChalkInput(e.target.value)}
                onKeyDown={handleChalkKeyDown}
                placeholder="✏️ 한마디 남기기..."
                disabled={sending}
                className="flex-1 h-9 px-3 rounded-lg bg-[#f2f4f6] text-sm text-[#191f28] placeholder-[#8b95a1] outline-none focus:ring-2 focus:ring-[#3182f6] transition-all disabled:opacity-50"
              />
              <button
                onClick={sendChalkMessage}
                disabled={!chalkInput.trim() || sending}
                className="h-9 px-4 rounded-lg bg-[#3182f6] text-white text-sm font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {sending ? "..." : "전송"}
              </button>
            </div>
          </div>
        </div>

        {/* 📸 우리 반 앨범 */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#6b7684]">📸 우리 반 앨범</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 rounded-[7px] bg-[#3182f6] text-white text-xs font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {uploading ? "업로드 중..." : "사진 추가"}
            </button>
          </div>

          {photos.length === 0 && !uploading && (
            <p className="text-[#8b95a1] text-xs text-center italic py-6">
              아직 앨범에 사진이 없어요. 첫 추억을 올려보세요!
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="aspect-square rounded-xl overflow-hidden bg-[#f2f4f6] shadow-[0_1px_3px_rgba(25,31,40,0.04)] active:scale-[0.97] transition-transform"
              >
                <img
                  src={photo.imageUrl}
                  alt={`${photo.uploaderName}님이 올린 사진`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
            {uploading && (
              <div className="aspect-square rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#8b95a1] text-xs">
                업로드 중...
              </div>
            )}
          </div>
        </div>

        {/* 자리표 */}
        <div className="flex-1 px-5 py-3 overflow-y-auto">
          <p className="text-xs font-semibold text-[#6b7684] mb-3">— 우리 반 자리표 —</p>
          <div className="grid grid-cols-5 gap-2.5">
            {seats.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSeatClick(i, s)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-transform active:scale-95
                  ${s.name
                    ? "bg-white border border-[#e5e8eb] shadow-sm hover:shadow-md"
                    : "bg-[#f9fafb] border border-dashed border-[#e5e8eb]"}`}
              >
                {s.name ? (
                  <>
                    {s.emotion && (
                      <span className="absolute -top-1.5 -right-1.5 text-sm drop-shadow-sm">
                        {emotionLabel[s.emotion]}
                      </span>
                    )}
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-[#f2f4f6] flex items-center justify-center text-base">
                        {s.emoji}
                      </div>
                      {s.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00c896] border-2 border-white rounded-full" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#191f28] mt-1 font-medium leading-tight truncate max-w-full px-0.5">
                      {s.name}
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] text-[#8b95a1]">빈 자리</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-6 pt-2 space-y-2.5">
          {!showEmotionPicker ? (
            <button
              onClick={() => setShowEmotionPicker(true)}
              className="w-full h-11 rounded-lg bg-[#e8f3ff] text-[#1b64da] font-medium text-sm active:scale-[0.98] transition-transform"
            >
              💭 내 감정 표현하기
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMyEmotion("heart")} className="flex-1 h-11 rounded-lg bg-[#e8f3ff] text-lg active:scale-[0.98] transition-transform">❤️</button>
              <button onClick={() => setMyEmotion("meet")} className="flex-1 h-11 rounded-lg bg-[#e8f3ff] text-lg active:scale-[0.98] transition-transform">🙋</button>
              <button onClick={() => setMyEmotion("notalk")} className="flex-1 h-11 rounded-lg bg-[#e8f3ff] text-lg active:scale-[0.98] transition-transform">🙅</button>
              <button onClick={() => setMyEmotion(null)} className="flex-1 h-11 rounded-lg bg-[#f2f4f6] text-[#8b95a1] text-sm active:scale-[0.98] transition-transform">지우기</button>
            </div>
          )}
          <button
            onClick={() => router.push("/reels")}
            className="w-full h-12 rounded-lg bg-[#f04452] text-white font-medium text-base active:scale-[0.98] transition-transform shadow-sm"
          >
            🎬 미니 브이로그
          </button>
          <button
            onClick={() => router.push("/roomshot")}
            className="w-full h-12 rounded-lg bg-[#f2f4f6] text-[#191f28] font-medium text-base active:scale-[0.98] transition-transform shadow-sm"
          >
            📸 룸샷 - 우리 반이 기억하는 나
          </button>
          <button
            onClick={() => router.push("/create")}
            className="w-full h-12 rounded-lg bg-[#3182f6] text-white font-medium text-base active:scale-[0.98] transition-transform shadow-sm"
          >
            🎬 함께 콘텐츠 만들기
          </button>
        </div>
      </div>

      {/* 프로필 바텀시트 */}
      {selectedSeat && selectedSeat.seat.name && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedSeat(null)} />
          <div className="relative w-full max-w-[420px] bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 pt-5 pb-10">
            <div className="w-8 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-5" />
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-[#f2f4f6] flex items-center justify-center text-3xl shadow-inner">
                {selectedSeat.seat.emoji}
              </div>
              <h2 className="text-lg font-bold text-[#191f28] mt-3">{selectedSeat.seat.name}</h2>
              <p className="text-sm text-[#6b7684] mt-0.5">
                {selectedSeat.seat.online ? "🟢 등교 중" : "⚪ 하교"}
              </p>
              {selectedSeat.seat.emotion && (
                <span className="mt-2 px-3 py-1 rounded-full bg-[#e8f3ff] text-[#1b64da] text-sm font-medium">
                  {emotionLabel[selectedSeat.seat.emotion]} {emotionName[selectedSeat.seat.emotion]}
                </span>
              )}
            </div>
            <div className="mt-6 space-y-2.5">
              <button
                onClick={() => alert(`💬 ${selectedSeat.seat.name}님에게 DM 보내기 (실제 DM 기능은 다음 작업)`)}
                className="w-full h-11 rounded-lg bg-[#3182f6] text-white font-medium text-sm active:scale-[0.98] transition-transform"
              >
                💬 DM 보내기
              </button>
              <button onClick={() => setSelectedSeat(null)} className="w-full h-11 rounded-lg bg-[#f2f4f6] text-[#6b7684] font-medium text-sm active:scale-[0.98] transition-transform">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 빈 자리 바텀시트 */}
      {selectedSeat && !selectedSeat.seat.name && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedSeat(null)} />
          <div className="relative w-full max-w-[420px] bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 pt-5 pb-10">
            <div className="w-8 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-5" />
            <div className="flex flex-col items-center py-4">
              <span className="text-4xl">🪑</span>
              <p className="text-base font-bold text-[#191f28] mt-3">아직 아무도 안 왔어요</p>
              <p className="text-sm text-[#6b7684] mt-1">친구가 입장하면 이 자리에 표시됩니다</p>
            </div>
            <button onClick={() => setSelectedSeat(null)} className="w-full h-11 rounded-lg bg-[#f2f4f6] text-[#6b7684] font-medium text-sm active:scale-[0.98] transition-transform">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 사진 확대 모달 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.imageUrl}
              alt="앨범 사진"
              className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
            />
            <p className="text-white/70 text-xs text-center mt-2">
              {selectedPhoto.uploaderName}님이 올린 사진
            </p>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-[#6b7684] text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
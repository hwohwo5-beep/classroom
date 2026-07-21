"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import Header from "@/app/components/Header";

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
  tags: string[];
  createdAt: Timestamp | null;
}

interface PendingFile {
  file: File;
  previewUrl: string;
  tagInput: string;
}

interface ReelDoc {
  id: string;
  uid: string;
  videoUrl: string;
  memberName: string;
  timeSlot: string;
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

function RoomPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") || "default-room"; // URL 쿼리에서 roomId 가져오기
  const { user, loading, signInWithGoogle } = useAuthContext();
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

  // 복수 업로드: 선택된 파일들 (미리보기 + 태그 입력)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // 그때 vs 지금 모달
  const [showThenNowModal, setShowThenNowModal] = useState(false);

  // 그때 vs 지금: 직접 추가한 이름
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");

  // 그때 vs 지금: 현재 사용자가 이미 연결한 태그 이름들
  const [matchedNames, setMatchedNames] = useState<Set<string>>(new Set());

  // 3초 출석(reels) 구독
  const [reels, setReels] = useState<{id:string; uid:string; videoUrl:string; memberName:string}[]>([]);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const reelsRef = collection(db, "rooms", roomId, "reels");
    const q = query(reelsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: {id:string; uid:string; videoUrl:string; memberName:string}[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docs.push({
          id: docSnap.id,
          uid: data.uid ?? "",
          videoUrl: data.videoUrl ?? "",
          memberName: data.memberName ?? "",
        });
      });
      setReels(docs);
    });
    return unsubscribe;
  }, [user, roomId]);

  // 초대 링크
  const [inviteUrl, setInviteUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setInviteUrl(`${window.location.origin}/room?roomId=${roomId}`);
    }
  }, [roomId]);

  const handleInvite = async () => {
    const url = inviteUrl || `${window.location.origin}/room?roomId=${roomId}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "반클 - 다시 만나는 우리 반",
          text: "우리 반 다시 모이는 중! 너도 들어와 👋",
          url,
        });
      } catch {
        // 사용자가 공유를 취소했거나 에러 발생 - 무시
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        alert("초대 링크가 복사됐어요! 카톡에 붙여넣기 하세요 📋");
      } catch {
        alert(`초대 링크:\n${url}`);
      }
    } else {
      // clipboard도 없는 구형 환경
      prompt("초대 링크를 복사하세요 (Ctrl+C):", url);
    }
  };

  // 로그인 가드: 미로그인 시 /login 으로 리다이렉트하지 않고,
  // 이 페이지 안에서 로그인 유도 → 로그인 성공 시 같은 roomId로 자동 복귀
  useEffect(() => {
    setMounted(true);
  }, []);

  // Firestore 실시간 구독 (방명록) - 로그인된 사용자만 구독
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // Firestore 실시간 구독 (앨범) - 로그인된 사용자만 구독
  useEffect(() => {
    if (!user) return;
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
          tags: data.tags ?? [],
          createdAt: data.createdAt ?? null,
        });
      });
      setPhotos(list);
    });
    return unsubscribe;
  }, [user]);

  // Firestore 실시간 구독 (matches) - 현재 사용자가 연결한 태그 이름들
  useEffect(() => {
    if (!user) return;
    const matchesRef = collection(db, "matches");
    const q = query(matchesRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const names = new Set<string>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // 현재 roomId + 현재 uid인 것만 수집
        if (data.roomId === roomId && data.uid === user.uid) {
          if (data.tagName && typeof data.tagName === "string") {
            names.add(data.tagName.trim());
          }
        }
      });
      setMatchedNames(names);
    });
    return unsubscribe;
  }, [user, roomId]);

  // 새 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // cleanup pendingFiles preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    };
  }, [pendingFiles]);

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

  // ── 복수 사진 선택 → 미리보기 + 태그 입력 UI ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const newPending: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: 10MB 이하의 사진만 업로드 가능합니다.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      newPending.push({ file, previewUrl, tagInput: "" });
    }

    if (newPending.length > 0) {
      setPendingFiles((prev) => [...prev, ...newPending]);
    }

    // input 초기화 (같은 파일 다시 선택 가능하게)
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── pendingFiles 태그 입력 업데이트 ──
  const updateTagInput = (index: number, value: string) => {
    setPendingFiles((prev) =>
      prev.map((pf, i) => (i === index ? { ...pf, tagInput: value } : pf))
    );
  };

  // ── pendingFiles에서 특정 파일 제거 ──
  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ── pendingFiles 전체 업로드 ──
  const uploadPendingPhotos = async () => {
    if (pendingFiles.length === 0 || !user) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const pf of pendingFiles) {
      try {
        const fileName = `${Date.now()}_${pf.file.name}`;
        const storageRef = ref(storage, `rooms/${roomId}/album/${fileName}`);
        const snapshot = await uploadBytes(storageRef, pf.file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        // 태그 파싱: 쉼표로 split, trim, 빈 문자열 제거
        const tags = pf.tagInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        await addDoc(collection(db, "album"), {
          imageUrl: downloadUrl,
          uploaderName: user.nickname || "익명",
          tags,
          createdAt: serverTimestamp(),
        });

        successCount++;
      } catch (err) {
        console.error(`Upload failed for ${pf.file.name}:`, err);
        failCount++;
      }
    }

    // cleanup preview URLs
    pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    setPendingFiles([]);
    setUploading(false);

    if (failCount > 0) {
      alert(`${successCount}장 업로드 완료, ${failCount}장 실패했습니다.`);
    }
  };

  // ── 그때 vs 지금: photos 태그 + 직접 추가한 이름 합치기 (중복 제거) ──
  const allNames: string[] = (() => {
    const nameSet = new Set<string>();
    photos.forEach((photo) => {
      photo.tags.forEach((tag) => {
        if (tag.trim().length > 0) nameSet.add(tag.trim());
      });
    });
    extraNames.forEach((name) => {
      if (name.trim().length > 0) nameSet.add(name.trim());
    });
    return Array.from(nameSet).sort();
  })();

  // ── 그때 vs 지금: 이름 직접 추가 ──
  const handleAddName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (allNames.includes(trimmed)) {
      alert("이미 목록에 있어요");
      return;
    }
    setExtraNames((prev) => [...prev, trimmed]);
    setNameInput("");
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddName();
    }
  };

  // ── 그때 vs 지금: 이름 칩 클릭 (통일 핸들러) ──
  const handleSelectName = async (name: string) => {
    if (!user) return;

    // 이미 연결된 이름이면 막기
    if (matchedNames.has(name)) {
      alert("이미 연결하셨어요");
      return;
    }

    const confirmed = window.confirm(
      `정말 당신이 '${name}'인가요? 옛날 사진 속 나로 연결됩니다.`
    );
    if (!confirmed) return;

    try {
      const docId = `${roomId}_${user.uid}`;
      await setDoc(doc(collection(db, "matches"), docId), {
        tagName: name,
        uid: user.uid,
        nickname: user.nickname,
        roomId: roomId,
        createdAt: serverTimestamp(),
      });
      alert("연결 완료! 그때 vs 지금에서 확인할 수 있어요");
      setShowThenNowModal(false);
    } catch (err) {
      console.error("Failed to save match:", err);
      alert("연결에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // ===== 로그인 가드: 로딩 / 미로그인 / 로그인됨 분기 =====

  // 1. 아직 마운트 안 됐거나 auth 로딩 중 → Header 없음
  if (!mounted || loading) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex items-center justify-center">
          <p className="text-[#8b95a1] text-sm">불러오는 중...</p>
        </div>
      </main>
    );
  }

  // 2. 미로그인 → 로그인 유도 화면 (roomId 유지 → 로그인 후 자동 복귀) → Header 없음
  if (!user) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl mb-5">🏫</div>
          <h1 className="text-xl font-bold text-[#191f28] mb-2">
            친구가 초대한 우리 반이에요!
          </h1>
          <p className="text-sm text-[#6b7684] mb-8 leading-relaxed">
            로그인하고 들어오세요 👋
          </p>
          <button
            onClick={async () => {
              try {
                await signInWithGoogle();
                // 로그인 성공 시 user가 채워지면서
                // 같은 URL(roomId 유지)로 방 화면이 자동 렌더됨
              } catch (err) {
                console.error("Google sign-in failed:", err);
                alert("로그인에 실패했어요. 다시 시도해 주세요.");
              }
            }}
            className="w-full max-w-[280px] h-12 rounded-lg bg-[#f04452] text-white font-medium text-base active:scale-[0.98] transition-transform shadow-sm"
          >
            구글로 시작하기
          </button>
          <p className="text-[11px] text-[#8b95a1] mt-4">
            로그인하면 우리 반 친구들을 만날 수 있어요
          </p>
        </div>
      </main>
    );
  }

  // 3. 로그인됨 → 방 화면 (Header 있음)
  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col relative">
        {/* 공통 헤더 (sticky top-0 z-50, 뒤로가기 + 로고 + 프로필 메뉴 포함) */}
        <Header />

        {/* 방 정보 헤더 (Header 아래) */}
        <div className="px-5 pt-4 pb-4 border-b border-[#e5e8eb]">
          <h1 className="text-[28px] font-bold tracking-tight text-[#0A0A0A]">3학년 5반</h1>
          <p className="text-sm text-[#6b7684] mt-0.5">○○고 · 2015년</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0f0] text-[#f04452] text-xs font-medium">
            <span>🟢 40석 중 {onlineCount}명 착석</span>
          </div>

          {/* 친구 초대하기 */}
          <div className="mt-3 space-y-2">
            <button
              onClick={handleInvite}
              className="w-full h-10 rounded-[7px] bg-[#f2f4f6] text-[#191f28] text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
            >
              <span>📨</span> 친구 초대하기
            </button>
            {inviteUrl && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 h-8 px-2.5 rounded-[7px] bg-[#f9fafb] text-[11px] text-[#6b7684] border border-[#e5e8eb] outline-none select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(inviteUrl).then(() => {
                        alert("초대 링크가 복사됐어요! 📋");
                      }).catch(() => {});
                    }
                  }}
                  className="h-8 px-3 rounded-[7px] bg-[#f04452] text-white text-[11px] font-medium active:scale-[0.98] transition-transform shrink-0"
                >
                  복사
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 방명록 (구 칠판) */}
        <div className="px-5 pt-4 pb-2">
          <div className="border border-[#e5e8eb] rounded-xl px-4 py-3.5 bg-white">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8E8E8E] mb-1">GUESTBOOK</p>
            <h2 className="text-[24px] font-bold tracking-tight text-[#0A0A0A] mb-3">📝 우리 반 한마디</h2>

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
                    color: msg.author === user?.nickname || msg.author === "나" ? "#f04452" : "#191f28",
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
                className="flex-1 h-9 px-3 rounded-lg bg-[#f2f4f6] text-sm text-[#191f28] placeholder-[#8b95a1] outline-none focus:ring-2 focus:ring-[#f04452] transition-all disabled:opacity-50"
              />
              <button
                onClick={sendChalkMessage}
                disabled={!chalkInput.trim() || sending}
                className="h-9 px-4 rounded-lg bg-[#f04452] text-white text-sm font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {sending ? "..." : "전송"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 📷 룸샷 컨테이너 (우리 반 앨범 + 그때 vs 지금) ── */}
        <div className="px-5 pt-4 pb-2">
          <div className="border border-[#e5e8eb] rounded-xl bg-[#fbfbfb] px-4 py-4">
            {/* 룸샷 컨테이너 제목 */}
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8E8E8E] mb-1">ROOMSHOT</p>
            <h2 className="text-[24px] font-bold tracking-tight text-[#0A0A0A] mb-4">📷 룸샷</h2>

            {/* ── (1) 우리 반 앨범 ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[16px] font-semibold text-[#0A0A0A]">📸 우리 반 앨범</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-8 px-3 rounded-[7px] bg-[#f04452] text-white text-xs font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {uploading ? "업로드 중..." : "사진 추가"}
                </button>
              </div>

              {/* ── pendingFiles: 업로드 전 미리보기 + 태그 입력 ── */}
              {pendingFiles.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-medium text-[#6b7684]">
                    📋 업로드할 사진 ({pendingFiles.length}장)
                  </p>
                  {pendingFiles.map((pf, i) => (
                    <div
                      key={i}
                      className="flex gap-3 p-3 rounded-xl border border-[#e5e8eb] bg-[#f9fafb]"
                    >
                      {/* 썸네일 */}
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-[#f2f4f6]">
                        <img
                          src={pf.previewUrl}
                          alt={`사진 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* 태그 입력 + 제거 버튼 */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <input
                          value={pf.tagInput}
                          onChange={(e) => updateTagInput(i, e.target.value)}
                          placeholder="이 사진 속 친구 이름 (쉼표로 여러 명)"
                          disabled={uploading}
                          className="w-full h-8 px-2.5 rounded-[7px] bg-white text-xs text-[#191f28] placeholder-[#8b95a1] border border-[#e5e8eb] outline-none focus:ring-2 focus:ring-[#f04452] transition-all disabled:opacity-50"
                        />
                        <p className="text-[10px] text-[#8b95a1] truncate">
                          {pf.file.name} ({(pf.file.size / 1024 / 1024).toFixed(1)}MB)
                        </p>
                      </div>
                      <button
                        onClick={() => removePendingFile(i)}
                        disabled={uploading}
                        className="shrink-0 w-7 h-7 rounded-full bg-[#f2f4f6] text-[#8b95a1] text-xs flex items-center justify-center active:scale-[0.95] transition-transform disabled:opacity-50"
                        title="제거"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* 업로드 실행 버튼 */}
                  <button
                    onClick={uploadPendingPhotos}
                    disabled={uploading}
                    className="w-full h-10 rounded-[7px] bg-[#f04452] text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {uploading ? "업로드 중..." : `${pendingFiles.length}장 업로드하기`}
                  </button>
                </div>
              )}

              {photos.length === 0 && pendingFiles.length === 0 && !uploading && (
                <p className="text-[#8b95a1] text-xs text-center italic py-6">
                  아직 앨범에 사진이 없어요. 첫 추억을 올려보세요!
                </p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-square rounded-xl overflow-hidden bg-[#f2f4f6] shadow-[0_1px_3px_rgba(25,31,40,0.04)] active:scale-[0.97] transition-transform relative group"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`${photo.uploaderName}님이 올린 사진`}
                      className="w-full h-full object-cover"
                    />
                    {/* 태그 오버레이 (tags가 있을 때만) */}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-[9px] text-white/90 truncate leading-tight">
                          🏷️ {photo.tags.join(", ")}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
                {uploading && pendingFiles.length === 0 && (
                  <div className="aspect-square rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#8b95a1] text-xs">
                    업로드 중...
                  </div>
                )}
              </div>
            </div>

            {/* ── (2) 🕰️ 그때 vs 지금 ── */}
            <div className="mt-5 pt-4 border-t border-[#e5e8eb]">
              <p className="text-[16px] font-semibold text-[#0A0A0A] mb-1.5">🕰️ 그때 vs 지금</p>
              <p className="text-[11px] text-[#8b95a1] mb-3 leading-relaxed">
                옛날 단체사진 속 나를 찾아서, 지금 내 3초 출석과 연결해보세요
              </p>
              <button
                onClick={() => setShowThenNowModal(true)}
                className="w-full h-10 rounded-[7px] bg-[#f04452] text-white text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
              >
                <span>🔍</span> 내 옛날 사진에서 나 찾기
              </button>
            </div>
          </div>
        </div>

        {/* 3초 출석 스토리 트레이 (자리표 대체) */}
        <div className="flex-1 px-5 py-3 overflow-y-auto">
          {/* 섹션 제목 - /reels 스타일 */}
          <div className="px-6 pb-4">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8E8E8E] mb-2">
              ATTENDANCE
            </p>
            <h2 className="text-[28px] font-bold text-[#0A0A0A] leading-[1.15] tracking-tight">
              우리 반이 모였어요
            </h2>
          </div>

          {/* 가로 스크롤 트레이 */}
          <div className="flex gap-4 overflow-x-auto pb-4 px-6 scrollbar-hide -mx-6">
            {/* ➕ 나도 출석 버튼 (맨 앞) */}
            <button
              onClick={() => router.push(`/reels?roomId=${roomId}`)}
              className="flex-shrink-0 flex flex-col items-center gap-2 w-[72px]"
            >
              <div className="relative w-[72px] h-[72px] rounded-full border-2 border-dashed border-[#f04452] bg-[#F7F7F7] flex items-center justify-center active:scale-[0.98] transition-transform">
                <span className="text-[28px] text-[#f04452]">+</span>
              </div>
              <p className="text-[11px] text-[#8E8E8E] text-center truncate max-w-[72px]">
                나도 출석
              </p>
            </button>

            {/* 출석자 원형 썸네일들 */}
            {reels.map((reel) => (
              <button
                key={reel.id}
                onClick={() => setPlayingUrl(reel.videoUrl)}
                className="flex-shrink-0 flex flex-col items-center gap-2 w-[72px]"
              >
                <div className="relative w-[72px] h-[72px] rounded-full ring-2 ring-[#f04452] ring-offset-2 ring-offset-white overflow-hidden bg-[#F7F7F7]">
                  {reel.videoUrl ? (
                    <video
                      src={reel.videoUrl}
                      muted
                      playsInline
                      loop
                        className="w-full h-full object-cover object-[center_25%] rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#8E8E8E]">
                      <span className="text-2xl">🎬</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[#0A0A0A] text-center truncate max-w-[72px] font-medium">
                  {reel.memberName || "익명"}
                </p>
              </button>
            ))}

            {/* 출석자 0명일 때 안내 */}
            {reels.length === 0 && (
              <div className="flex-shrink-0 flex flex-col items-center gap-2 w-[72px] text-center text-[#8E8E8E]">
                <p className="text-[11px]">아직 출석한 친구가 없어요</p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-6 pt-2 space-y-2.5">
          {!showEmotionPicker ? (
            <button
              onClick={() => setShowEmotionPicker(true)}
              className="w-full h-11 rounded-lg bg-[#fff0f0] text-[#f04452] font-medium text-sm active:scale-[0.98] transition-transform"
            >
              💭 내 감정 표현하기
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMyEmotion("heart")} className="flex-1 h-11 rounded-lg bg-[#fff0f0] text-lg active:scale-[0.98] transition-transform">❤️</button>
              <button onClick={() => setMyEmotion("meet")} className="flex-1 h-11 rounded-lg bg-[#fff0f0] text-lg active:scale-[0.98] transition-transform">🙋</button>
              <button onClick={() => setMyEmotion("notalk")} className="flex-1 h-11 rounded-lg bg-[#fff0f0] text-lg active:scale-[0.98] transition-transform">🙅</button>
              <button onClick={() => setMyEmotion(null)} className="flex-1 h-11 rounded-lg bg-[#f2f4f6] text-[#8b95a1] text-sm active:scale-[0.98] transition-transform">지우기</button>
            </div>
          )}
          <button
            onClick={() => router.push(`/reels?roomId=${roomId}`)}
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
                <span className="mt-2 px-3 py-1 rounded-full bg-[#fff0f0] text-[#f04452] text-sm font-medium">
                  {emotionLabel[selectedSeat.seat.emotion]} {emotionName[selectedSeat.seat.emotion]}
                </span>
              )}
            </div>
            <div className="mt-6 space-y-2.5">
              <button
                onClick={() => alert(`💬 ${selectedSeat.seat.name}님에게 DM 보내기 (실제 DM 기능은 다음 작업)`)}
                className="w-full h-11 rounded-lg bg-[#f04452] text-white font-medium text-sm active:scale-[0.98] transition-transform"
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
            {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
              <p className="text-white/50 text-[11px] text-center mt-0.5">
                🏷️ {selectedPhoto.tags.join(", ")}
              </p>
            )}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-[#6b7684] text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 그때 vs 지금: 이름 선택 모달 ── */}
      {showThenNowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-[380px] mx-4 bg-white rounded-2xl shadow-2xl px-5 pt-5 pb-6">
            <h2 className="text-base font-bold text-[#191f28] text-center mb-1">
              옛날 사진 속 이름을 골라주세요
            </h2>
            <p className="text-[11px] text-[#8b95a1] text-center mb-4">
              태그된 친구들 중에서 나를 찾아보세요
            </p>

            {allNames.length === 0 ? (
              <p className="text-sm text-[#8b95a1] text-center py-6">
                아직 태그된 옛날 사진이 없어요
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[240px] overflow-y-auto mb-4">
                {allNames.map((name) => {
                  const isMatched = matchedNames.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => handleSelectName(name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-[0.95] transition-transform ${
                        isMatched
                          ? "bg-[#fff0f0] text-[#f04452] cursor-default"
                          : "bg-[#f2f4f6] text-[#191f28] hover:bg-[#fff0f0] hover:text-[#f04452]"
                      }`}
                    >
                      {name}
                      {isMatched && (
                        <span className="ml-1 text-[10px] text-[#00c896] font-semibold">
                          ✅ 연결됨
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── 직접 이름 추가 ── */}
            <div className="flex gap-2 mb-4">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="목록에 없으면 이름 직접 입력"
                className="flex-1 h-9 px-3 rounded-[7px] bg-[#f2f4f6] text-sm text-[#191f28] placeholder-[#8b95a1] border border-[#e5e8eb] outline-none focus:ring-2 focus:ring-[#f04452] transition-all"
              />
              <button
                onClick={handleAddName}
                className="h-9 px-4 rounded-[7px] bg-[#f04452] text-white text-sm font-medium active:scale-[0.98] transition-transform shrink-0"
              >
                추가
              </button>
            </div>

            <button
              onClick={() => setShowThenNowModal(false)}
              className="w-full h-10 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-sm font-medium active:scale-[0.98] transition-transform"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 3초 출석 영상 재생 모달 */}
      {playingUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setPlayingUrl(null)}
        >
          <div
            className="relative max-w-full max-h-[80vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={playingUrl}
              autoPlay
              controls
              playsInline
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setPlayingUrl(null)}
              className="absolute -top-10 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-[#6b7684] text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// useSearchParams는 Suspense 경계가 필요하므로 래핑
export default function RoomPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f9fafb] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex items-center justify-center">
          <p className="text-[#8b95a1] text-sm">불러오는 중...</p>
        </div>
      </main>
    }>
      <RoomPageInner />
    </Suspense>
  );
}
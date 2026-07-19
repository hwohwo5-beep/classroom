"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

// TODO:
// - 졸업연도 기반 D+N년 계산
// - 신고/제3자 처리
// - 트랜지션 릴스 영상

// ⚠️ 초상권 주의:
// - 친구는 pending 업로드까지만 가능
// - 공개는 반드시 본인 승인 (approved)
// - 본인은 언제든 삭제/숨김 가능

interface RoomShot {
  id: string;
  targetUserId: string;
  targetName: string;
  uploaderId: string;
  uploaderName: string;
  imageUrl: string;
  memory: string;
  status: "pending" | "approved" | "hidden";
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

const MEMORY_SUGGESTIONS = [
  "수학여행 가기 전날",
  "매점 앞에서 몰래 찍음",
  "축제 끝나고 다 같이 남아있던 날",
  "장난치다 찍힌 사진",
  "나만 처음 보는 사진일지도",
];

export default function RoomShotPage() {
  const router = useRouter();
  const { user, loading } = useAuthContext();

  const [tab, setTab] = useState<"mine" | "uploaded">("mine");
  const [roomShots, setRoomShots] = useState<RoomShot[]>([]);
  const [myUploads, setMyUploads] = useState<RoomShot[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [memoryText, setMemoryText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 직접 추가한 이름
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");

  // NAMES + extraNames 합치기 (중복 제거)
  const allNames = Array.from(new Set([...NAMES, ...extraNames]));

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

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "roomshots"),
      where("targetUserId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: RoomShot[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          targetUserId: data.targetUserId,
          targetName: data.targetName,
          uploaderId: data.uploaderId,
          uploaderName: data.uploaderName,
          imageUrl: data.imageUrl,
          memory: data.memory,
          status: data.status,
          createdAt: data.createdAt ?? null,
        });
      });
      setRoomShots(list);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "roomshots"),
      where("uploaderId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: RoomShot[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          targetUserId: data.targetUserId,
          targetName: data.targetName,
          uploaderId: data.uploaderId,
          uploaderName: data.uploaderName,
          imageUrl: data.imageUrl,
          memory: data.memory,
          status: data.status,
          createdAt: data.createdAt ?? null,
        });
      });
      setMyUploads(list);
    });
    return unsubscribe;
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("10MB 이하의 사진만 업로드 가능합니다.");
      return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!user || !uploadFile || !selectedTarget) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop() || "jpg";
      const fileName = `${user.uid}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, `roomshots/${selectedTarget}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      const imageUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "roomshots"), {
        targetUserId: selectedTarget,
        targetName: selectedTarget,
        uploaderId: user.uid,
        uploaderName: user.nickname || "익명",
        imageUrl,
        memory: memoryText,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setUploadSuccess(`${selectedTarget}에게 사진을 보냈어요! 상대가 확인하면 공개돼요`);
      setUploadFile(null);
      setUploadPreview(null);
      setSelectedTarget("");
      setMemoryText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload failed:", err);
      alert("업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "roomshots", id), { status: "approved" });
    } catch (err) {
      console.error("Approve failed:", err);
    }
  };

  const handleHide = async (id: string) => {
    try {
      await updateDoc(doc(db, "roomshots", id), { status: "hidden" });
    } catch (err) {
      console.error("Hide failed:", err);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col" />
      </main>
    );
  }

  const approvedShots = roomShots.filter((s) => s.status === "approved");
  const pendingShots = roomShots.filter((s) => s.status === "pending");
  const hasAnyShots = roomShots.length > 0;

  return (
    <main className="min-h-screen bg-[#f9fafb] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white flex flex-col">
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-[#e5e8eb]">
          <button onClick={() => router.back()} className="text-[#6b7684] text-sm">
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-[#191f28]">📸 룸샷</h1>
        </div>

        {!hasAnyShots && !showUpload ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <span className="text-5xl mb-4">🕐</span>
            <h2 className="text-lg font-bold text-[#191f28] text-center">
              아직 우리 반 사진이 없어요
            </h2>
            <p className="text-sm text-[#6b7684] text-center mt-2 leading-relaxed">
              내가 몰랐던 내 사진을
              <br />
              친구들이 가지고 있을지도 몰라요
            </p>
            <p className="text-xs text-[#8b95a1] text-center mt-6 mb-8 leading-relaxed">
              친구들이 가지고 있는 옛날 사진을
              <br />
              내 이름에 모아보세요
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base active:scale-[0.98] transition-transform duration-96"
            >
              내 사진 모으기
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="w-full h-12 rounded-[7px] text-[#6b7684] font-medium text-sm mt-2 active:scale-[0.98] transition-transform"
            >
              우리 반 사진 올리기
            </button>
          </div>
        ) : showUpload ? (
          /* 사진 올리기 플로우 */
          <div className="flex-1 flex flex-col px-5 pt-4 pb-6">
            <h2 className="text-lg font-bold text-[#191f28] mb-4">📸 사진 올리기</h2>

            {uploadSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">✅</span>
                <p className="text-sm text-[#191f28] font-medium text-center">{uploadSuccess}</p>
                <button
                  onClick={() => {
                    setUploadSuccess(null);
                    setShowUpload(false);
                  }}
                  className="mt-6 h-11 px-6 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                {/* a) 사진 선택 */}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-[#191f28] mb-2">사진 선택</p>
                  <label
                    className={`block w-full aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      uploadPreview
                        ? "border-transparent bg-[#f2f4f6]"
                        : "border-[#e5e8eb] bg-[#f9fafb]"
                    }`}
                  >
                    {uploadPreview ? (
                      <img
                        src={uploadPreview}
                        alt="미리보기"
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <>
                        <span className="text-3xl">📷</span>
                        <p className="text-xs text-[#6b7684] mt-2">사진을 선택해주세요</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* b) 주인공 선택 */}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-[#191f28] mb-2">
                    이 사진 속 주인공을 선택해주세요
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSelectedTarget(name)}
                        className={`px-3 h-9 rounded-full text-xs font-medium transition-all active:scale-[0.98] ${
                          selectedTarget === name
                            ? "bg-[#3182f6] text-white"
                            : "bg-[#f2f4f6] text-[#333d4b]"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>

                  {/* 직접 이름 추가 */}
                  <div className="flex gap-2 mt-3">
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
                      + 추가
                    </button>
                  </div>
                </div>

                {/* c) "이때 뭐였지?" */}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-[#191f28] mb-2">이때 뭐였지?</p>
                  <input
                    value={memoryText}
                    onChange={(e) => setMemoryText(e.target.value)}
                    placeholder="한 줄 기억을 남겨주세요..."
                    className="w-full h-11 px-4 rounded-[7px] bg-[#f2f4f6] text-sm text-[#191f28] placeholder-[#8b95a1] outline-none focus:ring-2 focus:ring-[#3182f6] transition-all"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {MEMORY_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setMemoryText(suggestion)}
                        className="px-2.5 h-7 rounded-full bg-[#e8f3ff] text-[#1b64da] text-[11px] font-medium active:scale-[0.98] transition-transform"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* d) 보내기 */}
                <div className="mt-auto space-y-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadFile || !selectedTarget}
                    className="w-full h-14 rounded-[7px] bg-[#3182f6] text-white font-medium text-base disabled:opacity-40 active:scale-[0.98] transition-transform duration-96"
                  >
                    {uploading ? "업로드 중..." : "사진 보내기"}
                  </button>
                  <button
                    onClick={() => {
                      setShowUpload(false);
                      setUploadFile(null);
                      setUploadPreview(null);
                      setSelectedTarget("");
                      setMemoryText("");
                    }}
                    className="w-full h-12 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] font-medium text-sm active:scale-[0.98] transition-transform"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* 룸샷 메인 (탭 + 콘텐츠) */
          <div className="flex-1 flex flex-col">
            {/* 탭 */}
            <div className="flex border-b border-[#e5e8eb]">
              <button
                onClick={() => setTab("mine")}
                className={`flex-1 h-11 text-sm font-medium transition-colors ${
                  tab === "mine"
                    ? "text-[#3182f6] border-b-2 border-[#3182f6]"
                    : "text-[#6b7684]"
                }`}
              >
                나를 기억하는 사진
              </button>
              <button
                onClick={() => setTab("uploaded")}
                className={`flex-1 h-11 text-sm font-medium transition-colors ${
                  tab === "uploaded"
                    ? "text-[#3182f6] border-b-2 border-[#3182f6]"
                    : "text-[#6b7684]"
                }`}
              >
                내가 올린 사진
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
              {tab === "mine" ? (
                <>
                  {/* Pending 알림 */}
                  {pendingShots.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[#6b7684] mb-2">
                        🔔 친구가 찾아준 사진이 도착했어요
                      </p>
                      <div className="space-y-3">
                        {pendingShots.map((shot) => (
                          <div
                            key={shot.id}
                            className="rounded-xl bg-[#e8f3ff] border border-[#c8d9f0] p-4"
                          >
                            <div className="flex gap-3">
                              <img
                                src={shot.imageUrl}
                                alt="받은 사진"
                                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#191f28]">
                                  올린 사람: {shot.uploaderName}
                                </p>
                                {shot.memory && (
                                  <p className="text-xs text-[#6b7684] mt-1 line-clamp-2">
                                    &ldquo;{shot.memory}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleApprove(shot.id)}
                                className="flex-1 h-9 rounded-[7px] bg-[#3182f6] text-white text-xs font-medium active:scale-[0.98] transition-transform"
                              >
                                공개하기
                              </button>
                              <button
                                onClick={() => handleHide(shot.id)}
                                className="flex-1 h-9 rounded-[7px] bg-[#f2f4f6] text-[#6b7684] text-xs font-medium active:scale-[0.98] transition-transform"
                              >
                                숨기기
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved 사진 목록 */}
                  {approvedShots.length === 0 && pendingShots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <span className="text-3xl mb-3">🕐</span>
                      <p className="text-sm text-[#6b7684] text-center">
                        아직 사진이 없어요.
                        <br />
                        친구들이 가진 사진을 받아보세요
                      </p>
                    </div>
                  ) : approvedShots.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-[#6b7684] mb-3">
                        📸 친구가 찾아준 사진
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {approvedShots.map((shot) => (
                          <div
                            key={shot.id}
                            className="rounded-xl border border-[#e5e8eb] bg-white overflow-hidden"
                          >
                            <img
                              src={shot.imageUrl}
                              alt="룸샷 사진"
                              className="w-full aspect-square object-cover"
                            />
                            <div className="p-3">
                              <p className="text-[11px] font-semibold text-[#3182f6]">
                                📸 친구가 찾아준 사진
                              </p>
                              <p className="text-[11px] text-[#6b7684] mt-1 line-clamp-2">
                                2015 ○○고 3-5 · {shot.memory || "추억"}
                              </p>
                              <p className="text-[10px] text-[#8b95a1] mt-1">
                                올린 사람: {shot.uploaderName}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                /* 내가 올린 사진 탭 */
                <>
                  {myUploads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <span className="text-3xl mb-3">📷</span>
                      <p className="text-sm text-[#6b7684] text-center">
                        아직 올린 사진이 없어요.
                        <br />
                        친구의 옛날 사진을 찾아주세요
                      </p>
                      <button
                        onClick={() => setShowUpload(true)}
                        className="mt-4 h-11 px-6 rounded-[7px] bg-[#3182f6] text-white text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        사진 올리기
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {myUploads.map((shot) => (
                        <div
                          key={shot.id}
                          className="rounded-xl border border-[#e5e8eb] bg-white overflow-hidden"
                        >
                          <img
                            src={shot.imageUrl}
                            alt="내가 올린 사진"
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-3">
                            <p className="text-[11px] font-semibold text-[#191f28]">
                              {shot.targetName}
                            </p>
                            <p className="text-[11px] text-[#6b7684] mt-1 line-clamp-2">
                              {shot.memory || "추억"}
                            </p>
                            <p
                              className={`text-[10px] mt-1 font-medium ${
                                shot.status === "approved"
                                  ? "text-[#00c896]"
                                  : shot.status === "pending"
                                    ? "text-[#1b64da]"
                                    : "text-[#8b95a1]"
                              }`}
                            >
                              {shot.status === "approved"
                                ? "✅ 공개됨"
                                : shot.status === "pending"
                                  ? "⏳ 대기 중"
                                  : "🚫 숨김"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={() => setShowUpload(true)}
                className="w-full h-12 rounded-[7px] bg-[#3182f6] text-white font-medium text-base active:scale-[0.98] transition-transform duration-96"
              >
                📸 사진 올리기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
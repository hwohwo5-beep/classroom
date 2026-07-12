// TODO: 실제 데이터 연동 시 Firebase/Firestore 스키마와 맞춰 확정

export interface User {
  uid: string;
  nickname: string;
  photoURL: string;
  provider: "kakao" | "google";
}

export interface School {
  schoolId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Room {
  roomId: string;
  schoolId: string;
  year: number;
  grade: number;
  classNo: number;
}

export interface Member {
  roomId: string;
  uid: string;
  joinedAt: number; // timestamp
  lastActive: number; // timestamp
}

export type Visibility = "room" | "public";

export interface Content {
  contentId: string;
  roomId: string;
  creatorId: string;
  mediaUrl: string;
  templateType: "then-vs-now" | "group-shot";
  visibility: Visibility;
  createdAt: number; // timestamp
}

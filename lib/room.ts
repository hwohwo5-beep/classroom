// TODO: 방(Room) 관련 Firestore CRUD 연동

import type { Room, Member, Content } from "@/types";

export async function createRoom(
  schoolId: string,
  year: number,
  grade: number,
  classNo: number
): Promise<Room> {
  // TODO: Firestore에 새 Room 문서 생성
  throw new Error("createRoom not implemented yet");
}

export async function joinRoom(
  roomId: string,
  uid: string
): Promise<Member> {
  // TODO: Firestore에 Member 문서 추가
  throw new Error("joinRoom not implemented yet");
}

export async function getRoomMembers(roomId: string): Promise<Member[]> {
  // TODO: Firestore에서 roomId에 속한 Member 목록 조회
  throw new Error("getRoomMembers not implemented yet");
}

export async function addContent(
  roomId: string,
  creatorId: string,
  mediaUrl: string,
  templateType: Content["templateType"]
): Promise<Content> {
  // TODO: Firestore에 Content 문서 추가
  throw new Error("addContent not implemented yet");
}

export async function getRoomContents(roomId: string): Promise<Content[]> {
  // TODO: Firestore에서 roomId에 속한 Content 목록 조회
  throw new Error("getRoomContents not implemented yet");
}
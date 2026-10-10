import {
  addDoc, collection, doc, getDoc, increment, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, limit, type Timestamp,
} from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

export type PersonInfo = { username: string; displayName: string; avatarUrl: string | null };
export type Conversation = {
  id: string;
  participants: string[];
  participantInfo: Record<string, PersonInfo>;
  lastMessage?: string;
  lastAt?: Timestamp;
  unread?: Record<string, number>;
  typing?: Record<string, Timestamp | null>;
};
export type Message = {
  id: string;
  senderId: string;
  text?: string;
  videoShareId?: string;
  videoRowId?: string;
  createdAt?: Timestamp;
};

export const conversationId = (a: string, b: string) => [a, b].sort().join("_");

export async function ensureConversation(me: string, meInfo: PersonInfo, other: string, otherInfo: PersonInfo) {
  const id = conversationId(me, other);
  const ref = doc(db(), "conversations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [me, other].sort(),
      participantInfo: { [me]: meInfo, [other]: otherInfo },
      lastMessage: "",
      lastAt: serverTimestamp(),
      unread: { [me]: 0, [other]: 0 },
    });
  } else {
    await updateDoc(ref, { [`participantInfo.${me}`]: meInfo, [`participantInfo.${other}`]: otherInfo });
  }
  return id;
}

export async function sendMessage(convo: Conversation, senderId: string, payload: { text?: string; videoShareId?: string; videoRowId?: string }) {
  const other = convo.participants.find((p) => p !== senderId) ?? senderId;
  await addDoc(collection(db(), "conversations", convo.id, "messages"), {
    senderId,
    text: payload.text ?? "",
    videoShareId: payload.videoShareId ?? null,
    videoRowId: payload.videoRowId ?? null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db(), "conversations", convo.id), {
    lastMessage: payload.videoShareId ? "🎥 Shared a video" : (payload.text ?? "").slice(0, 120),
    lastAt: serverTimestamp(),
    [`unread.${other}`]: increment(1),
    [`typing.${senderId}`]: null,
  });
}

export const markRead = (cid: string, me: string) =>
  updateDoc(doc(db(), "conversations", cid), { [`unread.${me}`]: 0 }).catch(() => {});

export const setTyping = (cid: string, me: string, on: boolean) =>
  updateDoc(doc(db(), "conversations", cid), { [`typing.${me}`]: on ? serverTimestamp() : null }).catch(() => {});

export function listenConversations(me: string, cb: (c: Conversation[]) => void) {
  if (!firebaseReady) { cb([]); return () => {}; }
  const q = query(collection(db(), "conversations"), where("participants", "array-contains", me));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversation, "id">) }));
    list.sort((a, b) => (b.lastAt?.toMillis() ?? 0) - (a.lastAt?.toMillis() ?? 0));
    cb(list);
  }, (e) => { console.error(e); cb([]); });
}

export function listenMessages(cid: string, cb: (m: Message[]) => void) {
  const q = query(collection(db(), "conversations", cid, "messages"), orderBy("createdAt", "asc"), limit(300));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }))));
}

export function formatChatTime(ts?: Timestamp) {
  if (!ts) return "";
  const d = ts.toDate();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 2) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString();
}

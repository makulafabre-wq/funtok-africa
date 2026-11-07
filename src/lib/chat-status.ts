export type ChatPresence = { lastSeenAt: string | null; onlineUntil: string | null };

export function isChatOnline(presence: ChatPresence | undefined, now = Date.now()) {
  return !!presence?.onlineUntil && new Date(presence.onlineUntil).getTime() > now;
}

export function isChatTyping(timestamp: string | null | undefined, now = Date.now()) {
  if (!timestamp) return false;
  const age = now - new Date(timestamp).getTime();
  return age >= 0 && age < 6000;
}

export function chatStatus(presence: ChatPresence | undefined, typing: boolean, now = Date.now()) {
  if (typing) return "typing…";
  if (isChatOnline(presence, now)) return "online";
  if (!presence?.lastSeenAt) return "";
  const seen = new Date(presence.lastSeenAt);
  if (!Number.isFinite(seen.getTime())) return "";
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = seen.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (seen.toDateString() === today.toDateString()) return `last seen today at ${time}`;
  if (seen.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${seen.toLocaleDateString()} at ${time}`;
}